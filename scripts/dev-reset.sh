#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "[reset] Stopping local services (if running)..."
# Best-effort stop: reset must be non-interactive/idempotent.
bash scripts/dev-stop.sh >/dev/null 2>&1 || true

# Runtime artifacts to delete for a clean local state.
# Keep source code and dependencies intact.
REMOVE_PATHS=(
  ".run"
  "data"
  "test-results"
  "packages/web/.next"
  "packages/engine/.clawdbot-state"
  "workspaces/buildai-agent/.clawdbot-state"
  "workspaces/sarah-pm-agent/.clawdbot-state"
  ".procore-tokens.json"
  "packages/engine/.procore-tokens.json"
)

for path in "${REMOVE_PATHS[@]}"; do
  if [[ -e "$path" ]]; then
    rm -rf -- "$path"
    echo "[reset] removed $path"
  fi
done

# Recreate minimal runtime scaffolding required for smooth startup.
mkdir -p .run data

# Keep data dir in git-friendly shape when empty.
touch data/.gitkeep

echo "[reset] complete"
echo "[reset] next step: make start"
