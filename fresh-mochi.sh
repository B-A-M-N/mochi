#!/usr/bin/env bash
# Fresh-user mochi launch — simulates brand-new user experience
# Usage: ./fresh-mochi.sh

set -euo pipefail

echo "🧹 Wiping mochi config/cache for fresh install simulation..."
rm -rf ~/.mochi ~/.config/mochi ~/.cache/mochi 2>/dev/null || true

echo "🚀 Launching mochi (first-run welcome screen will appear)..."
# Use the npm-installed binary if available, else local dist
if command -v mochi >/dev/null 2>&1; then
  exec mochi
elif [[ -f ./dist/cli.js ]]; then
  exec node ./dist/cli.js
elif [[ -f ./dist/mochi-bin ]]; then
  exec ./dist/mochi-bin
else
  echo "❌ No mochi binary found. Run: npm run build:bin  or  npm i -g @mochi/agent"
  exit 1
fi
