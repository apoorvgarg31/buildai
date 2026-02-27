#!/usr/bin/env bash
# Start the BuildAI engine with disabled components
# Usage: ./start-buildai.sh [port]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT="${1:-18789}"

# Source BuildAI environment overrides
source "$SCRIPT_DIR/.env.buildai"

# Point to BuildAI config
export CLAWDBOT_CONFIG_PATH="$SCRIPT_DIR/buildai.config.json5"

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
