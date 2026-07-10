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

if [[ ! -f .env ]]; then
  cp .env.example .env
fi

# Ollama is local on DGX — reach it from inside the container
if grep -q '^OLLAMA_URL=' .env; then
  sed -i 's|^OLLAMA_URL=.*|OLLAMA_URL=http://host.docker.internal:11434|' .env
else
  echo 'OLLAMA_URL=http://host.docker.internal:11434' >> .env
fi

docker compose -f docker-compose.yml -f docker-compose.dgx.yml up --build -d

echo
echo "AMBER COOP on DGX:"
echo "  2D:    http://192.168.78.32:8081/"
echo "  HD-2D: http://192.168.78.32:8081/3d"
echo "  health: http://192.168.78.32:8081/health"
docker compose -f docker-compose.yml -f docker-compose.dgx.yml ps
EOF
