---
name: buildai-email
description: Send emails to users with attachments. Use for sending reports, exported files, notifications, and summaries. Supports HTML formatting and file attachments.
metadata: {"engine":{"emoji":"📧","requires":{"anyBins":["python3"]}}}
---

# BuildAI Email

Send emails to users via SMTP (Gmail). Used for delivering reports, exports, notifications, and summaries.

## Usage

```bash
# Send a simple email
bash skills/buildai-email/send.sh --to "user@example.com" --subject "Your RFI Report" --body "Please find your report attached."

# Send with HTML body
bash skills/buildai-email/send.sh --to "user@example.com" --subject "Weekly Summary" --html "<h1>Summary</h1><p>All good.</p>"

# Send with attachment
bash skills/buildai-email/send.sh --to "user@example.com" --subject "Export" --body "Attached is your export." --attach "/path/to/file.xlsx"

# Multiple attachments
bash skills/buildai-email/send.sh --to "user@example.com" --subject "Reports" --body "See attached." --attach "/path/a.pdf" --attach "/path/b.xlsx"
```

## Environment Variables

Set in `.env.buildai` or system environment:
- `SMTP_HOST` — SMTP server (default: `smtp.gmail.com`)
- `SMTP_PORT` — SMTP port (default: `587`)
- `SMTP_USER` — sender email address
- `SMTP_PASSWORD` — app password (NOT regular password — use Gmail App Password)
- `SMTP_FROM_NAME` — display name (default: `BuildAI`)

## Rules
- Always confirm with the user before sending an email
- Use HTML format for reports and tables — plain text for simple messages
- Include a clear subject line
- When sending exports/reports, attach the file rather than pasting content in the body
