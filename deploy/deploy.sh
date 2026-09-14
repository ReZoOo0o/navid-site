#!/usr/bin/env bash
# One command deploy to Reza's own VPS. Usage:
#   ./deploy/deploy.sh user@host [/var/www/navid]
# Builds locally, verifies, ships the static output over rsync, reloads nginx.
set -euo pipefail
HOST="${1:?usage: deploy.sh user@host [remote_root]}"
ROOT="${2:-/var/www/navid}"

# nginx on the origin proxies /api/contact to the contact backend that runs
# beside it, so a build for this target always has an endpoint. It is defaulted
# here rather than left to whoever types the command: a deploy that forgets it
# silently ships a form that tells every visitor to use email instead, and looks
# exactly like a successful deploy while doing it.
export PUBLIC_CONTACT_ENDPOINT="${PUBLIC_CONTACT_ENDPOINT:-/api/contact}"

echo "▸ contact endpoint: $PUBLIC_CONTACT_ENDPOINT"
echo "▸ verifying before shipping…"
LAUNCH=1 npm run check          # refuses to deploy while mock data remains
echo "▸ syncing to $HOST:$ROOT"
rsync -az --delete --checksum dist/ "$HOST:$ROOT/"
echo "▸ reloading nginx"
ssh "$HOST" 'sudo nginx -t && sudo systemctl reload nginx'
echo "✓ deployed"
