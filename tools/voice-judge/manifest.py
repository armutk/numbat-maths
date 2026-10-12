#!/usr/bin/env python3
"""Write manifest.json: candidate -> {line_id: {file, text, category}} for all rendered clips."""
import glob, json, os

ROOT = os.path.dirname(os.path.abspath(__file__))
lines = {ln["id"]: ln for ln in json.load(open(f"{ROOT}/lines.json"))["lines"]}
NOTES = {
    "gem-Kore": "gemini-2.5-flash-preview-tts; partial (5/9) - free-tier daily quota exhausted",
    "gem-Puck": "gemini-2.5-flash-preview-tts; partial (4/9) - free-tier daily quota exhausted",
    "gem-Aoede": "gemini-3.1-flash-tts-preview",
    "gem-Leda": "gemini-3.8-flash-lite-tts",
    "gem-Zephyr": "gemini-3.8-flash-tts",
    "edge-Ana": "edge-tts en-US-AnaNeural (default)",
    "edge-Ana-pitch5": "edge-tts en-US-AnaNeural pitch +5Hz",
    "edge-Natasha-news": "edge-tts en-AU-NatashaNeural rate -10% pitch +15Hz (newsreader baseline)",
    "kokoro-af_heart": "kokoro-onnx v1.0, af_heart, speed 0.95",
    "kokoro-af_bella": "kokoro-onnx v1.0, af_bella, speed 0.95",
}

manifest = {"style_prompt": ("A bright, playful, warm young buddy talking to a 6-year-old girl "
                             "learning maths. Gentle Australian accent, smiley, encouraging, like a "
                             "fun older friend. Never over the top, no shouting, natural pace for a "
                             "young child."),
            "judge_model": "gemini pool (multi-model rotation, free-tier daily caps)",
            "candidates": {}}
for d in sorted(glob.glob(f"{ROOT}/clips/*")):
    cand = os.path.basename(d)
    clips = {}
    for mp3 in sorted(glob.glob(f"{d}/*.mp3")):
        lid = os.path.splitext(os.path.basename(mp3))[0]
        clips[lid] = {"file": os.path.relpath(mp3, ROOT), "text": lines[lid]["text"],
                      "category": lines[lid]["cat"]}
    if clips:
        manifest["candidates"][cand] = {"note": NOTES.get(cand, ""), "clips": clips}
json.dump(manifest, open(f"{ROOT}/manifest.json", "w"), indent=1)
print({k: len(v["clips"]) for k, v in manifest["candidates"].items()})
