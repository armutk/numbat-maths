# Numbat Maths · Pip

Pip the numbat is Arisha's live maths tutor on the iPad. The screen is Pip's whiteboard: she builds sharing problems from Arisha's own world (Tim Tams for Mum and Dad), watches every move, asks one question at a time, and remembers what was tricky last time. Arisha can also hold real things up to the camera and share them out with Pip. After each session a short note for parents is saved (and sent to Ahmed's phone). Curriculum: Victorian Curriculum 2.0 Mathematics Level 1, this fortnight sharing equally (VC2M1N06), extension to 120.

Live at https://armutk.github.io/numbat-maths/ (offline-first PWA: Add to Home Screen in Safari).

## How it is built

| Piece | What it is |
| --- | --- |
| `js/tutor.js` | ElevenLabs Conversational AI session (agent config in `tools/pip-agent/`): voice in/out, client tools that drive the board, app events (`[APP] …` messages) for moves, Ask Pip, idle, camera, caps. |
| `js/board.js`, `css/board.css` | Pip's whiteboard: items, plates/groups with avatars, number line, 120 chart, ten frames, choices, keypad, highlight, demonstrate, celebrate. `tests/board-dev.html` exercises it standalone. |
| `js/camera.js` | Camera mode. JPEG snapshots (max 640 px) go to the Hermes proxy, which asks Gemini Flash to count objects; frames are never stored. |
| `js/memory.js`, `js/profile-config.js` | Learner profile (seed + what Pip learns), session history, parent summaries, daily/session caps. All on the device (`localStorage`). |
| `js/voice.js`, `assets/voice/` | Offline voice: 444 recorded clips of the same ElevenLabs voice, stitched gap-free on the Web Audio clock. No `speechSynthesis` anywhere. |
| `js/audio.js`, `assets/sfx/` | Web Audio engine (iOS unlock, voice/SFX buses, ducking) and a CC0 SFX set from Kenney.nl. |
| `js/drag.js` | One hardened touch drag engine for every screen (pointer capture, state machine, watchdog, spring/lift/snap feel). |
| `js/modules/*` | The original four islands, kept as "Practise on my own" (works offline). |
| Hermes `/opt/pip-proxy` | `https://hermes.redgumlab.au/pip/{health,see,summary}`. Gemini key stays on the server. Summaries go to Telegram only from the production origin, max one per 30 min. |

The agent: `tools/pip-agent/prompt.md` (persona + pedagogy), `tools/pip-agent/tools.json` (19 client tools), `tools/pip-agent/apply.py` (creates/updates the agent; run on Hermes with `ELEVENLABS_API_KEY=$(secrets get ELEVENLABS_API_KEY) python3 apply.py`). The agent is public but origin-locked to `armutk.github.io` (plus localhost for tests); no key ships in the site.

## Develop

Plain HTML, CSS and ES modules; no build step. `python3 -m http.server 8125` from the repo root, then open `http://127.0.0.1:8125/?dev` (`?dev` exposes `window.__numbat` and logs `[pip]` events; dev builds send parent summaries as dry runs).

Tests (Playwright; Chromium runs natively, WebKit runs through Docker with `tests/run-webkit.sh`):

- `tests/tutor-check.mjs` live agent wiring with a fake board (text-only session): connection, first response, tool calls, move reporting, Ask Pip.
- `tests/board-check.mjs` whiteboard API + touch drags + screenshots.
- `tests/drag-fuzz.mjs` adversarial touch fuzzing of every module (gate for deploys).
- `tests/touch-check.mjs`, `tests/audio-check.mjs`, `tests/voice-check.mjs`, `tests/play.mjs` (scripted practice quest).

Fonts: Fredoka and Nunito (SIL OFL), bundled. Illustrations are original SVG. SFX: Kenney.nl, CC0 (see `assets/sfx/LICENSE.txt`). ElevenLabs browser SDK vendored in `js/vendor/` (MIT).
