---
name: buildai-procore
description: Access Procore construction project management API (sandbox). Query live project data — projects, RFIs, submittals, budgets, daily logs, change orders, punch items, vendors, schedules, documents.
metadata: {"clawdbot":{"emoji":"🏗️","requires":{"anyBins":["curl","jq"]}}}
---

# BuildAI Procore Integration

Access Procore's construction management API for live project data.

## Usage

### Query an endpoint
```bash
bash command:"cd /home/apoorvgarg/buildai/packages/engine/skills/buildai-procore && bash procore-api.sh projects"
```

### Query with project scope
```bash
bash command:"cd /home/apoorvgarg/buildai/packages/engine/skills/buildai-procore && bash procore-api.sh rfis 12345"
```

### Check connection status
```bash
bash command:"cd /home/apoorvgarg/buildai/packages/engine/skills/buildai-procore && bash procore-api.sh status"
```

## Parameters

| Argument | Required | Description |
|----------|----------|-------------|
| `$1` | Yes | Endpoint name (see below) or "status" |
| `$2` | Sometimes | Project ID (required for project-scoped endpoints) |

## Available Endpoints

| Endpoint | Project-scoped | Description |
|----------|---------------|-------------|
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

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PROCORE_CLIENT_ID` | Yes | OAuth2 client ID |
| `PROCORE_CLIENT_SECRET` | Yes | OAuth2 client secret |
| `PROCORE_REDIRECT_URI` | No | OAuth redirect URI (default: http://localhost:3000/api/procore/callback) |
| `PROCORE_COMPANY_ID` | No | Procore company ID for API header |

## Token Management

OAuth tokens are stored in `.procore-tokens.json` in the workspace root.
The script auto-refreshes expired tokens.

To initiate OAuth:
```bash
bash command:"cd /home/apoorvgarg/buildai/packages/engine/skills/buildai-procore && bash procore-auth.sh authorize"
```
This outputs a URL the user must visit to authorize. After callback, tokens are saved automatically.

## Examples

```bash
# List all projects
bash command:"... && bash procore-api.sh projects"

# Get RFIs for project 12345
bash command:"... && bash procore-api.sh rfis 12345"

# Check if Procore is connected
bash command:"... && bash procore-api.sh status"
```
