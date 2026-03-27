# BuildAI QA Test Matrix

Last updated: 2026-03-27

This document defines the release-grade test matrix for BuildAI. The goal is not just file coverage, but explicit workflow coverage across admin, user, and runtime paths.

## Status Legend

| Status | Meaning |
| --- | --- |
| `Covered` | Core happy-path and negative-path tests exist and are part of the automated suite. |
| `Partial` | Important behavior is tested, but key branches or end-to-end workflow edges are still missing. |
| `Gap` | No meaningful automated coverage yet for the workflow. |

## Release Gates

| Gate | Requirement |
| --- | --- |
| API contracts | Critical routes must cover auth, forbidden, validation, not-found, and failure shapes. |
| Business workflows | Critical user/admin workflows must have happy-path and negative-path coverage. |
| Persistence | Workspace, settings, token, and runtime sync state must survive reload/re-entry. |
| Browser journeys | First-run onboarding and critical admin surfaces need browser-level verification. |
| Isolation/security | Cross-user access, expired auth, disabled states, and invalid input must be exercised. |

## Admin Workflows

| Workflow | Status | Primary automated coverage | Notes / next gaps |
| --- | --- | --- | --- |
| First user becomes admin | `Covered` | `packages/web/__tests__/admin-flow.test.ts` | Core provisioning and role behavior covered. |
| Create/update/delete users | `Covered` | `packages/web/__tests__/admin-db.integration.test.ts`, `packages/web/__tests__/admin-users-route.test.ts` | DB lifecycle plus route auth/validation/not-found/failure branches are covered. |
| Disable users | `Gap` | None | Needs explicit product behavior and tests once disable semantics are finalized. |
| Create/update/delete agents | `Covered` | `packages/web/__tests__/admin-agent-route-atomicity.test.ts`, `packages/web/__tests__/admin-db.integration.test.ts` | Covers rollback/failure paths and DB state. |
| Shared LLM settings inherited to agents | `Covered` | `packages/web/__tests__/admin-settings-route.test.ts`, `packages/web/__tests__/admin-settings-page.test.tsx`, `packages/web/__tests__/runtime-sync.integration.test.ts` | Includes persistence and runtime propagation. |
| Admin connector create/list/error handling | `Covered` | `packages/web/__tests__/admin-connections-route.test.ts` | Includes auth, validation, unsupported connector, and failure paths. |
| Admin connector test action | `Partial` | `packages/web/__tests__/admin-connections-test-route.test.ts` | Route covered, but connector-provider permutations are still limited. |
| Admin MCP server create/list/update/delete | `Covered` | `packages/web/__tests__/admin-mcp-servers-route.test.ts`, `packages/web/__tests__/admin-mcp-server-item-route.test.ts`, `packages/web/__tests__/admin-db.integration.test.ts` | Includes missing-resource, auth, and failure branches. |
| Admin tool enable/disable | `Covered` | `packages/web/__tests__/admin-tools-route.test.ts`, `packages/web/__tests__/admin-db.integration.test.ts` | Includes unsupported tool, bad payload, auth, and failure branches. |
| Multiple admins | `Gap` | None | Needs explicit admin/admin interaction coverage at route and UI level. |

## User Workflows

| Workflow | Status | Primary automated coverage | Notes / next gaps |
| --- | --- | --- | --- |
| Sign-in and `/api/me` provisioning | `Covered` | `packages/web/__tests__/me-route-provisioning.test.ts`, `packages/web/__tests__/admin-flow.test.ts` | Includes idempotency and first-user admin behavior. |
| Personal agent + workspace creation | `Covered` | `packages/web/__tests__/me-route-provisioning.test.ts`, `packages/web/__tests__/runtime-sync.integration.test.ts` | Runtime manifest and auth profile sync are also covered. |
| First-time onboarding | `Covered` | `packages/web/__tests__/workspace-onboarding-page.test.tsx`, `packages/web/__tests__/home-onboarding-routing.test.tsx`, Playwright preview | Browser-level path is verified. |
| User settings persist | `Covered` | `packages/web/__tests__/settings-page.test.tsx`, `packages/web/__tests__/user-settings.test.ts`, `packages/web/__tests__/personality-api.test.ts` | Covers load, save, failure handling, and USER.md persistence for user-facing workspace settings. |
| Files save/read in workspace | `Partial` | `packages/web/__tests__/files-api.test.ts`, `packages/web/__tests__/runtime-isolation-file-artifact-api.test.ts` | Needs broader end-to-end workspace artifact lifecycle coverage. |
| Watchlist create/update/delete | `Covered` | `packages/web/__tests__/watchlist-api.test.ts` | Good route coverage exists. |
| Schedule create/pause/run/delete | `Covered` | `packages/web/__tests__/schedule-page-timezone.test.tsx`, `packages/web/__tests__/api-schedule-ownership.test.ts` | Covers user timezone handling, recent run status display, enable/disable, run, delete, and ownership/validation branches. |
| Chat send and error handling | `Covered` | `packages/web/__tests__/api-chat.test.ts`, `packages/web/__tests__/api-chat-streaming.test.ts`, `packages/web/__tests__/chat-ui.test.tsx`, `packages/web/__tests__/chat-area-send.test.tsx` | Covers send, streaming accumulation, UI error warnings, and session-key continuity. |
| Chat history reload | `Covered` | `packages/web/__tests__/api-chat-history.test.ts`, `packages/web/__tests__/chat-area-history.test.tsx` | API ownership/history normalization and UI reload/compaction behavior are covered. |

## Connectors, Skills, and Marketplace

| Workflow | Status | Primary automated coverage | Notes / next gaps |
| --- | --- | --- | --- |
| Marketplace catalog integrity | `Covered` | `packages/web/__tests__/marketplace-catalog.test.ts` | Covers categories, install token helpers, packaging, and Anthropic skill imports. |
| Skill install | `Covered` | `packages/web/__tests__/marketplace-install-route.test.ts` | Includes validation, access checks, and requirement guidance. |
| Skill disable/uninstall | `Covered` | `packages/web/__tests__/marketplace-skill-item-route.test.ts`, `packages/web/__tests__/marketplace-page.test.tsx`, `packages/web/__tests__/marketplace-install-route.test.ts` | Covers uninstall, reinstall, refreshed UI state, and workspace copy reset during reinstall. |
| Connector requirement gating in marketplace | `Covered` | `packages/web/__tests__/marketplace-requirements.test.ts`, `packages/web/__tests__/agent-connections-route.test.ts` | Covers ready, reconnect, and admin-setup-needed states. |
| User connector auth readiness state | `Partial` | `packages/web/__tests__/connectors-page.test.tsx`, `packages/web/__tests__/procore-connection-guard.test.ts` | Expired/reconnect state covered; more provider-specific auth lifecycle tests still needed. |
| Refresh / expired token handling | `Partial` | `packages/web/__tests__/marketplace-install-route.test.ts`, `packages/web/__tests__/connectors-page.test.tsx` | Generic readiness exists; end-to-end token refresh flow still limited. |

## Runtime, Isolation, and Persistence

| Workflow | Status | Primary automated coverage | Notes / next gaps |
| --- | --- | --- | --- |
| Runtime sync from admin state | `Covered` | `packages/web/__tests__/runtime-sync.test.ts`, `packages/web/__tests__/runtime-sync.integration.test.ts` | Includes tool allow/deny and agent manifests. |
| Engine config mutation | `Covered` | `packages/web/__tests__/engine-config.test.ts` | Covers auth profiles and config add/remove behavior. |
| Workspace isolation between users | `Partial` | `packages/web/__tests__/runtime-isolation-file-artifact-api.test.ts`, `packages/web/__tests__/runtime-sync.integration.test.ts`, `packages/web/__tests__/engine-config.test.ts` | File-level isolation plus stale runtime/auth cleanup after admin changes are covered; full multi-user concurrent execution still needs stronger end-to-end testing. |
| Cron / scheduled runtime loop | `Partial` | `packages/web/__tests__/api-schedule-ownership.test.ts`, `packages/web/__tests__/schedule-page-timezone.test.tsx`, `packages/web/__tests__/runtime-sync.integration.test.ts` | Ownership, timezone-aware scheduling, recent run history display, and runtime cleanup around admin changes are covered; actual gateway-driven cron execution/history still needs end-to-end coverage against a live engine. |
| Agent tool loop behavior | `Gap` | None | Needs runtime/integration coverage against real agent execution. |
| Message send loop / session persistence | `Partial` | `packages/web/__tests__/chat-area-send.test.tsx`, `packages/web/__tests__/api-chat-history.test.ts`, `packages/web/__tests__/chat-area-history.test.tsx` | In-session continuity and history reload are covered; longer-lived persistence/restart scenarios still need runtime-level tests. |

## Browser-Level Journeys

| Journey | Status | Coverage |
| --- | --- | --- |
| First-time onboarding preview | `Covered` | `e2e/onboarding-preview.spec.ts` |
| Admin settings preview | `Covered` | `e2e/admin-settings-preview.spec.ts` |
| Admin tools / MCP preview | `Covered` | `e2e/admin-control-preview.spec.ts` |
| Connector install and user auth | `Gap` | Needs browser journey once provider auth mocks are formalized. |
| Marketplace install from user flow | `Gap` | Needs browser journey from marketplace to installed skill state. |
| Chat history persistence after refresh | `Gap` | Needs browser journey. |

## Current Priority Gaps

1. Admin user route coverage for create/update/delete/disable semantics.
2. Browser E2E for marketplace install and connector auth handoff.
3. Longer-lived runtime persistence tests across engine restarts and actual gateway cron execution.
4. Multiple-admin workflow coverage.
5. User connector auth lifecycle coverage beyond Procore.
6. Full multi-user concurrent runtime isolation coverage under real execution.

This matrix is the release bar. New features should add or update the relevant rows before they are considered production-ready.
