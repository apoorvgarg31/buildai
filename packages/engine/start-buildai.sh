#!/usr/bin/env bash
# Start the BuildAI engine with disabled components
# Usage: ./start-buildai.sh [port]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT="${1:-18789}"

# Source BuildAI environment overrides
source "$SCRIPT_DIR/.env.buildai"

# Export for the engine process
export CLAWDBOT_SKIP_BROWSER_CONTROL_SERVER
export CLAWDBOT_SKIP_CANVAS_HOST
export CLAWDBOT_SKIP_GMAIL_WATCHER
export CLAWDBOT_SKIP_CHANNELS

echo "🏗️  Starting BuildAI Engine on port $PORT"
echo "   Browser: DISABLED"
echo "   Canvas:  DISABLED"
echo "   Channels (Telegram/Discord/etc): DISABLED"
echo "   Webchat: ENABLED"
echo "   Memory:  ENABLED"
echo "   Cron:    ENABLED"
echo ""

# Start the gateway
# Start via openclaw CLI (or npx fallback)
if command -v openclaw &>/dev/null; then
  openclaw gateway start --port "$PORT"
elif command -v npx &>/dev/null; then
  npx openclaw gateway start --port "$PORT"
else
  echo "❌ openclaw not found. Install with: npm install -g openclaw"
  exit 1
fi
