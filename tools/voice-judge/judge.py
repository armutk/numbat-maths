#!/usr/bin/env python3
"""Judge each (candidate, line) clip with gemini-3.8-flash (text+audio input).
Writes raw/<cand>__<NN>.json (raw model output) and scores.json."""
import base64, glob, json, os, time
import requests

ROOT = os.path.dirname(os.path.abspath(__file__))
KEY = open(os.environ.get("VOICE_BAKEOFF_GEM", "/home/impmaster/Work/voice-bakeoff/.gem")).read().strip()
# Free tier: 20 requests/day per model. Rotate through judge models; a model that
# returns 429 is marked dead for the run. gemini-3.8-flash is pre-dead (exhausted today).
MODEL_POOL = [
    "gemini-3.5-flash",
    "gemini-3.6-flash",
    "gemini-3.7-flash",
    "gemini-flash-latest",
    "gemini-2.5-flash-lite",
    "gemini-3.5-flash-lite",
    "gemini-3.1-flash-lite",
    "gemini-3.8-flash",  # exhausted, will be skipped on first 429
]
DEAD = set()
RUBRIC = open(f"{ROOT}/judge-prompt.md").read().split("# Voice judge prompt")[0]
RUBRIC = RUBRIC.strip() or open(f"{ROOT}/judge-prompt.md").read()

PROMPT = """You are a strict, expert audio judge for a children's maths app. The app is for a 6-year-old girl named Arisha, tutored by Pip the numbat. The target voice sounds like Khan Academy's kid tutor: a warm, playful FRIEND talking to a 6-year-old. It must NOT sound like a newsreader, a documentary narrator, or a robot.

You will hear ONE short clip. The intended transcript is:
"{text}"

Score these 5 criteria STRICTLY, 1 (terrible) to 10 (perfect). Reserve 9-10 for genuinely natural human-child-friend delivery; a competent synthetic voice that still sounds synthetic should sit at 5-7.

1. warmth: natural kid-friendly warmth - sounds friendly, smiling, kind.
2. friendliness: sounds like a friend/buddy talking to a child, NOT a teacher, newsreader, or audiobook narrator.
3. clarity: clear, easy pronunciation and pacing a 6-year-old can follow.
4. consistency: even tone and pacing across the whole line, no odd jumps.
5. artefacts: no robotic, buzzy, garbled or mispronounced artefacts (10 = completely clean).

Also answer two pronunciation checks (true/false; use null when the word is not in this line):
- arisha_ok: is "Arisha" pronounced correctly, ah-REE-shah?
- numbat_ok: is "numbat" pronounced correctly, NUM-bat?

Output STRICT JSON only, no markdown, no commentary:
{{"warmth": int, "friendliness": int, "clarity": int, "consistency": int, "artefacts": int, "arisha_ok": bool|null, "numbat_ok": bool|null, "notes": "max 15 words"}}"""

def quota_is_daily(resp):
    for det in resp.json().get("error", {}).get("details", []):
        for v in det.get("violations", []):
            if "PerMinute" not in v.get("quotaId", ""):
                return True
    return False

def judge_clip(clip, text):
    audio = base64.b64encode(open(clip, "rb").read()).decode()
    body = lambda model: {"contents": [{"parts": [
        {"text": PROMPT.format(text=text)},
        {"inlineData": {"mimeType": "audio/mp3", "data": audio}},
    ]}], "generationConfig": {"temperature": 0, "responseMimeType": "application/json"}}
    for model in MODEL_POOL:
        if model in DEAD:
            continue
        for rpm_retry in range(4):  # per-minute 429s: wait and retry same model
            r = requests.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={KEY}",
                json=body(model), timeout=180)
            if r.status_code != 429:
                break
            if quota_is_daily(r):
                DEAD.add(model)
                print(f"model {model} daily quota exhausted, rotating", flush=True)
                break
            print(f"model {model} rpm limit, sleeping 50s", flush=True)
            time.sleep(50)
        else:
            continue
        if model in DEAD:
            continue
        if r.status_code != 200:
            return {"error": f"{r.status_code}: {r.text[:300]}"}
        raw = r.json()["candidates"][0]["content"]["parts"][0]["text"]
        return {"raw": raw, "model": model}
    return {"error": "all judge models exhausted for today"}

lines = {ln["id"]: ln["text"] for ln in json.load(open(f"{ROOT}/lines.json"))["lines"]}
os.makedirs(f"{ROOT}/raw", exist_ok=True)

candidates = sorted(os.path.basename(d) for d in glob.glob(f"{ROOT}/clips/*") if os.path.isdir(d))
if len(os.sys.argv) > 1:
    candidates = [c for c in candidates if c in os.sys.argv[1:]]

scores = {}
if os.path.exists(f"{ROOT}/scores.json"):
    scores = json.load(open(f"{ROOT}/scores.json"))

for cand in candidates:
    scores.setdefault(cand, {})
    for mp3 in sorted(glob.glob(f"{ROOT}/clips/{cand}/*.mp3")):
        lid = os.path.splitext(os.path.basename(mp3))[0]
        if lid in scores[cand]:
            continue
        rawname = f"{cand}__{lid}"
        res = judge_clip(mp3, lines.get(lid, ""))
        with open(f"{ROOT}/raw/{rawname}.json", "w") as f:
            json.dump(res, f, indent=1)
        if "error" in res:
            print(f"ERR {rawname}: {res['error'][:120]}", flush=True)
            if "all judge models exhausted" in res["error"]:
                print("STOPPING: no judge quota left today", flush=True)
                break
            time.sleep(5)
            continue
        try:
            parsed = json.loads(res["raw"])
            scores[cand][lid] = parsed
            print(f"ok {rawname}: w{parsed.get('warmth')} f{parsed.get('friendliness')} "
                  f"c{parsed.get('clarity')} s{parsed.get('consistency')} a{parsed.get('artefacts')}", flush=True)
        except Exception as e:
            print(f"BADJSON {rawname}: {e}: {res['raw'][:120]}", flush=True)
        json.dump(scores, open(f"{ROOT}/scores.json", "w"), indent=1)
        time.sleep(1)
print("judging done")
