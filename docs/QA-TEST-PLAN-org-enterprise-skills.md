# QA TEST PLAN — Org/Enterprise Skills

## Objective
Validate org/enterprise skill capabilities end-to-end with explicit coverage for:
1. Functional behavior
2. Security controls
3. Migration and rollout safety
4. Regression protection
5. Permission matrix enforcement
6. Phase gate readiness

## In-Scope Systems
- BuildAI web UI (admin + PM flows)
- Engine gateway and skill dispatch
- Skills: buildai-database, buildai-procore, buildai-documents, connection-manager, and future enterprise skills
- Tenant-scoped workspace/config/connections
- Audit and observability surfaces

## Test Environments
- **DEV:** feature validation and rapid iteration
- **STAGE:** production-like datasets, full integration, gate sign-off
- **PROD (pilot cohort):** controlled rollout verification

## Entry Criteria
- Stories and acceptance criteria are baselined in `USER-STORIES-org-enterprise-skills.md`
- Test data seeded for at least 2 tenants, 3 roles, and mixed healthy/unhealthy connections
- Required integrations available in STAGE (or approved mocks)

## Exit Criteria
- 100% pass on P0 tests
- No open Critical/High defects
- Security test suite pass + signoff
- Migration dry run pass + rollback validated
- Regression suite pass for impacted modules

---

## Traceability: Stories → Test Suites

| Story ID | Functional | Security | Migration | Regression | Permission Matrix |
|---|---:|---:|---:|---:|---:|
| P2-US-01 | ✅ | ✅ | — | ✅ | ✅ |
| P2-US-02 | ✅ | ✅ | ✅ | ✅ | ✅ |
| P2-US-03 | ✅ | ✅ | — | ✅ | ✅ |
| P2-US-04 | ✅ | ✅ | — | ✅ | ✅ |
| P3-US-01 | ✅ | ✅ | — | ✅ | ✅ |
| P3-US-02 | ✅ | ✅ | — | ✅ | ✅ |
| P3-US-03 | ✅ | ✅ | ✅ | ✅ | ✅ |
| P4-US-01 | ✅ | ✅ | ✅ | ✅ | ✅ |
| P4-US-02 | ✅ | ✅ | ✅ | ✅ | ✅ |
| P5-US-01 | ✅ | ✅ | ✅ | ✅ | ✅ |
| P5-US-02 | ✅ | ✅ | — | ✅ | ✅ |
| P5-US-03 | ✅ | ✅ | — | ✅ | ✅ |

---

## 1) Functional Test Suite

## F-01 Skill enable/disable lifecycle
- **Preconditions:** admin account, skill exists in catalog
- **Steps:** enable skill → invoke via chat → disable skill → invoke again
- **Expected:** enabled skill executes; disabled skill returns controlled unavailability response

## F-02 Connection setup and test health
- Validate successful and failed credential flows
- Validate actionable error messages (no secret leaks)
- Validate tenant-scoped storage of connection metadata

## F-03 Data skill safety behavior
- Execute valid read-only SQL (`SELECT`, `WITH`)
- Attempt destructive SQL (`DROP`, `DELETE`, `UPDATE`) through prompt
- Confirm policy block + user-safe error + audit event

## F-04 Role-filtered catalog and actions
- PM sees only permitted skills/actions
- Admin sees full governance options
- Viewer has read-only capability where defined

## F-05 Heartbeat proactive alerting
- Seed overdue RFI conditions
- Trigger heartbeat cycle
- Verify alert delivery, context, and recommendation quality

## F-06 Pattern-based automation recommendation
- Simulate repeated user queries
- Validate threshold detection and recommendation prompt
- Validate accept/reject behavior and persistence

## F-07 Daily digest generation
- Schedule digest and run at trigger time
- Verify multi-skill section composition + source attribution
- Verify graceful degradation when one source fails

## F-08 Rollout cohort controls
- Roll out skill version to pilot cohort only
- Confirm non-pilot unaffected
- Rollback and verify previous behavior restored

## F-09 Audit trail completeness
- Execute diverse actions across roles
- Verify log fields: actor, tenant, action, request ID, outcome, timestamp
- Verify redaction rules for sensitive payload elements

---

## 2) Security Test Suite

## S-01 Authentication and authorization
- Unauthorized requests rejected (401)
- Forbidden cross-role actions rejected (403)
- Session/token expiry and refresh behavior validated

## S-02 Tenant isolation
- Attempt cross-tenant access to connections/resources
- Confirm strict denial and security audit entry

## S-03 Prompt injection and tool abuse resistance
- Inject instructions to bypass skill policies
- Confirm policy engine still enforces allowed operations
- Ensure tool invocation remains constrained to registered/allowed actions

## S-04 Secret handling
- Validate secrets never appear in:
  - response payloads
  - logs
  - error traces
- Validate encryption/storage handling according to platform standards

## S-05 Rate limiting and abuse controls
- Flood skill endpoints/tool invocation attempts
- Confirm throttling and stability under abuse

## S-06 Audit integrity
- Validate logs are append-only/immutable in configured sink
- Validate correlation ID continuity end-to-end

---

## 3) Migration Test Suite

## M-01 Legacy skill config migration
- Migrate existing tenant skill settings to new org/enterprise schema
- Verify no data loss and correct default policies

## M-02 Connection record migration
- Migrate stored connection metadata formats
- Validate token references and health status survive migration

## M-03 Backward compatibility
- Old clients/sessions continue to function during phased rollout
- Unsupported fields handled gracefully

## M-04 Rollback migration
- Execute rollback from new schema to stable baseline
- Validate service continuity and no orphaned references

## M-05 Dry-run + checksum validation
- Run migration in dry-run mode with report
- Validate row/object counts, checksum/hash expectations

---

## 4) Regression Test Suite

## R-01 Core chat continuity
- Non-skill chat remains functional across releases
- Message delivery/streaming semantics unchanged

## R-02 Existing skill parity
- Previously working skill flows continue to pass
- No behavior drift in stable integrations

## R-03 Performance regression
- Compare latency and error rate vs baseline
- Fail if SLO regression exceeds agreed threshold

## R-04 UI regression (admin + PM)
- Sidebar/nav role rendering
- Skill catalog and settings consistency
- Error state rendering and retry affordances

## R-05 Data contract regression
- Response schemas remain backward-compatible or versioned
- Consumers tolerate optional additions without failure

---

## 5) Permission Matrix Tests

## Roles
- **Org Admin**
- **Project Manager (PM)**
- **Viewer/Auditor**

| Capability | Org Admin | PM | Viewer/Auditor |
|---|---|---|---|
| Enable/disable org skill | Allow | Deny | Deny |
| Configure connection | Allow | Scoped Allow | Deny |
| Invoke permitted skill actions | Allow | Allow | Scoped Allow (read-only) |
| Execute destructive DB operations | Deny (policy) | Deny | Deny |
| View audit logs | Allow | Scoped (own project/tenant view if policy allows) | Allow (read-only) |
| Configure rollout cohort | Allow | Deny | Deny |
| Trigger rollback | Allow | Deny | Deny |

### PMX-01..PMX-12 Test Cases
- Verify each matrix cell with explicit Allow/Deny assertions
- Include negative tests for privilege escalation attempts
- Verify UI controls and backend authorization both enforce same decision

---

## 6) Phase Gates (Go/No-Go)

## Gate for Phase 2 (Skills Integrations)
**Must pass:** F-01..F-04, S-01..S-04, R-01/R-02, PMX core cases  
**No-Go triggers:** any unauthorized access, destructive policy bypass, P0 failures.

## Gate for Phase 3 (Reactive)
**Must pass:** F-05..F-07, S-02/S-03, R-03 baseline check  
**No-Go triggers:** noisy/incorrect proactive alerts above agreed threshold, missing attribution.

## Gate for Phase 4 (Additional Integrations)
**Must pass:** F-08 (for staged enablement model), M-01..M-03, R-02/R-05  
**No-Go triggers:** schema incompatibility, cross-skill normalization mismatch with high impact.

## Gate for Phase 5 (Production Polish)
**Must pass:** F-08/F-09, S-01..S-06 full suite, M-04/M-05, full regression + PMX set  
**No-Go triggers:** audit gaps, rollback failure, cross-tenant leakage, unresolved Critical/High defects.

---

## Defect Severity Model
- **Critical:** security breach, cross-tenant data exposure, production outage risk
- **High:** P0 workflow broken, data integrity risk, migration failure with recovery risk
- **Medium:** significant UX or reliability issue with workaround
- **Low:** cosmetic/minor copy/edge-case

## Reporting Cadence
- Daily QA status during active phase testing
- Gate readiness summary at end of each phase
- Final sign-off report includes:
  - Pass/fail by suite
  - Open defects by severity
  - Risk acceptance (if any)
  - Go/No-Go recommendation

## Test Artifacts
- Test case IDs mapped to story IDs
- Execution logs and evidence (screenshots/log snippets)
- Security findings report
- Migration dry-run and rollback reports
- Final phase gate checklist with approvals
