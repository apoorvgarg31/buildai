#!/usr/bin/env bash
# Start the BuildAI engine with disabled components
# Usage: ./start-buildai.sh [port]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT="${1:-18789}"

# Source BuildAI environment overrides
source "$SCRIPT_DIR/.env.buildai"

# Prefer local user binaries (BuildAI docker shim lives here for sandbox-on local runs)
export PATH="$HOME/bin:$PATH"

# Keep gateway auth token aligned with the frontend's BUILDAI_GATEWAY_TOKEN when present.
WEB_ENV_PATH="$SCRIPT_DIR/../web/.env.local"
if [[ -f "$WEB_ENV_PATH" ]]; then
  web_token=$(grep -E '^BUILDAI_GATEWAY_TOKEN=' "$WEB_ENV_PATH" | head -n1 | cut -d'=' -f2- || true)
  web_token="${web_token%$'\r'}"
  web_token="${web_token%\"}"
  web_token="${web_token#\"}"
  web_token="${web_token%\'}"
  web_token="${web_token#\'}"
  if [[ -n "$web_token" ]]; then
    export CLAWDBOT_GATEWAY_TOKEN="$web_token"
  fi
fi

# Point to BuildAI config (prefer local override file when present)
DEFAULT_CONFIG_PATH="$SCRIPT_DIR/buildai.config.json5"
LOCAL_CONFIG_PATH="$SCRIPT_DIR/buildai.config.local.json5"
RUNTIME_CONFIG_PATH="$SCRIPT_DIR/buildai.config.runtime.json5"

if [[ -f "$LOCAL_CONFIG_PATH" ]]; then
  BASE_CONFIG_PATH="$LOCAL_CONFIG_PATH"
else
  BASE_CONFIG_PATH="$DEFAULT_CONFIG_PATH"
fi

# Keep gateway.remote.token aligned too, so local loopback CLI/subagent paths authenticate.
python3 - <<PY
import json
from pathlib import Path
base = Path(${BASE_CONFIG_PATH@Q})
out = Path(${RUNTIME_CONFIG_PATH@Q})
cfg = json.loads(base.read_text())
gw = cfg.setdefault('gateway', {})
remote = gw.setdefault('remote', {})
remote['token'] = ${CLAWDBOT_GATEWAY_TOKEN@Q}
out.write_text(json.dumps(cfg, indent=2))
print(out)
PY
export CLAWDBOT_CONFIG_PATH="$RUNTIME_CONFIG_PATH"

# Seed auth profiles for local BuildAI agents so UI works out-of-the-box.
# This copies an existing auth-profiles.json from a known main-agent location
# into BuildAI state if missing (no manual `openclaw agents add ...` needed).
seed_auth_profiles() {
  local state_dir="$SCRIPT_DIR/.clawdbot-state"
  local source_auth=""
  local candidate_sources=(
    "$state_dir/agents/main/agent/auth-profiles.json"
    "$HOME/.openclaw/agents/main/agent/auth-profiles.json"
    "$HOME/.clawdbot-state/agents/main/agent/auth-profiles.json"
  )

  for src in "${candidate_sources[@]}"; do
    if [[ -f "$src" ]]; then
      source_auth="$src"
      break
    fi
  done

  if [[ -z "$source_auth" ]]; then
    echo "⚠️  No source auth-profiles.json found (expected for first-time setup)."
    return 0
  fi

  local target_ids=("jarvis" "main" "buildai-agent")
  for agent_id in "${target_ids[@]}"; do
    local target_dir="$state_dir/agents/$agent_id/agent"
    local target_file="$target_dir/auth-profiles.json"
    mkdir -p "$target_dir"
    if [[ ! -f "$target_file" ]]; then
      cp "$source_auth" "$target_file"
      chmod 600 "$target_file" 2>/dev/null || true
      echo "🔐 Seeded auth profile for agent '$agent_id'"
    fi
  done
}

seed_auth_profiles

# Export for the engine process
export CLAWDBOT_SKIP_BROWSER_CONTROL_SERVER
export CLAWDBOT_SKIP_CANVAS_HOST
export CLAWDBOT_SKIP_GMAIL_WATCHER
export CLAWDBOT_SKIP_CHANNELS
export CLAWDBOT_STATE_DIR
export CLAWDBOT_ALLOW_MULTI_GATEWAY
export CLAWDBOT_GATEWAY_TOKEN
export OPENCLAW_DISABLE_BONJOUR=1

echo "🏗️  Starting BuildAI Engine on port $PORT"
echo "   Config:  $CLAWDBOT_CONFIG_PATH"
echo "   Browser: DISABLED"
echo "   Canvas:  DISABLED"
echo "   Channels (Telegram/Discord/etc): DISABLED"
echo "   Webchat: ENABLED"
echo "   Memory:  ENABLED"
echo "   Cron:    ENABLED"
echo ""

# Start the gateway (foreground) using the repo-local CLI so BuildAI env/config isolation applies.
if [[ -f "$SCRIPT_DIR/dist/entry.js" ]]; then
  node "$SCRIPT_DIR/dist/entry.js" gateway run --port "$PORT" --token "$CLAWDBOT_GATEWAY_TOKEN"
else
  echo "❌ BuildAI engine entrypoint not found at $SCRIPT_DIR/dist/entry.js"
  exit 1
fi
