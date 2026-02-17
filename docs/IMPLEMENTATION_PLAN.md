# BuildAI — Implementation Plan

**Product:** Reactive AI Assistant for Construction Project Managers
**Codename:** BuildAI
**Started:** February 17, 2026
**Owner:** Apy (Apoorv Garg)
**Builder:** Jarvis

---

## Vision
A personal AI assistant for construction PMs that connects to their PMIS systems (Procore, Unifier, P6, Kahua), databases, and documents. Reactive, not passive — it comes to PMs with problems and offers solutions. Built entirely on the Clawdbot engine.

## Architecture (LOCKED)

### Core Principle: Clawdbot IS the Engine
We use the full Clawdbot framework. We don't reinvent anything. We customize:
- **SOUL.md** — construction PM personality
- **ACTIVE.md** — current project state
- **MEMORY.md** — long-term PM context
- **HEARTBEAT.md** — reactive monitoring rules
- **Skills** — all PMIS integrations (Procore, P6, Unifier, etc.)

### Layers
```
┌─────────────────────────────────────────────────┐
│  Web UI (thin shell)                            │
│  - Chat interface (engine gateway WebSocket)     │
│  - Admin pages (agent creation, settings, etc.) │
│  - Marketplace (skill discovery)                │
│  - ONE API route: /api/chat → engine proxy      │
└──────────────────┬──────────────────────────────┘
                   │ WebSocket (gateway protocol v3)
┌──────────────────▼──────────────────────────────┐
│  Clawdbot Engine (packages/engine/)             │
│  - LLM orchestration                            │
│  - Memory & compaction                          │
│  - Session management                           │
│  - Tool/skill dispatch                          │
│  - Agent creation (like Simon, QueryBud, etc.)  │
│  - Cron / heartbeat                             │
└──────────────────┬──────────────────────────────┘
                   │ Skills
┌──────────────────▼──────────────────────────────┐
│  Skills (all integrations)                      │
│  - buildai-database (SQL queries)               │
│  - buildai-procore (Procore API + OAuth)         │
│  - buildai-documents (Gemini File API)           │
│  - buildai-p6 (Primavera scheduling)            │
│  - buildai-unifier (cost management)            │
└─────────────────────────────────────────────────┘
```

### Key Rules
1. **Web frontend is a thin shell** — it only talks to the engine gateway
2. **All intelligence lives in the engine** — LLM, memory, tools, everything
3. **All external integrations are skills** — no hardcoded API routes
4. **Agent creation uses Clawdbot's existing patterns** — workspace-per-agent
5. **No secrets in git** — env vars only, .env.example for documentation
6. **TypeScript only** — no Python

### Agent Model
- **1 agent = 1 user** (completely isolated)
- Uses Clawdbot's agent creation (same as Simon, QueryBud)
- Each agent has own workspace: SOUL, ACTIVE, MEMORY, HEARTBEAT, sessions
- Single eternal chat — one running conversation per PM
- Engine handles compaction, memory, all state

### Per-Agent Workspace
```
agent-workspace/
├── SOUL.md        (construction PM personality — shared template)
├── HEARTBEAT.md   (customized per user — what to monitor)
├── ACTIVE.md      (current project state)
├── MEMORY.md      (long-term: preferences, decisions, contacts)
├── memory/*.md    (daily interaction logs)
├── connections/   (inherited company + user-scoped tokens)
├── sessions/      (JSONL — single eternal session)
└── files/         (uploaded documents)
```

---

## Current File Structure

### packages/web/src/ (Thin UI)
```
app/
  layout.tsx              — Root layout
  page.tsx                — LoginScreen → Sidebar + ChatArea/AdminDashboard
  api/chat/route.ts       — POST: proxy to engine gateway. GET: health
components/
  LoginScreen.tsx         — Demo login (admin/user roles)
  Sidebar.tsx             — Role-based nav, responsive
  ChatArea.tsx            — Chat + doc panel + input
  ChatInput.tsx           — Text input + file attach
  ChatMessage.tsx         — Markdown-rendered messages
  DocumentPanel.tsx       — Right-side document panel
  AdminDashboard.tsx      — Admin overview
  AdminUsersPage.tsx      — User management
  AdminAgentsPage.tsx     — Agent management
  AdminConnectionsPage.tsx — Connection management
  AdminSettingsPage.tsx   — Company settings
  MarketplacePage.tsx     — Skill marketplace
  UsagePage.tsx           — Usage analytics
  SettingsPage.tsx        — User settings
lib/
  auth.ts                 — Demo credentials
  gateway-client.ts       — WebSocket client for engine
```

### packages/engine/ (Clawdbot Fork)
```
skills/
  buildai-database/       — SQL query skill
  buildai-procore/        — Procore API skill
buildai.config.json5      — Engine config (port 18790)
```

### workspaces/buildai-agent/ (Agent Template)
```
SOUL.md                   — Construction PM personality
AGENTS.md                 — Agent behavior rules
TOOLS.md                  — Tool configuration
HEARTBEAT.md              — Monitoring checklist
```

---

## Phase 1: Engine + UI Foundation ✅ COMPLETE

### Task 1.1: Clawdbot Engine Fork ✅
- [x] Monorepo with npm workspaces
- [x] Engine config: buildai.config.json5 (port 18790, local mode)
- [x] Engine starts and accepts WebSocket connections
- [x] Gateway client in web package (connect handshake, protocol v3)

### Task 1.2: Next.js Chat UI ✅
- [x] ChatGPT-style dark theme (#0a0a0a, #171717)
- [x] Chat with markdown rendering, auto-scroll
- [x] Document panel (right side, drag/drop)
- [x] Single API route: /api/chat → engine proxy

### Task 1.3: Demo Login & Role-Based UI ✅
- [x] Fake login (admin@buildai.com / pm@buildai.com)
- [x] Admin sidebar: Users, Agents, Connections, Settings
- [x] User sidebar: Chat, Marketplace, Usage, Settings
- [x] All admin pages with realistic demo data
- [x] Responsive (mobile hamburger + overlays)

### Task 1.4: Demo Database ✅
- [x] PostgreSQL `buildai_demo` on localhost:5432
- [x] 10 tables, 250+ records (projects, RFIs, submittals, budgets)
- [x] Pre-built views for common queries
- [x] Seed script: packages/engine/scripts/seed-demo-db.sql

### Task 1.5: End-to-End Chat Working ✅
- [x] Frontend → engine gateway → LLM → response
- [x] Tested: project counts, RFI lists, budget status
- [x] All responses route through engine (no direct API calls)

---

## Phase 2: Skills — All Integrations (CURRENT)
**Goal:** Every external system is a proper Clawdbot skill

### Task 2.1: Database Skill
- [x] Created `skills/buildai-database/SKILL.md`
- [x] Created `skills/buildai-database/query.sh`
- [ ] Register as engine tool (agent can invoke it)
- [ ] Safety: only SELECT/WITH, dangerous keywords blocked
- [ ] Support: PostgreSQL, MySQL, SQLite
- **Acceptance:** Agent runs actual SQL via skill, not just LLM knowledge

### Task 2.2: Procore Skill
- [x] Created `skills/buildai-procore/SKILL.md`
- [x] Created `skills/buildai-procore/procore-api.sh`
- [x] Created `skills/buildai-procore/procore-auth.sh`
- [ ] OAuth flow handled within skill (generates auth URL, receives callback)
- [ ] Read endpoints: projects, rfis, submittals, budget, daily_logs, etc.
- [ ] Register as engine tool
- **Acceptance:** Agent queries Procore via skill. "Show me open RFIs from Procore" → real data

### Task 2.3: Documents Skill
- [ ] Create `skills/buildai-documents/SKILL.md`
- [ ] Gemini File API for vectorization
- [ ] Actions: upload, list, delete, ask, search, summarize
- [ ] Document registry persisted across sessions
- **Acceptance:** Upload PDF, ask question, get answer with source reference

### Task 2.4: Connection Manager Skill
- [ ] Create `skills/connection-manager/SKILL.md`
- [ ] Actions: add, remove, list, test, status
- [ ] Manages `connections/*.json` in agent workspace
- [ ] Supports all connection types
- **Acceptance:** Agent can manage connections via chat

---

## Phase 3: Reactive Behavior (THE Killer Feature)
**Goal:** Agent proactively monitors and alerts

### Task 3.1: Heartbeat Monitors
- [ ] HEARTBEAT.md configured with monitoring rules
- [ ] Procore checks: overdue RFIs, expiring insurance, budget overruns
- [ ] Database checks: custom queries
- [ ] Alerts sent to PM via chat
- **Acceptance:** Agent detects overdue RFI, alerts PM proactively

### Task 3.2: Pattern Learning
- [ ] Track repeated queries in memory
- [ ] After 3+ similar queries, offer to automate
- [ ] Create cron jobs automatically
- **Acceptance:** PM asks about budget 3 times → agent offers weekly digest

### Task 3.3: Daily Digest
- [ ] Cron job: morning briefing
- [ ] Pulls from all connected systems
- [ ] PM can reply to take action
- **Acceptance:** Daily digest arrives with accurate data

---

## Phase 4: Additional Integrations
**Goal:** More PMIS systems as skills

### Task 4.1: P6 Skill
- [ ] `skills/buildai-p6/SKILL.md`
- [ ] Schedule, activities, critical path, milestones

### Task 4.2: Unifier Skill
- [ ] `skills/buildai-unifier/SKILL.md`
- [ ] Cost sheets, business processes, commitments

### Task 4.3: Email Skill
- [ ] Draft/send emails on behalf of PM
- [ ] Explicit confirmation before sending

---

## Phase 5: Production Polish
**Goal:** Demo-ready product

### Task 5.1: Agent Creation via Admin UI
- [ ] Admin creates agents through web UI
- [ ] Uses Clawdbot's agent creation patterns
- [ ] Workspace provisioned automatically

### Task 5.2: Streaming Responses
- [ ] Chat responses stream via WebSocket events
- [ ] Progressive rendering in UI

### Task 5.3: Voice Chat
- [ ] Voice input (Whisper STT)
- [ ] Voice output (TTS)
- [ ] Critical for PMs on-site

---

## Env Vars (in .env.local, NEVER committed)
- BUILDAI_GATEWAY_TOKEN — engine auth
- BUILDAI_GATEWAY_URL — engine WebSocket URL

## Stack
- TypeScript, Next.js 16, React, Tailwind CSS
- Clawdbot engine (gateway, skills, memory, agents)
- PostgreSQL (demo database)
- react-markdown + @tailwindcss/typography
