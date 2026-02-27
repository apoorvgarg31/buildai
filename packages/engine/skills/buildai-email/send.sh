#!/usr/bin/env bash
# BuildAI Email Send — sends email via SMTP (Gmail)
set -euo pipefail

SMTP_HOST="${SMTP_HOST:-smtp.gmail.com}"
SMTP_PORT="${SMTP_PORT:-587}"
SMTP_USER="${SMTP_USER:-}"
SMTP_PASSWORD="${SMTP_PASSWORD:-}"
SMTP_FROM_NAME="${SMTP_FROM_NAME:-BuildAI}"

TO=""
SUBJECT=""
BODY=""
HTML=""
ATTACHMENTS=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --to) TO="$2"; shift 2 ;;
    --subject) SUBJECT="$2"; shift 2 ;;
    --body) BODY="$2"; shift 2 ;;
    --html) HTML="$2"; shift 2 ;;
    --attach) ATTACHMENTS+=("$2"); shift 2 ;;
    *) echo "{\"error\": \"Unknown flag: $1\"}"; exit 1 ;;
  esac
done

if [[ -z "$TO" || -z "$SUBJECT" ]]; then
  echo '{"error": "Usage: send.sh --to <email> --subject <subject> [--body <text>] [--html <html>] [--attach <file>]"}'
  exit 1
fi

if [[ -z "$SMTP_USER" || -z "$SMTP_PASSWORD" ]]; then
  echo '{"error": "SMTP_USER and SMTP_PASSWORD environment variables are required. Set them in .env.buildai"}'
  exit 1
fi

# Build attachment args for python
ATTACH_JSON="[]"
if [[ ${#ATTACHMENTS[@]} -gt 0 ]]; then
  ATTACH_JSON=$(python3 -c "import json,sys; print(json.dumps(sys.argv[1:]))" "${ATTACHMENTS[@]}")
fi

python3 - "$SMTP_HOST" "$SMTP_PORT" "$SMTP_USER" "$SMTP_PASSWORD" "$SMTP_FROM_NAME" "$TO" "$SUBJECT" "$BODY" "$HTML" "$ATTACH_JSON" << 'PYEOF'
import sys
import json
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders
from pathlib import Path

smtp_host, smtp_port, smtp_user, smtp_pass, from_name, to, subject, body, html, attach_json = sys.argv[1:11]
attachments = json.loads(attach_json)

msg = MIMEMultipart("mixed")
msg["From"] = f"{from_name} <{smtp_user}>"
msg["To"] = to
msg["Subject"] = subject

# Build body
if html:
    alt = MIMEMultipart("alternative")
    if body:
        alt.attach(MIMEText(body, "plain", "utf-8"))
    alt.attach(MIMEText(html, "html", "utf-8"))
    msg.attach(alt)
elif body:
    msg.attach(MIMEText(body, "plain", "utf-8"))
else:
    msg.attach(MIMEText("", "plain", "utf-8"))

# Attach files
for fpath in attachments:
    p = Path(fpath)
    if not p.exists():
        print(json.dumps({"error": f"Attachment not found: {fpath}"}))
        sys.exit(1)
    part = MIMEBase("application", "octet-stream")
    part.set_payload(p.read_bytes())
    encoders.encode_base64(part)
    part.add_header("Content-Disposition", f'attachment; filename="{p.name}"')
    msg.attach(part)

try:
    with smtplib.SMTP(smtp_host, int(smtp_port)) as server:
        server.starttls()
        server.login(smtp_user, smtp_pass)
        server.send_message(msg)
    result = {"ok": True, "to": to, "subject": subject, "attachments": len(attachments)}
    print(json.dumps(result))
except Exception as e:
    print(json.dumps({"error": f"Send failed: {str(e)}"}))
    sys.exit(1)
PYEOF
