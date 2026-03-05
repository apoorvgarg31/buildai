# PRD: Org Enterprise Skills

**Document owner:** Product + Engineering  
**Status:** Draft for implementation  
**Last updated:** 2026-03-05

---

## 1) Problem Statement
Organizations need a governed way to create, publish, and consume skills with enterprise controls (roles, approvals, versioning, auditability), while preserving a fast builder workflow. Current behavior is optimized for individual usage and lacks clear separation between personal and organization contexts.

---

## 2) Goals
1. Enable **organization-scoped skills** with lifecycle controls (draft → review → approved → published).
2. Provide **role-based access control (RBAC)** for viewing, editing, approving, publishing, and deprecating skills.
3. Introduce a clear **mode switch** in UX between Personal and Org context.
4. Support **versioned releases** with rollback and compatibility metadata.
5. Ensure **auditability** of all sensitive actions (publish, approve, permission changes).

## 3) Non-Goals
1. Cross-org skill sharing marketplace (out of scope for v1).
2. Billing/seat management redesign (use existing org membership system).
3. Runtime sandbox redesign (reuse existing execution runtime policies).
4. Auto-migration of all personal skills to org scope (manual/import flow only in v1).

---

## 4) Personas
1. **Org Admin**
   - Manages org settings, permissions, and policy defaults.
   - Needs governance, visibility, and risk controls.

2. **Skill Maintainer**
   - Builds and iterates skills.
   - Needs fast edit/test loop and predictable release flow.

3. **Reviewer/Approver**
   - Reviews changes for security/compliance/quality.
   - Needs diff visibility, policy checks, and explicit approval controls.

4. **End User (Org Member)**
   - Uses approved skills in day-to-day tasks.
   - Needs discoverability and trust that skills are sanctioned.

---

## 5) Core User Journeys
### Journey A: Create and publish org skill
1. Maintainer switches to **Org mode**.
2. Creates new skill as Draft.
3. Iterates, tests, and submits for review.
4. Reviewer approves.
5. Maintainer/Admin publishes version `1.0.0`.
6. Skill becomes available in org catalog.

### Journey B: Update existing published skill
1. Maintainer opens published skill and creates a new draft version (`1.1.0` candidate).
2. Makes changes, runs validation checks.
3. Submits for review.
4. Reviewer approves; publisher releases.
5. Existing consumers continue on pinned versions unless configured for latest minor.

### Journey C: Roll back bad release
1. Admin detects incident in `1.2.0`.
2. Admin selects rollback target `1.1.3`.
3. System marks `1.2.0` as deprecated and updates default version pointer.
4. Audit event emitted and org notified.

### Journey D: Access denied path
1. Member tries to edit org skill without permission.
2. UI disables edit actions and API returns 403 with reason code.
3. User sees “Request access” flow.

---

## 6) RBAC Matrix (v1)
| Capability | Org Admin | Skill Maintainer | Reviewer | Org Member |
|---|---:|---:|---:|---:|
| View org skills | ✅ | ✅ | ✅ | ✅ |
| Create draft skill | ✅ | ✅ | ❌ | ❌ |
| Edit own draft | ✅ | ✅ | ❌ | ❌ |
| Edit others’ draft | ✅ | Optional* | ❌ | ❌ |
| Submit for review | ✅ | ✅ | ❌ | ❌ |
| Approve/reject review | ✅ | ❌ | ✅ | ❌ |
| Publish approved version | ✅ | ✅** | ❌ | ❌ |
| Deprecate/rollback published | ✅ | ❌ | ❌ | ❌ |
| Manage org skill permissions | ✅ | ❌ | ❌ | ❌ |
| Use published skills | ✅ | ✅ | ✅ | ✅ |

\* Optional by team policy (`maintainer_can_edit_all_drafts`).  
\** Controlled by policy (`publish_requires_admin=false` for delegated teams).

---

## 7) Data Model Requirements
### Entities
1. **organization**
   - `id`, `name`, `slug`

2. **org_member**
   - `id`, `org_id`, `user_id`, `role` (admin/maintainer/reviewer/member), `status`

3. **skill**
   - `id`, `org_id`, `key` (unique per org), `display_name`, `description`, `owner_user_id`, `created_at`, `archived_at`

4. **skill_version**
   - `id`, `skill_id`, `version` (semver), `status` (draft/in_review/approved/published/deprecated/rejected),
   - `manifest_json`, `bundle_uri`, `changelog`, `created_by`, `created_at`, `reviewed_by`, `reviewed_at`, `published_by`, `published_at`

5. **skill_permission_policy**
   - `org_id`, `publish_requires_admin`, `maintainer_can_edit_all_drafts`, `approval_required`

6. **audit_event**
   - `id`, `org_id`, `actor_user_id`, `entity_type`, `entity_id`, `action`, `before_json`, `after_json`, `reason`, `created_at`, `ip`, `user_agent`

### Constraints
- `(org_id, skill.key)` unique.
- `(skill_id, version)` unique.
- Exactly one `published` version pointer per skill (`skill.current_published_version_id` nullable).
- Immutable published version payload (`manifest_json`, `bundle_uri`) after publish.

### Indexing
- `skill(org_id, key)`
- `skill_version(skill_id, status, created_at desc)`
- `audit_event(org_id, created_at desc)`

---

## 8) API Requirements
All org APIs require authenticated user + org context header/path.

### Endpoints (minimum)
1. `GET /v1/orgs/{orgId}/skills`
   - List skills with latest draft + published metadata.
2. `POST /v1/orgs/{orgId}/skills`
   - Create skill + initial draft.
3. `GET /v1/orgs/{orgId}/skills/{skillId}`
4. `PATCH /v1/orgs/{orgId}/skills/{skillId}`
5. `POST /v1/orgs/{orgId}/skills/{skillId}/versions`
   - Create new draft from latest published or selected source version.
6. `GET /v1/orgs/{orgId}/skills/{skillId}/versions`
7. `POST /v1/orgs/{orgId}/skills/{skillId}/versions/{versionId}/submit-review`
8. `POST /v1/orgs/{orgId}/skills/{skillId}/versions/{versionId}/approve`
9. `POST /v1/orgs/{orgId}/skills/{skillId}/versions/{versionId}/reject`
10. `POST /v1/orgs/{orgId}/skills/{skillId}/versions/{versionId}/publish`
11. `POST /v1/orgs/{orgId}/skills/{skillId}/rollback`
12. `GET /v1/orgs/{orgId}/audit-events?entityType=skill&entityId=...`
13. `GET /v1/orgs/{orgId}/permission-policies`
14. `PATCH /v1/orgs/{orgId}/permission-policies`

### API Behavior
- RBAC enforced server-side for every mutation.
- Standard error model: `{ code, message, details, requestId }`.
- Permission failures return `403` + machine-readable reason (`insufficient_role`, `policy_blocked`).
- State transition validation (e.g., cannot publish non-approved when `approval_required=true`).

### Idempotency & Concurrency
- Mutating endpoints accept `Idempotency-Key`.
- Version updates require optimistic concurrency (`If-Match`/`etag` or `updated_at` guard).

---

## 9) UX Requirements (Mode Switch)
### Mode Switch Placement
- Persistent switch in left sidebar header: **Personal | Organization**.
- If multiple orgs: second selector for org context under Organization mode.

### Behavior
1. Switching mode updates:
   - visible skill catalog,
   - creation defaults,
   - permissioned actions.
2. URL includes mode/org context (`?mode=org&orgId=...`) for shareable state.
3. Last selected mode persisted per user (local + server preference).
4. On insufficient access to selected org, fallback to Personal with non-blocking banner.

### UX Rules for Permissioning
- Disable actions user cannot perform; include tooltip with required role.
- On submit actions, show final confirmation for publish/rollback.
- Expose version status badges consistently: Draft, In Review, Approved, Published, Deprecated.

### Empty/Edge States
- No org selected → prompt to select org.
- No org membership → show CTA to request invite.
- No published versions → “Not available to members yet” banner.

---

## 10) Metrics & Success Criteria
### Product Metrics
1. Time to first org skill published (P50/P90).
2. # of org-published skills per active org (weekly).
3. Draft-to-publish conversion rate.
4. Review turnaround time.

### Quality & Reliability Metrics
1. Publish failure rate < 1%.
2. Rollback rate < 5% of publishes (signal for quality issues).
3. 99.9% success for permission checks (no false allows).
4. Audit event write success = 100% for privileged actions.

### Adoption Targets (first 60 days)
- 30% of active orgs publish at least one skill.
- 70% of skill mutations in org mode audited with complete metadata.

---

## 11) Risks & Mitigations
1. **Risk:** Permission misconfiguration blocks teams.
   - **Mitigation:** Safe defaults + admin policy templates + permission simulation UI.

2. **Risk:** Reviewer bottleneck slows releases.
   - **Mitigation:** Optional delegated publish policy for low-risk orgs.

3. **Risk:** Context confusion between personal vs org modes.
   - **Mitigation:** Strong visual mode indicators + scoped URL + contextual banners.

4. **Risk:** Inconsistent version usage by consumers.
   - **Mitigation:** Explicit default version pointer + optional pinning policy.

5. **Risk:** Compliance gaps in audit trail.
   - **Mitigation:** Non-optional audit writes for privileged actions; alert on audit write failures.

---

## 12) Rollout Plan
### Phase 0 (Internal)
- Feature flag: `org_skills_v1`.
- Internal dogfood with 1–2 orgs.
- Validate RBAC + audit completeness.

### Phase 1 (Private Beta)
- Enable for selected design partners.
- Track funnel: create → review → publish.
- Weekly policy tuning.

### Phase 2 (GA)
- Enable by default for all enterprise orgs.
- Migration tooling for importing personal skills into org scope.
- Admin docs + release notes.

### Rollback Strategy
- Kill switch on feature flag.
- Keep personal mode unaffected.
- Preserve org skill data; hide UI if disabled.

---

## 13) Open Questions
1. Should maintainers be allowed to publish in regulated org profiles by default?
2. Do we need multi-stage approvals (2 approvers) for certain org tiers?
3. Should org policies support branch-level rules (e.g., prod vs dev skill catalogs)?
4. What is the default consumer behavior: latest published vs pinned explicit version?
5. Should rejected versions be editable in-place or force new draft creation?

---

## 14) Acceptance Criteria (Engineering-Ready)
1. User can switch between Personal and Org mode from persistent UI control.
2. Org mode shows only org-scoped skills and actions allowed by RBAC.
3. Skill lifecycle state machine enforced in API and UI:
   - draft → in_review → approved → published,
   - plus rejected/deprecated transitions.
4. Unauthorized mutations return 403 with reason code.
5. Privileged actions (approve/publish/rollback/policy update) create audit events.
6. Published versions are immutable; rollback sets prior version as default.
7. API supports idempotency for mutating endpoints.
8. Metrics instrumentation is emitted for create/submit/approve/publish/rollback events.
9. Feature flag can disable org skills without breaking personal skills.
10. End-to-end test coverage includes:
    - happy path publish,
    - permission denial,
    - rollback,
    - mode-switch context persistence.

---

## 15) Implementation Notes (Initial Task Breakdown)
1. Backend: DB migrations for `skill`, `skill_version`, `audit_event`, policy tables.
2. Backend: RBAC middleware + lifecycle transition guards.
3. Backend: Org skills API endpoints + metrics hooks.
4. Frontend: Mode switch + org selector + context-aware routing.
5. Frontend: Skill list/detail/version workflows with status badges and gated actions.
6. QA: E2E matrix by role (admin/maintainer/reviewer/member).
7. DevOps: Feature flag config and environment rollout checklist.
