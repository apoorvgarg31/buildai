# BuildAI — Build Log

## 2026-02-17: Phase 1 — Initial Setup

### What Was Done

**1. Monorepo Structure (Task 1.3) ✅**
- Created root `package.json` with npm workspaces (`packages/*`)
- Created `turbo.json` for Turborepo task orchestration
- Created `.gitignore` excluding node_modules, .next, dist, .env
- Directory structure: `packages/engine/`, `packages/web/`, `workspaces/templates/`, `docs/`

**2. Fork OpenClaw Engine (Task 1.1) ✅**
- Copied Clawdbot from `~/.npm-global/lib/node_modules/clawdbot/` to `packages/engine/`
- Excluded `node_modules/` (too large for git, ~hundreds of MB)
- Engine has: `dist/`, `skills/`, `extensions/`, `docs/`, `scripts/`, `package.json`
- Added engine-specific `.gitignore`
- Total engine size (without node_modules): ~29MB

**3. Workspace Templates (Task 1.9) ✅**
- Moved existing SOUL.md, AGENTS.md, ACTIVE.md, TOOLS.md, MEMORY.md from repo root to `workspaces/templates/`
- Created new `HEARTBEAT.md` with construction-specific monitoring rules:
  - Overdue RFIs (>7 days)
  - Expiring insurance certs (<30 days)
  - Budget overruns (>5%)
  - Late submittals
  - Pending change orders
  - Schedule checks
  - Pattern tracking for automation

**4. Next.js App (Task 1.3 continued) ✅**
- Created with `npx create-next-app@latest` — TypeScript, App Router, Tailwind CSS
- Built custom components:
  - `Sidebar.tsx` — collapsible navigation with Chat, Projects, Connections, Documents, Settings
  - `ChatArea.tsx` — full chat interface with welcome message, auto-scroll, loading animation
  - `ChatMessage.tsx` — user/assistant message bubbles with timestamps
  - `ChatInput.tsx` — auto-resizing textarea with Enter-to-send, file upload button placeholder
- Amber/construction-themed color scheme
- Dark mode support
- Build verified: `next build` passes clean

**5. README.md ✅**
- Architecture overview with directory tree
- Stack table
- Getting started (clone → install → dev)
- Project status with phase checkboxes
- Key concepts (reactive agent, pattern learning, single eternal chat)

### Commits
1. `chore: initial monorepo structure with docs and workspace config`
2. `feat: fork OpenClaw engine into packages/engine`
3. `feat: workspace templates (SOUL, AGENTS, HEARTBEAT, ACTIVE, TOOLS, MEMORY)`
4. `feat: Next.js app with sidebar + chat UI (packages/web)`
5. `docs: README with architecture overview, getting started, and project status`

### Lessons Learned
1. **Engine is large:** Even without node_modules, the OpenClaw fork is ~29MB with 925 files (lots of extensions/plugins). Will need to strip unnecessary extensions later.
2. **npm workspaces work well** for this structure — web app installs independently while root manages the monorepo.
3. **Chat UI is clean** with minimal code — Tailwind + React components keep it simple. Simulated responses for now until engine integration.
4. **TDD gap:** No tests written yet for Phase 1 setup tasks (mostly scaffolding). Tests will start with Task 1.2 (engine stripping) and Task 1.4 (agent config).

### Next Steps
- Task 1.5-1.8: Verify memory, heartbeat, cron, compaction
- Wire chat UI to actual engine gateway WebSocket (replace mock with real engine)
- Phase 2: Connection Manager & Procore integration

---

## 2026-02-17: Phase 1 Continued — Engine Config, API, Tests

### What Was Done

**1. Disable Unnecessary Engine Components (Task 1.2) ✅**
- Created `buildai.config.json5` — primary engine config disabling browser, canvas, node pairing, discovery, all messaging channels except web
- Created `.env.buildai` — process-level env vars: `CLAWDBOT_SKIP_BROWSER_CONTROL_SERVER=1`, `CLAWDBOT_SKIP_CANVAS_HOST=1`, `CLAWDBOT_SKIP_GMAIL_WATCHER=1`, `CLAWDBOT_SKIP_CHANNELS=1`
- Created `COMPONENTS.md` — comprehensive documentation mapping every component to its enable/disable mechanism
- Created `start-buildai.sh` — wrapper script that sources env and starts gateway
- 28 tests verifying config correctness, env flags, documentation, entry points

**2. Construction PM Agent Config (Task 1.4) ✅**
- Enhanced SOUL.md with "What You Cover" section (RFIs, submittals, budget, schedule, change orders, insurance, daily logs, documents)
- 44 tests validating all 6 workspace templates: SOUL.md (identity, reactive behavior, construction concepts, personality, safety), HEARTBEAT.md (monitors, alerts, quiet rules, pattern tracking), AGENTS.md (startup, memory, write-first, reactive, tools, safety), ACTIVE.md, TOOLS.md, MEMORY.md

**3. Chat API Route (Connect Next.js to Engine) ✅**
- Created `/api/chat` POST endpoint with contextual mock responses (RFI, budget, schedule, submittal, greeting)
- Added GET endpoint for health check (reports engine connection status)
- Input validation: empty messages, type checking, max length (10000 chars)
- Session ID persistence across messages
- Engine proxy stub ready for real gateway integration
- Updated ChatArea component to call `/api/chat` instead of setTimeout simulation
- Dynamic engine status badge (Preview Mode / Connected / Connecting)
- 15 unit tests covering health check, valid messages, contextual responses, session IDs, error handling

**4. Package.json Scripts ✅**
- `npm run dev` — starts both Next.js and engine via concurrently
- `npm run dev:web` — starts just Next.js
- `npm run dev:engine` — starts engine with BuildAI config
- `npm run build` — builds web app
- `npm run test` — runs all unit tests (93 total: 21 web + 72 engine)
- `npm run test:web` / `test:engine` — package-specific tests
- `npm run test:e2e` — Playwright E2E tests
- Installed concurrently for parallel dev processes

**5. Basic Tests Setup ✅**
- Vitest (Jest-compatible) with jsdom for component rendering tests
- @testing-library/react for React component tests
- Playwright with Chromium for E2E browser tests
- Chat UI tests: message rendering, avatars (B/PM), timestamps, styling (6 tests)
- E2E tests: page load, welcome message, status badge, chat input, send button, send+receive flow, sidebar nav, API health/POST/error (10 tests)
- Total: 103 tests (93 unit + 10 E2E), all passing

### Commits
1. `feat: disable unnecessary engine components (keep core + webchat)` — 28 tests
2. `feat: construction PM agent configuration validated` — 44 tests
3. `feat: chat API route with engine proxy stub` — 15 tests
4. `feat: dev scripts for running web + engine`
5. `test: basic test setup with Jest + Playwright` — 16 tests (6 component + 10 E2E)

### Lessons Learned
1. **Engine uses env vars for disable**: `CLAWDBOT_SKIP_*` environment variables are the cleanest way to disable components at the process level. Config file settings add defense-in-depth.
2. **Vitest > Jest for ESM**: The engine is ESM-only (`"type": "module"`), and vitest handles this natively. Jest requires awkward transforms.
3. **jsdom + testing-library**: Need `cleanup()` between tests to avoid DOM leakage. Without it, `getByText` finds elements from previous renders.
4. **Playwright locators**: Text matching is case-insensitive and greedy — "Preview Mode" in a badge matches even when looking for it in message content. Scoped locators (`.locator('.parent').locator('text=child')`) fix this.
5. **vitest root setting**: When running vitest from a different directory than the config file, `root` must be set explicitly or test file discovery fails.
6. **Mock responses**: Contextual mock responses (matching keywords like "RFI", "budget") make the preview experience much better than generic "not connected" messages.
