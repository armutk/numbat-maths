#!/usr/bin/env bash
# Commit and push to armutk/numbat-maths as "Omi" without the token touching this machine's config.
# Usage: tools/deploy.sh "commit message"
set -euo pipefail
cd "$(dirname "$0")/.."
MSG="${1:?commit message}"
git add -A
if git diff --cached --quiet; then echo "nothing to commit"; else
  git -c user.name="Omi" -c user.email="109920547+armutk@users.noreply.github.com" commit -q -m "$MSG" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
fi
GH_T=$(ssh -o BatchMode=yes hermes 'secrets get GITHUB_TOKEN_ARMUTK' 2>/dev/null)
[ -n "$GH_T" ] || { echo "no token"; exit 1; }
ASK=$(mktemp)
printf '#!/bin/sh\necho "%s"\n' "$GH_T" > "$ASK"; chmod 700 "$ASK"
GIT_ASKPASS="$ASK" git -c credential.helper= push -q https://armutk@github.com/armutk/numbat-maths.git HEAD:main
rm -f "$ASK"; unset GH_T
echo "pushed $(git rev-parse --short HEAD)"
