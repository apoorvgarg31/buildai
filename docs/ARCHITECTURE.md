# BuildAI — Architecture Document

## Overview
BuildAI is a reactive, personal AI assistant for construction project managers. It connects to PMIS systems (Procore, Unifier, P6, Kahua), databases, and documents to provide proactive project insights, automate repetitive tasks, and serve as the PM's always-available digital partner.

## Core Principles
1. **Personal** — 1 agent = 1 user, fully isolated, learns their habits
2. **Reactive** — comes to users with problems, doesn't wait to be asked
3. **Secure** — data isolation per user, encrypted credentials, no cross-agent leakage
4. **Fast** — sub-second responses for queries, real-time streaming
5. **Read + Write** — not just queries — creates RFIs, updates statuses, sends emails

## System Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                     MISSION CONTROL                          │
│                  (Next.js Frontend)                           │
│                                                              │
│  ┌────────────┐  ┌────────────┐  ┌────────────────────────┐ │
│  │ Admin      │  │ Connection │  │ Agent Management       │ │
│  │ Dashboard  │  │ Manager UI │  │ (Create/Monitor/Config)│ │
│  └────────────┘  └────────────┘  └────────────────────────┘ │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │              PM Chat Interface                         │  │
│  │  (Webchat, file upload/download, voice in/out)         │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────┬───────────────────────────────────────┘
                       │ REST API + WebSocket
                       ▼
┌──────────────────────────────────────────────────────────────┐
│                    BACKEND API                                │
│                  (Node.js / FastAPI)                          │
│                                                              │
│  ┌────────────┐  ┌────────────┐  ┌────────────────────────┐ │
│  │ Auth       │  │ Agent CRUD │  │ Connection CRUD        │ │
│  │ (JWT/OAuth)│  │            │  │                        │ │
│  └────────────┘  └────────────┘  └────────────────────────┘ │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │              SQLite / PostgreSQL                        │  │
│  │  (Connections, agents registry, audit log, preferences)│  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────┬───────────────────────────────────────┘
                       │ Gateway Protocol (WebSocket)
                       ▼
┌──────────────────────────────────────────────────────────────┐
│                    CORE ENGINE                                │
│              (OpenClaw / Clawdbot Fork)                       │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ Gateway (WebSocket Server)                           │    │
│  │ • Session management                                 │    │
│  │ • Message routing                                    │    │
│  │ • Tool dispatch                                      │    │
│  │ • Webchat protocol                                   │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌─────────────┐ ┌─────────────┐ ┌────────────────────┐     │
│  │ Memory      │ │ Heartbeat   │ │ Cron               │     │
│  │ • MEMORY.md │ │ • Scheduled │ │ • Daily digest      │     │
│  │ • Daily logs│ │ • Monitors  │ │ • Pattern jobs      │     │
│  │ • Compaction│ │ • Alerts    │ │ • Custom schedules  │     │
│  └─────────────┘ └─────────────┘ └────────────────────┘     │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ Agent Runtime                                        │    │
│  │ • LLM integration (Gemini / OpenAI / Anthropic)      │    │
│  │ • Tool execution (exec-based)                        │    │
│  │ • Streaming responses                                │    │
│  │ • Context management + compaction                    │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ Skills (Integration Layer)                           │    │
│  │                                                      │    │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐            │    │
│  │  │ Procore  │ │ Database │ │Documents │            │    │
│  │  │ R+W API  │ │ RO Query │ │Gemini API│            │    │
│  │  └──────────┘ └──────────┘ └──────────┘            │    │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐            │    │
│  │  │ P6       │ │ Unifier  │ │ Conn Mgr │            │    │
│  │  │ Schedule │ │ Costs    │ │ Shared   │            │    │
│  │  └──────────┘ └──────────┘ └──────────┘            │    │
│  └──────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

## Monorepo Structure

```
buildai/
├── packages/
│   ├── engine/              ← Core engine (OpenClaw fork)
│   │   ├── dist/            ← Compiled gateway
│   │   ├── skills/          ← Built-in skills (Procore, DB, Docs, etc.)
│   │   ├── docs/
│   │   ├── package.json
│   │   └── ...
│   │
│   ├── backend/             ← Backend API
│   │   ├── src/
│   │   │   ├── auth/        ← JWT + OAuth
│   │   │   ├── agents/      ← Agent CRUD + workspace provisioning
│   │   │   ├── connections/ ← Connection CRUD + testing
│   │   │   ├── admin/       ← Admin endpoints
│   │   │   └── db/          ← SQLite/PostgreSQL models
│   │   ├── tests/
│   │   └── package.json
│   │
│   └── frontend/            ← Mission Control (Next.js)
│       ├── src/
│       │   ├── app/
│       │   │   ├── admin/       ← Admin dashboard
│       │   │   ├── chat/        ← PM chat interface
│       │   │   ├── connections/ ← Connection manager UI
│       │   │   ├── agents/      ← Agent management UI
│       │   │   └── onboarding/  ← Setup wizard
│       │   ├── components/
│       │   └── lib/
│       ├── tests/
│       └── package.json
│
├── workspaces/              ← Agent workspaces (one per user)
│   ├── templates/           ← Workspace templates
│   │   ├── SOUL.md
│   │   ├── AGENTS.md
│   │   ├── HEARTBEAT.md
│   │   └── ACTIVE.md
│   └── agents/
│       ├── user-001/        ← PM John's workspace
│       ├── user-002/        ← PM Sarah's workspace
│       └── ...
│
├── docs/                    ← Project documentation
│   ├── ARCHITECTURE.md      ← This file
│   ├── IMPLEMENTATION_PLAN.md
│   ├── TASKS.md
│   └── PROCORE_API.md
│
├── package.json             ← Root monorepo config
├── turbo.json               ← Turborepo config (or pnpm workspaces)
└── README.md
```

## Data Architecture

### Hybrid Storage

**File-based (Core Engine — OpenClaw native):**
| Data | Format | Location |
|------|--------|----------|
| Chat sessions | JSONL | `workspaces/agents/{user}/sessions/` |
| Long-term memory | Markdown | `workspaces/agents/{user}/MEMORY.md` |
| Daily logs | Markdown | `workspaces/agents/{user}/memory/*.md` |
| Active state | Markdown | `workspaces/agents/{user}/ACTIVE.md` |
| Vector index | Embedded | `workspaces/agents/{user}/memory/` |
| Uploaded files | Binary | `workspaces/agents/{user}/files/` |

**Database (BuildAI layer — SQLite MVP → PostgreSQL prod):**
| Table | Purpose |
|-------|---------|
| `companies` | Company accounts |
| `users` | User accounts (PMs + admins) |
| `agents` | Agent registry (user → workspace mapping) |
| `connections` | Company-level connections (encrypted credentials) |
| `user_tokens` | User-scoped OAuth tokens (Procore, etc.) |
| `audit_log` | All admin actions, connection changes |
| `preferences` | Learned patterns for reactive behavior |
| `skills` | Installed skills per company (future marketplace) |

### Security Model
- **Agent isolation:** Each agent runs in its own workspace, no shared state
- **Credential encryption:** Connection passwords/tokens encrypted at rest (AES-256)
- **User-scoped tokens:** Procore OAuth tokens belong to the user, not the company
- **Read-only by default:** Database skill only allows SELECT queries
- **Write confirmation:** Procore write operations require explicit user confirmation
- **Audit trail:** Every connection change, agent creation, and admin action logged
- **No cross-agent access:** Agent A cannot read Agent B's memory, files, or sessions

## Agent Lifecycle

### Creation (by PMO Director)
1. Admin creates agent via Mission Control → Backend API
2. Backend provisions workspace from template (SOUL.md, AGENTS.md, HEARTBEAT.md, ACTIVE.md)
3. Backend registers agent in SQLite
4. Backend links company connections to agent workspace
5. Engine loads new agent → ready for chat

### Onboarding (by PM, in chat)
1. PM logs in → routed to their agent's webchat
2. Agent greets + guides through personalization:
   - Sign in to Procore (OAuth popup → token stored)
   - Select projects to monitor
   - Set preferences (alert types, frequency, digest time)
3. Agent saves preferences to MEMORY.md
4. Agent runs initial scan → reports findings
5. Onboarding complete — agent is live

### Daily Operation
1. **Heartbeat:** Agent checks PMIS systems on schedule → alerts PM if issues found
2. **Cron:** Daily digest, weekly reports, custom schedules
3. **Chat:** PM asks questions, gives commands, uploads files
4. **Reactive:** Agent learns patterns → offers automation → creates cron jobs
5. **Memory:** Agent logs decisions, preferences, important events daily

### Compaction
- Context fills up → compaction triggers
- ACTIVE.md survives as anchor (always loaded post-compaction)
- Critical project data (names, contacts, active issues) preserved
- Daily logs in `memory/*.md` provide recovery path

## Integration Skills

### Procore (Read + Write)
**Read operations:**
- List/get projects, RFIs, submittals, budget, pay apps, daily logs, change orders, punch list, directory, schedule, documents, observations

**Write operations (with user confirmation):**
- Create RFI
- Update RFI status
- Create submittal
- Add daily log entry
- Create punch item
- Upload document
- Add observation

### Database (Read-only)
- PostgreSQL, SQL Server, MySQL
- SELECT/WITH/SHOW/DESCRIBE only
- Auto-LIMIT on all queries
- Connection managed by Connection Manager skill

### Documents (Gemini File API)
- Upload: PDF, DOCX, XLSX, images, drawings
- Ask: question-answering against uploaded docs
- Search: semantic search across all docs
- Summarize: document summaries
- Extract: structured field extraction
- Vectorization handled automatically by Gemini

### Future Skills
- P6 (Primavera schedules)
- Unifier (cost management)
- Email (send/receive with confirmation)
- CRM / ERP connectors

## Chat Features
- **Text chat:** standard messaging with streaming responses
- **File upload:** drag & drop or attach → processed via Documents skill
- **File download:** agent sends generated files (reports, exports, CSVs)
- **Voice input:** speech-to-text (Whisper) → agent processes → text response
- **Voice output:** TTS for hands-free response on jobsite
- **Single eternal session:** no chat history UI, one continuous conversation

## Technology Stack
| Component | Technology |
|-----------|-----------|
| Core Engine | OpenClaw (Clawdbot fork) — Node.js |
| Backend API | Node.js or FastAPI |
| Frontend | Next.js (React) |
| Database | SQLite (MVP) → PostgreSQL (prod) |
| LLM | Gemini / OpenAI / Anthropic (configurable) |
| Documents | Gemini File API |
| Voice STT | OpenAI Whisper |
| Voice TTS | ElevenLabs or OpenAI TTS |
| Monorepo | Turborepo or pnpm workspaces |
| Testing | TDD — Jest (engine/backend), Playwright (frontend) |
| CI/CD | GitHub Actions |

## Testing Strategy (TDD)
- **Unit tests:** Every skill script, every API endpoint
- **Integration tests:** Skill → Procore API (sandbox), Skill → Database
- **E2E tests:** Admin creates agent → PM chats → agent queries Procore → returns data
- **Compaction tests:** Fill context → compact → verify knowledge retained
- **Security tests:** Cross-agent access blocked, SQL injection prevented, credential encryption verified
- Write tests FIRST, then implement. Red → Green → Refactor.
