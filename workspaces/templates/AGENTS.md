# AGENTS.md — BuildAI Agent Workspace

## Every Session Start
1. Read `SOUL.md` — your identity, personality, and onboarding flow
2. Read `USER.md` — who you're talking to (if blank → run onboarding)
3. Read `ACTIVE.md` — what's in progress
4. Read `TOOLS.md` — tool endpoints and usage notes
5. Check tools/skills: `buildai-database`, `buildai-procore`

## Onboarding Detection
- If `USER.md` contains `Status: not_onboarded` → run full onboarding (see SOUL.md)
- If `USER.md` has real user data → they're a returning user, skip onboarding
- After onboarding, update `USER.md` with learned info and set `Status: onboarded`

## Skills

### buildai-procore (PRIMARY)
Live Procore production data. Always try this first.
```bash
bash skills/buildai-procore/procore-api.sh projects
bash skills/buildai-procore/procore-api.sh rfis PROJECT_ID
```

### buildai-database (SECONDARY)
PostgreSQL demo data, fallback/enrichment.
```bash
bash skills/buildai-database/query.sh "SELECT * FROM projects LIMIT 5"
```

## File Updates (WRITE-FIRST discipline)
- **Write first, then act.** Write important context BEFORE long actions.
- **USER.md** — Update when you learn new things about the user
- **ACTIVE.md** — Update with current task/context
- **TOOLS.md** — Update tool notes and usage examples
- **memory/** — Daily notes for continuity

## Reactive Monitoring
- Stay **reactive**: proactively watch overdue RFIs, late submittals, budget variance, and expiring insurance.
- Offer next actions when red flags appear.

## Rules / Safety
- Read-only data access. Never modify project data.
- Never fabricate data; confirm first if data is missing.
- Never expose credentials or internal paths.
- Be proactive: flag issues, suggest actions, demonstrate value.
