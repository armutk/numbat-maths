#!/usr/bin/env python3
"""Complete Gemini TTS renders spread across TTS models (free tier = 10 req/day/model).
gemini-2.5-flash-preview-tts was exhausted (10/day), so remaining voices use other TTS
models, each with its own daily quota. Spacing + backoff for the pro model."""
import base64, json, os, subprocess, sys, time
import requests

ROOT = os.path.dirname(os.path.abspath(__file__))
KEY = open(os.environ.get("VOICE_BAKEOFF_GEM", "/home/impmaster/Work/voice-bakeoff/.gem")).read().strip()
STYLE = ("A bright, playful, warm young buddy talking to a 6-year-old girl learning maths. "
         "Gentle Australian accent, smiley, encouraging, like a fun older friend. "
         "Never over the top, no shouting, natural pace for a young child.")

# voice -> model used to finish its renders (per-model free-tier daily quota = 10/day).
# gemini-2.5-flash-preview-tts and gemini-2.5-pro-preview-tts are both exhausted today,
# so Kore (5/9) and Puck (4/9) stay partial; Aoede/Leda/Zephyr get full 9 lines each.
ASSIGN = [
    ("Aoede",  "gemini-3.1-flash-tts-preview"),
    ("Leda",   "gemini-3.8-flash-lite-tts"),
    ("Zephyr", "gemini-3.8-flash-tts"),
]
lines = json.load(open(f"{ROOT}/lines.json"))["lines"]

def render(voice, model, ln, sleep_s):
    outdir = f"{ROOT}/clips/gem-{voice}"
    os.makedirs(outdir, exist_ok=True)
    mp3 = f"{outdir}/{ln['id']}.mp3"
    if os.path.exists(mp3) and os.path.getsize(mp3) > 1000:
        return True
    prompt = f"{STYLE}. Read the line exactly as written, nothing else: {ln['text']}"
    for attempt in range(6):
        r = requests.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={KEY}",
            json={"contents": [{"parts": [{"text": prompt}]}],
                  "generationConfig": {"responseModalities": ["AUDIO"],
                      "speechConfig": {"voiceConfig": {"prebuiltVoiceConfig": {"voiceName": voice}}}}},
            timeout=120)
        if r.status_code == 200:
            pcm = base64.b64decode(r.json()["candidates"][0]["content"]["parts"][0]["inlineData"]["data"])
            raw = f"{outdir}/{ln['id']}.pcm"
            open(raw, "wb").write(pcm)
            subprocess.run(["ffmpeg", "-y", "-loglevel", "error",
                            "-f", "s16le", "-ar", "24000", "-ac", "1", "-i", raw,
                            "-ar", "44100", "-ac", "1", "-b:a", "128k", mp3], check=True)
            os.remove(raw)
            print(f"ok gem-{voice}/{ln['id']} via {model}", flush=True)
            return True
        wait = 45 if r.status_code == 429 else 5
        print(f"retry gem-{voice}/{ln['id']} {r.status_code} (sleep {wait})", flush=True)
        time.sleep(wait)
    print(f"FAIL gem-{voice}/{ln['id']}", flush=True)
    return False

only = sys.argv[1:] or None
for voice, model in ASSIGN:
    if only and voice not in only:
        continue
    for ln in lines:
        render(voice, model, ln, 0)
        time.sleep(3 if "pro" not in model else 20)  # pro is per-minute limited
print("done")
