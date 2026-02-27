---
name: buildai-procore
description: Full Procore REST API client (read AND write). Query and create/update any entity — RFIs, submittals, budgets, daily logs, change orders, punch items, drawings, meetings, inspections, and more. Supports GET, POST, PUT, PATCH, DELETE.
metadata: {"engine":{"emoji":"🏗️","requires":{"anyBins":["curl","python3"]}}}
---

# BuildAI Procore Integration

Full CRUD access to Procore's REST API. Read, create, update, delete any construction entity.

## ⚠️ IMPORTANT: User Authentication Flow

Before making ANY Procore API call, you MUST check if the user has authorized Procore access.

### Step 1: Check user's Procore connection
The agent has Procore connections assigned via the admin dashboard. When a user asks about Procore data:

1. Check if the agent has a Procore connection assigned (check agent_connections in admin DB)
2. If yes, check if the user has authorized: `GET /api/procore/status?connectionId=<id>`
3. If NOT authorized, tell the user:
   > "I can help with that! First, you need to connect your Procore account. Please click here to authorize: [Login to Procore](/api/procore/auth?connectionId=<id>)"
4. Once authorized, proceed with the API call using their token

### Step 2: Get user's access token
```bash
# Get token for API calls (auto-refreshes if expired)
curl -s http://localhost:3000/api/procore/token?connectionId=<id>
# Returns: { "authorized": true, "access_token": "...", "expires_in": 7200 }
# Or:      { "authorized": false, "authUrl": "/api/procore/auth?connectionId=<id>" }
```

### Step 3: Make API calls with user's token
Pass the user's access token to the Procore API script:
```bash
PROCORE_ACCESS_TOKEN="<user_token>" bash skills/buildai-procore/procore-api.sh projects
```

## How to Use

### Entity Mode (recommended)
```bash
# List supported entities
bash skills/buildai-procore/procore-api.sh entities

# Generic entity actions
bash skills/buildai-procore/procore-api.sh <entity> <action> [project_id] [id] [json_body]
# actions: list | get | create | update | delete

# Optional list controls
bash skills/buildai-procore/procore-api.sh --page 2 --per-page 50 --filter status=open rfis list <project_id>
bash skills/buildai-procore/procore-api.sh --all --per-page 100 rfis list <project_id>
```

### Generic Raw Mode (any endpoint, any method)
```bash
bash skills/buildai-procore/procore-api.sh <METHOD> <path> [json_body]
```

### Shortcuts (backward compatibility)
```bash
bash skills/buildai-procore/procore-api.sh projects
bash skills/buildai-procore/procore-api.sh rfis <project_id>
bash skills/buildai-procore/procore-api.sh submittals <project_id>
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

## PM Wrappers

```bash
bash skills/buildai-procore/procore-api.sh pm rfis-overdue <project_id>
bash skills/buildai-procore/procore-api.sh pm submittals-late <project_id>
bash skills/buildai-procore/procore-api.sh pm budget-variance <project_id> --threshold 5
```

## Rules
- **ALWAYS check user authorization before making API calls**
- If user is not authorized, provide the login link — do NOT attempt API calls
- Returns JSON envelope with `ok`, `mode`, `method`, `path`, and `data` fields
- company_id is automatically appended
- Token auto-refreshes when expired via /api/procore/token endpoint
- For write operations, wrap the entity in its type key: `{"rfi": {...}}`, `{"punch_item": {...}}`
