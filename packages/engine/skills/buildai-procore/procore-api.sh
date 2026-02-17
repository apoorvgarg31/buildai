#!/usr/bin/env bash
# BuildAI Procore API — query Procore PRODUCTION endpoints
# Usage: procore-api.sh <endpoint> [project_id]
# Usage: procore-api.sh status
#
# Environment:
#   PROCORE_CLIENT_ID
#   PROCORE_CLIENT_SECRET
#   PROCORE_COMPANY_ID

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TOKEN_FILE="${SCRIPT_DIR}/../../.procore-tokens.json"
API_BASE="https://api.procore.com"
LOGIN_BASE="https://login.procore.com"

ENDPOINT="${1:-}"
PROJECT_ID="${2:-}"
COMPANY_ID="${PROCORE_COMPANY_ID:-562949953508550}"

if [ -z "$ENDPOINT" ]; then
  echo '{"error": "No endpoint specified. Usage: procore-api.sh <endpoint> [project_id]"}' >&2
  echo '{"available": ["projects","rfis","submittals","daily_logs","change_orders","punch_items","vendors","schedule","documents","status"]}' >&2
  exit 1
fi

# ── Endpoint mapping (v1.0 for compatibility) ────────────────────
declare -A ENDPOINTS=(
  ["projects"]="/rest/v1.0/projects?company_id=${COMPANY_ID}"
  ["rfis"]="/rest/v1.0/projects/{pid}/rfis?company_id=${COMPANY_ID}"
  ["submittals"]="/rest/v1.0/projects/{pid}/submittals?company_id=${COMPANY_ID}"
  ["daily_logs"]="/rest/v1.0/projects/{pid}/daily_logs?company_id=${COMPANY_ID}&start_date=2024-01-01&end_date=2026-12-31"
  ["change_orders"]="/rest/v1.0/projects/{pid}/change_order_packages?company_id=${COMPANY_ID}"
  ["punch_items"]="/rest/v1.0/projects/{pid}/punch_items?company_id=${COMPANY_ID}"
  ["vendors"]="/rest/v1.0/projects/{pid}/vendors?company_id=${COMPANY_ID}"
  ["schedule"]="/rest/v1.0/projects/{pid}/schedule/tasks?company_id=${COMPANY_ID}"
  ["documents"]="/rest/v1.0/projects/{pid}/documents?company_id=${COMPANY_ID}"
)

declare -A NEEDS_PROJECT=(
  ["rfis"]=1 ["submittals"]=1 ["daily_logs"]=1
  ["change_orders"]=1 ["punch_items"]=1 ["vendors"]=1
  ["schedule"]=1 ["documents"]=1
)

# ── Status check ─────────────────────────────────────────────────
if [ "$ENDPOINT" = "status" ]; then
  if [ ! -f "$TOKEN_FILE" ]; then
    echo '{"connected": false, "reason": "No tokens found. Run procore-auth.sh to connect."}'
    exit 0
  fi
  python3 -c "
import json, time
with open('$TOKEN_FILE') as f:
    t = json.load(f)
expires = (t.get('created_at',0) + t.get('expires_in',0))
remaining = expires - time.time()
print(json.dumps({'connected': True, 'expires_in_seconds': int(remaining), 'expired': remaining < 0}))
" 2>/dev/null || echo '{"connected": false, "reason": "Failed to read tokens"}'
  exit 0
fi

# ── Validate endpoint ────────────────────────────────────────────
if [ -z "${ENDPOINTS[$ENDPOINT]:-}" ]; then
  echo "{\"error\": \"Unknown endpoint: $ENDPOINT\"}" >&2
  exit 1
fi

if [ -n "${NEEDS_PROJECT[$ENDPOINT]:-}" ] && [ -z "$PROJECT_ID" ]; then
  echo "{\"error\": \"Endpoint '$ENDPOINT' requires a project_id. Usage: procore-api.sh $ENDPOINT <project_id>\"}" >&2
  exit 1
fi

# ── Token management ─────────────────────────────────────────────
get_access_token() {
  if [ ! -f "$TOKEN_FILE" ]; then
    echo '{"error": "Not connected to Procore. Run procore-auth.sh to authenticate."}' >&2
    exit 1
  fi

  local EXPIRED
  EXPIRED=$(python3 -c "
import json, time
with open('$TOKEN_FILE') as f:
    t = json.load(f)
expires = (t.get('created_at',0) + t.get('expires_in',0))
print('yes' if time.time() >= expires - 60 else 'no')
" 2>/dev/null)

  if [ "$EXPIRED" = "yes" ]; then
    local REFRESH_TOKEN
    REFRESH_TOKEN=$(python3 -c "import json; print(json.load(open('$TOKEN_FILE'))['refresh_token'])")
    
    local REFRESH_RESULT
    REFRESH_RESULT=$(curl -s -X POST "$LOGIN_BASE/oauth/token" \
      -H "Content-Type: application/json" \
      -d "{
        \"grant_type\": \"refresh_token\",
        \"client_id\": \"${PROCORE_CLIENT_ID}\",
        \"client_secret\": \"${PROCORE_CLIENT_SECRET}\",
        \"refresh_token\": \"$REFRESH_TOKEN\"
      }")
    
    if echo "$REFRESH_RESULT" | jq -e '.error' >/dev/null 2>&1; then
      echo "{\"error\": \"Token refresh failed: $(echo "$REFRESH_RESULT" | jq -r '.error_description // .error')\"}" >&2
      exit 1
    fi
    
    echo "$REFRESH_RESULT" > "$TOKEN_FILE"
  fi

  python3 -c "import json; print(json.load(open('$TOKEN_FILE'))['access_token'])"
}

# ── Make API call ────────────────────────────────────────────────
ACCESS_TOKEN=$(get_access_token)

API_PATH="${ENDPOINTS[$ENDPOINT]}"
if [ -n "$PROJECT_ID" ]; then
  API_PATH="${API_PATH//\{pid\}/$PROJECT_ID}"
fi

RESULT=$(curl -s -w "\n%{http_code}" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  "$API_BASE$API_PATH")

HTTP_CODE=$(echo "$RESULT" | tail -1)
BODY=$(echo "$RESULT" | sed '$d')

if [ "$HTTP_CODE" -ge 400 ]; then
  echo "{\"error\": \"Procore API returned HTTP $HTTP_CODE\", \"body\": $(echo "$BODY" | jq . 2>/dev/null || echo "\"$BODY\"")}" >&2
  exit 1
fi

if echo "$BODY" | jq -e 'type == "array"' >/dev/null 2>&1; then
  COUNT=$(echo "$BODY" | jq 'length')
  echo "{\"endpoint\": \"$ENDPOINT\", \"count\": $COUNT, \"data\": $BODY}"
else
  echo "{\"endpoint\": \"$ENDPOINT\", \"data\": $BODY}"
fi
