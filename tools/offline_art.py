#!/usr/bin/env python3
"""Generate optional LIFE scenes completely offline using a model already on disk.

Windows example (RTX 3060 12GB):
  py tools/offline_art.py --model "D:\models\my-diffusers-model" --scenes home rain garden

Requires PyTorch, diffusers, Pillow, accelerate, and a compatible LOCAL text-to-image
pipeline/checkpoint. This script downloads nothing. Default is 640x512 at 22 steps.
It writes WebP files into art/ and updates art/manifest.js. Commit those files to
your Life repository for the GitHub Pages game to display them; without them LIFE
draws all its scenes locally in canvas instead.
"""
import argparse
import json
import os
from pathlib import Path

os.environ["HF_HUB_OFFLINE"] = "1"
os.environ["TRANSFORMERS_OFFLINE"] = "1"
os.environ["DIFFUSERS_OFFLINE"] = "1"

ROOT = Path(__file__).resolve().parents[1]
BASE = (
    "painterly atmospheric still frame for an intimate contemplative indie life "
    "simulation, textured oil and graphite on rough paper, nordic muted green and "
    "ochre palette, cinematic lighting, evocative space, delicate dust, chiaroscuro, "
    "no words, no lettering, no signs, no watermarks, no interface, no logos, "
    "no recognizable people, environment art, wide frame, "
)
SCENES = {
    "home": "an old warm kitchen window at dusk, two empty cups, soft golden light, the suggestion of a garden beyond",
    "rain": "raindrops tracking down a dark apartment window, blue hour outside, intimate melancholy, wet glass",
    "night": "a quiet room at four in the morning, pale moonlight touching a wooden floor, a distant streetlamp",
    "garden": "green vines climbing a rusted chain in an overgrown small garden, warm sunlight from the side",
    "city": "city rooftops and small illuminated windows in a misty autumn evening, muted colors",
    "train": "an empty seat by a train window, a distant countryside blurred with motion, early morning light",
    "studio": "a modest artist's corner with sketches, a worktable, an unfinished project and dust in sunbeams",
    "street": "a quiet street with an open cafe doorway and bicycles, a human-scale neighborhood at dusk",
    "evening": "a room with a single chair and an open door, a long late-summer shadow, possibility and uncertainty",
}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model", type=Path, required=True, help="Pre-existing local Diffusers model folder or supported single checkpoint")
    parser.add_argument("--scenes", nargs="*", choices=list(SCENES), default=list(SCENES))
    parser.add_argument("--width", type=int, default=640)
    parser.add_argument("--height", type=int, default=512)
    parser.add_argument("--steps", type=int, default=22)
    parser.add_argument("--seed", type=int, default=1105)
    parser.add_argument("--no-offload", action="store_true", help="Hold all model layers on GPU (needs more VRAM)")
    parser.add_argument("--output-dir", type=Path, default=ROOT / "art")
    args = parser.parse_args()
    if not args.model.exists():
        parser.error(f"Model must already exist locally: {args.model}")
    if args.width % 8 or args.height % 8:
        parser.error("Dimensions must be divisible by 8.")
    if args.width > 1536 or args.height > 1536 or args.width < 256 or args.height < 256:
        parser.error("Choose dimensions between 256 and 1536.")
    if not 1 <= args.steps <= 150:
        parser.error("Steps must be from 1 to 150.")
    import torch
    from diffusers import AutoPipelineForText2Image

    device = "cuda" if torch.cuda.is_available() else "cpu"
    dtype = torch.float16 if device == "cuda" else torch.float32
    print(f"Loading local model from {args.model} on {device}; no remote downloads")
    if args.model.is_file():
        # Some single-file pipelines require additional config files already cached.
        pipe = AutoPipelineForText2Image.from_single_file(
            str(args.model), torch_dtype=dtype, local_files_only=True
        )
    else:
        pipe = AutoPipelineForText2Image.from_pretrained(
            str(args.model), torch_dtype=dtype, local_files_only=True
        )
    if device == "cuda":
        if not args.no_offload:
            pipe.enable_model_cpu_offload()
        else:
            pipe.to("cuda")
    else:
        pipe.to("cpu")
        print("No CUDA device detected; local CPU rendering may be very slow.")
    try:
        pipe.enable_attention_slicing()
    except (AttributeError, ValueError):
        pass
    try:
        pipe.enable_vae_tiling()
    except (AttributeError, ValueError):
        pass
    output = args.output_dir.resolve()
    output.mkdir(parents=True, exist_ok=True)
    manifest_file = output / "manifest.js"
    manifest = {}
    if manifest_file.exists():
        import re
        text = manifest_file.read_text(encoding="utf-8")
        match = re.search(r"Object\.freeze\((\{.*?\})\)", text, flags=re.S)
        if match:
            try:
                manifest = json.loads(match.group(1))
            except ValueError:
                pass
    for ix, scene in enumerate(args.scenes):
        prompt = BASE + SCENES[scene]
        generator = torch.Generator(device="cpu").manual_seed(args.seed + ix * 101)
        print(f"Rendering {scene} ({ix + 1}/{len(args.scenes)})")
        image = pipe(prompt, height=args.height, width=args.width,
                     num_inference_steps=args.steps, generator=generator).images[0]
        name = scene + ".webp"
        image.save(output / name, "WEBP", quality=88, method=5)
        manifest[scene] = name
    manifest_file.write_text(
        "/* Generated locally by tools/offline_art.py; no runtime API requests. */\n"
        "window.LifeArtManifest = Object.freeze(" + json.dumps(manifest, indent=2) + ");\n",
        encoding="utf-8",
    )
    print(f"Saved {len(args.scenes)} image(s) and updated {manifest_file}")
    print("The game still runs without these files. No images are uploaded automatically.")


if __name__ == "__main__":
    main()
