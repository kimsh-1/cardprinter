# Installation

CardPrinter renders with a headless Chrome + a small Node/Python toolchain. Everything paths off the repo
root by default; a handful of external tools are pointed to via environment variables (with sane defaults).

## Requirements

| Tool | Why | Default |
|---|---|---|
| Node.js 20+ | copy contract, card render, charts, gates | — |
| Python 3.11+ | pixel-level gates (contrast/OCR), `rembg` cutouts | `$CARDSHORTS_PY`, defaults to `python3` |
| `chrome-headless-shell` | HTML → PNG / MP4 (via `puppeteer-core` / HyperFrames) | auto-downloaded by puppeteer |
| Fonts | bundled woff2 (OFL) | `assets/fonts/` (in-repo, nothing to install) |

## Setup

```bash
git clone https://github.com/kimsh-1/cardprinter
cd cardprinter

# 1. Node deps (includes echarts for charts + puppeteer-core for render)
cd scripts && npm install && cd ..

# 2. Python venv for gates + cutouts
python3 -m venv .venv
. .venv/bin/activate
pip install pillow numpy opencv-python-headless rembg onnxruntime pytesseract
export CARDSHORTS_PY="$PWD/.venv/bin/python"

# 3. (Linux headless only) if chrome-headless-shell is missing system libs,
#    point LD_LIBRARY_PATH at an extracted lib dir:
# export CARDSHORTS_CHROME_LIBS=/path/to/chrome-libs/usr/lib/x86_64-linux-gnu
```

## Environment variables

| Var | Meaning | Default |
|---|---|---|
| `CARDSHORTS_PY` | Python interpreter for gates/cutouts | `python3` |
| `CARDSHORTS_CHROME_LIBS` | extra `LD_LIBRARY_PATH` for headless Chrome libs | *(unset → system libs)* |
| `CARDSHORTS_ECHARTS` | path to an echarts build | `scripts/node_modules/echarts` |

## Smoke test

```bash
# render the bundled sample project end-to-end
bash scripts/pipeline.sh examples/sample draft
node scripts/gates/run_gates.mjs all examples/sample
```

## Notes

- **Charts** need `echarts` (installed by step 1). Set `CARDSHORTS_ECHARTS` only if you keep it elsewhere.
- **The G4 image-prompt gate** is optional: if the external prompt checker isn't present it is skipped, not
  failed — image generation still works.
- **TTS is off by default** (silent + kinetic captions). Wire HeyGen/ElevenLabs credentials to enable voice.
