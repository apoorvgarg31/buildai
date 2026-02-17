# BuildAI — Remaining Work Plan

## What's Done
- Engine integration (end-to-end working)
- Admin pipeline (connections → agents → skills → workspace → chat)
- Admin UI wired to real APIs (connections + agents)
- Database skill (query.sh executing real SQL)

---

## Step 1: Chat Session Routing Per User (~1hr)
**Problem:** When PM logs in, chat uses a generic session key. Should route to their assigned agent.

**Changes:**
- `lib/auth.ts` — update demo users to include `agentId` field
- `page.tsx` — pass `agentId` to ChatArea after login
- `ChatArea.tsx` — use `agent:{agentId}:webchat:default` as session key
- If user has no agent assigned, show "No agent assigned — contact admin"

**Files:** auth.ts, page.tsx, ChatArea.tsx

---

## Step 2: Admin Users Page — Wire to Real API (~1hr)
**Problem:** AdminUsersPage shows static demo data.

**Changes:**
- Fetch from `/api/admin/users` (already exists)
- Real create/delete users
- Show assigned agent for each user
- "Assign Agent" dropdown that calls PUT /api/admin/users/:id

**Files:** AdminUsersPage.tsx

---

## Step 3: Admin Dashboard — Real Stats (~1hr)
**Problem:** AdminDashboard shows hardcoded stats.

**Changes:**
- New API: `GET /api/admin/stats` — returns counts (agents, connections, users, active sessions)
- Dashboard fetches real stats on mount
- Team members list from /api/admin/users
- Connections overview from /api/admin/connections

**Files:** AdminDashboard.tsx, api/admin/stats/route.ts

---

## Step 4: Streaming Responses (~2hr)
**Problem:** Chat waits for full LLM response before showing anything. Feels slow.

**Changes:**
- `gateway-client.ts` — add `chatSendStream()` that yields delta events
- `api/chat/route.ts` — return a ReadableStream (SSE) instead of JSON
- `ChatArea.tsx` — consume SSE stream, render tokens as they arrive
- Fallback: if streaming fails, fall back to current wait-for-full behavior

**Files:** gateway-client.ts, api/chat/route.ts, ChatArea.tsx, ChatMessage.tsx

---

## Step 5: Procore Skill — Real Sandbox Test (~2hr)
**Problem:** Procore skill scripts exist but haven't been tested.

**Changes:**
- `procore-auth.sh` — test OAuth flow with sandbox credentials
- `procore-api.sh` — test against Procore sandbox API
- SKILL.md — update with verified endpoints and examples
- OAuth callback handling: skill generates auth URL, admin completes in browser, callback stores tokens
- Need: generic `/api/oauth/callback` route that passes tokens to skill workspace

**Files:** skills/buildai-procore/*, api/oauth/callback/route.ts

---

## Step 6: Documents Skill — Gemini File API (~2hr)
**Problem:** No document Q&A capability yet.

**Changes:**
- Create `skills/buildai-documents/SKILL.md`
- Create `skills/buildai-documents/upload.sh` — upload file to Gemini File API
- Create `skills/buildai-documents/ask.sh` — query uploaded documents
- Create `skills/buildai-documents/list.sh` — list uploaded files
- Document registry in skill workspace (JSON file tracking uploads)
- UI: DocumentPanel already exists — wire upload to skill via engine

**Files:** skills/buildai-documents/*, DocumentPanel.tsx, gateway-client.ts (file upload)

---

## Step 7: Reactive Behavior — Heartbeat Monitors (~2hr)
**Problem:** Agent doesn't proactively alert. This is THE differentiator.

**Changes:**
- Agent workspace HEARTBEAT.md already has monitoring checklist
- Engine already runs heartbeats on schedule
- Configure heartbeat in engine config for each agent:
  ```json5
  "heartbeat": { "every": "30m", "activeHours": { "start": "07:00", "end": "19:00" } }
  ```
- HEARTBEAT.md instructs agent to run database skill checks:
  - Overdue RFIs → alert
  - Expiring insurance → alert  
  - Budget overruns → alert
- Alerts stored in agent's memory, surfaced in next chat session
- Future: push notifications via WebSocket to chat UI

**Files:** workspaces/templates/HEARTBEAT.md, engine config

---

## Step 8: Voice Chat (~2hr)
**Problem:** PMs on-site can't type — need voice input/output.

**Changes:**
- Add microphone button to ChatInput.tsx
- Browser MediaRecorder API → record audio → send as attachment
- Engine uses Whisper (if available) for STT
- Response TTS via engine's TTS capability (if configured)
- Fallback: just send transcribed text, respond with text

**Files:** ChatInput.tsx, ChatArea.tsx

---

## Implementation Order & Time

| # | Task | Time | Priority |
|---|------|------|----------|
| 1 | Chat session routing per user | 1hr | HIGH — broken UX |
| 2 | Admin Users page wiring | 1hr | HIGH — demo essential |
| 3 | Admin Dashboard real stats | 1hr | MEDIUM — demo polish |
| 4 | Streaming responses | 2hr | HIGH — perceived speed |
| 5 | Procore skill testing | 2hr | MEDIUM — needs sandbox |
| 6 | Documents skill | 2hr | MEDIUM — new capability |
| 7 | Reactive behavior | 2hr | HIGH — differentiator |
| 8 | Voice chat | 2hr | LOW — nice-to-have |

**Total: ~13 hours**

**Recommended order:** 1 → 2 → 4 → 3 → 7 → 5 → 6 → 8

Start with UX fixes (routing, users), then speed (streaming), then features (reactive, procore, docs, voice).
