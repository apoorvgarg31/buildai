#!/usr/bin/env bash
# BuildAI Excel Export — JSON to .xlsx
set -euo pipefail

INPUT=""
OUTPUT=""
SHEET="Sheet1"
APPEND=0
TITLE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --input) INPUT="$2"; shift 2 ;;
    --output) OUTPUT="$2"; shift 2 ;;
    --sheet) SHEET="$2"; shift 2 ;;
    --append) APPEND=1; shift ;;
    --title) TITLE="$2"; shift 2 ;;
    *) echo "{\"error\": \"Unknown flag: $1\"}"; exit 1 ;;
  esac
done

if [[ -z "$OUTPUT" ]]; then
  echo '{"error": "Usage: export.sh --output <file.xlsx> [--input <data.json>] [--sheet <name>] [--append] [--title <text>]"}'
  exit 1
fi

# Check openpyxl is available, install if not
python3 -c "import openpyxl" 2>/dev/null || {
  pip3 install --quiet openpyxl 2>/dev/null || pip install --quiet openpyxl 2>/dev/null
}

# Read JSON from input file or stdin
if [[ -n "$INPUT" ]]; then
  JSON_DATA=$(cat "$INPUT")
else
  JSON_DATA=$(cat)
fi

python3 - "$OUTPUT" "$SHEET" "$APPEND" "$TITLE" "$JSON_DATA" << 'PYEOF'
import sys
import json
from pathlib import Path

output, sheet_name, append_str, title, json_str = sys.argv[1:6]
append = append_str == "1"

try:
    import openpyxl
    from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
    from openpyxl.utils import get_column_letter
except ImportError:
    print(json.dumps({"error": "openpyxl not installed. Run: pip3 install openpyxl"}))
    sys.exit(1)

try:
    data = json.loads(json_str)
except json.JSONDecodeError as e:
    print(json.dumps({"error": f"Invalid JSON: {str(e)}"}))
    sys.exit(1)

if not isinstance(data, list):
    data = [data]

if len(data) == 0:
    print(json.dumps({"error": "No data to export"}))
    sys.exit(1)

# Load or create workbook
p = Path(output)
if append and p.exists():
    wb = openpyxl.load_workbook(output)
else:
    wb = openpyxl.Workbook()
    # Remove default sheet if we're naming our own
    if "Sheet" in wb.sheetnames:
        del wb["Sheet"]

ws = wb.create_sheet(title=sheet_name)

# Styles
header_font = Font(bold=True, color="FFFFFF", size=11)
header_fill = PatternFill(start_color="2F5496", end_color="2F5496", fill_type="solid")
header_align = Alignment(horizontal="center", vertical="center")
thin_border = Border(
    left=Side(style="thin", color="D9D9D9"),
    right=Side(style="thin", color="D9D9D9"),
    top=Side(style="thin", color="D9D9D9"),
    bottom=Side(style="thin", color="D9D9D9"),
)
alt_fill = PatternFill(start_color="F2F2F2", end_color="F2F2F2", fill_type="solid")

row_offset = 1

# Title row
if title:
    ws.cell(row=1, column=1, value=title)
    ws.cell(row=1, column=1).font = Font(bold=True, size=14)
    row_offset = 3

# Get headers from all items (union of all keys)
headers = []
seen = set()
for item in data:
    if isinstance(item, dict):
        for k in item.keys():
            if k not in seen:
                headers.append(k)
                seen.add(k)

# Write headers
for col_idx, header in enumerate(headers, 1):
    cell = ws.cell(row=row_offset, column=col_idx, value=header.replace("_", " ").title())
    cell.font = header_font
    cell.fill = header_fill
    cell.alignment = header_align
    cell.border = thin_border

# Write data rows
for row_idx, item in enumerate(data, row_offset + 1):
    for col_idx, header in enumerate(headers, 1):
        val = item.get(header, "") if isinstance(item, dict) else item
        cell = ws.cell(row=row_idx, column=col_idx, value=val)
        cell.border = thin_border
        if (row_idx - row_offset) % 2 == 0:
            cell.fill = alt_fill

# Auto-width columns
for col_idx, header in enumerate(headers, 1):
    max_len = len(str(header))
    for row in ws.iter_rows(min_row=row_offset, max_row=ws.max_row, min_col=col_idx, max_col=col_idx):
        for cell in row:
            if cell.value:
                max_len = max(max_len, len(str(cell.value)))
    ws.column_dimensions[get_column_letter(col_idx)].width = min(max_len + 3, 50)

# Freeze header row
ws.freeze_panes = ws.cell(row=row_offset + 1, column=1)

# Auto-filter
if headers:
    ws.auto_filter.ref = f"A{row_offset}:{get_column_letter(len(headers))}{ws.max_row}"

# Save
p.parent.mkdir(parents=True, exist_ok=True)
wb.save(output)

print(json.dumps({
    "ok": True,
    "output": output,
    "sheet": sheet_name,
    "rows": len(data),
    "columns": len(headers),
    "headers": headers,
}))
PYEOF
