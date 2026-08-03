#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_USER="${RUN_USER:-www}"

cd "$ROOT_DIR"

if [[ ! -f package.json || ! -f server.js || ! -d dist ]]; then
  echo "Invalid production package: package.json, server.js or dist/ is missing." >&2
  exit 1
fi

if [[ ! -f .env ]]; then
  echo "Missing .env in $ROOT_DIR." >&2
  exit 1
fi

if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  echo "Install Node.js 24 LTS from aaPanel before running this script." >&2
  exit 1
fi

NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]")"
if (( NODE_MAJOR < 20 )); then
  echo "Node.js 20 or newer is required. Node.js 24 LTS is recommended." >&2
  exit 1
fi

echo "Installing production dependencies..."
npm ci --omit=dev

mkdir -p \
  storage/uploads/gallery \
  storage/uploads/blog \
  storage/uploads/sections \
  storage/uploads/video \
  storage/uploads/misc \
  storage/data/applications

# First install or migration from the previous layout: preserve existing live
# JSON, CVs and uploads without replacing anything already in storage/.
for filename in \
  site-content.json \
  customer-reviews.json \
  project-inquiries.json \
  career-applications.json \
  newsletter-subscribers.json; do
  if [[ -f "data/$filename" && ! -e "storage/data/$filename" ]]; then
    cp -p "data/$filename" "storage/data/$filename"
  fi
done

if [[ -d data/applications ]]; then
  cp --archive --no-clobber data/applications/. storage/data/applications/
fi

if [[ -d public/uploads ]]; then
  cp --archive --no-clobber public/uploads/. storage/uploads/
fi

if [[ "$(id -u)" == "0" ]] && id "$RUN_USER" >/dev/null 2>&1; then
  chown -R "$RUN_USER:$RUN_USER" "$ROOT_DIR"
fi

chmod 600 .env
chmod -R u+rwX,g+rwX,o-rwx storage

echo
echo "aaPanel PM2 settings:"
echo "  Startup file: $ROOT_DIR/server.js"
echo "  Run directory: $ROOT_DIR"
echo "  Node version: 24 LTS"
echo "  Run user: $RUN_USER"
echo "  Instances: 1"
echo "  Port: 3000"
