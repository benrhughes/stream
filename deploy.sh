#!/usr/bin/env bash
set -euo pipefail

echo "Building..."
npm run build

echo "Deploying to Mac Mini..."
rsync -az --delete packages/web/dist/ doug@192.168.0.5:~/docker/stream/dist/

echo "Done. https://stream.dynamicskillset.com"
