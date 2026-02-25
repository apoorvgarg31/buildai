#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_DIR="$ROOT_DIR/.run"
mkdir -p "$RUN_DIR"

ENGINE_PID_FILE="$RUN_DIR/engine.pid"
WEB_PID_FILE="$RUN_DIR/web.pid"
ENGINE_LOG="$RUN_DIR/engine.log"
WEB_LOG="$RUN_DIR/web.log"

cd "$ROOT_DIR"

if [[ -f "$ENGINE_PID_FILE" ]] && kill -0 "$(cat "$ENGINE_PID_FILE")" 2>/dev/null; then
  echo "Engine already running (pid $(cat "$ENGINE_PID_FILE"))."
else
  echo "Starting BuildAI engine (clawdbot gateway)..."
  nohup bash packages/engine/start-buildai.sh >"$ENGINE_LOG" 2>&1 &
  echo $! > "$ENGINE_PID_FILE"
  sleep 1
fi

if [[ -f "$WEB_PID_FILE" ]] && kill -0 "$(cat "$WEB_PID_FILE")" 2>/dev/null; then
  echo "Web already running (pid $(cat "$WEB_PID_FILE"))."
else
  echo "Starting web app..."
  nohup npm run dev:web >"$WEB_LOG" 2>&1 &
  echo $! > "$WEB_PID_FILE"
  sleep 1
fi

echo ""
echo "BuildAI started."
echo "- Web log:    $WEB_LOG"
echo "- Engine log: $ENGINE_LOG"
echo "- URL:        http://localhost:3000"
