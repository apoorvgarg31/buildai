---
name: buildai-schedule-import
description: Import and parse project schedules from CSV, Excel, or PDF exports (P6, MS Project, Asta). Extract activities, durations, dependencies, milestones, and critical path data.
metadata: {"engine":{"emoji":"📅","requires":{"anyBins":["python3"]}}}
---

# BuildAI Schedule Import

Import project schedule data from various export formats.

## How to Use

```bash
bash skills/buildai-schedule-import/import.sh <file_path> [format]
```

Formats: `csv` (default, auto-detected), `excel`, `pdf`

## Output

Returns JSON with:
- `activities` — Array of {id, name, start, finish, duration, percent_complete, predecessor}
- `milestones` — Key milestone activities
- `summary` — Total activities, date range, completion %
- `critical_activities` — Activities with zero float (if available)

## Examples

```bash
# Import P6 CSV export
bash skills/buildai-schedule-import/import.sh "/workspace/files/p6-export.csv"

# Import Excel schedule
bash skills/buildai-schedule-import/import.sh "/workspace/files/schedule.xlsx" excel

# Import schedule from PDF
bash skills/buildai-schedule-import/import.sh "/workspace/files/schedule.pdf" pdf
```

## Supported Formats
- **CSV** — P6 exports, MS Project CSV, generic CSV with activity columns
- **Excel** — .xlsx files with schedule data
- **PDF** — Tabular schedule PDFs (best effort extraction)

## Construction Use Cases
- Import P6 schedule exports for analysis
- Compare baseline vs current schedule
- Identify slipping activities
- Track milestone completion
- Analyze critical path changes
