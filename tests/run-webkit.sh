#!/usr/bin/env bash
# Run a Node test script inside the Playwright (noble) container so WebKit works on this Arch host.
# Usage: tests/run-webkit.sh tests/drag-fuzz.mjs --engine=webkit
# The static server must be running on the host (python3 -m http.server 8124); --network host reaches it.
exec docker run --rm --network host \
  -v /home/impmaster/Work/kids-maths-app:/work \
  -v /home/impmaster/.local/share/mise/installs/npm-playwright/1.63.0/node_modules:/pw \
  -w /work -e PW_PATH=/pw/playwright -e PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
  ${BASE:+-e BASE="$BASE"} \
  mcr.microsoft.com/playwright:v1.63.0-noble node "$@"
