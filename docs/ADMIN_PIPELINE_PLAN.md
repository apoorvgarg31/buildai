# BuildAI — Admin → Agent → Skills Pipeline
## Detailed Implementation Plan

**Goal:** Wire end-to-end: Admin creates connection → creates agent → assigns connections as skills → agent workspace provisioned → PM chats → engine dispatches skills.

---

## How Clawdbot Already Works (What We Build On)

### Agent Definition
Agents are defined in `agents.list[]` in the config file:
```json5
{
  "agents": {
    "defaults": {
      "model": { "primary": "anthropic/claude-sonnet-4-20250514" },
      "workspace": "../../workspaces/default-agent"
    },
    "list": [
      {
        "id": "pm-sarah",
        "name": "Sarah's PM Agent",
        "workspace": "../../workspaces/pm-sarah",
        "model": { "primary": "anthropic/claude-sonnet-4-20250514" },
        "identity": {
          "name": "BuildAI",
          "emoji": "🏗️"
        }
      }
    ]
  }
}
```

### Agent → Session Routing
Session keys follow the format `agent:<agentId>:<channel>:<sessionId>`.
When `chat.send` is called with a sessionKey, the engine resolves the agentId from the key and loads the agent's workspace, model, and skills.

If no agentId in the session key, it uses the default agent.

### Skill Discovery
Skills are loaded from multiple sources (in priority order):
1. **Workspace skills dir** — `{workspace}/skills/` (per-agent)
2. **Managed skills dir** — `~/.clawdbot/skills/` (global)
3. **Bundled skills dir** — `packages/engine/skills/` (built-in)
4. **Extra dirs** — `config.skills.load.extraDirs[]`

Each skill is a directory with a `SKILL.md` file that describes the skill to the LLM and tells it what scripts/tools are available.

### Skill Execution
When the LLM decides to use a skill, it uses the `exec` tool to run the skill's scripts. The skill's SKILL.md tells the LLM:
- What the skill does
- What scripts are available
- What arguments they take
- What environment variables they need

The LLM generates the appropriate `exec` command, the engine runs it, and returns results to the LLM.

---

## Point 1: Backend API for Admin Operations

### What
A set of API routes that the admin UI calls to manage agents, connections, and users. These routes modify the engine's config file and provision workspaces on disk.

### Architecture Decision
**Option A:** Next.js API routes that directly modify config + filesystem.
**Option B:** Engine gateway methods (extend the gateway protocol).

**Decision: Option A** — Next.js API routes.
Reasoning: The gateway protocol is complex and designed for chat/session operations. Admin CRUD is simpler and maps cleanly to REST. The API routes read/write the engine config file and workspace directories directly.

### API Routes

```
POST   /api/admin/agents          — Create agent
GET    /api/admin/agents          — List agents
GET    /api/admin/agents/:id      — Get agent details
PUT    /api/admin/agents/:id      — Update agent
DELETE /api/admin/agents/:id      — Delete agent

POST   /api/admin/connections     — Create connection
GET    /api/admin/connections     — List connections
GET    /api/admin/connections/:id — Get connection details
PUT    /api/admin/connections/:id — Update connection
DELETE /api/admin/connections/:id — Delete connection
POST   /api/admin/connections/:id/test — Test connection

GET    /api/admin/users           — List users
POST   /api/admin/users           — Create user
PUT    /api/admin/users/:id       — Update user
DELETE /api/admin/users/:id       — Delete user
```

### Data Storage
Admin data stored in a SQLite database at `data/buildai-admin.db`:

```sql
-- Users table
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',  -- 'admin' | 'user'
  agent_id TEXT,                       -- assigned agent
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Connections table  
CREATE TABLE connections (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,          -- 'procore' | 'database' | 'p6' | 'unifier' | 'documents' | 'llm'
  config TEXT NOT NULL,        -- JSON: host, port, db_name, etc. (no secrets)
  status TEXT DEFAULT 'pending', -- 'connected' | 'pending' | 'error'
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Connection credentials (encrypted separately)
CREATE TABLE connection_secrets (
  connection_id TEXT PRIMARY KEY REFERENCES connections(id),
  encrypted_data TEXT NOT NULL   -- AES-256 encrypted JSON of secrets
);

-- Agent-connection assignments
CREATE TABLE agent_connections (
  agent_id TEXT NOT NULL,
  connection_id TEXT NOT NULL,
  PRIMARY KEY (agent_id, connection_id)
);

-- Agents table (mirrors config but adds metadata)
CREATE TABLE agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  user_id TEXT REFERENCES users(id),
  model TEXT DEFAULT 'anthropic/claude-sonnet-4-20250514',
  workspace_dir TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### Files

```
packages/web/src/
  app/api/admin/
    agents/route.ts          — GET (list) + POST (create)
    agents/[id]/route.ts     — GET + PUT + DELETE
    connections/route.ts     — GET (list) + POST (create)
    connections/[id]/route.ts — GET + PUT + DELETE  
    connections/[id]/test/route.ts — POST (test connection)
    users/route.ts           — GET + POST
    users/[id]/route.ts      — GET + PUT + DELETE
  lib/
    admin-db.ts              — SQLite init, queries, helpers
    encryption.ts            — AES-256 encrypt/decrypt for secrets
    engine-config.ts         — Read/write buildai.config.json5
    workspace-provisioner.ts — Create/delete agent workspaces
```

### Security
- All `/api/admin/*` routes check for admin role (from auth cookie/header)
- Connection secrets encrypted at rest with AES-256
- Encryption key from env var `BUILDAI_ENCRYPTION_KEY`
- Secrets NEVER returned in GET responses (only `has_secret: true/false`)

---

## Point 2: Agent Creation → Workspace Provisioning

### What
When admin clicks "Create Agent" and assigns it to a user, the system:
1. Creates a workspace directory
2. Copies template files (SOUL, ACTIVE, MEMORY, HEARTBEAT, AGENTS, TOOLS)
3. Writes skill configs based on assigned connections
4. Adds the agent to the engine config
5. Restarts/reloads the engine to pick up the new agent

### Flow

```
Admin UI: "Create Agent"
  ↓
POST /api/admin/agents
  body: { name, userId, model, connectionIds: ["conn-1", "conn-2"] }
  ↓
1. Generate agentId (slugified name or UUID)
  ↓
2. Create workspace directory:
   workspaces/{agentId}/
   ├── SOUL.md        ← copy from workspaces/templates/SOUL.md
   ├── AGENTS.md      ← copy from workspaces/templates/AGENTS.md
   ├── TOOLS.md       ← generated with connection details
   ├── HEARTBEAT.md   ← copy from workspaces/templates/HEARTBEAT.md
   ├── ACTIVE.md      ← fresh (empty state)
   ├── MEMORY.md      ← fresh (empty)
   ├── memory/        ← empty dir
   ├── sessions/      ← empty dir
   └── skills/        ← symlinks or copies of assigned skill dirs
  ↓
3. For each assigned connection:
   - Look up connection type → skill mapping
   - Copy/symlink the skill into workspace/skills/
   - Write connection config to skill's env file
   e.g. connection type "database" → copies skills/buildai-database/
        writes workspace/skills/buildai-database/.env with DB_HOST, DB_PORT, etc.
  ↓
4. Add agent to engine config:
   agents.list[] += {
     id: agentId,
     workspace: "../../workspaces/{agentId}",
     model: { primary: selectedModel },
     identity: { name: "BuildAI", emoji: "🏗️" }
   }
  ↓
5. Write config file → signal engine to reload
  ↓
6. Insert into SQLite (agents table + agent_connections)
  ↓
7. Return { agentId, sessionKey: "agent:{agentId}:webchat:default" }
```

### Template Files
Located at `workspaces/templates/`:

```
workspaces/templates/
├── SOUL.md       — Construction PM personality (shared by all agents)
├── AGENTS.md     — Standard agent behavior rules
├── TOOLS.md      — Base tool configuration (populated per-agent)
├── HEARTBEAT.md  — Default monitoring checklist
├── ACTIVE.md     — Empty starting state
└── MEMORY.md     — Empty starting memory
```

### Connection → Skill Mapping

| Connection Type | Skill Directory        | Env Vars Needed                          |
|----------------|------------------------|------------------------------------------|
| database       | buildai-database       | DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD |
| procore        | buildai-procore        | PROCORE_CLIENT_ID, PROCORE_CLIENT_SECRET, PROCORE_COMPANY_ID |
| documents      | buildai-documents      | (file paths only)                        |
| p6             | buildai-p6             | P6_BASE_URL, P6_USERNAME, P6_PASSWORD    |
| unifier        | buildai-unifier        | UNIFIER_BASE_URL, UNIFIER_USERNAME, UNIFIER_PASSWORD |
| llm            | (engine config)        | Model setting in agent config            |

### Engine Config Reload
After modifying `buildai.config.json5`:
- Option 1: Send SIGUSR1 to engine process (hot reload)
- Option 2: Restart engine process
- The admin API needs to know the engine PID (stored in a pidfile or discovered via port)

### Files

```
packages/web/src/lib/
  workspace-provisioner.ts  — createWorkspace(), deleteWorkspace(), listWorkspaces()
  engine-config.ts          — readConfig(), writeConfig(), addAgent(), removeAgent()

workspaces/
  templates/                — Template files for new agents
    SOUL.md
    AGENTS.md  
    TOOLS.md
    HEARTBEAT.md
    ACTIVE.md
    MEMORY.md
```

---

## Point 3: Connection Management → Skill Assignment

### What
Connections are external system configs (host, credentials, type). When assigned to an agent, the connection's type determines which skill gets installed, and the connection's credentials are made available to that skill.

### Flow: Create Connection

```
Admin UI: "Add Connection" → selects type "Database"
  ↓
POST /api/admin/connections
  body: {
    name: "Project Database",
    type: "database",
    config: { host: "db.example.com", port: 5432, dbName: "projects" },
    secrets: { username: "pm_readonly", password: "s3cret" }
  }
  ↓
1. Insert into connections table (config as JSON, no secrets)
2. Encrypt secrets → insert into connection_secrets table
3. Return { id: "conn-xxx", status: "pending" }
```

### Flow: Test Connection

```
POST /api/admin/connections/conn-xxx/test
  ↓
1. Load connection config + decrypt secrets
2. Based on type, run test:
   - database: try to connect and run "SELECT 1"
   - procore: try to hit /rest/v1.0/me endpoint
   - p6: try to authenticate
3. Update status in DB
4. Return { ok: true/false, message: "Connected to PostgreSQL, 5 tables found" }
```

### Flow: Assign Connection to Agent

```
PUT /api/admin/agents/pm-sarah
  body: { connectionIds: ["conn-db-1", "conn-procore-1"] }
  ↓
1. Update agent_connections table
2. For each connection:
   a. Look up connection type
   b. Copy skill directory into agent's workspace/skills/
   c. Write .env file with decrypted connection config
      e.g. workspaces/pm-sarah/skills/buildai-database/.env:
        DB_HOST=db.example.com
        DB_PORT=5432
        DB_NAME=projects
        DB_USER=pm_readonly
        DB_PASSWORD=s3cret
3. Reload engine (skills are re-discovered on next session)
```

### Security: Credential Flow
```
Admin enters creds in UI
  → POST /api/admin/connections (HTTPS)
  → Encrypted at rest in SQLite (AES-256)
  → Decrypted only when:
    a. Writing .env to agent workspace (on assignment)
    b. Testing connection (one-time use, not stored in memory)
  → Skill reads .env at execution time
  → .env files are in workspace dirs (not in git, not in web package)
```

---

## Point 4: Skill Registration → Engine Tool Execution

### What
The engine needs to discover skills and make them available as tools. Clawdbot already does this — we just need to ensure our BuildAI skills follow the correct format.

### How Clawdbot Skills Work
1. Engine scans skill directories on startup
2. Each skill has a `SKILL.md` with `<description>` and `<location>`
3. SKILL.md is injected into the system prompt as `<available_skills>`
4. When the LLM decides to use a skill, it uses the `exec` tool to run the skill's scripts
5. The scripts read their config from env vars or local .env files

### What Our Skills Need

#### buildai-database/SKILL.md
```markdown
# BuildAI Database Skill

Query connected databases with read-only SQL.

## Usage
Run queries against the agent's assigned database connection.

## Scripts
- `query.sh <sql>` — Execute a read-only SQL query, returns JSON
  - Only SELECT and WITH statements allowed
  - Automatically applies LIMIT 100 if not specified
  - Returns: { columns: [...], rows: [...], rowCount: N }

## Environment
Reads from .env in skill directory:
- DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD

## Safety
- Blocks INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE
- Read-only connection (if DB supports it)
- Query timeout: 30 seconds
```

#### buildai-database/query.sh
```bash
#!/bin/bash
# Reads .env from script directory, executes SQL, returns JSON
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
if [ -f "$SCRIPT_DIR/.env" ]; then
  set -a; source "$SCRIPT_DIR/.env"; set +a
fi

SQL="$1"

# Safety check
if echo "$SQL" | grep -qiE '\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|GRANT|REVOKE)\b'; then
  echo '{"error": "Only SELECT/WITH queries are allowed"}' >&2
  exit 1
fi

PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "${DB_PORT:-5432}" -U "$DB_USER" -d "$DB_NAME" \
  -c "SET statement_timeout = '30s';" \
  -c "$SQL" \
  --no-align --tuples-only --pset=format=json 2>&1

exit $?
```

#### buildai-procore/SKILL.md
```markdown
# BuildAI Procore Skill

Query Procore PMIS for project data.

## Scripts
- `procore-api.sh <endpoint> [params]` — Call Procore REST API
  - Endpoints: projects, rfis, submittals, budget, daily_logs, etc.
  - Auto-refreshes OAuth tokens
  - Returns: JSON response from Procore API

- `procore-auth.sh init` — Generate OAuth authorization URL
- `procore-auth.sh callback <code>` — Exchange auth code for tokens
- `procore-auth.sh status` — Check if tokens are valid

## Environment
- PROCORE_CLIENT_ID, PROCORE_CLIENT_SECRET
- PROCORE_COMPANY_ID
- Token file: .procore-tokens.json in skill directory
```

### Verification
After provisioning, the skill should appear in the engine's system prompt:
```xml
<available_skills>
  <skill>
    <name>buildai-database</name>
    <description>Query connected databases with read-only SQL.</description>
    <location>/path/to/workspaces/pm-sarah/skills/buildai-database/SKILL.md</location>
  </skill>
</available_skills>
```

The LLM then uses `exec` to run `query.sh` when it needs database data.

---

## Point 5: End-to-End Pipeline

### Complete Flow

```
SETUP PHASE (Admin does this once):

1. Admin logs in → sees Admin Dashboard
2. Admin goes to Connections → "Add Connection"
   → Enters: name="Project DB", type=database, host=localhost, port=5432, db=buildai_demo
   → Enters credentials (encrypted at rest)
   → Tests connection → "Connected! 10 tables found"
   → Status: connected ✅

3. Admin goes to Agents → "Create Agent"
   → Enters: name="Sarah's Agent", model=Sonnet
   → Assigns connections: [Project DB]
   → System provisions workspace:
     workspaces/pm-sarah/
       SOUL.md, AGENTS.md, TOOLS.md, HEARTBEAT.md, ACTIVE.md, MEMORY.md
       skills/buildai-database/SKILL.md + query.sh + .env (with DB creds)
   → Agent added to engine config
   → Engine reloaded

4. Admin goes to Users → assigns agent to user pm@buildai.com


RUNTIME PHASE (PM uses this daily):

5. PM logs in → Chat page
   → Frontend connects to engine via WebSocket
   → Session key: "agent:pm-sarah:webchat:default"

6. PM types: "How many open RFIs do we have?"
   → POST /api/chat → engine gateway → chat.send
   → Engine resolves agent "pm-sarah"
   → Loads workspace: workspaces/pm-sarah/
   → System prompt includes SOUL.md + available_skills (buildai-database)
   → LLM sees database skill, decides to query

7. LLM generates:
   exec("cd /path/to/skills/buildai-database && bash query.sh 'SELECT COUNT(*) FROM rfis WHERE status = \'Open\''")
   → Engine executes query.sh
   → query.sh reads .env → connects to DB → runs SQL → returns JSON
   → LLM formats: "You have 19 open RFIs. 4 are critical priority."

8. PM sees response in chat UI ✅
```

### Implementation Order

```
Step 1: Admin Database + API skeleton
  Files: lib/admin-db.ts, lib/encryption.ts
  API: /api/admin/connections (CRUD), /api/admin/agents (CRUD), /api/admin/users (CRUD)
  Test: curl POST/GET/DELETE all work
  Time: ~3 hours

Step 2: Workspace Provisioner
  Files: lib/workspace-provisioner.ts, workspaces/templates/*
  Function: createWorkspace(agentId, templateDir) → provisions full workspace
  Test: Call function → workspace dir created with all files
  Time: ~2 hours

Step 3: Engine Config Manager
  Files: lib/engine-config.ts
  Functions: addAgent(config), removeAgent(config), reloadEngine()
  Test: Add agent → config file updated → engine picks it up
  Time: ~2 hours

Step 4: Connection → Skill Wiring
  Files: lib/skill-provisioner.ts
  Function: assignConnectionToAgent(connectionId, agentId)
    → copies skill dir to workspace
    → writes .env with decrypted creds
  Test: Assign DB connection → skill appears in workspace → engine sees it
  Time: ~2 hours

Step 5: Fix Skill Scripts
  Files: skills/buildai-database/query.sh, skills/buildai-procore/procore-api.sh
  Make scripts actually work (test with real DB, real Procore sandbox)
  Test: bash query.sh "SELECT COUNT(*) FROM projects" → returns JSON
  Time: ~2 hours

Step 6: Wire Admin UI to Real APIs
  Files: AdminAgentsPage.tsx, AdminConnectionsPage.tsx, AdminUsersPage.tsx
  Replace demo data with fetch() calls to /api/admin/*
  Test: Create connection in UI → shows up in list → test button works
  Time: ~3 hours

Step 7: End-to-End Test
  Full flow: create connection → create agent → assign → chat → skill executes → response
  Test: All steps from the flow above
  Time: ~2 hours
```

### Total Estimated Time: ~16 hours

### Dependencies
- `better-sqlite3` — SQLite for admin data (add to web package)
- No other new dependencies needed

### Env Vars (new)
- `BUILDAI_ENCRYPTION_KEY` — AES-256 key for secret encryption
- `BUILDAI_ENGINE_PID_FILE` — Path to engine PID file (for reload)
- `BUILDAI_WORKSPACES_DIR` — Base dir for agent workspaces (default: `../../workspaces`)
- `BUILDAI_ENGINE_CONFIG` — Path to buildai.config.json5

---

## What We're NOT Building (Scope Boundaries)

- No real auth system (keep fake login for demo)
- No multi-tenancy (single company)
- No billing/usage tracking (demo only)
- No agent-to-agent communication
- No real-time config hot-reload (restart is fine)
- No OAuth flow for Procore in this phase (credentials entered manually by admin)
  - OAuth flow will be added as a separate skill enhancement later
