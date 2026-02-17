#!/usr/bin/env bash
# BuildAI Marketplace Installer
# Usage: bash skills/buildai-marketplace/install.sh "<install_url>"
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
SKILLS_DIR="$WORKSPACE_ROOT/skills"
TMPFILE=$(mktemp /tmp/buildai-install-XXXXXX.json)
trap "rm -f $TMPFILE" EXIT

INSTALL_URL="${1:-}"

if [ -z "$INSTALL_URL" ]; then
  echo '{"error": "Usage: install.sh <marketplace_install_url>"}'
  exit 1
fi

# Security: only allow BuildAI marketplace URLs
if ! echo "$INSTALL_URL" | grep -q "/api/marketplace/skills/"; then
  echo '{"error": "Invalid URL. Only BuildAI marketplace URLs are allowed (must contain /api/marketplace/skills/)."}'
  exit 1
fi

# If URL doesn't have a token, request one first
if ! echo "$INSTALL_URL" | grep -q "token="; then
  SKILL_ID=$(echo "$INSTALL_URL" | grep -oP 'skills/\K[^/]+')
  if [ -z "$SKILL_ID" ]; then
    echo '{"error": "Could not parse skill ID from URL."}'
    exit 1
  fi

  BASE_URL=$(echo "$INSTALL_URL" | grep -oP '^https?://[^/]+')

  TOKEN_RESPONSE=$(curl -sf "${BASE_URL}/api/marketplace/skills/${SKILL_ID}?agentId=self" 2>&1) || {
    echo "{\"error\": \"Failed to reach marketplace at ${BASE_URL}\"}"
    exit 1
  }

  INSTALL_URL=$(python3 -c "
import json, sys
data = json.loads(sys.argv[1])
url = data.get('installUrl')
if url:
    print(url)
else:
    sys.exit(1)
" "$TOKEN_RESPONSE" 2>/dev/null) || {
    echo '{"error": "Failed to get install token from marketplace."}'
    exit 1
  }
fi

# Download the skill package to temp file
HTTP_CODE=$(curl -sf -o "$TMPFILE" -w "%{http_code}" "$INSTALL_URL" 2>/dev/null) || {
  echo '{"error": "Failed to download skill. The install token may be expired — ask the user for a fresh URL."}'
  exit 1
}

if [ "$HTTP_CODE" != "200" ]; then
  echo "{\"error\": \"Marketplace returned HTTP $HTTP_CODE. Token may be expired.\"}"
  exit 1
fi

# Extract and write skill files
python3 - "$TMPFILE" "$SKILLS_DIR" << 'PYEOF'
import json, os, sys

tmpfile = sys.argv[1]
skills_dir = sys.argv[2]

with open(tmpfile) as f:
    response = json.load(f)

if 'error' in response:
    print(json.dumps({'error': response['error']}))
    sys.exit(1)

if not response.get('success'):
    print(json.dumps({'error': 'Unexpected response from marketplace'}))
    sys.exit(1)

pkg = response.get('package', {})
skill_id = pkg.get('id', '')
skill_name = pkg.get('name', '')
files = pkg.get('files', [])
skill_meta = response.get('skill', {})
instructions = response.get('instructions', '')

if not skill_id or not files:
    print(json.dumps({'error': 'Empty skill package'}))
    sys.exit(1)

skill_dir = os.path.join(skills_dir, skill_id)
os.makedirs(skill_dir, exist_ok=True)

written = []
for f in files:
    fpath = os.path.join(skill_dir, f['path'])
    os.makedirs(os.path.dirname(fpath), exist_ok=True)
    with open(fpath, 'w') as fh:
        fh.write(f['content'])
    written.append(f['path'])

result = {
    'success': True,
    'installed': {
        'id': skill_id,
        'name': skill_name,
        'description': skill_meta.get('description', ''),
        'version': skill_meta.get('version', ''),
        'files': written,
        'location': skill_dir,
    },
    'instructions': instructions,
    'needsConnection': skill_meta.get('connectionType'),
}

print(json.dumps(result, indent=2))
PYEOF
