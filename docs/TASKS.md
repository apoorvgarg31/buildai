# BuildAI — Task Tracker

## Status Legend
- ⬜ Not started
- 🔵 In progress
- ✅ Done
- ❌ Blocked
- 🧪 Tests written, implementation pending

---

## Phase 1: Engine Fork & Core (Week 1-2)
| # | Task | Status | Acceptance Criteria | Tests |
|---|------|--------|-------------------|-------|
| 1.1 | Fork OpenClaw source | ⬜ | Engine starts with `node entry.js gateway` | Startup test |
| 1.2 | Disable unnecessary components | ⬜ | Engine starts, webchat works, disabled components don't error | Component disable test |
| 1.3 | Set up monorepo structure | ⬜ | `packages/engine`, `packages/backend`, `packages/frontend`, `workspaces/` | Dir structure verified |
| 1.4 | Construction PM agent config | ⬜ | Agent responds as construction PM via webchat | Chat response test |
| 1.5 | Verify memory persistence | ⬜ | Restart gateway → memory retained | Write/restart/read test |
| 1.6 | Verify heartbeat | ⬜ | Heartbeat fires on schedule | Timer mock test |
| 1.7 | Verify cron jobs | ⬜ | Cron job creates and executes | Cron create/fire test |
| 1.8 | Verify compaction | ⬜ | Context compacts, critical data survives | Fill/compact/verify test |
| 1.9 | Workspace templates | ⬜ | Template SOUL/AGENTS/HEARTBEAT/ACTIVE generates correctly | Template gen test |

## Phase 2: Connection Manager & Procore (Week 2-3)
| # | Task | Status | Acceptance Criteria | Tests |
|---|------|--------|-------------------|-------|
| 2.1 | Connection Manager skill | ⬜ | Agent can add/list/test connections via chat | CRUD tests |
| 2.2 | Procore skill (read) | ⬜ | "Show open RFIs on Riverside" returns real data | Mock API + parse tests |
| 2.3 | Procore skill (write) | ⬜ | "Create RFI for missing specs" → confirms → creates | Confirm flow + API tests |
| 2.4 | Procore OAuth flow | ⬜ | User signs in → token stored → auto-refresh works | OAuth flow test |
| 2.5 | LLM connection skill | ⬜ | Switch LLM provider via config | Config switch test |

## Phase 3: Database & Documents (Week 3-4)
| # | Task | Status | Acceptance Criteria | Tests |
|---|------|--------|-------------------|-------|
| 3.1 | Database skill (PostgreSQL) | ⬜ | "How many open RFIs?" → SQL → result | Query + safety tests |
| 3.2 | Database skill (SQL Server) | ⬜ | Same as above for SQL Server | Connection test |
| 3.3 | Database skill (MySQL) | ⬜ | Same as above for MySQL | Connection test |
| 3.4 | SQL injection prevention | ⬜ | Malicious queries blocked, only SELECT allowed | Injection attack tests |
| 3.5 | Documents skill (upload) | ⬜ | Upload PDF → indexed in Gemini | Upload + verify test |
| 3.6 | Documents skill (ask) | ⬜ | "What's the retainage?" → correct answer from doc | Q&A accuracy test |
| 3.7 | Documents skill (search) | ⬜ | Search across multiple docs returns relevant results | Search relevance test |
| 3.8 | File upload/download in chat | ⬜ | PM sends file → processed; agent sends file → downloadable | E2E file test |

## Phase 4: Reactive Behavior (Week 4-5)
| # | Task | Status | Acceptance Criteria | Tests |
|---|------|--------|-------------------|-------|
| 4.1 | Heartbeat monitors (Procore) | ⬜ | Detects overdue RFIs, sends alert with actions | Mock data + alert test |
| 4.2 | Heartbeat monitors (insurance) | ⬜ | Detects expiring certs (<30 days) | Date comparison test |
| 4.3 | Heartbeat monitors (budget) | ⬜ | Detects >5% overrun | Threshold test |
| 4.4 | Pattern learning | ⬜ | After 3+ similar queries → offers automation | Pattern detection test |
| 4.5 | Auto cron creation | ⬜ | User agrees to automation → cron job created | Cron creation test |
| 4.6 | Daily digest | ⬜ | Morning briefing with all-system data | Digest generation test |
| 4.7 | Better compaction | ⬜ | Project knowledge survives compaction | Compaction recovery test |

## Phase 5: Voice & Chat Features (Week 5-6)
| # | Task | Status | Acceptance Criteria | Tests |
|---|------|--------|-------------------|-------|
| 5.1 | Voice input (STT) | ⬜ | Voice message → text → agent processes | Whisper integration test |
| 5.2 | Voice output (TTS) | ⬜ | Agent responds with audio option | TTS generation test |
| 5.3 | File upload in chat | ⬜ | Drag & drop → Documents skill processes | Upload flow test |
| 5.4 | File download from agent | ⬜ | Agent generates CSV/report → downloadable | Download flow test |

## Phase 6: Additional Integrations (Week 6-8)
| # | Task | Status | Acceptance Criteria | Tests |
|---|------|--------|-------------------|-------|
| 6.1 | P6 skill | ⬜ | Schedule/critical path queries work | Mock API test |
| 6.2 | Unifier skill | ⬜ | Cost sheet queries work | Mock API test |
| 6.3 | Email skill | ⬜ | Draft + send with PM approval | Confirm flow test |

## Phase 7: Backend API (Week 7-8)
| # | Task | Status | Acceptance Criteria | Tests |
|---|------|--------|-------------------|-------|
| 7.1 | Auth (JWT + company signup) | ⬜ | Admin signs up, gets JWT, authenticates | Auth flow test |
| 7.2 | Agent CRUD API | ⬜ | POST/GET/PUT/DELETE agents | REST CRUD tests |
| 7.3 | Connection CRUD API | ⬜ | POST/GET/PUT/DELETE connections | REST CRUD tests |
| 7.4 | Workspace provisioning | ⬜ | Create agent → workspace generated from template | Provisioning test |
| 7.5 | SQLite models | ⬜ | All tables created, migrations work | Schema test |
| 7.6 | Credential encryption | ⬜ | Passwords/tokens encrypted at rest | Encryption test |
| 7.7 | Audit logging | ⬜ | All admin actions logged | Audit trail test |

## Phase 8: Frontend — Mission Control (Week 8-10)
| # | Task | Status | Acceptance Criteria | Tests |
|---|------|--------|-------------------|-------|
| 8.1 | Admin dashboard | ⬜ | View agents, connections, activity | Playwright E2E test |
| 8.2 | Connection manager UI | ⬜ | Add/test/manage connections via UI | Playwright E2E test |
| 8.3 | Agent management UI | ⬜ | Create/edit/delete agents via UI | Playwright E2E test |
| 8.4 | PM chat interface | ⬜ | Full chat with streaming, files, voice | Playwright E2E test |
| 8.5 | Onboarding flow | ⬜ | Signup → connect → create → welcome | Full E2E test |
| 8.6 | Mobile responsive | ⬜ | Chat works on mobile viewport | Viewport test |

---

## Review Checklist (for each completed task)
1. ✅ Tests written and passing (TDD — tests first)
2. ✅ Meets acceptance criteria
3. ✅ Code clean and documented
4. ✅ Works with existing skills/connections
5. ✅ E2E tested where applicable
6. ✅ Documented in relevant SKILL.md or TOOLS.md
7. ✅ No security regressions (credential exposure, cross-agent access)
