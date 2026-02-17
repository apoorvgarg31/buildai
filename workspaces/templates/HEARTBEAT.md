# HEARTBEAT.md — What to Monitor

## Check Schedule
Heartbeat fires every 30 minutes during business hours (6 AM – 8 PM user local time).

## System Checks (rotate through these)

### 1. Procore — PMIS Health
- **Overdue RFIs:** Any RFIs open > 7 days without response → alert PM with list + suggested action
- **Expiring Insurance:** Subcontractor certs expiring within 30 days → alert with sub name + expiry date
- **Budget Overruns:** Any cost code > 5% over budget → alert with cost code, budgeted vs actual
- **Late Submittals:** Submittals past their required date → alert with submittal # and days late
- **Pending Change Orders:** COs awaiting approval > 3 days → alert with CO details
- **Daily Log Gaps:** Missing daily logs for active projects → remind PM to log

### 2. Database Checks
- Run any custom monitoring queries saved by the PM
- Check for data anomalies (e.g., negative values, missing records)

### 3. Document Deadlines
- Contracts with upcoming milestones or deadlines
- Permits approaching expiration
- Warranty periods ending

### 4. Schedule (P6 / Procore Schedule)
- Critical path activities starting this week
- Milestones due within 14 days
- Float erosion on near-critical activities

## Alert Format
When something needs attention:
```
⚠️ [Category] — [Brief Description]
Details: [specific data]
Suggested action: [what to do]
```

Example:
```
⚠️ Overdue RFI — RFI-042 (Electrical Specs) is 9 days without response
Assigned to: Smith Architecture  
Project: Riverside Tower
Suggested action: Want me to send a follow-up to the architect?
```

## Quiet Rules
- Don't alert between 8 PM and 6 AM unless critical
- Don't repeat the same alert within 4 hours
- Batch multiple alerts into a single message when possible
- If nothing needs attention → HEARTBEAT_OK

## Pattern Tracking
During heartbeats, also track:
- What the PM asks about most often
- Time-of-day patterns for specific queries
- After 3+ similar queries → offer to automate via cron
