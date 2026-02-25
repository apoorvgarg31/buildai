#!/usr/bin/env bash
# BuildAI Procore API — Generic REST client + Entity/Action mode (Phase 2)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TOKEN_FILE="$SCRIPT_DIR/../../../../.procore-tokens.json"
ENTITIES_FILE="$SCRIPT_DIR/entities.json"
LOGIN_BASE="https://login.procore.com"
API_BASE="https://api.procore.com"
COMPANY_ID="${PROCORE_COMPANY_ID:-562949953508550}"

DRY_RUN="${PROCORE_DRY_RUN:-0}"
PAGE=""
PER_PAGE=""
AUTO_PAGINATE=0
THRESHOLD="5"
FILTERS=()

# Parse flags first
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=1; shift ;;
    --page) PAGE="${2:-}"; shift 2 ;;
    --per-page) PER_PAGE="${2:-}"; shift 2 ;;
    --all) AUTO_PAGINATE=1; shift ;;
    --filter) FILTERS+=("${2:-}"); shift 2 ;;
    --threshold) THRESHOLD="${2:-5}"; shift 2 ;;
    *) break ;;
  esac
done

ARG1="${1:-}"
ARG2="${2:-}"
ARG3="${3:-}"
ARG4="${4:-}"
ARG5="${5:-}"

# ── Backward-compatible shortcuts ───────────────────────────────
declare -A SHORTCUTS=(
  ["projects"]="GET /rest/v1.0/projects"
  ["rfis"]="GET /rest/v1.0/projects/{pid}/rfis"
  ["submittals"]="GET /rest/v1.0/projects/{pid}/submittals"
  ["daily_logs"]="GET /rest/v1.0/projects/{pid}/daily_logs"
  ["change_orders"]="GET /rest/v1.0/projects/{pid}/change_order_packages"
  ["punch_items"]="GET /rest/v1.0/projects/{pid}/punch_items"
  ["vendors"]="GET /rest/v1.0/projects/{pid}/vendors"
  ["schedule"]="GET /rest/v1.0/projects/{pid}/schedule/tasks"
  ["documents"]="GET /rest/v1.0/projects/{pid}/documents"
  ["budget"]="GET /rest/v1.0/projects/{pid}/budget_line_items"
)

declare -A SHORTCUT_NEEDS_PROJECT=(
  ["rfis"]=1 ["submittals"]=1 ["daily_logs"]=1 ["budget"]=1
  ["change_orders"]=1 ["punch_items"]=1 ["vendors"]=1
  ["schedule"]=1 ["documents"]=1
)

is_http_method() { [[ "$1" =~ ^(GET|POST|PUT|PATCH|DELETE)$ ]]; }

append_query_param() {
  local path="$1" key="$2" val="$3"
  if [[ -z "$val" ]]; then
    echo "$path"
    return
  fi
  if [[ "$path" == *"?"* ]]; then
    echo "${path}&${key}=${val}"
  else
    echo "${path}?${key}=${val}"
  fi
}

apply_query_overrides() {
  local path="$1"
  path="$(append_query_param "$path" "company_id" "$COMPANY_ID")"
  if [[ -n "$PAGE" ]]; then path="$(append_query_param "$path" "page" "$PAGE")"; fi
  if [[ -n "$PER_PAGE" ]]; then path="$(append_query_param "$path" "per_page" "$PER_PAGE")"; fi
  for f in "${FILTERS[@]}"; do
    if [[ "$f" == *=* ]]; then
      local k="${f%%=*}" v="${f#*=}"
      path="$(append_query_param "$path" "$k" "$v")"
    fi
  done
  echo "$path"
}

resolve_entity_action() {
  local entity="$1" action="$2" pid="$3" rid="$4"
  python3 - "$ENTITIES_FILE" "$entity" "$action" "$pid" "$rid" <<'PY'
import json,sys
f,entity,action,pid,rid=sys.argv[1:]
d=json.load(open(f))
obj=d.get(entity)
if not obj:
    print(json.dumps({"error":f"unknown entity '{entity}'"}))
    raise SystemExit(3)
if action not in obj.get("actions",[]):
    print(json.dumps({"error":f"action '{action}' not supported for '{entity}'"}))
    raise SystemExit(4)
path=obj.get("collection" if action in ("list","create") else "item","")
if "{pid}" in path and not pid:
    print(json.dumps({"error":"project_id required"}))
    raise SystemExit(6)
if "{id}" in path and not rid:
    print(json.dumps({"error":"id required"}))
    raise SystemExit(7)
path=path.replace("{pid}",pid or "").replace("{id}",rid or "")
m={"list":"GET","get":"GET","create":"POST","update":"PATCH","delete":"DELETE"}[action]
print(json.dumps({"method":m,"path":path}))
PY
}

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

if [[ "$ARG1" == "entities" ]]; then
  python3 - <<PY
import json
from pathlib import Path
p=Path("$ENTITIES_FILE")
d=json.loads(p.read_text())
print(json.dumps({"count":len(d),"entities":[{"entity":k,"actions":v.get("actions",[])} for k,v in d.items()]}))
PY
  exit 0
fi

if [[ "$ARG1" == "status" ]]; then
  if [[ ! -f "$TOKEN_FILE" ]]; then
    echo '{"connected": false, "reason": "No token file"}'
    exit 0
  fi
  python3 - <<PY
import json,time
t=json.load(open("$TOKEN_FILE"))
expires=t.get('created_at',0)+t.get('expires_in',0)
remaining=expires-time.time()
print(json.dumps({'connected':True,'expires_in_seconds':int(remaining),'expired':remaining<0}))
PY
  exit 0
fi

METHOD=""; API_PATH=""; BODY=""; MODE="raw"; ENTITY=""

# PM wrappers
if [[ "$ARG1" == "pm" ]]; then
  MODE="pm-wrapper"
  case "$ARG2" in
    rfis-overdue)
      pid="$ARG3"; [[ -z "$pid" ]] && { echo '{"error":"project_id required"}' >&2; exit 1; }
      METHOD="GET"
      API_PATH="/rest/v1.0/projects/${pid}/rfis"
      FILTERS+=("status=open" "sort=due_date")
      ENTITY="rfis"
      ;;
    submittals-late)
      pid="$ARG3"; [[ -z "$pid" ]] && { echo '{"error":"project_id required"}' >&2; exit 1; }
      METHOD="GET"
      API_PATH="/rest/v1.0/projects/${pid}/submittals"
      FILTERS+=("status=open" "sort=due_date")
      ENTITY="submittals"
      ;;
    budget-variance)
      pid="$ARG3"; [[ -z "$pid" ]] && { echo '{"error":"project_id required"}' >&2; exit 1; }
      METHOD="GET"
      API_PATH="/rest/v1.0/projects/${pid}/budget_line_items"
      ENTITY="budget_line_items"
      ;;
    *)
      echo '{"error":"Unknown pm command. Use: pm rfis-overdue|submittals-late|budget-variance <project_id>"}' >&2
      exit 1
      ;;
  esac
elif [[ "$IS_ENTITY_MODE" == "yes" ]]; then
  MODE="entity"
  ENTITY="$ARG1"
  RESOLVED="$(resolve_entity_action "$ARG1" "$ARG2" "$ARG3" "$ARG4")" || { echo "$RESOLVED" >&2; exit 1; }
  METHOD="$(python3 -c 'import json,sys; print(json.loads(sys.argv[1])["method"])' "$RESOLVED")"
  API_PATH="$(python3 -c 'import json,sys; print(json.loads(sys.argv[1])["path"])' "$RESOLVED")"
  if [[ "$ARG2" =~ ^(create|update)$ ]]; then
    BODY="$ARG5"; [[ -z "$BODY" ]] && BODY='{}'
  fi
fi

if [[ -z "$METHOD" ]]; then
  if [[ -n "${SHORTCUTS[$ARG1]+x}" ]]; then
    MODE="shortcut"
    SHORTCUT="${SHORTCUTS[$ARG1]}"
    METHOD="${SHORTCUT%% *}"
    API_PATH="${SHORTCUT#* }"
    if [[ -n "${SHORTCUT_NEEDS_PROJECT[$ARG1]+x}" ]]; then
      [[ -z "$ARG2" ]] && { echo "{\"error\":\"project_id required for $ARG1\"}" >&2; exit 1; }
      API_PATH="${API_PATH//\{pid\}/$ARG2}"
    fi
  else
    METHOD="${ARG1^^}"; API_PATH="$ARG2"; BODY="$ARG3"
  fi
fi

if [[ -z "$METHOD" || -z "$API_PATH" || ! $(is_http_method "$METHOD"; echo $?) -eq 0 ]]; then
  echo '{"error":"Usage: procore-api.sh [flags] <METHOD> <path> [json_body] | <entity> <action> [project_id] [id] [json_body] | pm <command> <project_id>"}' >&2
  exit 1
fi

API_PATH="$(apply_query_overrides "$API_PATH")"
FINAL_PATH="$API_PATH"
if [[ "$METHOD" =~ ^(POST|PUT|PATCH|DELETE)$ ]]; then
  FINAL_PATH="${FINAL_PATH/\/rest\/v1.0\//\/rest\/v1.1\/}"
fi

if [[ "$DRY_RUN" == "1" ]]; then
  python3 - "$MODE" "$ENTITY" "$METHOD" "$API_PATH" "$FINAL_PATH" "$BODY" "$AUTO_PAGINATE" <<'PY'
import json,sys
mode,entity,method,path,final_path,body,auto = sys.argv[1:8]
print(json.dumps({
  "dry_run": True,
  "mode": mode,
  "entity": entity or None,
  "method": method,
  "path": path,
  "final_path": final_path,
  "has_body": bool(body),
  "auto_paginate": auto == '1'
}))
PY
  exit 0
fi

get_access_token() {
  [[ ! -f "$TOKEN_FILE" ]] && { echo '{"error":"No Procore tokens. Run auth first."}' >&2; exit 1; }

  EXPIRED=$(python3 - <<PY
import json,time
t=json.load(open("$TOKEN_FILE"))
expires=t.get('created_at',0)+t.get('expires_in',0)
print('yes' if time.time() >= expires-60 else 'no')
PY
)

  if [[ "$EXPIRED" == "yes" ]]; then
    REFRESH_TOKEN=$(python3 -c "import json; print(json.load(open('$TOKEN_FILE'))['refresh_token'])")
    REFRESH_RESULT=$(curl -s -X POST "$LOGIN_BASE/oauth/token" -H "Content-Type: application/json" -d "{\"grant_type\":\"refresh_token\",\"client_id\":\"${PROCORE_CLIENT_ID}\",\"client_secret\":\"${PROCORE_CLIENT_SECRET}\",\"refresh_token\":\"$REFRESH_TOKEN\"}")
    if python3 -c "import json,sys; d=json.loads(sys.argv[1]); sys.exit(0 if 'error' in d else 1)" "$REFRESH_RESULT"; then
      ERR_MSG=$(python3 -c "import json,sys; d=json.loads(sys.argv[1]); print(d.get('error_description', d.get('error','unknown')))" "$REFRESH_RESULT")
      echo "{\"error\":\"Token refresh failed: $ERR_MSG\"}" >&2
      exit 1
    fi
    python3 -c "import json,sys; d=json.loads(sys.argv[1]); assert 'access_token' in d" "$REFRESH_RESULT"
    echo "$REFRESH_RESULT" > "$TOKEN_FILE"
  fi

  python3 -c "import json; print(json.load(open('$TOKEN_FILE'))['access_token'])"
}

ACCESS_TOKEN="$(get_access_token)"

call_once() {
  local path="$1"
  local body="$2"
  local result

  CURL_ARGS=(
    -s -w "\n%{http_code}" -X "$METHOD"
    -H "Authorization: Bearer $ACCESS_TOKEN"
    -H "Content-Type: application/json"
    -H "Procore-Company-Id: $COMPANY_ID"
  )
  if [[ -n "$body" && "$METHOD" =~ ^(POST|PUT|PATCH)$ ]]; then
    CURL_ARGS+=( -d "$body" )
  fi
  result=$(curl "${CURL_ARGS[@]}" "$API_BASE$path")
  echo "$result"
}

error_code_for_http() {
  local code="$1"
  if [[ "$code" == "401" ]]; then echo "auth_error"; return; fi
  if [[ "$code" == "403" ]]; then echo "permission_denied"; return; fi
  if [[ "$code" == "404" ]]; then echo "not_found"; return; fi
  if [[ "$code" == "429" ]]; then echo "rate_limited"; return; fi
  if [[ "$code" -ge 500 ]]; then echo "upstream_error"; return; fi
  echo "request_invalid"
}

# Auto-pagination for GET list endpoints
if [[ "$AUTO_PAGINATE" == "1" && "$METHOD" == "GET" ]]; then
  p="${PAGE:-1}"
  pp="${PER_PAGE:-100}"
  all='[]'

  while true; do
    loop_path="$FINAL_PATH"
    # override page/per_page each loop
    loop_path=$(python3 - "$loop_path" "$p" "$pp" <<'PY'
import sys
path,p,pp=sys.argv[1:]
if 'page=' in path:
    import re
    path=re.sub(r'([?&])page=[^&]*', r'\1page='+p, path)
else:
    path += ('&' if '?' in path else '?') + 'page=' + p
if 'per_page=' in path:
    import re
    path=re.sub(r'([?&])per_page=[^&]*', r'\1per_page='+pp, path)
else:
    path += '&per_page=' + pp
print(path)
PY
)

    RESULT=$(call_once "$loop_path" "$BODY")
    HTTP_CODE=$(echo "$RESULT" | tail -1)
    RESPONSE_BODY=$(echo "$RESULT" | sed '$d')

    if [[ "$HTTP_CODE" -ge 400 ]]; then
      CODE="$(error_code_for_http "$HTTP_CODE")"
      echo "{\"ok\":false,\"error_code\":\"$CODE\",\"error\":\"Procore API returned HTTP $HTTP_CODE\",\"method\":\"$METHOD\",\"path\":\"$loop_path\",\"mode\":\"$MODE\",\"entity\":\"$ENTITY\"}" >&2
      exit 1
    fi

    LEN=$(python3 -c "import json,sys; d=json.loads(sys.argv[1]); print(len(d) if isinstance(d,list) else -1)" "$RESPONSE_BODY" 2>/dev/null || echo -1)
    if [[ "$LEN" -lt 0 ]]; then
      # Not a list response; return single payload
      python3 - "$MODE" "$ENTITY" "$METHOD" "$API_PATH" "$RESPONSE_BODY" <<'PY'
import json,sys
mode,entity,method,path,body=sys.argv[1:]
try:
  data=json.loads(body)
except Exception:
  data=body
print(json.dumps({"ok":True,"mode":mode,"entity":entity or None,"method":method,"path":path,"data":data}))
PY
      exit 0
    fi

    all=$(python3 - "$all" "$RESPONSE_BODY" <<'PY'
import json,sys
a=json.loads(sys.argv[1]); b=json.loads(sys.argv[2]);
print(json.dumps(a+b))
PY
)

    if [[ "$LEN" -lt "$pp" ]]; then
      break
    fi
    p=$((p+1))
    [[ "$p" -gt 50 ]] && break
  done

  python3 - "$MODE" "$ENTITY" "$METHOD" "$API_PATH" "$all" <<'PY'
import json,sys
mode,entity,method,path,all_data=sys.argv[1:]
data=json.loads(all_data)
print(json.dumps({"ok":True,"mode":mode,"entity":entity or None,"method":method,"path":path,"count":len(data),"data":data}))
PY
  exit 0
fi

RESULT=$(call_once "$FINAL_PATH" "$BODY")
HTTP_CODE=$(echo "$RESULT" | tail -1)
RESPONSE_BODY=$(echo "$RESULT" | sed '$d')

if [[ "$HTTP_CODE" -ge 400 ]]; then
  CODE="$(error_code_for_http "$HTTP_CODE")"
  echo "{\"ok\":false,\"error_code\":\"$CODE\",\"error\":\"Procore API returned HTTP $HTTP_CODE\",\"method\":\"$METHOD\",\"path\":\"$API_PATH\",\"mode\":\"$MODE\",\"entity\":\"$ENTITY\",\"body\":$(python3 -c "import json,sys;\ntry: print(json.dumps(json.loads(sys.argv[1])))\nexcept: print(json.dumps(sys.argv[1]))" "$RESPONSE_BODY")}" >&2
  exit 1
fi

python3 - "$MODE" "$ENTITY" "$METHOD" "$API_PATH" "$RESPONSE_BODY" <<'PY'
import json,sys
mode,entity,method,path,body=sys.argv[1:]
try:
    data=json.loads(body)
    out={"ok":True,"mode":mode,"entity":entity or None,"method":method,"path":path}
    if isinstance(data,list):
        out["count"]=len(data)
    out["data"]=data
    print(json.dumps(out))
except Exception:
    print(json.dumps({"ok":True,"mode":mode,"entity":entity or None,"method":method,"path":path,"raw":body}))
PY
