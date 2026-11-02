# /effects for Claude: 1 clip, 6 edits

Six video effects you can put on your own talking-head clip just by asking Claude. Give it a clip; it cuts you out of the background, builds the effect around or behind you, and exports an MP4 with your original audio.

| Effect | What you get |
|---|---|
| `carousel-spin` | Your other reels spin in a 3D carousel behind you |
| `match-cut` | A wall of your own words scrolls behind you, key words boxed in red |
| `glass-graph` | Frosted-glass stats over your clip: render counter, progress ring, live voice bars |
| `phone-fan` | Four phones fan out behind you, each playing a different reel |
| `led-sign` | A glowing LED sign behind you ("ONE CLIP / ZERO APPS" or your own words) |
| `type-behind` | One giant word behind you on a bold color |

Works with landscape and vertical clips.

---

## 1. What you need (one time)

- **Claude Code**, in the terminal or the Claude desktop app
- **ffmpeg**: Mac `brew install ffmpeg` · Windows `winget install ffmpeg` · Linux `sudo apt install ffmpeg`
- **Node.js 18+**: https://nodejs.org
- **Python 3.9+**: https://python.org (Macs and most Linux machines already have it)

Everything else installs automatically the first time you run it.

## 2. Install (two commands)

Open Claude Code and run:

```
/plugin marketplace add nihalshx/claude-effects
/plugin install effects@nihal-effects
```

Restart Claude Code. Done.

**To get updates later:** run `/plugin marketplace update nihal-effects`.

## 3. Use it

Type `/effects`, the effect, and your clip:

```
/effects phone-fan ~/Videos/my-clip.mp4
/effects led-sign ~/Videos/my-clip.mp4 with the words "BUILT|WITH CLAUDE"
/effects all ~/Videos/my-clip.mp4
```

Or ask in plain words: *"Put the carousel-spin effect on my-clip.mp4 and use the reels in my Reels folder."*

Claude asks for anything it needs, runs the edit and tells you where the finished MP4 is (next to your clip, named like `my-clip_phone-fan.mp4`).

### Make it look like yours

- **Your own reels on the carousel and phones:** put a few of your other videos or thumbnails in one folder and tell Claude to use it ("use the b-roll in ~/Videos/reels").
- **Your words for match-cut:** paste your script, or let Claude transcribe the clip.
- **Custom text:** the LED sign lines, the phone-fan title, and the type-behind word and color can all be changed. Just ask.

### Tips for the best result

- 5–20 seconds of you talking to camera, one person in frame, good light.
- A background that isn't the same color as your hair or clothes gives a cleaner cutout.
- The first run downloads the cutout model (~170 MB) and takes longer. After that, a 10-second clip takes a few minutes per effect on a laptop.

---

## Other ways to install

**Downloaded the ZIP instead?** Click the green **Code** button on this page → **Download ZIP**, unzip it, then in Claude Code:

```
/plugin marketplace add /full/path/to/the/unzipped/folder
/plugin install effects@nihal-effects
```

**Run it without Claude:**

```
python3 effects/skills/effects/scripts/effects.py --check
python3 effects/skills/effects/scripts/effects.py --input my-clip.mp4 --effect all
```

Run `python3 effects/skills/effects/scripts/effects.py --help` for every option.

---

Fonts: Inter and Source Serif 4, SIL Open Font License (see `effects/skills/effects/engine/fonts/`). Person cutout: rembg (u2net_human_seg), downloaded on first use.
