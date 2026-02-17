---
name: buildai-procore
description: Access Procore construction project management API (production). Query live project data — projects, RFIs, submittals, budgets, daily logs, change orders, punch items, vendors, schedules, documents.
metadata: {"clawdbot":{"emoji":"🏗️","requires":{"anyBins":["curl","python3"]}}}
---

# BuildAI Procore Integration

Query Procore's production API for live construction project data.

## How to Use

Run queries using the procore-api.sh script in this skill directory:

```bash
bash skills/buildai-procore/procore-api.sh projects
```

That's it. The script handles authentication, token refresh, and returns JSON.

## Examples

```bash
# List all projects
bash skills/buildai-procore/procore-api.sh projects

# Get RFIs for a project
bash skills/buildai-procore/procore-api.sh rfis 562949954991755

# Check Procore connection status
bash skills/buildai-procore/procore-api.sh status

# Get submittals for a project
bash skills/buildai-procore/procore-api.sh submittals 562949954991755

# Get daily logs
bash skills/buildai-procore/procore-api.sh daily_logs 562949954991755

# Get change orders
bash skills/buildai-procore/procore-api.sh change_orders 562949954991755
```

## Workflow

1. Call `status` to verify Procore is connected
2. Call `projects` to get project IDs and names
3. Use a project ID for project-scoped queries (rfis, submittals, etc.)

## Available Endpoints

| Endpoint | Needs Project ID | Description |
|----------|-----------------|-------------|
| `projects` | No | List all projects |
| `rfis` | Yes | RFIs for a project |
| `submittals` | Yes | Submittals for a project |
| `budget` | Yes | Budget line items |
| `daily_logs` | Yes | Daily logs |
| `change_orders` | Yes | Change order packages |
| `punch_items` | Yes | Punch list items |
| `vendors` | Yes | Vendors/subcontractors |
| `schedule` | Yes | Schedule tasks |
| `documents` | Yes | Project documents |

## Rules
- Returns JSON with `endpoint`, `count`, and `data` fields
- Token auto-refreshes when expired
- Environment variables loaded from process (set in engine start.sh)
