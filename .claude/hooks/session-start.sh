#!/usr/bin/env bash
# Prepares cloud sessions of Claude Code (only when CLAUDE_CODE_REMOTE=true):
# installs dependencies and runs the idempotent dev setup (Postgres, demo, migrations).
set -euo pipefail
[[ "${CLAUDE_CODE_REMOTE:-}" == "true" ]] || exit 0
cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}"
[[ -f package.json ]] || exit 0
[[ -f .env ]] || cp .env.example .env
pnpm install --frozen-lockfile >/dev/null 2>&1 || pnpm install >/dev/null 2>&1
SKIP_DEMO_DATA=1 bash scripts/dev-setup.sh >/dev/null 2>&1 || echo "dev-setup falhou; rode bash scripts/dev-setup.sh"
