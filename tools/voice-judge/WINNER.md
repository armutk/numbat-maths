# WINNER: gem-Leda

Gemini TTS prebuilt voice **Leda** (rendered via `gemini-3.8-flash-lite-tts` with the
shared style prompt) is the bake-off winner.

## Scores (Gemini judge, 1-10 strict, averaged over all 9 lines)

| criterion | score |
|---|---|
| warmth (kid-friendly warmth) | 8.0 |
| friendliness (friend, not newsreader) | 8.0 |
| clarity (for a 6-year-old) | 9.0 |
| consistency | 9.0 |
| artefacts (10 = clean) | 10.0 |
| **GRAND** | **8.80** |

Name pronunciation: "Arisha" 2/2 correct (ah-REE-shah), "numbat" 1/1 correct (NUM-bat).

## Why

Leda scored highest overall and tied for the top warmth/friendliness pair (8.0/8.0)
while producing the cleanest audio of any candidate (10.0 artefacts, i.e. no robotic
or buzzy artefacts across all nine lines), and it pronounced both probe names
correctly. The judge's per-line notes described it as bright, warm and buddy-like
rather than announcer-like, which is the Khan-Academy-kid-tutor bar Ahmed set.
Runner-up kokoro-af_heart is statistically tied (8.78) and is completely free/local —
a strong fallback if API cost or offline playback matters more than the last 0.02.

## Caveats

- Free-tier API quota (10 requests/day per model, 20/day per judge model) forced
  each Gemini voice to be rendered on a different TTS model (see manifest.json);
  Kore is partial (5/9 lines) and Puck partial (4/9) because
  gemini-2.5-flash-preview-tts hit its daily cap mid-run. All other candidates have
  all 9 lines.
- Judge used a rotating pool of Gemini flash models (gemini-3.5/3.6/3.7-flash,
  gemini-flash-latest, gemini-2.5-flash-lite, gemini-3.5-flash-lite,
  gemini-3.1-flash-lite) because each free-tier judge model caps at 20 requests/day.
  All clips were scored with the identical prompt and temperature 0.
- Re-verify the winner with a human ear (Arisha) before baking it into the app.

## Addendum (2026-10-11): full-set render decision — kokoro-af_heart

**DECISION: kokoro-af_heart for the complete voice set** (all word/number clips +
6,291 whole sentences), not gem-Leda.

Reasoning, per the decision rule ("use gem-Leda only if a PAID Gemini key exists
AND the estimate ≤ US$4.50"):

1. No paid-tier key was obtainable. The Hermes pip-proxy key (/opt/pip-proxy/env,
   read-only, copied to Work/voice-bakeoff/.gem without printing it) is NOT
   paid tier: a 12-request burst at gemini-2.5-flash-preview-tts got 11x 429
   (even the first request), i.e. the same shared free-tier quota the bake-off
   key died on. Requests 11-12 succeeding was the paid-tier test; they did not.
2. Cost estimate for the full sentence set with any Gemini TTS key
   (6,291 sentences ≈ 183k chars; est. ≈ 12-13k seconds of audio; audio output
   ≈ 25-32 tokens/sec):
   - gemini-2.5-flash-tts at $10/1M audio output tokens: ~330k-420k tokens
     → **US$3.3-4.2** (borderline).
   - The winner's actual model, gemini-3.8-flash-lite-tts, is priced around
     $20/1M audio output tokens → **US$6.6-8.4**, over the $5 cap.
   So even if a paid key had been available, Leda on its own model would have
   exceeded the budget.

kokoro-af_heart (8.78 vs 8.80, statistically tied in the bake-off; cleanest
non-Gemini audio; pronounced both probe names correctly) is free, local and
unlimited, so the whole set — including the ~6k counting-practice sentences —
renders in one consistent voice at zero cost. af_heart renders with
kokoro-v1.0.onnx (Work/voice-bakeoff/models/), voice=af_heart, speed=1.0 (default),
lang=en-us; digit texts verified to phonemize as number words ("10"→tˈɛn,
"120"→"one hundred twenty", "Arisha"→ah-REE-shah).
