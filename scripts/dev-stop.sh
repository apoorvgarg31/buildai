#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_DIR="$ROOT_DIR/.run"
ENGINE_PID_FILE="$RUN_DIR/engine.pid"
WEB_PID_FILE="$RUN_DIR/web.pid"

stop_pid_file() {
  local name="$1"
  local file="$2"
  if [[ -f "$file" ]]; then
    local pid
    pid="$(cat "$file")"
    if kill -0 "$pid" 2>/dev/null; then
      echo "Stopping $name (pid $pid)..."
      kill "$pid" || true
      sleep 1
      if kill -0 "$pid" 2>/dev/null; then
        kill -9 "$pid" || true
      fi
    else
      echo "$name not running (stale pid file)."
    fi
    rm -f "$file"
  else
    echo "$name not running."
  fi
}

stop_pid_file "web" "$WEB_PID_FILE"
stop_pid_file "engine" "$ENGINE_PID_FILE"

echo "BuildAI stopped."
