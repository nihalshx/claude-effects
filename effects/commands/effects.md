---
description: Apply a video effect to your clip (carousel-spin, match-cut, glass-graph, phone-fan, led-sign, type-behind, or all)
argument-hint: "<effect|all> <path/to/clip.mp4> [options]"
---

Use the `effects` skill to apply a video effect to the user's clip.

Request: $ARGUMENTS

If the effect name or the clip path is missing, ask for it (show the six effects with one line each). Collect only the options the chosen effect uses, run the pipeline from the skill, check one frame of the result, and reply with the output path.
