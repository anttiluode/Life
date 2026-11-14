#!/usr/bin/env python3
"""Generate a LIFE narrator pack with a LOCAL llama.cpp GGUF model. No server / API.
Works with the JSON export from the browser. Original life decisions are immutable.
The imported pack replaces only narrated text, never game state or probability.

Example (Windows):
  py tools/offline_narrator.py --input life-1234-age-45.json ^
     --model "D:\models\my-instruct.Q4_K_M.gguf" --cli "C:\llama.cpp\llama-cli.exe"

Requires a local llama-cli binary and a GGUF model already on disk.
"""
import argparse
import hashlib
import json
import re
import subprocess
from pathlib import Path


def clean_output(output: str) -> str:
    output = re.sub(r"\x1b\[[0-9;]*[A-Za-z]", "", output)
    for stop in ("<|eot_id|>", "<|end|>", "</s>", "[end]", "###"):
        output = output.split(stop, 1)[0]
    output = output.strip().strip('"').strip()
    return output[:2600]


def source_entries(archive: dict, limit: int, only_events: bool):
    if archive.get("format") != "LIFE-ARCHIVE-1":
        raise ValueError("Export a LIFE-ARCHIVE-1 file from the game first.")
    entries = archive.get("book")
    if not isinstance(entries, list):
        raise ValueError("The archive has no life-story chapters.")
    unique = {}
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        at = str(entry.get("at", ""))
        if not re.fullmatch(r"(year|event|end):[0-9]{2,3}(?::[a-z]+)?", at):
            continue
        if only_events and not at.startswith("event:"):
            continue
        unique[at] = entry
    return list(unique.values())[-limit:]


def make_prompt(entry, prior):
    age = int(entry.get("age", 0))
    title = str(entry.get("title", ""))[:160]
    facts = str(entry.get("body", ""))[:900]
    choice = str(entry.get("choice", ""))[:220]
    thread = " | ".join(prior[-3:])[:350]
    return (
        "You are a restrained literary narrator in a game about one life. "
        "Write one short atmospheric paragraph (35-80 words) in second person, "
        "present or past tense. Show what the moment feels like without judging "
        "the player's decision. Preserve all the facts exactly. Never invent "
        "a birth, death, diagnosis, marriage, job loss, child, real-world location "
        "or named person not already specified in the facts. If facts are sparse, "
        "describe a sensory detail, not an imagined event. No headings, explanations, "
        "markdown, quotation marks, or author notes. Output ONLY the passage.\n\n"
        f"AGE: {age}\nSCENE: {title}\nKNOWN FACTS: {facts}\n"
        f"ACTUAL PLAYER CHOICE/CONSEQUENCE: {choice or 'No decision recorded.'}\n"
        f"PREVIOUS MOTIFS: {thread or 'No previous motifs.'}\n\nPASSAGE:\n"
    )


def run_cli(binary: Path, model: Path, prompt: str, seed: int, gpu_layers: int, tokens: int):
    cmd = [
        str(binary), "-m", str(model), "-p", prompt,
        "-n", str(tokens), "--temp", "0.75", "-s", str(seed),
        "-ngl", str(gpu_layers), "--no-display-prompt",
        "--no-show-timings", "--color", "off", "--single-turn",
    ]
    try:
        done = subprocess.run(cmd, input="", capture_output=True, text=True,
                              encoding="utf-8", errors="replace", timeout=360)
    except FileNotFoundError as ex:
        raise RuntimeError(f"llama-cli binary not found: {binary}") from ex
    if done.returncode:
        raise RuntimeError(f"llama-cli failed (exit {done.returncode}): {done.stderr[-1400:]}")
    return clean_output(done.stdout)


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--input", type=Path, required=True, help="Downloaded LIFE JSON archive")
    p.add_argument("--model", type=Path, help="Existing local GGUF file")
    p.add_argument("--cli", type=Path, default=Path("llama-cli"), help="Local llama.cpp CLI executable")
    p.add_argument("--output", type=Path, default=Path("life-local-narration.json"))
    p.add_argument("--limit", type=int, default=8, help="Number of most recent chapters, max 200")
    p.add_argument("--only-events", action="store_true", help="Narrate only life choices")
    p.add_argument("--gpu-layers", type=int, default=60)
    p.add_argument("--tokens", type=int, default=160)
    p.add_argument("--dry-run", action="store_true", help="Validate archive/pack without a model")
    args = p.parse_args()
    archive = json.loads(args.input.read_text(encoding="utf-8"))
    chapters = source_entries(archive, max(1, min(200, args.limit)), args.only_events)
    if not chapters:
        raise SystemExit("No matching chapters in archive; play and export a life first.")
    if not args.dry_run and (not args.model or not args.model.is_file()):
        raise SystemExit("Give --model with a real GGUF model file already on your computer.")
    result = {"format": "LIFE-NARRATION-1", "stories": []}
    motifs = []
    for i, e in enumerate(chapters, 1):
        at = str(e["at"])
        digest = hashlib.sha256((str(archive["journal"]["seed"]) + at).encode()).digest()
        seed = int.from_bytes(digest[:4], "little") & 0x7FFFFFFF
        prompt = make_prompt(e, motifs)
        body = str(e.get("body", "")) if args.dry_run else run_cli(
            args.cli, args.model, prompt, seed, args.gpu_layers, args.tokens
        )
        if not body.strip():
            print(f"[{i}/{len(chapters)}] empty output for {at}; skipped")
            continue
        result["stories"].append({
            "at": at, "title": str(e.get("title", ""))[:150],
            "body": body[:2600],
            # Deliberately no scene override; the player can reroll scene locally.
        })
        motifs.append(str(e.get("title", ""))[:80])
        print(f"[{i}/{len(chapters)}] wrote {at}")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Saved {args.output} · {len(result['stories'])} chapters. Import from LIFE > Saves > Import.")


if __name__ == "__main__":
    main()
