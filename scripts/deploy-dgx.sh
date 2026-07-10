#!/usr/bin/env bash
set -euo pipefail

DGX_HOST="${DGX_HOST:-spark-a510.local}"
REMOTE_DIR="${REMOTE_DIR:-/home/azvyagintsev/amber-coop}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "→ syncing to ${DGX_HOST}:${REMOTE_DIR}"
rsync -avz --delete \
  --exclude node_modules \
  --exclude dist \
  --exclude .git \
  "${ROOT}/" "${DGX_HOST}:${REMOTE_DIR}/"

echo "→ building & starting on DGX"
ssh "${DGX_HOST}" bash -s <<EOF
set -euo pipefail
cd "${REMOTE_DIR}"
bash scripts/ci-deploy-dgx.sh
EOF

echo
echo "AMBER COOP on DGX:"
echo "  2D:    http://192.168.78.32:8081/"
echo "  HD-2D: http://192.168.78.32:8081/3d"
echo "  health: http://192.168.78.32:8081/health"
