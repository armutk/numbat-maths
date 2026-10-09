#!/usr/bin/env bash
# Run the drag fuzz suite with one process per module (parallel). Usage: tests/fuzz-all.sh chromium|webkit [extra drag-fuzz args]
# Needs the static server on 127.0.0.1:8124. webkit runs inside docker via tests/run-webkit.sh.
set -u
ENGINE=${1:-chromium}; shift || true
cd "$(dirname "$0")/.."
LOGDIR=${LOGDIR:-/tmp/drag-fuzz-$ENGINE}; mkdir -p "$LOGDIR"; rm -f "$LOGDIR"/*.log
MODS=(sharing.two sharing.groups groups.pairs groups.fives numbers.build numbers.order addsub.maketen)
RUN=(node); [ "$ENGINE" = webkit ] && RUN=(tests/run-webkit.sh)
PAR=${PAR:-$([ "$ENGINE" = webkit ] && echo 3 || echo 7)}
export ENGINE LOGDIR; export RUNSTR="${RUN[*]}"
printf '%s\n' "${MODS[@]}" | xargs -P "$PAR" -I{} bash -c '$RUNSTR tests/drag-fuzz.mjs --engine=$ENGINE --modules={} '"$*"' > "$LOGDIR/{}.log" 2>&1'
rc=0; grep -qE "^FAIL" "$LOGDIR"/*.log && rc=1
echo "engine	orient	module	scenarios...	resets"
cat "$LOGDIR"/*.log | awk -F'\t' '$1 ~ /^(chromium|webkit)$/ && NF > 5' | sort -k3,3 -k2,2
cat "$LOGDIR"/*.log | grep -E "^FAIL" | cut -c1-240
[ $rc -eq 0 ] && echo "ALL PASS ($ENGINE)" || echo "FAILED ($ENGINE)"
exit $rc
