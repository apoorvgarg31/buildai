#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
# BuildAI Procore API — Generic REST client
# Supports ANY Procore endpoint, ANY HTTP method, with request bodies
#
# Usage:
#   procore-api.sh <method> <path> [json_body]
#   procore-api.sh GET /rest/v1.0/projects
#   procore-api.sh POST /rest/v1.0/projects/{pid}/rfis '{"rfi": {"subject": "..."}}'
#   procore-api.sh PATCH /rest/v1.0/projects/{pid}/rfis/123 '{"rfi": {"status": "closed"}}'
#
# Shortcuts (backward compat):
#   procore-api.sh status
#   procore-api.sh projects
#   procore-api.sh rfis <project_id>
# ═══════════════════════════════════════════════════════════════════
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TOKEN_FILE="$SCRIPT_DIR/../../../../.procore-tokens.json"
LOGIN_BASE="https://login.procore.com"
API_BASE="https://api.procore.com"
COMPANY_ID="${PROCORE_COMPANY_ID:-562949953508550}"

# ── Shortcut mapping (backward compat) ───────────────────────────
declare -A SHORTCUTS=(
  ["projects"]="GET /rest/v1.0/projects?company_id=${COMPANY_ID}"
  ["rfis"]="GET /rest/v1.0/projects/{pid}/rfis?company_id=${COMPANY_ID}"
  ["submittals"]="GET /rest/v1.0/projects/{pid}/submittals?company_id=${COMPANY_ID}"
  ["daily_logs"]="GET /rest/v1.0/projects/{pid}/daily_logs?company_id=${COMPANY_ID}&start_date=2024-01-01&end_date=2026-12-31"
  ["change_orders"]="GET /rest/v1.0/projects/{pid}/change_order_packages?company_id=${COMPANY_ID}"
  ["punch_items"]="GET /rest/v1.0/projects/{pid}/punch_items?company_id=${COMPANY_ID}"
  ["vendors"]="GET /rest/v1.0/projects/{pid}/vendors?company_id=${COMPANY_ID}"
  ["schedule"]="GET /rest/v1.0/projects/{pid}/schedule/tasks?company_id=${COMPANY_ID}"
  ["documents"]="GET /rest/v1.0/projects/{pid}/documents?company_id=${COMPANY_ID}"
  ["budget"]="GET /rest/v1.0/projects/{pid}/budget_line_items?company_id=${COMPANY_ID}"
)

declare -A SHORTCUT_NEEDS_PROJECT=(
  ["rfis"]=1 ["submittals"]=1 ["daily_logs"]=1 ["budget"]=1
  ["change_orders"]=1 ["punch_items"]=1 ["vendors"]=1
  ["schedule"]=1 ["documents"]=1
)

# ── Parse arguments ──────────────────────────────────────────────
ARG1="${1:-}"
ARG2="${2:-}"
ARG3="${3:-}"

# Handle: procore-api.sh status
if [ "$ARG1" = "status" ]; then
  if [ ! -f "$TOKEN_FILE" ]; then
    echo '{"connected": false, "reason": "No token file"}'
    exit 0
  fi
  python3 -c "
import json, time
try:
    t = json.load(open('$TOKEN_FILE'))
    expires = (t.get('created_at',0) + t.get('expires_in',0))
    remaining = expires - time.time()
    print(json.dumps({'connected': True, 'expires_in_seconds': int(remaining), 'expired': remaining < 0}))
except:
    print(json.dumps({'connected': False, 'reason': 'Failed to read tokens'}))
"
  exit 0
fi

# Handle shortcuts: procore-api.sh rfis <project_id>
if [ -n "${SHORTCUTS[$ARG1]+x}" ]; then
  SHORTCUT="${SHORTCUTS[$ARG1]}"
  METHOD="${SHORTCUT%% *}"
  API_PATH="${SHORTCUT#* }"
  
  if [ -n "${SHORTCUT_NEEDS_PROJECT[$ARG1]+x}" ]; then
    if [ -z "$ARG2" ]; then
      echo "{\"error\": \"Endpoint '$ARG1' requires a project ID. Usage: procore-api.sh $ARG1 <project_id>\"}"
      exit 1
    fi
    API_PATH="${API_PATH//\{pid\}/$ARG2}"
  fi
  BODY=""
else
  # Generic mode: procore-api.sh <METHOD> <path> [body]
  METHOD="${ARG1^^}"  # uppercase
  API_PATH="$ARG2"
  BODY="$ARG3"
  
  if [ -z "$API_PATH" ]; then
    echo '{"error": "Usage: procore-api.sh <METHOD> <path> [json_body] OR procore-api.sh <shortcut> [project_id]", "shortcuts": ["projects","rfis","submittals","daily_logs","change_orders","punch_items","vendors","schedule","documents","budget"]}'
    exit 1
  fi
  
  # Auto-append company_id if not present
  if [[ "$API_PATH" != *"company_id"* ]]; then
    if [[ "$API_PATH" == *"?"* ]]; then
      API_PATH="${API_PATH}&company_id=${COMPANY_ID}"
    else
      API_PATH="${API_PATH}?company_id=${COMPANY_ID}"
    fi
  fi
fi

# ── Token management ─────────────────────────────────────────────
get_access_token() {
  if [ ! -f "$TOKEN_FILE" ]; then
    echo '{"error": "No Procore tokens. Run auth first."}' >&2
    exit 1
  fi

  local EXPIRED
  EXPIRED=$(python3 -c "
import json, time
t = json.load(open('$TOKEN_FILE'))
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
    
    if python3 -c "import json,sys; d=json.loads(sys.argv[1]); sys.exit(0 if 'error' in d else 1)" "$REFRESH_RESULT" 2>/dev/null; then
      local ERR_MSG
      ERR_MSG=$(python3 -c "import json,sys; d=json.loads(sys.argv[1]); print(d.get('error_description', d.get('error','unknown')))" "$REFRESH_RESULT")
      echo "{\"error\": \"Token refresh failed: $ERR_MSG\"}" >&2
      exit 1
    fi
    
    # Only write if we got a valid token response
    if python3 -c "import json,sys; d=json.loads(sys.argv[1]); assert 'access_token' in d" "$REFRESH_RESULT" 2>/dev/null; then
      echo "$REFRESH_RESULT" > "$TOKEN_FILE"
    else
      echo "{\"error\": \"Token refresh returned invalid response\"}" >&2
      exit 1
    fi
  fi

  python3 -c "import json; print(json.load(open('$TOKEN_FILE'))['access_token'])"
}

# ── Make API call ────────────────────────────────────────────────
ACCESS_TOKEN=$(get_access_token)

# For write operations, use v1.1 API and Procore-Company-Id header
FINAL_PATH="$API_PATH"
if [[ "$METHOD" =~ ^(POST|PUT|PATCH|DELETE)$ ]]; then
  # Upgrade v1.0 to v1.1 for write operations (v1.0 returns 500 on writes)
  FINAL_PATH="${FINAL_PATH/\/rest\/v1.0\//\/rest\/v1.1\/}"
fi

# Build curl command
CURL_ARGS=(
  -s
  -w "\n%{http_code}"
  -X "$METHOD"
  -H "Authorization: Bearer $ACCESS_TOKEN"
  -H "Content-Type: application/json"
  -H "Procore-Company-Id: $COMPANY_ID"
)

# Add body for POST/PUT/PATCH
if [ -n "$BODY" ] && [[ "$METHOD" =~ ^(POST|PUT|PATCH)$ ]]; then
  CURL_ARGS+=(-d "$BODY")
fi

RESULT=$(curl "${CURL_ARGS[@]}" "$API_BASE$FINAL_PATH")

HTTP_CODE=$(echo "$RESULT" | tail -1)
RESPONSE_BODY=$(echo "$RESULT" | sed '$d')

if [ "$HTTP_CODE" -ge 400 ]; then
  echo "{\"error\": \"Procore API returned HTTP $HTTP_CODE\", \"method\": \"$METHOD\", \"path\": \"$API_PATH\", \"body\": $(python3 -c "import json,sys; print(json.dumps(json.loads(sys.argv[1])))" "$RESPONSE_BODY" 2>/dev/null || echo "\"$RESPONSE_BODY\"")}" >&2
  exit 1
fi

# Format output
python3 -c "
import json, sys
body = sys.argv[1]
method = sys.argv[2]
path = sys.argv[3]
try:
    data = json.loads(body)
    result = {'method': method, 'path': path}
    if isinstance(data, list):
        result['count'] = len(data)
        result['data'] = data
    else:
        result['data'] = data
    print(json.dumps(result))
except:
    print(json.dumps({'method': method, 'path': path, 'raw': body}))
" "$RESPONSE_BODY" "$METHOD" "$API_PATH"
