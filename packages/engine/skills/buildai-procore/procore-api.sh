#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
# BuildAI Procore API — Generic REST client + Entity/Action mode
#
# Raw mode:
#   procore-api.sh <METHOD> <path> [json_body]
#
# Entity mode:
#   procore-api.sh <entity> <action> [project_id] [id] [json_body]
#   actions: list|get|create|update|delete
#
# Utility:
#   procore-api.sh entities
#   procore-api.sh status
#   procore-api.sh --dry-run ...
# ═══════════════════════════════════════════════════════════════════
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TOKEN_FILE="$SCRIPT_DIR/../../../../.procore-tokens.json"
ENTITIES_FILE="$SCRIPT_DIR/entities.json"
LOGIN_BASE="https://login.procore.com"
API_BASE="https://api.procore.com"
COMPANY_ID="${PROCORE_COMPANY_ID:-562949953508550}"
DRY_RUN="${PROCORE_DRY_RUN:-0}"

# Optional first arg flag
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=1
  shift
fi

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

ARG1="${1:-}"
ARG2="${2:-}"
ARG3="${3:-}"
ARG4="${4:-}"
ARG5="${5:-}"

# Utility command: list entities
if [[ "$ARG1" == "entities" ]]; then
  python3 - <<PY
import json
from pathlib import Path
p=Path("$ENTITIES_FILE")
if not p.exists():
    print('{"error":"entities.json not found"}')
    raise SystemExit(1)
d=json.loads(p.read_text())
out=[]
for k,v in d.items():
    out.append({"entity":k,"actions":v.get("actions",[])})
print(json.dumps({"count":len(out),"entities":out}))
PY
  exit 0
fi

# Handle status
if [[ "$ARG1" == "status" ]]; then
  if [[ ! -f "$TOKEN_FILE" ]]; then
    echo '{"connected": false, "reason": "No token file"}'
    exit 0
  fi
  python3 - <<PY
import json,time
try:
    t=json.load(open("$TOKEN_FILE"))
    expires=t.get('created_at',0)+t.get('expires_in',0)
    remaining=expires-time.time()
    print(json.dumps({'connected':True,'expires_in_seconds':int(remaining),'expired':remaining<0}))
except Exception:
    print(json.dumps({'connected':False,'reason':'Failed to read tokens'}))
PY
  exit 0
fi

METHOD=""
API_PATH=""
BODY=""
MODE="raw"

is_http_method() {
  [[ "$1" =~ ^(GET|POST|PUT|PATCH|DELETE)$ ]]
}

resolve_entity_action() {
  local entity="$1" action="$2" pid="$3" rid="$4"
  python3 - "$ENTITIES_FILE" "$entity" "$action" "$pid" "$rid" <<'PY'
import json,sys
f,entity,action,pid,rid=sys.argv[1:]
try:
    d=json.load(open(f))
except Exception as e:
    print(json.dumps({"error":f"failed to read entities: {e}"}))
    raise SystemExit(2)
obj=d.get(entity)
if not obj:
    print(json.dumps({"error":f"unknown entity '{entity}'"}))
    raise SystemExit(3)
if action not in obj.get("actions",[]):
    print(json.dumps({"error":f"action '{action}' not supported for '{entity}'"}))
    raise SystemExit(4)
if action in ("list","create"):
    path=obj.get("collection","")
else:
    path=obj.get("item","")
if not path:
    print(json.dumps({"error":"missing path template"}))
    raise SystemExit(5)
if "{pid}" in path and not pid:
    print(json.dumps({"error":"project_id required for this entity/action"}))
    raise SystemExit(6)
if "{id}" in path and not rid:
    print(json.dumps({"error":"id required for this entity/action"}))
    raise SystemExit(7)
path=path.replace("{pid}",pid or "").replace("{id}",rid or "")
m={"list":"GET","get":"GET","create":"POST","update":"PATCH","delete":"DELETE"}[action]
print(json.dumps({"method":m,"path":path}))
PY
}

# Entity mode (preferred)
IS_ENTITY_MODE="$(python3 - <<PY
import json
from pathlib import Path
p=Path("$ENTITIES_FILE")
ok=False
if p.exists():
  d=json.loads(p.read_text())
  ok="$ARG1" in d and "$ARG2" in {"list","get","create","update","delete"}
print("yes" if ok else "no")
PY
)"

if [[ "$IS_ENTITY_MODE" == "yes" ]]; then
  MODE="entity"
  RESOLVED="$(resolve_entity_action "$ARG1" "$ARG2" "$ARG3" "$ARG4")" || {
    echo "$RESOLVED" >&2
    exit 1
  }
  METHOD="$(python3 -c 'import json,sys; print(json.loads(sys.argv[1])["method"])' "$RESOLVED")"
  API_PATH="$(python3 -c 'import json,sys; print(json.loads(sys.argv[1])["path"])' "$RESOLVED")"
  if [[ "$ARG2" =~ ^(create|update)$ ]]; then
    BODY="$ARG5"
    [[ -z "$BODY" ]] && BODY='{}'
  else
    BODY=""
  fi
# Backward-compatible shortcuts
elif [[ -n "${SHORTCUTS[$ARG1]+x}" ]]; then
  MODE="shortcut"
  SHORTCUT="${SHORTCUTS[$ARG1]}"
  METHOD="${SHORTCUT%% *}"
  API_PATH="${SHORTCUT#* }"

  if [[ -n "${SHORTCUT_NEEDS_PROJECT[$ARG1]+x}" ]]; then
    if [[ -z "$ARG2" ]]; then
      echo "{\"error\": \"Endpoint '$ARG1' requires project_id\"}" >&2
      exit 1
    fi
    API_PATH="${API_PATH//\{pid\}/$ARG2}"
  fi
  BODY=""
else
  METHOD="${ARG1^^}"
  API_PATH="$ARG2"
  BODY="$ARG3"
fi

if [[ -z "$METHOD" || -z "$API_PATH" ]]; then
  echo '{"error":"Usage: procore-api.sh [--dry-run] <METHOD> <path> [json_body] | <entity> <action> [project_id] [id] [json_body] | entities | status"}' >&2
  exit 1
fi

if ! is_http_method "$METHOD"; then
  echo "{\"error\":\"Invalid METHOD '$METHOD'\"}" >&2
  exit 1
fi

# Auto append company_id if absent
if [[ "$API_PATH" != *"company_id"* ]]; then
  if [[ "$API_PATH" == *"?"* ]]; then
    API_PATH="${API_PATH}&company_id=${COMPANY_ID}"
  else
    API_PATH="${API_PATH}?company_id=${COMPANY_ID}"
  fi
fi

# Write ops use v1.1
FINAL_PATH="$API_PATH"
if [[ "$METHOD" =~ ^(POST|PUT|PATCH|DELETE)$ ]]; then
  FINAL_PATH="${FINAL_PATH/\/rest\/v1.0\//\/rest\/v1.1\/}"
fi

if [[ "$DRY_RUN" == "1" ]]; then
  python3 - "$MODE" "$METHOD" "$API_PATH" "$FINAL_PATH" "$BODY" <<'PY'
import json,sys
mode,method,path,final_path,body = sys.argv[1:6]
print(json.dumps({
  "dry_run": True,
  "mode": mode,
  "method": method,
  "path": path,
  "final_path": final_path,
  "has_body": bool(body)
}))
PY
  exit 0
fi

get_access_token() {
  if [[ ! -f "$TOKEN_FILE" ]]; then
    echo '{"error":"No Procore tokens. Run auth first."}' >&2
    exit 1
  fi

  local EXPIRED
  EXPIRED=$(python3 - <<PY
import json,time
t=json.load(open("$TOKEN_FILE"))
expires=t.get('created_at',0)+t.get('expires_in',0)
print('yes' if time.time() >= expires-60 else 'no')
PY
)

  if [[ "$EXPIRED" == "yes" ]]; then
    local REFRESH_TOKEN
    REFRESH_TOKEN=$(python3 -c "import json; print(json.load(open('$TOKEN_FILE'))['refresh_token'])")

    local REFRESH_RESULT
    REFRESH_RESULT=$(curl -s -X POST "$LOGIN_BASE/oauth/token" \
      -H "Content-Type: application/json" \
      -d "{\"grant_type\":\"refresh_token\",\"client_id\":\"${PROCORE_CLIENT_ID}\",\"client_secret\":\"${PROCORE_CLIENT_SECRET}\",\"refresh_token\":\"$REFRESH_TOKEN\"}")

    if python3 -c "import json,sys; d=json.loads(sys.argv[1]); sys.exit(0 if 'error' in d else 1)" "$REFRESH_RESULT" 2>/dev/null; then
      local ERR_MSG
      ERR_MSG=$(python3 -c "import json,sys; d=json.loads(sys.argv[1]); print(d.get('error_description', d.get('error','unknown')))" "$REFRESH_RESULT")
      echo "{\"error\":\"Token refresh failed: $ERR_MSG\"}" >&2
      exit 1
    fi

    if python3 -c "import json,sys; d=json.loads(sys.argv[1]); assert 'access_token' in d" "$REFRESH_RESULT" 2>/dev/null; then
      echo "$REFRESH_RESULT" > "$TOKEN_FILE"
    else
      echo '{"error":"Token refresh returned invalid response"}' >&2
      exit 1
    fi
  fi

  python3 -c "import json; print(json.load(open('$TOKEN_FILE'))['access_token'])"
}

ACCESS_TOKEN="$(get_access_token)"

CURL_ARGS=(
  -s -w "\n%{http_code}" -X "$METHOD"
  -H "Authorization: Bearer $ACCESS_TOKEN"
  -H "Content-Type: application/json"
  -H "Procore-Company-Id: $COMPANY_ID"
)

if [[ -n "$BODY" && "$METHOD" =~ ^(POST|PUT|PATCH)$ ]]; then
  CURL_ARGS+=( -d "$BODY" )
fi

RESULT=$(curl "${CURL_ARGS[@]}" "$API_BASE$FINAL_PATH")
HTTP_CODE=$(echo "$RESULT" | tail -1)
RESPONSE_BODY=$(echo "$RESULT" | sed '$d')

if [[ "$HTTP_CODE" -ge 400 ]]; then
  echo "{\"ok\":false,\"error\":\"Procore API returned HTTP $HTTP_CODE\",\"method\":\"$METHOD\",\"path\":\"$API_PATH\",\"mode\":\"$MODE\",\"body\":$(python3 -c "import json,sys;\ntry: print(json.dumps(json.loads(sys.argv[1])))\nexcept: print(json.dumps(sys.argv[1]))" "$RESPONSE_BODY")}" >&2
  exit 1
fi

python3 - <<PY
import json
body = '''$RESPONSE_BODY'''
method = "$METHOD"
path = "$API_PATH"
mode = "$MODE"
try:
    data = json.loads(body)
    out = {"ok": True, "mode": mode, "method": method, "path": path}
    if isinstance(data, list):
        out["count"] = len(data)
    out["data"] = data
    print(json.dumps(out))
except Exception:
    print(json.dumps({"ok": True, "mode": mode, "method": method, "path": path, "raw": body}))
PY
