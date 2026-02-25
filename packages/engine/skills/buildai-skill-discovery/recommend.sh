#!/usr/bin/env bash
set -euo pipefail

ROLE="${1:-}"
SYSTEMS="${2:-}"
shift 2 || true

PAIN_ARGS=()
for p in "$@"; do
  PAIN_ARGS+=(--pain "$p")
done

python3 skills/buildai-skill-discovery/recommend.py \
  --role "$ROLE" \
  --systems "$SYSTEMS" \
  "${PAIN_ARGS[@]}"
