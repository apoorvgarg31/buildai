---
name: buildai-watchlist
description: Manage user watchlist items (add/list/remove) and sync them into HEARTBEAT.md for proactive monitoring.
metadata: {"engine":{"emoji":"👀","requires":{"anyBins":["python3"]}}}
---

# BuildAI Watchlist

Use this skill when users want to track entities (RFI, submittal, punch item, change order, etc.) and get proactive updates.

## Commands

### Add item
```bash
python3 skills/buildai-watchlist/watchlist.py add \
  --system "Procore" \
  --type "RFI" \
  --id "102" \
  --label "RFI 102 - Loading Dock"
```

### List items
```bash
python3 skills/buildai-watchlist/watchlist.py list
```

### Remove item
```bash
python3 skills/buildai-watchlist/watchlist.py remove --watch-id "procore:rfi:102"
```

## Behavior
- Persists to `watchlist.json` in current workspace
- Auto-syncs a managed block into `HEARTBEAT.md`
- Prevents duplicates by watch-id

## Notes
- This is the canonical watchlist mechanism.
- Prefer this skill over ad-hoc file edits.
