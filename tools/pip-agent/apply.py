#!/usr/bin/env python3
"""Create or update the Pip tutor agent on ElevenLabs Conversational AI from the files in this folder.

Usage (on a machine that has the key):  ELEVENLABS_API_KEY=... python3 apply.py [--dry]
Writes agent-id.json next to this file. Idempotent: tools are matched by name, the agent by the id file.
Never prints the key.
"""
import json, os, sys, urllib.request, urllib.error, pathlib

HERE = pathlib.Path(__file__).resolve().parent
KEY = os.environ.get("ELEVENLABS_API_KEY")
if not KEY:
    sys.exit("ELEVENLABS_API_KEY missing")
DRY = "--dry" in sys.argv
BASE = "https://api.elevenlabs.io"
H = {"xi-api-key": KEY, "Content-Type": "application/json"}

VOICE_ID = "5GZaeOOG7yqLdoTRsaa6"          # Sally - Kind Australian Voice (library voice, added to the workspace)
TTS_MODEL = "eleven_v4_turbo"
LLM = (sys.argv[sys.argv.index("--llm") + 1] if "--llm" in sys.argv else "claude-sonnet-5-5")
GUARDRAILS = "on" in [a.split("=")[1] for a in sys.argv if a.startswith("--guardrails=")]  # default off: blocking guardrails measured +2 s per turn
BACKUP_LLMS = ["gemini-3.8-flash", "gpt-5.4-mini"]
AGENT_NAME = "Pip — Numbat Maths tutor (Arisha)"
ALLOWED_HOSTS = ["armutk.github.io", "127.0.0.1", "localhost"]
MAX_SESSION_SECONDS = 900


def call(method, path, body=None):
    req = urllib.request.Request(BASE + path, data=json.dumps(body).encode() if body is not None else None, headers=H, method=method)
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            raw = r.read()
            return r.status, (json.loads(raw) if raw else {})
    except urllib.error.HTTPError as e:
        raw = e.read()
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, {"raw": raw[:500].decode(errors="replace")}


def tool_config(t):
    cfg = {
        "type": "client",
        "name": t["name"],
        "description": t["description"],
        "parameters": t["parameters"],
        "expects_response": bool(t.get("expects_response", False)),
        "response_timeout_secs": int(t.get("response_timeout_secs", 20)),
        "execution_mode": t.get("execution_mode", "immediate"),
        "pre_tool_speech": t.get("pre_tool_speech", "auto"),
        "tool_error_handling_mode": "hide",
    }
    return cfg


def sync_tools(tools):
    status, existing = call("GET", "/v1/convai/tools?page_size=100")
    if status != 200:
        sys.exit(f"list tools failed: {status} {existing}")
    by_name = {}
    for t in existing.get("tools", []):
        cfg = t.get("tool_config", {})
        if cfg.get("type") == "client":
            by_name[cfg.get("name")] = t["id"]
    ids = []
    for t in tools:
        body = {"tool_config": tool_config(t)}
        if t["name"] in by_name:
            tid = by_name[t["name"]]
            if not DRY:
                s, r = call("PATCH", f"/v1/convai/tools/{tid}", body)
                if s != 200:
                    print("  tool update failed", t["name"], s, r)
            print(f"  tool {t['name']}: updated {tid}")
        else:
            if DRY:
                tid = "dry"
            else:
                s, r = call("POST", "/v1/convai/tools", body)
                if s not in (200, 201):
                    sys.exit(f"tool create failed {t['name']}: {s} {r}")
                tid = r["id"]
            print(f"  tool {t['name']}: created {tid}")
        ids.append(tid)
    return ids


def agent_body(tool_ids, prompt):
    body = _agent_body(tool_ids, prompt)
    if body["platform_settings"]["guardrails"] is None:
        off = {k: {"is_enabled": False, "threshold": "medium"} for k in ["harassment", "sexual", "violence", "self_harm", "profanity", "religion_or_politics", "medical_and_legal_information"]}
        body["platform_settings"]["guardrails"] = {"version": "1", "content": {"execution_mode": "blocking", "config": off}, "focus": {"is_enabled": True}, "prompt_injection": {"is_enabled": False}, "custom": {"config": {"configs": []}}}
    return body


def _agent_body(tool_ids, prompt):
    return {
        "name": AGENT_NAME,
        "tags": ["numbat-maths", "pip", "tutor"],
        "conversation_config": {
            "agent": {
                "first_message": "",
                "language": "en",
                "dynamic_variables": {
                    "dynamic_variable_placeholders": {
                        "child_name": "Arisha",
                        "learner_context": "No profile yet. Ask her what she likes.",
                        "session_mode": "lesson",
                        "today": "today",
                    }
                },
                "prompt": {
                    "prompt": prompt,
                    "llm": LLM,
                    "temperature": 0.6,
                    "max_tokens": 160,
                    "reasoning_effort": "low",
                    "tool_ids": tool_ids,
                    "backup_llm_config": {"preference": "override", "order": BACKUP_LLMS},
                    "cascade_timeout_seconds": 5,
                    "ignore_default_personality": True,
                    "timezone": "Australia/Melbourne",
                    "built_in_tools": {"end_call": None, "language_detection": None, "skip_turn": {"name": "skip_turn", "description": "", "type": "system", "params": {"system_tool_type": "skip_turn", "wait_timeout_secs": 12}}},
                },
            },
            "tts": {
                "voice_id": VOICE_ID,
                "model_id": TTS_MODEL,
                "stability": 0.5,
                "similarity_boost": 0.8,
                "speed": 0.97,
                "agent_output_audio_format": "pcm_24000",
                "text_normalisation_type": "system_prompt",
            },
            "asr": {"provider": "scribe_realtime", "quality": "high", "user_input_audio_format": "pcm_16000", "keywords": ["Pip", "numbat", "Tim Tam", "Tim Tams", "fair", "leftover", "share", "each", "Arisha"]},
            "turn": {
                "turn_timeout": 14,
                "turn_eagerness": "patient",
                "silence_end_call_timeout": 240,
                "mode": "turn",
                "soft_timeout_config": {"timeout_seconds": 4.0, "message": "Hmm...", "use_llm_generated_message": False, "disable_until_first_user_message": True},
            },
            "conversation": {
                "max_duration_seconds": MAX_SESSION_SECONDS,
                "text_only": False,
                "client_events": ["audio", "interruption", "user_transcript", "agent_response", "agent_response_correction", "client_tool_call", "ping", "conversation_initiation_metadata", "vad_score", "internal_turn_probability", "internal_tentative_agent_response"],
            },
        },
        "platform_settings": {
            "auth": {"enable_auth": False, "allowlist": [{"hostname": h} for h in ALLOWED_HOSTS], "require_origin_header": True},
            "privacy": {"record_voice": False, "retention_days": 1, "delete_audio": True, "delete_transcript_and_pii": False, "zero_retention_mode": False},
            "call_limits": {"agent_concurrency_limit": 2, "daily_limit": 14, "bursting_enabled": False},
            "trust_context": "low",
            "overrides": {"conversation_config_override": {"conversation": {"text_only": True}, "agent": {"first_message": True}}, "custom_llm_extra_body": False},
            "guardrails": None if not GUARDRAILS else {
                "version": "1",
                "content": {
                    "execution_mode": "blocking",
                    "config": {k: {"is_enabled": True, "threshold": "medium"} for k in ["harassment", "sexual", "violence", "self_harm", "profanity", "religion_or_politics"]},
                    "trigger_action": {"type": "retry", "feedback": "That reply was blocked because: '{{trigger_reason}}'. Say something kind and bring her back to the maths."},
                },
                "focus": {"is_enabled": True},
                "prompt_injection": {"is_enabled": False},
                "custom": {"config": {"configs": [{
                    "name": "No personal details",
                    "prompt": "Block any reply that asks the child for, or repeats, a surname, home address, school name, phone number, email, password, or asks her to keep a secret from her parents, or arranges to meet.",
                    "is_enabled": True,
                    "model": "gemini-3.1-flash-lite",
                    "execution_mode": "blocking",
                    "trigger_action": {"type": "retry", "feedback": "Do not ask for or repeat personal details. Say something kind and go back to the maths."},
                }]}},
            },
        },
    }


def main():
    tools = json.loads((HERE / "tools.json").read_text())
    prompt = (HERE / "prompt.md").read_text()
    print("syncing", len(tools), "client tools")
    tool_ids = sync_tools(tools)
    body = agent_body(tool_ids, prompt)
    idfile = HERE / "agent-id.json"
    agent_id = json.loads(idfile.read_text()).get("agent_id") if idfile.exists() else None
    if DRY:
        print(json.dumps(body, indent=1)[:3000]); return
    if agent_id:
        s, r = call("PATCH", f"/v1/convai/agents/{agent_id}", body)
        if s != 200:
            sys.exit(f"agent update failed: {s} {json.dumps(r)[:1500]}")
        print("agent updated", agent_id)
    else:
        s, r = call("POST", "/v1/convai/agents/create", body)
        if s not in (200, 201):
            sys.exit(f"agent create failed: {s} {json.dumps(r)[:1500]}")
        agent_id = r["agent_id"]
        idfile.write_text(json.dumps({"agent_id": agent_id, "voice_id": VOICE_ID, "llm": LLM, "tts_model": TTS_MODEL}, indent=1) + "\n")
        print("agent created", agent_id)
    s, r = call("GET", f"/v1/convai/agents/{agent_id}")
    cc = r.get("conversation_config", {}); ps = r.get("platform_settings", {})
    print("verify: llm", cc.get("agent", {}).get("prompt", {}).get("llm"), "| tts", cc.get("tts", {}).get("model_id"), cc.get("tts", {}).get("voice_id"),
          "| tools", len(cc.get("agent", {}).get("prompt", {}).get("tool_ids", [])), "| auth", ps.get("auth"), "| privacy", ps.get("privacy"), "| limits", ps.get("call_limits"),
          "| max_dur", cc.get("conversation", {}).get("max_duration_seconds"))


if __name__ == "__main__":
    main()
