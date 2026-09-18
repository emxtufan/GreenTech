#!/usr/bin/env bash
# Deploys the latest main on the server without touching the live databases.
#
#   cd /var/www/greentech && bash deploy/update.sh
#
# storage/ (JSON content, translations, uploads) is not tracked by Git any
# more. The first run after that change still finds the old tracked copies in
# the checkout, possibly edited from the admin panel: they are archived, kept
# out of the pull's way, then put back byte for byte. Later runs find
# storage/ untracked and the copy round-trip is a harmless no-op.
set -euo pipefail

cd "$(dirname "$0")/.."

keep=""
if [ -d storage ]; then
  backup="/root/greentech-storage-$(date +%Y%m%d-%H%M%S).tar.gz"
  echo "Archiving live storage/ to $backup"
  tar -czf "$backup" storage

  keep="$(mktemp -d)"
  cp -a storage/. "$keep"/
  # Drop local edits to still-tracked storage files so the pull can proceed;
  # the live bytes are safe in $keep.
  git checkout --quiet -- storage 2>/dev/null || true
fi

git fetch origin main
git pull --ff-only origin main

if [ -n "$keep" ]; then
  mkdir -p storage
  cp -a "$keep"/. storage/
  rm -rf "$keep"
  echo "Live storage/ restored."
fi

npm ci --omit=dev
pm2 restart GreenTech --update-env

echo
echo "Deployed $(git log -1 --oneline)."
echo "To convert photos uploaded from the admin before WebP optimisation existed:"
echo "  npm run optimize:images -- --live"
