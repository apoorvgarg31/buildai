#!/usr/bin/env bash
# Start the BuildAI engine (isolated from main Clawdbot gateway)
set -euo pipefail
cd "$(dirname "$0")"

export CLAWDBOT_CONFIG_PATH="$(pwd)/buildai.config.json5"
export CLAWDBOT_STATE_DIR="$(pwd)/.clawdbot-state"
export CLAWDBOT_ALLOW_MULTI_GATEWAY=1
export CLAWDBOT_SKIP_BROWSER_CONTROL_SERVER=1
export CLAWDBOT_SKIP_CANVAS_HOST=1
export CLAWDBOT_SKIP_GMAIL_WATCHER=1
export CLAWDBOT_SKIP_CHANNELS=1

# Source additional env vars if present
[ -f .env.buildai ] && set -a && source .env.buildai && set +a

# Source Procore secrets (production OAuth creds)
PROCORE_SECRETS="$(cd ../.. && pwd)/.secrets/procore.env"
[ -f "$PROCORE_SECRETS" ] && set -a && source "$PROCORE_SECRETS" && set +a

mkdir -p "$CLAWDBOT_STATE_DIR"

exec clawdbot gateway --port 18790
