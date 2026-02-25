#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_DIR="$ROOT_DIR/.run"
ENGINE_PID_FILE="$RUN_DIR/engine.pid"
WEB_PID_FILE="$RUN_DIR/web.pid"

check() {
  local name="$1"
  local file="$2"
  if [[ -f "$file" ]] && kill -0 "$(cat "$file")" 2>/dev/null; then
    echo "$name: running (pid $(cat "$file"))"
  else
    echo "$name: stopped"
  fi
}

check web "$WEB_PID_FILE"
check engine "$ENGINE_PID_FILE"
