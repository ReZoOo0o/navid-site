#!/usr/bin/env bash
# One command deploy to Reza's own VPS. Usage:
#   ./deploy/deploy.sh user@host [/var/www/navid]
# Builds locally, verifies, ships the static output over rsync, reloads nginx.
set -euo pipefail
HOST="${1:?usage: deploy.sh user@host [remote_root]}"
ROOT="${2:-/var/www/navid}"

echo "▸ verifying before shipping…"
LAUNCH=1 npm run check          # refuses to deploy while mock data remains
echo "▸ syncing to $HOST:$ROOT"
rsync -az --delete --checksum dist/ "$HOST:$ROOT/"
echo "▸ reloading nginx"
ssh "$HOST" 'sudo nginx -t && sudo systemctl reload nginx'
echo "✓ deployed"
