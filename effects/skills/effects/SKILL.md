---
name: effects
description: Apply one of six video effects to the user's own talking-head clip (carousel-spin, match-cut, glass-graph, phone-fan, led-sign, type-behind) and export an MP4 with their original audio. Use when the user types /effects, asks to edit a clip with one of these effects, or asks for "all six edits" of a video.
---

# effects

Turn one talking-head clip into six different edits. Each effect keeps the person in front and builds graphics around or behind them, using an automatic person cutout.

| Effect | What it does | Options |
|---|---|---|
| `carousel-spin` | The person stays in front of their own room; a 3D carousel of other reels/images spins in behind them and settles | `--broll DIR` |
| `match-cut` | A cream wall of their own words scrolls behind them; chosen words are boxed in red | `--words "script text"`, `--highlight "Claude,word"` |
| `glass-graph` | Frosted-glass stat cards over the clip: frames rendered, render progress ring, live voice-level bars (all real values) | none |
| `phone-fan` | Four phones fan out behind the person, each playing a different reel, plus a title box | `--broll DIR`, `--title "text"` |
| `led-sign` | A glowing LED dot-matrix sign behind the person, warm grade, flickers on | `--lines "LINE 1|LINE 2"` |
| `type-behind` | One giant word behind the person on a solid color; letters rise in | `--word WORD`, `--color "#hex"` |

## How to run it

The pipeline is one command. `<skill-dir>` is this skill's folder (the folder holding this SKILL.md).

```bash
python3 <skill-dir>/scripts/effects.py --input "/path/to/clip.mp4" --effect phone-fan
python3 <skill-dir>/scripts/effects.py --input "/path/to/clip.mp4" --effect all          # all six
python3 <skill-dir>/scripts/effects.py --check                                           # dependencies only
```

Output goes next to the input as `<name>_<effect>.mp4` unless `--out` is given (a file for one effect, a folder for several).

Other options: `--start S --duration D` (trim first), `--max-side PX` (default 1920), `--workers N` (default 3), `--quality CRF` (default 14; lower is higher quality).

## Steps to follow

1. **Get the clip.** Ask for the path if the user has not given one. Any length works, but 5–20 seconds of one person talking to camera gives the best result. Landscape and vertical both work; the output keeps the clip's shape.
2. **Pick the effect(s).** If the user named one (`/effects led-sign`), use it. If they said "all", use `all`. If unclear, show the table above and ask.
3. **Collect the options the effect uses, briefly:**
   - `match-cut` needs their words. If they have a script or transcript, pass it with `--words`. If not, transcribe the clip if you have a way to, or ask them to paste what they say.
   - `carousel-spin` and `phone-fan` look best with `--broll` pointing at a folder of their other reels (MP4) or images (PNG/JPG). Without it, the effect uses tinted copies of the clip itself.
   - `led-sign`, `phone-fan` and `type-behind` have text defaults ("ONE CLIP | ZERO APPS", "One clip. Six edits.", "EDIT"); offer to change them.
4. **Run `--check` first on a new machine.** It installs Playwright + Chromium and rembg if they are missing (one time). The first cutout run downloads the person-segmentation model (~170 MB) from GitHub.
5. **Run the effect.** Rendering takes roughly 2–4 seconds per second of video per effect, plus the one-time cutout (about 1–2 s per frame on a laptop CPU; cached for later effects on the same clip). Tell the user it is running and roughly how long.
6. **Check the result** by extracting a frame (`ffmpeg -ss 2 -i out.mp4 -frames:v 1 check.png`) and looking at it before reporting back. Then give the user the output path(s).

## Requirements

- `ffmpeg` and `ffprobe` on PATH
- Node.js 18+ (Playwright and Chromium are installed automatically into the engine folder)
- Python 3.9+ (rembg, onnxruntime, numpy and pillow are installed automatically)

## Notes

- The cutout works best with one person, clearly lit, against a background that is not the same color as their hair or clothes.
- Work files go in a hidden `.effects_work` folder next to the input; delete it after finishing to free disk space.
- Fonts (Inter, Source Serif 4) are bundled under the SIL Open Font License (see `engine/fonts/`).
