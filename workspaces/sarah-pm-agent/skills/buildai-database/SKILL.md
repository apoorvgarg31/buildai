# BuildAI Database Skill

Query the project's PostgreSQL database with read-only SQL.

## Usage

When the user asks a data question (project counts, RFI status, budget numbers, etc.), use this skill to run actual SQL queries against the database.

## Scripts

### query.sh
Execute a read-only SQL query. Returns JSON results.

```bash
bash /path/to/skills/buildai-database/query.sh "SELECT * FROM projects LIMIT 5"
```

**Rules:**
- Only SELECT and WITH statements are allowed
- INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE are blocked
- LIMIT is auto-applied if not specified (default 100)
- Query timeout: 30 seconds
- Returns JSON array of result rows

**Available tables:**
- `projects` — id, name, status, start_date, end_date, budget, contract_sum
- `rfis` — id, project_id, number, subject, status, priority, assigned_to, due_date
- `submittals` — id, project_id, number, title, status, due_date
- `daily_logs` — id, project_id, log_date, weather, notes, created_by
- `change_orders` — id, project_id, number, title, amount, status
- `budget_line_items` — id, project_id, cost_code, description, original_budget, revised_budget, committed, actual
- `punch_items` — id, project_id, location, description, status, assigned_to
- `insurance_certificates` — id, project_id, vendor, policy_type, expiration_date
- `vendors` — id, project_id, name, trade, contact_email, status
- `team_members` — id, project_id, name, role, email, company

**Pre-built views (use these when possible):**
- `v_project_dashboard` — project overview with stats
- `v_overdue_rfis` — RFIs past due date
- `v_expiring_insurance` — certs expiring within 90 days
- `v_project_budget_summary` — budget rollup per project

## Environment
Reads `.env` from skill directory. Required vars:
- DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD
