---
name: buildai-doc-generator
description: Generate formatted PDF and DOCX reports — executive summaries, RFI reports, daily reports, meeting minutes, and status updates for construction projects.
metadata: {"engine":{"emoji":"📋","requires":{"anyBins":["python3"]}}}
---

# BuildAI Document Generator

Generate professional construction project reports as PDF or DOCX files.

## How to Use

```bash
bash skills/buildai-doc-generator/generate.sh <type> <output_path> [title]
```

The script reads report data from stdin as JSON.

## Report Types

| Type | Description |
|------|-------------|
| `executive-summary` | One-page project overview for leadership |
| `rfi-report` | RFI status summary with details |
| `daily-report` | Daily construction log report |
| `meeting-minutes` | Structured meeting notes with action items |
| `status-report` | Weekly/monthly project status |
| `custom` | Custom report from provided content |

## Examples

Generate an executive summary:
```bash
echo '{"project":"Terminal A","date":"2026-02-17","budget_total":5000000,"budget_spent":3200000,"open_rfis":12,"overdue_rfis":3,"schedule_status":"On Track","key_risks":["HVAC delay","Permit pending"]}' | bash skills/buildai-doc-generator/generate.sh executive-summary /tmp/exec-summary.pdf "Terminal A Executive Summary"
```

Generate meeting minutes:
```bash
echo '{"project":"Terminal A","date":"2026-02-17","attendees":["Sarah Chen","Mike Torres","John Smith"],"items":[{"topic":"HVAC Progress","notes":"80% complete","action":"Schedule inspection","owner":"Mike","due":"2026-02-20"}]}' | bash skills/buildai-doc-generator/generate.sh meeting-minutes /tmp/minutes.pdf
```

## Rules
- Output format determined by file extension (.pdf or .docx)
- Data passed via stdin as JSON
- Returns JSON with file path and metadata
