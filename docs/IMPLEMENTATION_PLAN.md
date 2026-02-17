# BuildAI — Implementation Plan

**Product:** Reactive AI Assistant for Construction Project Managers
**Codename:** BuildAI
**Started:** February 17, 2026
**Owner:** Apy (Apoorv Garg)
**Builder:** Jarvis

---

## Vision
A personal AI assistant for construction PMs that connects to their PMIS systems (Procore, Unifier, P6, Kahua), databases, and documents. Reactive, not passive — it comes to PMs with problems and offers solutions. Built on a fork of Clawdbot's engine.

## Architecture Decisions (Locked)
- **Engine:** Fork of Clawdbot — same memory, compaction, heartbeat, cron
- **Integrations:** Built as Skills (not custom tools) — each connection = one skill
- **Connection Manager:** Shared skill that manages `connections/*.json`
- **Documents:** Gemini File API for vectorization (no custom RAG pipeline)
- **LLM:** Configurable per deployment (Gemini/OpenAI/Anthropic) — also a connection
- **Channel:** Webchat first (Clawdbot webchat protocol)
- **Multi-tenancy:** NOT now — single deployment per company
- **Frontend:** NOT now — CLI first, prove engine works, then build Mission Control
- **Auth:** Procore OAuth is user-scoped — each PM signs in themselves

## Key Principles
1. Fork, don't rebuild — strip what we don't need, keep what works
2. Skills pattern for ALL integrations
3. CLI first — prove everything works before touching frontend
4. Reactive agent behavior is THE differentiator
5. Single company deployment — no multi-tenant complexity yet

---

## Phase 1: Engine Fork & Core (Week 1-2)
**Goal:** Working Clawdbot fork, stripped down, running as CLI

### Task 1.1: Fork Clawdbot Source
- [ ] Clone Clawdbot source (from GitHub or npm package)
- [ ] Set up as independent project with own git repo
- [ ] Install dependencies, verify it builds and runs
- **Acceptance:** `node buildai-engine/dist/entry.js gateway` starts without errors

### Task 1.2: Disable Unnecessary Components (don't delete — disable for future)
- [ ] Disable: Telegram bot management (keep webchat only)
- [ ] Disable: Node pairing & discovery
- [ ] Disable: Browser automation
- [ ] Disable: ClawdHub skill marketplace
- [ ] Disable: Camera/screen tools
- [ ] Disable: Canvas/A2UI
- [ ] Keep: Memory architecture, compaction, heartbeat, cron, agent engine, tool system, exec, webchat
- [ ] Write test: engine starts without errors with disabled components
- **Acceptance:** Stripped engine starts, agent responds via webchat, no errors. Disabled components can be re-enabled via config.

### Task 1.3: Construction PM Agent Configuration
- [ ] Create workspace with SOUL.md (reactive construction PM personality)
- [ ] Create AGENTS.md with construction-specific behavior rules
- [ ] Create TOOLS.md documenting available skills
- [ ] Create HEARTBEAT.md with construction-specific checks
- [ ] Configure agent to use construction persona
- **Acceptance:** Chat with agent via webchat, it responds as construction PM assistant, understands construction terminology

### Task 1.4: Verify Core Systems
- [ ] Test memory persistence across sessions (restart gateway, memory retained)
- [ ] Test heartbeat fires on schedule
- [ ] Test cron jobs create and execute
- [ ] Test compaction works (fill context, verify graceful compaction)
- **Acceptance:** All four systems working identically to Clawdbot

---

## Phase 2: Connection Manager & First Integration (Week 2-3)
**Goal:** Connection manager skill + working Procore integration

### Task 2.1: Connection Manager Skill
- [ ] Create `skills/connection-manager/SKILL.md`
- [ ] Create `scripts/manage_connections.py`
- [ ] Actions: add, remove, list, test, status
- [ ] Connections stored in `connections/*.json`
- [ ] Support connection types: procore, database, documents, p6, unifier, llm
- [ ] Each connection has: name, type, status, credentials, metadata
- **Acceptance:** Agent can list/add/test connections via chat. `connections/` dir populated correctly.

### Task 2.2: Procore Skill (Read Operations)
- [ ] Create `skills/procore/SKILL.md` with full instructions
- [ ] Create `scripts/procore.py` — OAuth flow + all read API endpoints
- [ ] Read actions: auth, list_projects, get_rfis, get_submittals, get_budget, get_pay_apps, get_daily_logs, get_change_orders, get_punch_list, get_directory, get_schedule, get_documents
- [ ] Reads credentials from `connections/procore.json` (managed by connection manager)
- [ ] Error handling: token expired → refresh flow, connection down → clear error
- [ ] Include `references/procore-api.md` with endpoint documentation
- [ ] Write tests: mock API responses, verify parsing, verify error handling
- **Acceptance:** Agent queries real Procore data via chat. "Show me open RFIs on [project]" returns real data.

### Task 2.3: Procore Skill (Write Operations)
- [ ] Add write actions: create_rfi, update_rfi_status, create_submittal, add_daily_log, create_punch_item, upload_document, add_observation
- [ ] All write operations require explicit user confirmation before executing
- [ ] Agent asks: "I'll create RFI #043 for missing electrical specs. Confirm?"
- [ ] Rollback info: agent tells user what was created and how to undo if needed
- [ ] Write tests: verify confirmation flow, verify API payload, verify error handling
- **Acceptance:** "Create an RFI for the missing concrete specs on Riverside" → agent confirms → creates RFI in Procore → returns RFI number + link.

### Task 2.4: LLM Connection Skill

### Task 2.5: LLM Connection Skill
- [ ] Create `skills/llm-config/SKILL.md`
- [ ] Allow configuring which LLM provider to use (Gemini, OpenAI, Anthropic)
- [ ] Store in `connections/llm.json`
- [ ] Agent uses configured LLM for responses
- **Acceptance:** Can switch between LLM providers via connection config

---

## Phase 3: Database & Documents (Week 3-4)
**Goal:** Database queries and document Q&A working

### Task 3.1: Database Skill
- [ ] Create `skills/database/SKILL.md`
- [ ] Create `scripts/database.py`
- [ ] Actions: list_connections, list_tables, describe_table, query (READ-ONLY)
- [ ] Support: PostgreSQL, MySQL, SQLite
- [ ] Safety: only SELECT/WITH/SHOW/DESCRIBE allowed, auto-LIMIT
- [ ] Reads connection config from `connections/databases.json`
- **Acceptance:** Agent answers "How many open RFIs are in the database?" by querying SQL and returning results.

### Task 3.2: Documents Skill (Gemini File API)
- [ ] Create `skills/documents/SKILL.md`
- [ ] Create `scripts/documents.py`
- [ ] Actions: upload, list, delete, ask, search, summarize, extract
- [ ] Gemini File API handles vectorization automatically
- [ ] Document registry in `connections/documents.json`
- [ ] Tags/categories for organization
- [ ] Agent remembers documents across sessions (registry persisted)
- **Acceptance:** Upload a PDF contract, ask "What is the retainage percentage?" and get correct answer with source reference.

---

## Phase 4: Reactive Behavior (Week 4-5)
**Goal:** Agent proactively monitors and alerts — the killer feature

### Task 4.1: Heartbeat Monitors
- [ ] Configure heartbeat to check connected systems
- [ ] Procore checks: overdue RFIs (>7 days), expiring insurance (<30 days), budget overruns (>5%), late submittals, pending change orders
- [ ] Database checks: custom queries defined by PM
- [ ] Document checks: upcoming deadlines extracted from docs
- [ ] Output: alert message to PM via webchat with suggested actions
- **Acceptance:** Heartbeat fires, detects overdue RFI in Procore, sends alert: "RFI-042 is 9 days overdue. Want me to chase the architect?"

### Task 4.2: Pattern Learning
- [ ] Track repeated queries in memory (PM asks same thing regularly)
- [ ] After 3+ similar queries, offer to automate: "I notice you check concrete budget every Monday. Want me to send a weekly digest?"
- [ ] If PM agrees, create cron job automatically
- [ ] Log learned preferences in MEMORY.md
- **Acceptance:** Ask about budget 3 times on different days → agent offers to automate → cron job created.

### Task 4.3: Daily Digest
- [ ] Cron job: morning digest at configurable time
- [ ] Pulls from all connected systems: open RFIs, expiring docs, budget status, schedule status, pending items
- [ ] Formatted as a concise briefing
- [ ] PM can reply to take action on any item
- **Acceptance:** Daily digest arrives on time with accurate data from connected systems.

### Task 4.4: Better Compaction
- [ ] Review Clawdbot's current compaction implementation
- [ ] Ensure critical project data survives compaction (project names, key contacts, active issues)
- [ ] ACTIVE.md as compaction anchor (always loaded)
- [ ] Test: fill context to compaction threshold → verify agent retains project knowledge
- **Acceptance:** After compaction, agent still knows project names, current issues, and PM preferences.

---

## Phase 5: Additional Integrations (Week 5-7)
**Goal:** P6, Unifier, and expanded capabilities

### Task 5.1: Primavera P6 Skill
- [ ] Create `skills/p6/SKILL.md`
- [ ] Actions: get_schedule, get_activities, get_critical_path, get_milestones, get_resource_assignments
- [ ] P6 EPPM REST API or P6 XML export parsing
- **Acceptance:** "What's on the critical path for Riverside Tower?" returns real schedule data.

### Task 5.2: Unifier Skill
- [ ] Create `skills/unifier/SKILL.md`
- [ ] Actions: get_cost_sheets, get_business_processes, get_line_items, get_commitments
- **Acceptance:** Agent queries Unifier cost data via chat.

### Task 5.3: Email Skill (Future)
- [ ] Send/draft emails on behalf of PM
- [ ] "Draft an email to the architect chasing RFI-042"
- [ ] Requires explicit PM approval before sending
- **Acceptance:** Agent drafts email, PM confirms, email sent.

---

## Phase 6: Frontend — Mission Control (Week 7-10)
**Goal:** Web UI for admin and PM chat

### Task 6.1: Mission Control Admin Panel
- [ ] Next.js app
- [ ] Company setup wizard
- [ ] Connection Manager UI (add/test/manage connections)
- [ ] Agent creation UI (create PM agents, assign projects)
- [ ] Monitoring dashboard (agent activity, alerts, costs)
- **Acceptance:** Admin creates a connection and a new agent via web UI.

### Task 6.2: PM Chat Interface
- [ ] Web chat UI (React)
- [ ] Connects to gateway webchat protocol
- [ ] Message history, file upload, real-time streaming
- [ ] Mobile-responsive
- **Acceptance:** PM chats with agent via web browser, full functionality.

### Task 6.3: Onboarding Flow
- [ ] Company signup
- [ ] Guided connection wizard (OAuth buttons for Procore, etc.)
- [ ] Agent creation for each PM
- [ ] PM receives welcome message with initial system scan results
- **Acceptance:** New company signs up → connects Procore → creates PM agent → PM gets welcome message with project issues found.

---

## Data Architecture

### Clawdbot Core (File-based — don't touch)
- Sessions: JSONL files (one per session, append-only)
- Memory: markdown files (MEMORY.md + daily notes)
- Vector search: embedded index
- Compaction: file-based

### BuildAI Layer (SQLite → PostgreSQL later)
- Connections: SQLite table (credentials encrypted at rest)
- Agents registry: SQLite table (which user, which workspace)
- Audit log: SQLite table (connection changes, admin actions)
- Learned preferences: SQLite table (pattern data for reactive behavior)

**Hybrid approach:** Engine stays file-based (proven). New BuildAI features use SQLite. Swap to PostgreSQL when scaling.

## Product Model

### Agent Model
- **1 agent = 1 user** (completely isolated)
- 4000 users = 4000 agents
- No agent-to-agent collaboration (for now)
- Each agent has own workspace, memory, files, sessions
- Single eternal chat — no chat history UI, just one running conversation

### User Onboarding (Chat-first, no UI wizard)
Agent-guided onboarding happens IN the chat:
1. Agent greets: "Welcome! I'm your personal PMIS assistant."
2. Agent asks: "Which projects are you managing?"
3. Agent prompts: "Sign in to Procore so I can see your data"
4. Agent asks: "What matters most? Overdue RFIs? Budget?"
5. Agent asks: "How often do you want updates?"
6. Done — agent is live and reactive

### Admin Flow (PMO Director)
1. Signs in to Mission Control
2. Configures shared connections (LLM, DB, PMIS)
3. Creates agent per PM → generates workspace (SOUL, HEARTBEAT, ACTIVE, MEMORY)
4. Links shared connections to agent
5. User gets access, agent handles onboarding via chat

### Per-Agent Workspace
```
agent-workspace/
├── SOUL.md        (template — same for all, construction PM personality)
├── HEARTBEAT.md   (customized per user preferences)
├── ACTIVE.md      (user's current state)
├── MEMORY.md      (long-term: habits, preferences, decisions)
├── memory/*.md    (daily interaction logs)
├── connections/   (inherited from company + user-scoped tokens)
├── sessions/      (single eternal session — JSONL)
└── files/         (uploaded documents)
```

### Native Chat Features
- **File Upload:** PM uploads PDFs, drawings, photos, spreadsheets directly in chat → agent processes via Documents skill (Gemini File API)
- **File Download:** Agent generates reports, exports, CSVs → sends as downloadable file in chat
- **Voice Chat:** PM sends voice message → speech-to-text → agent processes → responds with text (or TTS voice reply)
  - Critical for PMs on-site — they're walking a jobsite, can't type
  - "Hey, RFI for the second floor electrical — what's the status?" (voice)
  - Agent responds with text + optional voice reply
  - Uses Whisper (STT) + TTS engine for voice responses

### Connections Model
- **Company-level:** LLM provider, database, PMIS app registration
- **User-level:** User's own OAuth token (Procore is user-scoped)
- Connection manager skill handles both levels
- Shared connections inherited by all agents in the company

## Supported Database Connections
- PostgreSQL
- SQL Server (via pyodbc / pymssql)
- MySQL

## Future Roadmap (Not Planned Yet)

### Near Future
- **Skills Marketplace** — private, API-key gated marketplace
  - Users onboard skills into their personal agent
  - Only BuildAI-approved skills (not public)
  - Skills installed via API key authentication
  - Revenue opportunity: premium skills

### Medium Future
- **Multi-agent collaboration** — agents interact with each other
  - Like Clawdbot's agent-to-agent but for project teams
  - PM agent talks to estimator agent, scheduler agent, etc.
- WhatsApp/Slack channels
- Email integration (send/receive on behalf of PM)
- CRM/ERP integrations
- Kahua, Aconex integrations

### Long Future
- Multi-tenancy
- Mobile app
- Billing/subscription system
- AI-generated reports (PDF)
- Procore webhooks (real-time event triggers)

---

## Notes
- Clawdbot is open source (MIT). Fork is legal.
- Start with Procore — best API documentation in construction
- Procore OAuth tokens are user-scoped — natural fit for per-PM agents
- Gemini File API eliminates need for vector DB infrastructure
- Single deployment per company keeps things simple
- All architecture decisions documented in `memory/2026-02-16.md`
