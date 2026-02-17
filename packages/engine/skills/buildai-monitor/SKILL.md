---
name: buildai-monitor
description: Manage project monitors and watches. Add, list, remove, and check monitors for RFIs, budgets, submittals, and other project items. Monitors trigger alerts when conditions change.
metadata: {"clawdbot":{"emoji":"👁️","requires":{"anyBins":["python3"]}}}
---

# BuildAI Monitor

Track and alert on project changes. Monitors watch for specific conditions and flag changes.

## How to Use

```bash
bash skills/buildai-monitor/monitor.sh <action> [args...]
```

## Actions

### List all active watches
```bash
bash skills/buildai-monitor/monitor.sh list
```

### Add a watch
```bash
bash skills/buildai-monitor/monitor.sh add "<type>" "<description>" "<project_id>" "<item_id>" "<condition>"
```

Types: `rfi`, `budget`, `submittal`, `insurance`, `schedule`, `custom`

Examples:
```bash
# Watch an RFI for status change
bash skills/buildai-monitor/monitor.sh add "rfi" "HVAC System RFI" "562949954971933" "rfi-1" "status_change"

# Watch budget for overruns
bash skills/buildai-monitor/monitor.sh add "budget" "Terminal A Budget" "562949954971933" "" "variance_over_5pct"

# Watch for new RFIs on a project
bash skills/buildai-monitor/monitor.sh add "rfi" "New RFIs on Terminal A" "562949954971933" "" "new_items"

# Watch insurance expiration
bash skills/buildai-monitor/monitor.sh add "insurance" "Expiring certs" "" "" "expiring_30days"
```

### Remove a watch
```bash
bash skills/buildai-monitor/monitor.sh remove <watch_id>
```

### Check all watches (run during heartbeat)
```bash
bash skills/buildai-monitor/monitor.sh check
```

### Set daily digest time
```bash
bash skills/buildai-monitor/monitor.sh digest "09:00"
```

## Watch File

Watches are stored in `watches.json` in the workspace root. The monitor script reads and writes this file.

## Proactive Behavior

After showing data to users, OFFER to set up monitors:
- Showed overdue RFIs → "Want me to keep an eye on these and notify you when they're resolved?"
- Showed budget data → "I can alert you if any budget line exceeds 5% variance. Want that?"
- Showed project status → "Want a daily digest of your projects every morning?"
