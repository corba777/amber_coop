#!/usr/bin/env bash
# Build, selftest, deploy to DGX. Merge origin/main into az_dev first.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "→ npm ci + build + selftest"
npm ci
node scripts-build.mjs
node dist/selftest.js

echo "→ deploy"
exec "${ROOT}/scripts/deploy-dgx.sh"
