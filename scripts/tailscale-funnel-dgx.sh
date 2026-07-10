#!/usr/bin/env bash
# Run ON the DGX. Public internet access via Tailscale Funnel (requires ACL allow).
set -euo pipefail

PORT="${PORT:-8081}"

echo "Current Funnel config:"
sudo tailscale funnel status || true
echo

echo "→ Funnel port ${PORT} → http://127.0.0.1:${PORT} (public, tailnet + internet)"
sudo tailscale funnel --bg --https="${PORT}" "${PORT}"

echo
echo "Public link (anyone with the URL):"
sudo tailscale funnel status
echo "  append /3d for HD-2D client"
