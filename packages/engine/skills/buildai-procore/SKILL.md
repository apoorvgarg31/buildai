---
name: buildai-procore
description: Full Procore REST API client (read AND write). Query and create/update any entity — RFIs, submittals, budgets, daily logs, change orders, punch items, drawings, meetings, inspections, and more. Supports GET, POST, PUT, PATCH, DELETE.
metadata: {"engine":{"emoji":"🏗️","requires":{"anyBins":["curl","python3"]}}}
---

# BuildAI Procore Integration

Full CRUD access to Procore's REST API. Read, create, update, delete any construction entity.

## How to Use

### Generic Mode (any endpoint, any method)
```bash
bash skills/buildai-procore/procore-api.sh <METHOD> <path> [json_body]
```

### Shortcuts (common read operations)
```bash
bash skills/buildai-procore/procore-api.sh projects
bash skills/buildai-procore/procore-api.sh rfis <project_id>
bash skills/buildai-procore/procore-api.sh submittals <project_id>
```

## Examples

### READ operations
```bash
# List all projects
bash skills/buildai-procore/procore-api.sh projects

# Get RFIs for a project
bash skills/buildai-procore/procore-api.sh rfis 562949954991755

# Get a specific RFI
bash skills/buildai-procore/procore-api.sh GET /rest/v1.0/projects/562949954991755/rfis/123

# List drawings
bash skills/buildai-procore/procore-api.sh GET /rest/v1.0/projects/562949954991755/drawings

# List meetings
bash skills/buildai-procore/procore-api.sh GET /rest/v1.0/projects/562949954991755/meetings

# List inspections
bash skills/buildai-procore/procore-api.sh GET /rest/v1.0/projects/562949954991755/inspections

# Search directory (people)
bash skills/buildai-procore/procore-api.sh GET /rest/v1.0/projects/562949954991755/directory
```

### CREATE operations
```bash
# Create an RFI
bash skills/buildai-procore/procore-api.sh POST /rest/v1.0/projects/562949954991755/rfis '{
  "rfi": {
    "subject": "Electrical conduit routing conflict",
    "assigned_id": 12345,
    "responsible_contractor_id": 67890,
    "due_date": "2026-03-01",
    "question": "There is a routing conflict between electrical conduits and HVAC ductwork at grid line B3. Please advise on preferred routing."
  }
}'

# Create a punch item
bash skills/buildai-procore/procore-api.sh POST /rest/v1.0/projects/562949954991755/punch_items '{
  "punch_item": {
    "name": "Touch up paint in lobby",
    "description": "Paint chipped near entrance door frame",
    "priority": "medium",
    "assignee_id": 12345,
    "due_date": "2026-03-15"
  }
}'

# Create a daily log entry
bash skills/buildai-procore/procore-api.sh POST /rest/v1.0/projects/562949954991755/daily_logs '{
  "daily_log": {
    "log_date": "2026-02-17",
    "notes": "Concrete pour completed for Level 3 slab. Weather clear."
  }
}'
```

### UPDATE operations
```bash
# Update RFI status
bash skills/buildai-procore/procore-api.sh PATCH /rest/v1.0/projects/562949954991755/rfis/123 '{
  "rfi": {"status": "closed", "answer": "Route conduits above ductwork per revised drawing A-301."}
}'

# Update punch item
bash skills/buildai-procore/procore-api.sh PATCH /rest/v1.0/projects/562949954991755/punch_items/456 '{
  "punch_item": {"status": "ready_for_review"}
}'
```

### DELETE operations
```bash
# Delete a punch item
bash skills/buildai-procore/procore-api.sh DELETE /rest/v1.0/projects/562949954991755/punch_items/456
```

## Available Shortcuts

| Shortcut | Method | Description |
|----------|--------|-------------|
| `projects` | GET | List all projects |
| `rfis` | GET | RFIs for a project |
| `submittals` | GET | Submittals for a project |
| `budget` | GET | Budget line items |
| `daily_logs` | GET | Daily logs |
| `change_orders` | GET | Change order packages |
| `punch_items` | GET | Punch list items |
| `vendors` | GET | Vendors/subcontractors |
| `schedule` | GET | Schedule tasks |
| `documents` | GET | Project documents |

## Procore REST API Reference

Base URL: `https://api.procore.com`
Docs: `https://developers.procore.com/reference`

Common project-scoped paths:
- `/rest/v1.0/projects/{pid}/rfis`
- `/rest/v1.0/projects/{pid}/submittals`
- `/rest/v1.0/projects/{pid}/punch_items`
- `/rest/v1.0/projects/{pid}/daily_logs`
- `/rest/v1.0/projects/{pid}/drawings`
- `/rest/v1.0/projects/{pid}/meetings`
- `/rest/v1.0/projects/{pid}/inspections`
- `/rest/v1.0/projects/{pid}/specifications`
- `/rest/v1.0/projects/{pid}/transmittals`
- `/rest/v1.0/projects/{pid}/change_order_packages`
- `/rest/v1.0/projects/{pid}/budget_line_items`
- `/rest/v1.0/projects/{pid}/directory`
- `/rest/v1.0/projects/{pid}/schedule/tasks`
- `/rest/v1.0/projects/{pid}/photos`
- `/rest/v1.0/projects/{pid}/correspondence`

Company_id is auto-appended. Token auto-refreshes.

## Rules
- Returns JSON with `method`, `path`, `count` (for arrays), and `data` fields
- company_id is automatically appended if not in the path
- Token auto-refreshes when expired (never overwrites token file on failure)
- For write operations, wrap the entity in its type key: `{"rfi": {...}}`, `{"punch_item": {...}}`
