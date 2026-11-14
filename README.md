# LIFE — a story you spend 🌿

**A playable, atmospheric, offline-first life simulator.** Every relationship is a growing, resource-maintained branch. The game uses the original [LifeSucks](https://github.com/anttiluode/LifeSucks) life engine, built out of the Elävä Matriisi vine-economy research. This version adds an independent local narrative and image layer, preserving every decision, replayable saved lives, and optional spoken narration.

**Play when GitHub Pages is enabled:** https://anttiluode.github.io/Life/

> There isn't a winning life. There is only the one you live.

## The interesting part

You begin at 18. Each year you allocate a limited number of drops of attention to relationships, work, dreams, and yourself. Channels carry warmth, money, or costs. Old strong connections adapt more slowly than fresh ones. Neglected connections can naturally wither; a child, friend, job, dream, and retirement can reshape the vine. The original consequences remain: no generic moral score decides which kind of life is best.

**The narrator observes the simulation; it never changes its RNG.** You may retell the exact same moment with different prose and artwork without rerolling a child's birth, a friendship, or an illness.

## What works

- **Original life economy** copied from [LifeSucks/life.js](https://github.com/anttiluode/LifeSucks/blob/main/life.js), kept intact to preserve Claude's model and bot-balancing work.
- **Locally generated narration** (story.js): deterministic, conditional literary grammar. It uses actual age, health, warmth, relationships, and events. There is no hosted text model, API, paid service, or fabricated real user data.
- **Procedural environments** (scene.js): sky, windows, weather, city/garden rooms, atmosphere, and the growing relationship vine, generated in browser canvas. No image downloads required.
- **Optional true local AI writing and paintings:** scripts in tools/ run your existing offline models and create narration packs or image files. Model weights aren't bundled, downloaded, or required.
- **Offline speech:** only voices explicitly identified by the browser as local (SpeechSynthesisVoice.localService === true) can speak. Otherwise text narration continues.
- **Auto-save and three local save slots:** browser localStorage, no accounts or database. Download a complete life archive (.json) to transfer or back it up.
- **Rewind / replay:** rewind the previous completed year and choose differently. Same-seed replay gives the same starting world; a new seed rerolls possible events and people.
- **Two distinct rerolls:** Retell this moment changes narrative and ambience, NOT life outcomes. Reroll destiny starts a different seed.
- **Final portrait and epitaph:** generated locally as a PNG image and shareable text.
- **Small-screen UI**, no framework, no runtime imports and no hosted API requests.

### Saving a life precisely

The original model uses function closures for random state and event decisions. A naïve snapshot would lose them. journal.js saves **the original seed and exact sequence of decisions and allocations** and replays them against the model. This reconstructs the same life deterministically.

A downloaded archive includes the journal, story chronicle and optional narration-only overrides. Browser storage can be cleared, so **download the JSON** for durable backups.

A ?seed= link shares the same **starting world**, but not the actual choices. The downloadable JSON transfers the full played timeline.

## Running locally

Open index.html directly in Chrome or Edge. There are no module imports, bundles or build steps. Alternatively use a static server with: python -m http.server

Tests with local Node.js:

~~~shell
node tests/life.test.cjs
node tests/ui.test.cjs
~~~

These cover complete-life replay, epitaphs, rewind, JSON validation, narrative RNG isolation, generated scenes, and a simulated browser controller from 18 to death with saving and restoring. GitHub Actions runs them too.

## Genuine local AI, without any API

The game runs immediately using procedural stories and paintings. If you already have local models, generate higher-fidelity assets **on your own machine** and import them. GitHub Pages itself does not run a text or diffusion model.

### Local GGUF narrator

1. Play LIFE and choose **Saves → Download life file**.
2. Install [llama.cpp](https://github.com/ggml-org/llama.cpp) locally and have an instruct GGUF file already downloaded.
3. In Windows PowerShell, run (replace paths with yours):

~~~powershell
py tools/offline_narrator.py --input "life-1234-age-45.json" --model "D:\models\your-instruct.Q4_K_M.gguf" --cli "C:\llama.cpp\llama-cli.exe" --limit 8
~~~

4. The script writes life-local-narration.json. In LIFE choose **Saves → Import life file** and select it. The model-generated passages replace the text of those chapters only; game state and RNG remain untouched.

No HTTP server or paid service is required. The script will exit rather than downloading a model. **Local LLMs may invent details** despite the prompt; review narration before sharing. Each passage starts a fresh llama-cli process, so start with --limit 3 to save time.

### Local AI artwork

Install a suitable local PyTorch, Diffusers, accelerate and Pillow environment. With a compatible model folder **already present on disk**:

~~~powershell
py tools/offline_art.py --model "D:\models\local-diffusers-model" --scenes home rain night garden
~~~

On an RTX 3060 12GB, try the default 640×512 and 22 steps initially. The script sets offline flags and uses local-only loading, produces WebP images in art/, and updates art/manifest.js. Commit those generated assets to make them appear on the public site. **Nothing uploads automatically.** Without them, canvas scenes still work.

### Voice

Open Voice, select a voice explicitly marked local by your browser, then press Read aloud or choose automatic narration. If no verified local voice appears, LIFE avoids sending your story to an unknown remote speech service. The browser Web Speech API exposes the localService flag to distinguish local and remote voices: https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesisVoice/localService

## Files

- life.js — unchanged LifeSucks life simulation
- journal.js — deterministic replay, save, import validation, rewind
- story.js — contextual rule-based narrator (not an LLM)
- scene.js — local procedural artwork and living vine rendering
- app.js, index.html, style.css — game controls, mobile UI
- art/manifest.js — optional generated art mapping, empty by default
- tools/offline_narrator.py — optional true local GGUF narration
- tools/offline_art.py — optional true local image generation
- tests/ — headless life and UI tests
- .github/workflows/ — static Pages publishing and automated tests

## Honest boundaries

The default narrator is **algorithmic prose composition**, not a neural text generator. The default paintings are local browser code, not diffusion-generated images. Optional offline scripts provide actual local AI only if you already have model weights.

LifeSucks's game balance came from simulated players, not actual epidemiological data. Illness, parenting, loneliness and money are stylized fictional dynamics. The game should never suggest a solitary, child-free or artistic life has less value. Nor is a final money figure a verdict.

**Source credit:** Claude's [LifeSucks](https://github.com/anttiluode/LifeSucks), the [ElavaMatriisiClaude](https://github.com/anttiluode/ElavaMatriisiClaude) vine economy, and the independent Life presentation work in this repository.

**MIT license.**
