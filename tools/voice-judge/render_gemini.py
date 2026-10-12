#!/usr/bin/env python3
"""Render Gemini 2.5 Flash TTS candidates. Key read from VOICE_BAKEOFF_GEM or /home/impmaster/Work/voice-bakeoff/.gem (never printed)."""
import base64, json, os, subprocess, sys, time
import requests

ROOT = os.path.dirname(os.path.abspath(__file__))
GEM_KEY_PATH = os.environ.get("VOICE_BAKEOFF_GEM", "/home/impmaster/Work/voice-bakeoff/.gem")
MODEL = "gemini-2.5-flash-preview-tts"
STYLE = ("A bright, playful, warm young buddy talking to a 6-year-old girl learning maths. "
         "Gentle Australian accent, smiley, encouraging, like a fun older friend. "
         "Never over the top, no shouting, natural pace for a young child.")
VOICES = ["Kore", "Puck", "Leda", "Aoede", "Zephyr"]
KEY = open(GEM_KEY_PATH).read().strip()

lines = json.load(open(f"{ROOT}/lines.json"))["lines"]

for voice in VOICES:
    outdir = f"{ROOT}/clips/gem-{voice}"
    os.makedirs(outdir, exist_ok=True)
    for ln in lines:
        mp3 = f"{outdir}/{ln['id']}.mp3"
        if os.path.exists(mp3) and os.path.getsize(mp3) > 1000:
            continue
        prompt = f"{STYLE}. Read the line exactly as written, nothing else: {ln['text']}"
        r = requests.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent?key={KEY}",
            json={
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {
                    "responseModalities": ["AUDIO"],
                    "speechConfig": {"voiceConfig": {"prebuiltVoiceConfig": {"voiceName": voice}}},
                },
            },
            timeout=120,
        )
        if r.status_code != 200:
            print(f"FAIL gem-{voice}/{ln['id']}: {r.status_code} {r.text[:200]}", flush=True)
            continue
        pcm = base64.b64decode(r.json()["candidates"][0]["content"]["parts"][0]["inlineData"]["data"])
        raw = f"{outdir}/{ln['id']}.pcm"
        open(raw, "wb").write(pcm)
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error",
                        "-f", "s16le", "-ar", "24000", "-ac", "1", "-i", raw,
                        "-ar", "44100", "-ac", "1", "-b:a", "128k", mp3], check=True)
        os.remove(raw)
        print(f"ok gem-{voice}/{ln['id']} ({len(pcm)} pcm bytes)", flush=True)
        time.sleep(0.3)
print("done gemini renders")
