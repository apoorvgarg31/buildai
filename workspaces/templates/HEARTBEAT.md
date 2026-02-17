# HEARTBEAT.md — Proactive Monitoring

Run these checks every heartbeat. Use the database skill (`query.sh`) to run real queries.
If issues are found, write them to ACTIVE.md and alert in the next chat session.
If nothing needs attention, reply HEARTBEAT_OK.

## Checks

### 1. Overdue RFIs (Critical)
```bash
bash skills/buildai-database/query.sh "SELECT r.number, r.subject, r.priority, p.name as project, (CURRENT_DATE - r.due_date) as days_overdue FROM rfis r JOIN projects p ON r.project_id = p.id WHERE r.status = 'open' AND r.due_date < CURRENT_DATE AND r.priority IN ('critical', 'urgent') ORDER BY days_overdue DESC LIMIT 10"
```
**Alert if:** Any results returned. Include RFI numbers and days overdue.

### 2. Expiring Insurance (<30 days)
```bash
bash skills/buildai-database/query.sh "SELECT ic.vendor, ic.policy_type, ic.expiration_date, p.name as project, (ic.expiration_date - CURRENT_DATE) as days_until_expiry FROM insurance_certificates ic JOIN projects p ON ic.project_id = p.id WHERE ic.expiration_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 30 ORDER BY ic.expiration_date"
```
**Alert if:** Any certificates expiring within 30 days.

### 3. Budget Overruns (>5% variance)
```bash
bash skills/buildai-database/query.sh "SELECT * FROM v_project_budget_summary WHERE abs(variance_pct) > 5"
```
**Alert if:** Any project has >5% budget variance.

### 4. Late Submittals
```bash
bash skills/buildai-database/query.sh "SELECT s.number, s.title, s.status, p.name as project, (CURRENT_DATE - s.due_date) as days_late FROM submittals s JOIN projects p ON s.project_id = p.id WHERE s.status NOT IN ('approved', 'closed') AND s.due_date < CURRENT_DATE ORDER BY days_late DESC LIMIT 10"
```
**Alert if:** Any overdue submittals found.

## Alert Format
Write alerts to ACTIVE.md in this format:
```
## ⚠️ Alerts (last checked: YYYY-MM-DD HH:MM)
- 🔴 4 critical overdue RFIs (oldest: RFI-003, 303 days)
- 🟡 2 insurance certificates expiring within 30 days
- 🟡 Budget overrun on Westfield Logistics (6.2%)
```

## Schedule
- Checks run every 30 minutes during business hours (07:00-19:00)
- Only alert on NEW issues (check ACTIVE.md for already-reported alerts)
