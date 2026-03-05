# USER STORIES — Org/Enterprise Skills

## Purpose
Define phase-traceable user stories for organization/enterprise skill rollout in BuildAI, with explicit Gherkin acceptance criteria aligned to the implementation phases.

## Scope
- **In scope:** skill onboarding, org-level governance, enterprise controls, permissions, security, migration, observability, and rollout quality gates.
- **Out of scope:** UI polish not tied to skill workflows, non-skill product features.

---

## Phase Traceability Matrix

| Story ID | Phase | Capability | Priority |
|---|---|---|---|
| P2-US-01 | Phase 2 (Skills Integrations) | Register and invoke approved skills | P0 |
| P2-US-02 | Phase 2 | Skill-specific connection setup and health checks | P0 |
| P2-US-03 | Phase 2 | Safe query execution for data skills | P0 |
| P2-US-04 | Phase 2 | Skill catalog visibility by role | P1 |
| P3-US-01 | Phase 3 (Reactive) | Proactive monitoring via skill-driven heartbeat rules | P0 |
| P3-US-02 | Phase 3 | Automated recommendations from repeated user behavior | P1 |
| P3-US-03 | Phase 3 | Daily digest generated from connected skill data | P1 |
| P4-US-01 | Phase 4 (Additional Integrations) | Add enterprise PMIS skills (P6/Unifier/etc.) with common contract | P1 |
| P4-US-02 | Phase 4 | Cross-skill normalization for unified answers | P2 |
| P5-US-01 | Phase 5 (Production Polish) | Admin-controlled org skill rollout and rollback | P0 |
| P5-US-02 | Phase 5 | Enterprise auditability for skill actions | P0 |
| P5-US-03 | Phase 5 | Tenant-isolated permission model for skills | P0 |

---

## User Stories + Gherkin Acceptance Criteria

## P2-US-01 — Register and invoke approved skills
**As** an organization admin  
**I want** approved skills to be registered and invokable by agents  
**So that** PM users get real tool-backed responses instead of model-only guesses.

### Acceptance Criteria (Gherkin)
```gherkin
Feature: Skill registration and invocation

  Scenario: Admin enables a skill for the organization
    Given an admin is authenticated for org "Acme Construction"
    And the skill "buildai-procore" exists in the catalog
    When the admin enables the skill for the org
    Then the skill is marked "active" for that org
    And agents in that org can invoke the skill

  Scenario: Disabled skill cannot be invoked
    Given the skill "buildai-documents" is disabled for org "Acme Construction"
    When a PM asks the agent to use that skill
    Then the agent returns a controlled "skill unavailable" response
    And no tool execution is performed
```

## P2-US-02 — Connection setup and health checks
**As** a PM or admin  
**I want** guided connection setup and health validation per skill  
**So that** I can trust the integration before production use.

### Acceptance Criteria (Gherkin)
```gherkin
Feature: Skill connections and health

  Scenario: Successful connection test
    Given a user has provided valid credentials for "Procore"
    When they run "test connection"
    Then the system returns "healthy"
    And stores connection metadata in tenant-scoped storage

  Scenario: Failed connection test
    Given a user has provided invalid credentials for "Procore"
    When they run "test connection"
    Then the system returns "unhealthy" with actionable error guidance
    And credentials are not logged in plaintext
```

## P2-US-03 — Safe query execution for data skills
**As** a security-conscious admin  
**I want** SQL and API operations constrained by policy  
**So that** enterprise data remains protected.

### Acceptance Criteria (Gherkin)
```gherkin
Feature: Safe execution guardrails

  Scenario: Read-only SQL is allowed
    Given the "buildai-database" skill is active
    When the agent executes a SELECT query
    Then the query is executed
    And the result is returned

  Scenario: Destructive SQL is blocked
    Given the "buildai-database" skill is active
    When the agent attempts a query containing "DROP" or "DELETE"
    Then execution is blocked
    And a policy violation event is logged
```

## P2-US-04 — Skill catalog visibility by role
**As** a PM user  
**I want** to see only the skills I can use  
**So that** the product feels clear and secure.

### Acceptance Criteria (Gherkin)
```gherkin
Feature: Role-filtered skill catalog

  Scenario: PM sees permitted skills only
    Given role "PM" has access to "buildai-database" and "buildai-procore"
    And role "PM" has no access to "connection-manager:admin-actions"
    When the PM opens marketplace or settings
    Then only permitted skills/actions are visible
```

## P3-US-01 — Proactive monitoring alerts
**As** a PM  
**I want** the assistant to proactively detect exceptions  
**So that** I can act before issues escalate.

### Acceptance Criteria (Gherkin)
```gherkin
Feature: Reactive heartbeat monitoring

  Scenario: Overdue RFI alert is triggered
    Given heartbeat rules include "overdue RFIs > 7 days"
    And Procore connection is healthy
    When a heartbeat cycle runs
    And at least one RFI matches the rule
    Then an alert is sent to the PM session
    And the alert includes recommended actions
```

## P3-US-02 — Automation recommendations from repeated asks
**As** a frequent user  
**I want** the assistant to suggest automation for repeated requests  
**So that** recurring reporting becomes hands-free.

### Acceptance Criteria (Gherkin)
```gherkin
Feature: Pattern-based automation suggestions

  Scenario: Suggest digest after repeated budget questions
    Given a PM asked for budget status at least 3 times in 14 days
    When the pattern detector runs
    Then the assistant suggests creating a weekly digest automation
    And the user can approve or reject it
```

## P3-US-03 — Daily digest across skills
**As** an executive stakeholder  
**I want** a daily roll-up from connected systems  
**So that** I see project risk quickly.

### Acceptance Criteria (Gherkin)
```gherkin
Feature: Daily digest generation

  Scenario: Digest is created and delivered
    Given Procore and database skills are connected
    And digest cron is configured for 07:30 local time
    When schedule time is reached
    Then a digest message is delivered
    And each data section includes source attribution
```

## P4-US-01 — Add enterprise PMIS skills with common contract
**As** a platform admin  
**I want** new enterprise skills to follow a standard contract  
**So that** onboarding is predictable and low-risk.

### Acceptance Criteria (Gherkin)
```gherkin
Feature: Standardized enterprise skill onboarding

  Scenario: New skill passes contract checks
    Given a new skill "buildai-p6" is submitted
    When validation runs
    Then required actions (auth, list, read, health) are present
    And security policy checks pass
    And the skill is eligible for staged rollout
```

## P4-US-02 — Cross-skill normalization
**As** a PM  
**I want** answers normalized across systems  
**So that** I can compare schedule/cost/risk without manual reconciliation.

### Acceptance Criteria (Gherkin)
```gherkin
Feature: Cross-skill normalization

  Scenario: Unified response for mixed-system query
    Given P6 and Procore skills are connected
    When the user asks "show schedule slippage and related RFIs"
    Then the response maps entities to a shared project identifier
    And highlights conflicts or missing joins explicitly
```

## P5-US-01 — Admin-controlled rollout and rollback
**As** an enterprise admin  
**I want** phased rollout controls with rollback  
**So that** incidents can be contained quickly.

### Acceptance Criteria (Gherkin)
```gherkin
Feature: Controlled rollout lifecycle

  Scenario: Rollout by cohort
    Given a skill version is approved
    When admin enables rollout for cohort "pilot"
    Then only pilot users receive the new skill version

  Scenario: Rollback on failure threshold
    Given error rate exceeds defined threshold during rollout
    When rollback is triggered
    Then previous stable version is restored for impacted cohort
    And incident metadata is preserved
```

## P5-US-02 — Enterprise audit trail
**As** a compliance officer  
**I want** immutable audit logs of skill actions  
**So that** audits and investigations are defensible.

### Acceptance Criteria (Gherkin)
```gherkin
Feature: Auditability and trace

  Scenario: Tool execution is auditable
    Given any skill action is executed
    When execution completes
    Then audit logs include actor, tenant, skill, action, timestamp, outcome, and request ID
    And sensitive fields are redacted
```

## P5-US-03 — Tenant-isolated permission model
**As** a security admin  
**I want** strict tenant and role isolation  
**So that** no cross-org access is possible.

### Acceptance Criteria (Gherkin)
```gherkin
Feature: Tenant and role isolation

  Scenario: Cross-tenant request is denied
    Given user A belongs to tenant "Org-A"
    And resource belongs to tenant "Org-B"
    When user A attempts skill access to that resource
    Then access is denied with "forbidden"
    And an authorization failure event is logged
```

---

## Non-Functional Acceptance Criteria (Applies to all stories)
- P95 skill action latency within agreed SLO for each integration tier.
- Zero plaintext secret exposure in logs/events.
- Idempotent retry behavior for network/transient failures where applicable.
- Correlation IDs present across request, tool execution, and audit logs.
- All enterprise-critical stories (P0) require automated test coverage before phase gate approval.
