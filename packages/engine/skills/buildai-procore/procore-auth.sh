#!/usr/bin/env bash
# BuildAI Procore OAuth — authorize or exchange tokens
# Usage: procore-auth.sh authorize        → prints auth URL
#        procore-auth.sh callback <code>  → exchanges code for tokens
#
# Environment:
#   PROCORE_CLIENT_ID
#   PROCORE_CLIENT_SECRET
#   PROCORE_REDIRECT_URI (default: http://localhost:3000/api/procore/callback)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TOKEN_FILE="${SCRIPT_DIR}/../../../../.procore-tokens.json"
SANDBOX_BASE="https://sandbox.procore.com"

PROCORE_REDIRECT_URI="${PROCORE_REDIRECT_URI:-http://localhost:3000/api/procore/callback}"

ACTION="${1:-}"

if [ -z "$ACTION" ]; then
  echo "Usage:"
  echo "  procore-auth.sh authorize        → Print authorization URL"
  echo "  procore-auth.sh callback <code>  → Exchange auth code for tokens"
  echo "  procore-auth.sh status           → Check token status"
  exit 0
fi

case "$ACTION" in
  authorize)
    if [ -z "${PROCORE_CLIENT_ID:-}" ]; then
      echo '{"error": "PROCORE_CLIENT_ID not set"}' >&2
      exit 1
    fi
    
    URL="${SANDBOX_BASE}/oauth/authorize?response_type=code&client_id=${PROCORE_CLIENT_ID}&redirect_uri=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$PROCORE_REDIRECT_URI'))")"
    echo "{\"action\": \"authorize\", \"url\": \"$URL\"}"
    echo ""
    echo "Visit this URL to authorize Procore access:"
    echo "$URL"
    ;;

  callback)
    CODE="${2:-}"
    if [ -z "$CODE" ]; then
      echo '{"error": "Missing authorization code. Usage: procore-auth.sh callback <code>"}' >&2
      exit 1
    fi
    
    if [ -z "${PROCORE_CLIENT_ID:-}" ] || [ -z "${PROCORE_CLIENT_SECRET:-}" ]; then
      echo '{"error": "PROCORE_CLIENT_ID and PROCORE_CLIENT_SECRET must be set"}' >&2
      exit 1
    fi
    
    RESULT=$(curl -s -X POST "$SANDBOX_BASE/oauth/token" \
      -H "Content-Type: application/json" \
      -d "{
        \"grant_type\": \"authorization_code\",
        \"client_id\": \"${PROCORE_CLIENT_ID}\",
        \"client_secret\": \"${PROCORE_CLIENT_SECRET}\",
        \"code\": \"$CODE\",
        \"redirect_uri\": \"$PROCORE_REDIRECT_URI\"
      }")
    
    if echo "$RESULT" | jq -e '.error' >/dev/null 2>&1; then
      echo "{\"error\": \"Token exchange failed: $(echo "$RESULT" | jq -r '.error_description // .error')\"}" >&2
      exit 1
    fi
    
    echo "$RESULT" > "$TOKEN_FILE"
    echo '{"success": true, "message": "Procore tokens saved successfully"}'
    ;;

  status)
    if [ ! -f "$TOKEN_FILE" ]; then
      echo '{"connected": false, "reason": "No tokens found"}'
      exit 0
    fi
    
    python3 -c "
import json, time
with open('$TOKEN_FILE') as f:
    t = json.load(f)
expires = t.get('created_at',0) + t.get('expires_in',0)
remaining = expires - time.time()
print(json.dumps({
    'connected': True,
    'expires_in_seconds': int(remaining),
    'expired': remaining < 0,
    'token_type': t.get('token_type', 'unknown')
}))
"
    ;;
    
  *)
    echo "{\"error\": \"Unknown action: $ACTION\"}" >&2
    exit 1
    ;;
esac
