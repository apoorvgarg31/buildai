# BuildAI — Implementation Plan

**Product:** Reactive AI Assistant for Construction Project Managers
**Codename:** BuildAI
**Started:** February 17, 2026
**Owner:** Apy (Apoorv Garg)
**Builder:** Jarvis

---

## Current File Structure (packages/web/src/)
```
app/
  layout.tsx          — Root layout (Geist font, html/body)
  page.tsx            — Main page: LoginScreen → Sidebar + ChatArea/AdminDashboard
  globals.css         — Tailwind imports
  api/chat/route.ts   — POST: chat with LLM+DB, GET: health check
components/
  LoginScreen.tsx     — Fake login form (admin@buildai.com / pm@buildai.com)
  Sidebar.tsx         — Role-based nav (admin vs user), responsive hamburger
  ChatArea.tsx        — Chat messages + document panel toggle + input
  ChatInput.tsx       — Text input + file attach button
  ChatMessage.tsx     — Single message bubble (user/assistant)
  DocumentPanel.tsx   — Right-side document panel (upload, list, delete)
  AdminDashboard.tsx  — Admin stats, user table, connections overview
lib/
  auth.ts             — Demo user definitions + authenticate()
  db.ts               — PostgreSQL connection (pg Pool)
  llm.ts              — Gemini 2.0 Flash integration
```

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

## 🚨 Rule 1: NO SECRETS IN GIT
Never commit API keys, credentials, tokens, or sensitive info. Use env vars only.
See CONTRIBUTING.md for details.

## Key Principles
1. Fork, don't rebuild — strip what we don't need, keep what works
2. Skills pattern for ALL integrations
3. Reactive agent behavior is THE differentiator
4. Single company deployment — no multi-tenant complexity yet
5. **No secrets in git** — env vars only, .env.example for documentation
6. TypeScript only — no Python

---

## Phase 1: Engine Fork & Core ✅ COMPLETE
**Goal:** Working Clawdbot fork, stripped down, with Next.js UI

### Task 1.1: Fork Clawdbot Source ✅
- [x] Cloned into packages/engine/
- [x] Monorepo with npm workspaces

### Task 1.2: Disable Unnecessary Components ✅
- [x] Config: buildai.config.json5 disables browser, canvas, node pairing, all messaging channels
- [x] Env: .env.buildai with skip flags
- [x] Docs: COMPONENTS.md documents all components
- [x] 28 tests passing

### Task 1.3: Construction PM Agent Configuration ✅
- [x] SOUL.md, AGENTS.md, TOOLS.md, HEARTBEAT.md, ACTIVE.md, MEMORY.md templates
- [x] 44 tests validating templates

### Task 1.4: Next.js Chat UI ✅
- [x] Chat with bubbles, auto-scroll, loading animation
- [x] Chat API route (/api/chat) with mock + real engine
- [x] Document panel (right side) — drag/drop, file management
- [x] 103 tests (93 unit + 10 E2E)

### Task 1.5: Demo Database ✅
- [x] PostgreSQL `buildai_demo` on localhost:5432
- [x] 10 tables, 250+ records (projects, RFIs, submittals, budgets, etc.)
- [x] Pre-built views: v_project_dashboard, v_overdue_rfis, v_expiring_insurance, v_project_budget_summary
- [x] Seed script: packages/engine/scripts/seed-demo-db.sql

### Task 1.6: Login & Role-Based UI ✅
- [x] Fake login screen (admin@buildai.com / pm@buildai.com)
- [x] Admin sidebar: 👥 Users, 🤖 Agents, 🔗 Connections, ⚙️ Settings
- [x] User sidebar: 💬 Agent, 🛍️ Marketplace, 📊 Usage, ⚙️ Settings
- [x] Admin dashboard with stats, users table, connections overview
- [x] Role badge, user profile, logout
- [x] Fully responsive (mobile hamburger + overlays)

### Task 1.7: LLM + Database Wiring ✅
- [x] Gemini 2.0 Flash integration (via @google/generative-ai)
- [x] Agent generates SQL from natural language, executes against real DB
- [x] Two-step loop: user question → SQL generation → DB query → natural language response
- [x] Safety: only SELECT/WITH allowed, dangerous keywords blocked
- [x] In-memory conversation history (20-turn window)
- [x] Full database schema embedded in system prompt
- [x] Uses env vars only (GEMINI_API_KEY) — throws error if missing
- [x] Tested: "How many projects?" → 5 ✅, "Overdue critical RFIs" → 4 results ✅
- Files: lib/llm.ts, lib/db.ts, api/chat/route.ts

### Task 1.8: ChatGPT-Style UI Polish ✅
- [x] react-markdown + @tailwindcss/typography for proper markdown rendering
- [x] Dark theme (#0a0a0a, #171717) throughout
- [x] Gradient avatars, refined spacing, sleeker sidebar (260px)
- [x] ChatGPT-style messages (no bubbles, clean prose, timestamp on hover)
- [x] "BuildAI can make mistakes" disclaimer
- [x] Status badge shows Connected/Preview correctly

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

### Task 2.2: Procore OAuth + Read API ✅ COMPLETE
- [x] OAuth authorization flow (`/api/procore/auth` → Procore login → `/api/procore/callback`)
- [x] Token management (save/load/refresh in `.procore-tokens.json`)
- [x] Read endpoints: projects, rfis, submittals, budget, daily_logs, change_orders, punch_items, vendors, schedule, documents, observations
- [x] Generic API proxy (`/api/procore/data`) for any Procore endpoint
- [x] Status endpoint (`/api/procore/status`) for connection checking
- [x] AdminConnectionsPage: live Procore status, "Connect OAuth" button, "Test Connection" 
- [x] LLM integration: Gemini generates ```procore blocks to query Procore API
- [x] Error handling: token refresh, connection status detection
- [ ] Write tests: mock API responses (TODO)
- **Status:** OAuth flow built, sandbox credentials configured. Needs real OAuth dance test with browser.

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

## Phase 6: Frontend — Dual-Role UI (Week 7-10)
**Goal:** Admin panel + User chat, role-based sidebar, fake auth for demo

### Architecture: Two Roles, Two Experiences
The app has two distinct views controlled by role:

**Admin** — the PMO director / company owner who sets up the platform:
- 👥 User Management — create/manage PM users
- 🤖 Agent Management — create/configure/assign AI agents  
- 🔗 Connection Management — PMIS, database, LLM connections
- ⚙️ Settings — company-wide settings

**User** — the construction PM who uses the AI daily:
- 💬 Agent — chat with their assigned AI assistant
- 🛍️ Marketplace — browse/install skills for their agent
- 📊 Usage — token usage, query history, costs
- ⚙️ Settings — personal preferences

### Task 6.0: Demo Login Screen (No Real Auth)
- [x] Fake login screen with two hardcoded credentials
- [x] Admin: admin@buildai.com / admin123
- [x] User: pm@buildai.com / demo123
- [x] Clean, professional login UI (not obviously fake)
- [x] Role stored in React state (no JWT, no backend auth)
- [x] Role determines which sidebar + pages are shown
- **Acceptance:** Login with admin creds → see admin sidebar. Login with user creds → see user sidebar.

### Task 6.1: Admin Panel
- [ ] User management page (list/create/delete users)
- [ ] Agent management page (create/configure/assign agents to users)
- [ ] Connection management page (add/test/manage PMIS connections)
- [ ] Dashboard with overview stats
- **Acceptance:** Admin creates a connection and a new agent via web UI.

### Task 6.2: User Chat Interface
- [x] Web chat UI with AI agent
- [x] Document panel (right side) for file uploads
- [x] Responsive design (mobile + desktop)
- [ ] Message history, real-time streaming
- **Acceptance:** PM chats with agent via web browser, full functionality.

### Task 6.3: Marketplace Page ✅
- [x] Grid of skill cards (10 skills across 6 categories)
- [x] Search + category filter
- [x] Install/Installed toggle buttons
- [x] Responsive grid layout
- **Done:** MarketplacePage.tsx with demo data

### Task 6.4: Usage Page ✅
- [x] Stats row (queries, tokens, cost, response time)
- [x] 7-day usage bar chart (CSS only, no chart library)
- [x] Usage breakdown by category
- [x] Recent queries list
- **Done:** UsagePage.tsx with demo data

### Task 6.5: Dynamic Onboarding ✅
- [x] Auto project health scan on login (Gemini queries DB)
- [x] Shows active projects, overdue RFIs, expiring certs, budget flags
- [x] Proactive alerts in system prompt
- [x] Fallback to static welcome if API unavailable
- **Critical:** This IS the killer feature — investors see real data from moment 1

### Task 6.6: Admin Sub-Pages ✅
- [x] AdminUsersPage — user list with search, status, add user button
- [x] AdminAgentsPage — agent cards with skills, status, create agent button
- [x] AdminConnectionsPage — connections with test/add buttons, status badges
- [x] AdminSettingsPage — company settings form
- [x] SettingsPage (user) — personal prefs
- [x] Client-side routing via state (no URL navigation)

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
