#!/usr/bin/env bash
# Run ON the DGX (or: ssh -t spark-a510.local 'bash -s' < scripts/tailscale-serve-dgx.sh)
# Exposes AMBER COOP (localhost:8081) via Tailscale Serve (HTTPS, tailnet-only).
set -euo pipefail

PORT="${PORT:-8081}"

echo "Current Tailscale Serve config:"
sudo tailscale serve status || true
echo

echo "→ Adding HTTPS Serve on port ${PORT} → http://127.0.0.1:${PORT}"
sudo tailscale serve --bg --https="${PORT}" "${PORT}"

echo
echo "Done. Share these links with anyone on your tailnet:"
echo "  HTTP (direct):  http://$(tailscale ip -4):${PORT}/"
echo "  HTTP (DNS):     http://$(tailscale status --self --json 2>/dev/null | grep -o '"DNSName":"[^"]*"' | head -1 | cut -d'"' -f4 || hostname):${PORT}/"
echo "  HTTPS (Serve):  https://spark-a510.tailfaa92f.ts.net:${PORT}/"
echo "  HD-2D:          append /3d"
echo
sudo tailscale serve status
