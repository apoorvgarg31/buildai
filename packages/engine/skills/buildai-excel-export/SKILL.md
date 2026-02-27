---
name: buildai-excel-export
description: Export data to Excel (.xlsx) files. Convert JSON data, tables, or query results into formatted Excel spreadsheets with headers, auto-column-widths, and multiple sheets.
metadata: {"engine":{"emoji":"📊","requires":{"anyBins":["python3"]}}}
---

# BuildAI Excel Export

Export any data to formatted Excel (.xlsx) files. Use for exporting RFIs, budgets, schedules, reports, or any tabular data.

## Usage

### From JSON data (pipe or file)
```bash
# Pipe JSON array to Excel
echo '[{"name":"RFI-001","status":"open"},{"name":"RFI-002","status":"closed"}]' | \
  bash skills/buildai-excel-export/export.sh --output /tmp/rfis.xlsx --sheet "RFIs"

# From JSON file
bash skills/buildai-excel-export/export.sh --input data.json --output /tmp/export.xlsx --sheet "Data"

# Multiple sheets (call multiple times with --append)
echo '[{"item":"Steel","cost":50000}]' | \
  bash skills/buildai-excel-export/export.sh --output /tmp/report.xlsx --sheet "Budget"
echo '[{"rfi":"RFI-001","status":"open"}]' | \
  bash skills/buildai-excel-export/export.sh --output /tmp/report.xlsx --sheet "RFIs" --append
```

### Options
- `--input <file>` — read JSON from file (default: stdin)
- `--output <file>` — output .xlsx path (required)
- `--sheet <name>` — sheet name (default: "Sheet1")
- `--append` — add sheet to existing file instead of overwriting
- `--title <text>` — add a title row at the top

## Rules
- Always save output to the agent's workspace or /tmp
- After export, offer to email the file to the user (use buildai-email skill)
- Use descriptive sheet names
- Format dates and numbers appropriately
