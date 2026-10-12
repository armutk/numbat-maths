#!/usr/bin/env bash
# Render edge-tts candidates into clips/<name>/NN.mp3
set -u
ROOT="/home/impmaster/Work/kids-maths-app/tools/voice-judge"
EDGE="/home/impmaster/Work/voice-bakeoff/.venv/bin/edge-tts"

render() {
  local name="$1" voice="$2" extra="$3"
  mkdir -p "$ROOT/clips/$name"
  while IFS=$'\t' read -r id text; do
    mp3="$ROOT/clips/$name/$id.mp3"
    [ -s "$mp3" ] && continue
    # shellcheck disable=SC2086
    "$EDGE" --voice "$voice" $extra --text "$text" --write-media "$mp3" \
      && echo "ok $name/$id" || echo "FAIL $name/$id"
  done < "$ROOT/lines.tsv"
}

# tab-separated id<TAB>text for the shell loop
python3 - "$ROOT/lines.json" > "$ROOT/lines.tsv" <<'PY'
import json, sys
for ln in json.load(open(sys.argv[1]))["lines"]:
    print(f"{ln['id']}\t{ln['text']}")
PY

render "edge-Ana"        "en-US-AnaNeural"       ""
render "edge-Ana-pitch5" "en-US-AnaNeural"       "--pitch=+5Hz"
# newsreader baseline, kept only for contrast
render "edge-Natasha-news" "en-AU-NatashaNeural" "--rate=-10% --pitch=+15Hz"

# en-AU-KimberlyNeural not offered by this edge-tts build (checked --list-voices); skipped.
echo "done edge renders"
