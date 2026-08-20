#!/bin/bash
# SessionStart hook — makes a fresh cloud container able to do the three things
# this project's work always needs: run the asset pipeline, serve the game, and
# render it in a browser. Without it every session rediscovers the same gaps.
#
# Local machines are untouched: Mikael's checkout already has all of this, and a
# hook that reinstalls things there would be noise. Remote only.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  echo "session-start: local session, nothing to do"
  exit 0
fi

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
# Node deps live OUTSIDE the repo on purpose: "no build step, no framework" is
# the project's ethos, and a node_modules/ or package.json at the root would be
# the first crack in it. NODE_PATH is how tools/shot.js finds them.
DEV_CACHE="$HOME/.cache/mm-dev"

echo "session-start: python deps (pillow, numpy) for the asset pipeline"
# process_assets.py needs both; compress_backgrounds.py needs Pillow. Neither is
# in a base image. --quiet keeps the transcript readable; both are idempotent.
python3 -m pip install --quiet --disable-pip-version-check --root-user-action=ignore pillow numpy

echo "session-start: playwright for tools/shot.js"
mkdir -p "$DEV_CACHE"
# The BROWSER is already in the image ($PLAYWRIGHT_BROWSERS_PATH); this is only
# the driver library. Never run `playwright install` here — it would re-download
# a browser the image already has, and the npm package's pinned build number
# will not match it anyway (which is exactly why tools/shot.js always passes an
# explicit executablePath).
if [ ! -d "$DEV_CACHE/node_modules/playwright" ]; then
  npm install --prefix "$DEV_CACHE" --no-audit --no-fund --silent playwright
fi

if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  echo "export NODE_PATH=\"$DEV_CACHE/node_modules\"" >> "$CLAUDE_ENV_FILE"
  echo "export MM_CHROME=\"/opt/pw-browsers/chromium\"" >> "$CLAUDE_ENV_FILE"
fi

# The dev server. Best effort: if the sandbox reaps it, `python serve.py 5500`
# by hand is all it takes — tools/shot.js says so when it can't connect.
if ! curl -sf -o /dev/null --max-time 2 http://localhost:5500/index.html; then
  echo "session-start: starting serve.py on 5500"
  cd "$PROJECT_DIR"
  nohup python3 serve.py 5500 >/tmp/mm-serve.log 2>&1 &
  disown || true
  for _ in 1 2 3 4 5; do
    sleep 0.4
    curl -sf -o /dev/null --max-time 2 http://localhost:5500/index.html && break
  done
fi

if curl -sf -o /dev/null --max-time 2 http://localhost:5500/index.html; then
  echo "session-start: http://localhost:5500 is up"
else
  echo "session-start: server not up — run 'python serve.py 5500' when you need it"
fi

echo "session-start: done"
