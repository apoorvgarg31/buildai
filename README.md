# BuildAI 🏗️

**Reactive AI assistant for construction project managers.**

BuildAI connects to your PMIS systems (Procore, Unifier, P6, Kahua), databases, and documents to provide proactive project insights, automate repetitive tasks, and serve as a PM's always-available digital partner.

## What Makes It Different

BuildAI is **reactive**, not passive. It doesn't wait for you to ask — it comes to you with problems and solutions:

- 🚨 **"RFI-042 is 9 days overdue. Want me to chase the architect?"**
- 💰 **"Electrical is 8% over budget. Here's where the overruns are."**
- 📋 **"Acme Electric's GL cert expires in 12 days. Want me to flag this?"**
- 🔄 **"I notice you check concrete budget every Monday. Want me to send a weekly digest?"**

## Architecture

```
buildai/
├── packages/
│   ├── engine/          ← Core AI engine (OpenClaw fork)
│   └── web/             ← Next.js app (frontend + API routes)
├── workspaces/
│   └── templates/       ← Agent workspace templates
├── docs/                ← Architecture & implementation docs
├── package.json         ← Root monorepo config
├── turbo.json           ← Turborepo config
└── README.md
```

### Stack

| Component | Technology |
|-----------|-----------|
| Core Engine | OpenClaw (Clawdbot fork) — Node.js |
| Frontend | Next.js (React, App Router, Tailwind CSS) |
| Language | TypeScript everywhere |
| LLM | Configurable (Gemini / OpenAI / Anthropic) |
| Documents | Gemini File API for vectorization |
| Database | SQLite (MVP) → PostgreSQL (prod) |
| Testing | Jest (unit) + Playwright (E2E), TDD |
| Monorepo | npm workspaces + Turborepo |

### How It Works

1. **Core Engine** (OpenClaw fork) handles the AI agent runtime — memory, compaction, heartbeat, cron, tool execution, streaming responses
2. **Next.js App** provides the Mission Control UI — admin dashboard, PM chat interface, connection management
3. **Skills** are integration modules — Procore, Database, Documents, P6, Unifier — each with its own scripts and configuration
4. **Workspaces** are per-agent directories containing personality (SOUL.md), behavior rules (AGENTS.md), memory, and files

Each PM gets their own isolated agent with persistent memory, learning their habits and projects over time.

## Getting Started

### Prerequisites

- Node.js >= 20
- npm >= 10

### Installation

```bash
# Clone the repo
git clone https://github.com/apoorvgarg31/buildai.git
cd buildai

# Install dependencies (web app only — engine deps are large)
npm install

# Start the dev server
npm run dev
```

The web app will be available at `http://localhost:3000`.

### Engine Setup (Advanced)

The engine in `packages/engine/` is a fork of OpenClaw. To run it:

```bash
cd packages/engine
npm install          # Install engine dependencies (large)
node dist/entry.js gateway   # Start the engine gateway
```

## Project Status

### Phase 1: Engine Fork & Core ← **Current**
- [x] Monorepo structure
- [x] OpenClaw engine fork
- [x] Workspace templates (SOUL, AGENTS, HEARTBEAT, ACTIVE)
- [x] Next.js app with chat UI
- [ ] Disable unnecessary engine components
- [ ] Verify memory, heartbeat, cron, compaction

### Phase 2: Connection Manager & Procore
- [ ] Connection manager skill
- [ ] Procore read operations
- [ ] Procore write operations (with confirmation)
- [ ] LLM connection configuration

### Phase 3: Database & Documents
- [ ] Database skill (read-only SQL)
- [ ] Document Q&A (Gemini File API)

### Phase 4: Reactive Behavior
- [ ] Heartbeat monitors
- [ ] Pattern learning & auto-cron
- [ ] Daily digest

### Phase 5+: Frontend, Voice, Additional Integrations

## Key Concepts

### Reactive Agent
The agent proactively monitors connected systems during heartbeats — checking for overdue RFIs, budget overruns, expiring certs, and schedule slippage. When it finds issues, it alerts the PM with specific data and suggested actions.

### Pattern Learning
After the PM asks the same thing 3+ times, the agent offers to automate it as a recurring check via cron job. Over time, it becomes more useful without being configured.

### Single Eternal Chat
Each PM has one continuous conversation with their agent. No chat history UI, no threads — just one running conversation that the agent remembers across sessions via its memory system.

## Docs

- [Architecture](docs/ARCHITECTURE.md) — Full system design
- [Implementation Plan](docs/IMPLEMENTATION_PLAN.md) — Phase-by-phase roadmap
- [Tasks](docs/TASKS.md) — Detailed task tracker

## License

MIT
