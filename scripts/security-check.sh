#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# Scan tracked files only.
FILES=$(git ls-files)

PATTERN='AIza[0-9A-Za-z_-]{20,}|sk-[A-Za-z0-9]{20,}|-----BEGIN (RSA|OPENSSH|EC) PRIVATE KEY-----'

HITS=$(grep -RInE --exclude-dir=node_modules --exclude-dir=.git --binary-files=without-match "$PATTERN" $FILES || true)

if [[ -n "$HITS" ]]; then
  echo "[WARN] Potential sensitive patterns found in tracked files:"
  echo "$HITS"
  exit 1
fi

echo "[OK] No obvious secrets found in tracked files."
