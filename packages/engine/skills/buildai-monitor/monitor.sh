#!/usr/bin/env bash
# BuildAI Monitor — manage project watches and alerts
# Usage: monitor.sh <action> [args...]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Resolve workspace root (go up through symlink)
WORKSPACE_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
WATCHES_FILE="$WORKSPACE_ROOT/watches.json"

# Ensure watches file exists
if [ ! -f "$WATCHES_FILE" ]; then
  echo '{"watches":[],"lastCheck":null,"digestSchedule":null}' > "$WATCHES_FILE"
fi

ACTION="${1:-}"
shift || true

case "$ACTION" in
  list)
    python3 -c "
import json
with open('$WATCHES_FILE') as f:
    data = json.load(f)
watches = data.get('watches', [])
if not watches:
    print(json.dumps({'watches': [], 'count': 0, 'message': 'No active watches. Add one with: monitor.sh add <type> <description> <project_id> <item_id> <condition>'}))
else:
    print(json.dumps({'watches': watches, 'count': len(watches), 'digest': data.get('digestSchedule'), 'lastCheck': data.get('lastCheck')}))
"
    ;;

  add)
    TYPE="${1:-custom}"
    DESC="${2:-Watch}"
    PROJECT_ID="${3:-}"
    ITEM_ID="${4:-}"
    CONDITION="${5:-status_change}"
    
    python3 -c "
import json, time, hashlib
with open('$WATCHES_FILE') as f:
    data = json.load(f)

watch_id = 'w-' + hashlib.md5(('$TYPE-$PROJECT_ID-$ITEM_ID-$CONDITION-' + str(time.time())).encode()).hexdigest()[:8]
watch = {
    'id': watch_id,
    'type': '$TYPE',
    'description': '$DESC',
    'projectId': '$PROJECT_ID' or None,
    'itemId': '$ITEM_ID' or None,
    'condition': '$CONDITION',
    'createdAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
    'lastChecked': None,
    'lastStatus': None,
    'triggered': False
}
data['watches'].append(watch)
with open('$WATCHES_FILE', 'w') as f:
    json.dump(data, f, indent=2)
print(json.dumps({'added': watch, 'totalWatches': len(data['watches'])}))
"
    ;;

  remove)
    WATCH_ID="${1:-}"
    if [ -z "$WATCH_ID" ]; then
      echo '{"error": "Usage: monitor.sh remove <watch_id>"}'
      exit 1
    fi
    python3 -c "
import json
with open('$WATCHES_FILE') as f:
    data = json.load(f)
before = len(data['watches'])
data['watches'] = [w for w in data['watches'] if w['id'] != '$WATCH_ID']
after = len(data['watches'])
with open('$WATCHES_FILE', 'w') as f:
    json.dump(data, f, indent=2)
if before == after:
    print(json.dumps({'error': 'Watch not found: $WATCH_ID'}))
else:
    print(json.dumps({'removed': '$WATCH_ID', 'remainingWatches': after}))
"
    ;;

  check)
    # Check all watches against current data
    # This is called during heartbeat
    python3 << PYEOF
import json, subprocess, time, os

watches_file = "$WATCHES_FILE"
with open(watches_file) as f:
    data = json.load(f)

watches = data.get('watches', [])
if not watches:
    print(json.dumps({"alerts": [], "message": "No watches configured"}))
    exit(0)

alerts = []
procore_script = "$WORKSPACE_ROOT/skills/buildai-procore/procore-api.sh"

for watch in watches:
    try:
        w_type = watch.get('type', '')
        project_id = watch.get('projectId', '')
        condition = watch.get('condition', '')
        
        if w_type == 'rfi' and project_id:
            result = subprocess.run(
                ['bash', procore_script, 'rfis', project_id],
                capture_output=True, text=True, timeout=30
            )
            if result.returncode == 0:
                rfi_data = json.loads(result.stdout)
                rfis = rfi_data.get('data', [])
                
                if condition == 'new_items':
                    last_status = watch.get('lastStatus') or {}
                    last_count = last_status.get('count', 0)
                    current_count = len(rfis)
                    if current_count > last_count and last_count > 0:
                        new_rfis = rfis[last_count:]
                        alerts.append({
                            'watchId': watch['id'],
                            'type': 'new_rfis',
                            'message': f"{current_count - last_count} new RFI(s) on {watch['description']}",
                            'data': [{'subject': r.get('subject', ''), 'status': r.get('status', '')} for r in new_rfis[:5]]
                        })
                    watch['lastStatus'] = {'count': current_count}
                
                elif condition == 'status_change':
                    item_id = watch.get('itemId', '')
                    for rfi in rfis:
                        if str(rfi.get('id', '')) == item_id or str(rfi.get('number', '')) == item_id:
                            current_status = rfi.get('status', '')
                            prev_status = (watch.get('lastStatus') or {}).get('status', '')
                            if prev_status and current_status != prev_status:
                                alerts.append({
                                    'watchId': watch['id'],
                                    'type': 'status_change',
                                    'message': f"RFI '{rfi.get('subject', '')}' changed from {prev_status} to {current_status}",
                                    'data': rfi
                                })
                            watch['lastStatus'] = {'status': current_status}
                            break
        
        elif w_type == 'budget' and project_id:
            result = subprocess.run(
                ['bash', procore_script, 'budget', project_id],
                capture_output=True, text=True, timeout=30
            )
            if result.returncode == 0:
                budget_data = json.loads(result.stdout)
                items = budget_data.get('data', [])
                overruns = []
                for item in items:
                    original = float(item.get('original_budget_amount', 0) or 0)
                    actual = float(item.get('actual_costs', 0) or 0)
                    if original > 0 and actual > original * 1.05:
                        overruns.append({
                            'code': item.get('cost_code', ''),
                            'description': item.get('description', ''),
                            'budget': original,
                            'actual': actual,
                            'variance_pct': round((actual - original) / original * 100, 1)
                        })
                if overruns:
                    alerts.append({
                        'watchId': watch['id'],
                        'type': 'budget_overrun',
                        'message': f"{len(overruns)} budget line(s) over 5% on {watch['description']}",
                        'data': overruns[:5]
                    })
        
        watch['lastChecked'] = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
        if alerts and alerts[-1].get('watchId') == watch['id']:
            watch['triggered'] = True
        
    except Exception as e:
        alerts.append({
            'watchId': watch.get('id', ''),
            'type': 'error',
            'message': f"Error checking {watch.get('description', '')}: {str(e)}"
        })

data['lastCheck'] = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
with open(watches_file, 'w') as f:
    json.dump(data, f, indent=2)

print(json.dumps({'alerts': alerts, 'watchesChecked': len(watches), 'alertCount': len(alerts)}))
PYEOF
    ;;

  digest)
    SCHEDULE="${1:-09:00}"
    python3 -c "
import json
with open('$WATCHES_FILE') as f:
    data = json.load(f)
data['digestSchedule'] = '$SCHEDULE'
with open('$WATCHES_FILE', 'w') as f:
    json.dump(data, f, indent=2)
print(json.dumps({'digestSchedule': '$SCHEDULE', 'message': 'Daily digest set for $SCHEDULE'}))
"
    ;;

  *)
    echo '{"error": "Unknown action. Usage: monitor.sh <list|add|remove|check|digest> [args...]"}'
    exit 1
    ;;
esac
