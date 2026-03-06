#!/usr/bin/env bash
# Start the BuildAI engine with disabled components
# Usage: ./start-buildai.sh [port]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT="${1:-18789}"

# Source BuildAI environment overrides
source "$SCRIPT_DIR/.env.buildai"

# Point to BuildAI config (prefer local override file when present)
DEFAULT_CONFIG_PATH="$SCRIPT_DIR/buildai.config.json5"
LOCAL_CONFIG_PATH="$SCRIPT_DIR/buildai.config.local.json5"

if [[ -f "$LOCAL_CONFIG_PATH" ]]; then
  export CLAWDBOT_CONFIG_PATH="$LOCAL_CONFIG_PATH"
else
  export CLAWDBOT_CONFIG_PATH="$DEFAULT_CONFIG_PATH"
fi

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

# Start the gateway (foreground)
if command -v openclaw &>/dev/null; then
  openclaw gateway run --port "$PORT"
elif command -v npx &>/dev/null; then
  npx openclaw gateway run --port "$PORT"
else
  echo "❌ openclaw not found. Install with: npm install -g openclaw"
  exit 1
fi
