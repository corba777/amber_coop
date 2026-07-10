#!/usr/bin/env bash
# Runs on the DGX (self-hosted GitHub Actions runner) or via deploy-dgx.sh over SSH.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .env ]]; then
  cp .env.example .env
fi

# Ollama is local on DGX — reach it from inside the container
if grep -q '^OLLAMA_URL=' .env; then
  sed -i 's|^OLLAMA_URL=.*|OLLAMA_URL=http://host.docker.internal:11434|' .env
else
  echo 'OLLAMA_URL=http://host.docker.internal:11434' >> .env
fi

echo "→ docker compose up --build -d"
docker compose -f docker-compose.yml -f docker-compose.dgx.yml up --build -d

echo "→ waiting for health"
for i in $(seq 1 30); do
  if curl -sf "http://127.0.0.1:8081/health" >/dev/null; then
    curl -s "http://127.0.0.1:8081/health"
    echo
    docker compose -f docker-compose.yml -f docker-compose.dgx.yml ps
    exit 0
  fi
  sleep 2
done

echo "health check failed" >&2
docker compose -f docker-compose.yml -f docker-compose.dgx.yml logs --tail 40
exit 1
