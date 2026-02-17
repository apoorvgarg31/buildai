# TOOLS.md — Available Tools

## Construction PM Tools

### 1. Procore (`tools/procore.py`)
Query Procore PMIS — projects, RFIs, submittals, budget, pay apps, daily logs, and more.

```bash
# Setup: user signs in via OAuth
python3 tools/procore.py auth_url
python3 tools/procore.py set_token --token "ACCESS_TOKEN"

# Query data
python3 tools/procore.py list_projects
python3 tools/procore.py get_rfis --project_id 12345
python3 tools/procore.py get_submittals --project_id 12345
python3 tools/procore.py get_budget --project_id 12345
python3 tools/procore.py get_pay_apps --project_id 12345
python3 tools/procore.py get_daily_logs --project_id 12345 --date 2026-02-16
python3 tools/procore.py get_change_orders --project_id 12345
python3 tools/procore.py get_punch_list --project_id 12345
python3 tools/procore.py get_directory --project_id 12345
python3 tools/procore.py get_schedule --project_id 12345
```

Config: `connections/procore.json`

### 2. Database (`tools/database.py`)
Direct read-only database queries. Supports PostgreSQL, MySQL, SQLite.

```bash
# Manage connections
python3 tools/database.py list_connections
python3 tools/database.py add_connection --name "project_db" --type postgresql --host localhost --port 5432 --db mydb --user admin --password secret
python3 tools/database.py test_connection --name "project_db"

# Query
python3 tools/database.py list_tables --name "project_db"
python3 tools/database.py describe_table --name "project_db" --table "rfis"
python3 tools/database.py query --name "project_db" --sql "SELECT * FROM rfis WHERE status = 'open'"
```

Config: `connections/databases.json`
**SAFETY: Only SELECT queries allowed. No writes.**

### 3. Documents (`tools/documents.py`)
Upload, search, and query documents using Gemini File API. Vectorization is automatic.

```bash
# Setup
python3 tools/documents.py configure --api_key "YOUR_GEMINI_KEY"

# Upload documents
python3 tools/documents.py upload --file_path "/path/to/rfi_log.pdf" --display_name "RFI Log Feb 2026" --tags "rfi,riverside"
python3 tools/documents.py upload --file_path "/path/to/contract.pdf" --tags "contract,riverside"

# Query documents
python3 tools/documents.py ask --question "What is the retainage percentage?"
python3 tools/documents.py ask --question "What are the liquidated damages terms?" --file_ids "file1,file2"
python3 tools/documents.py search --query "concrete specifications"
python3 tools/documents.py summarize --file_id "file123"
python3 tools/documents.py extract --file_id "file123" --fields "contractor_name,contract_sum,completion_date"

# Manage
python3 tools/documents.py list
python3 tools/documents.py list --tags "riverside"
python3 tools/documents.py delete --file_id "file123"
```

Config: `connections/gemini.json`
Document index: `connections/documents.json`

## Connection Status
Check `connections/` directory for all configured connections.
Each tool manages its own connection config.

## How to Use Tools
All tools are Python scripts. Run them via:
```bash
python3 tools/<tool>.py <action> [--args]
```

Output is always JSON. Parse it and present results clearly to the user.

When tools fail, report the error clearly and suggest fixes.
