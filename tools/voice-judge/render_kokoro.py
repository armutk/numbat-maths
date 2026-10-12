#!/usr/bin/env python3
"""Render Kokoro v1.0 candidates (af_heart, af_bella) -> clips/kokoro-<voice>/NN.mp3 (mono 44.1kHz)."""
import json, os, subprocess
from kokoro_onnx import Kokoro

ROOT = os.path.dirname(os.path.abspath(__file__))
KOKORO = "/home/impmaster/Work/voice-bakeoff/models/kokoro-v1.0.onnx"
VOICES = "/home/impmaster/Work/voice-bakeoff/models/voices-v1.0.bin"

kokoro = Kokoro(KOKORO, VOICES)
lines = json.load(open(f"{ROOT}/lines.json"))["lines"]

for voice in ("af_heart", "af_bella"):
    outdir = f"{ROOT}/clips/kokoro-{voice}"
    os.makedirs(outdir, exist_ok=True)
    for ln in lines:
        mp3 = f"{outdir}/{ln['id']}.mp3"
        if os.path.exists(mp3) and os.path.getsize(mp3) > 1000:
            continue
        try:
            samples, sr = kokoro.create(ln["text"], voice=voice, speed=0.95, lang="en-us")
        except Exception as e:
            print(f"FAIL kokoro-{voice}/{ln['id']}: {e}", flush=True)
            continue
        wav = f"{outdir}/{ln['id']}.wav"
        import wave
        w = wave.open(wav, "wb"); w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr)
        w.writeframes((samples * 32767).astype("int16").tobytes()); w.close()
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", wav,
                        "-ar", "44100", "-ac", "1", "-b:a", "128k", mp3], check=True)
        os.remove(wav)
        print(f"ok kokoro-{voice}/{ln['id']}", flush=True)
print("done kokoro renders")
