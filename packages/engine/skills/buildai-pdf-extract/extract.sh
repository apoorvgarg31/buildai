#!/usr/bin/env bash
# BuildAI PDF Extract — Extract text and tables from PDFs
# Usage: bash skills/buildai-pdf-extract/extract.sh <pdf_path> [mode]
# Modes: text (default), tables, all
set -euo pipefail

PDF_PATH="${1:-}"
MODE="${EXTRACT_MODE:-${2:-text}}"
PAGES="${PAGES:-}"
OUTPUT_FORMAT="${OUTPUT_FORMAT:-text}"

if [ -z "$PDF_PATH" ]; then
  echo '{"error": "Usage: extract.sh <pdf_path> [text|tables|all]"}'
  exit 1
fi

if [ ! -f "$PDF_PATH" ]; then
  echo "{\"error\": \"File not found: $PDF_PATH\"}"
  exit 1
fi

# Ensure pdfplumber is installed
python3 -c "import pdfplumber" 2>/dev/null || pip3 install -q pdfplumber 2>/dev/null

python3 - "$PDF_PATH" "$MODE" "$PAGES" "$OUTPUT_FORMAT" << 'PYEOF'
import sys, json, os

pdf_path = sys.argv[1]
mode = sys.argv[2]
pages_arg = sys.argv[3]
output_format = sys.argv[4]

try:
    import pdfplumber
except ImportError:
    # Fallback to basic text extraction
    import subprocess
    result = subprocess.run(['pdftotext', '-layout', pdf_path, '-'], capture_output=True, text=True)
    if result.returncode == 0:
        print(json.dumps({"text": result.stdout, "pages": 1, "method": "pdftotext"}))
    else:
        print(json.dumps({"error": "pdfplumber not available and pdftotext failed"}))
    sys.exit(0)

def parse_pages(pages_str, total):
    if not pages_str:
        return list(range(total))
    result = []
    for part in pages_str.split(','):
        if '-' in part:
            start, end = part.split('-', 1)
            result.extend(range(int(start)-1, min(int(end), total)))
        else:
            idx = int(part) - 1
            if 0 <= idx < total:
                result.append(idx)
    return result

with pdfplumber.open(pdf_path) as pdf:
    page_indices = parse_pages(pages_arg, len(pdf.pages))
    results = []

    for i in page_indices:
        page = pdf.pages[i]
        page_data = {"page": i + 1}

        if mode in ("text", "all"):
            text = page.extract_text() or ""
            page_data["text"] = text

        if mode in ("tables", "all"):
            tables = page.extract_tables() or []
            page_data["tables"] = []
            for t_idx, table in enumerate(tables):
                if table and len(table) > 0:
                    headers = [str(h or "").strip() for h in table[0]]
                    rows = []
                    for row in table[1:]:
                        rows.append({headers[j]: str(cell or "").strip() for j, cell in enumerate(row) if j < len(headers)})
                    page_data["tables"].append({"headers": headers, "rows": rows, "row_count": len(rows)})

        results.append(page_data)

output = {
    "file": os.path.basename(pdf_path),
    "total_pages": len(pdf.pages),
    "extracted_pages": len(results),
    "mode": mode,
    "pages": results
}

if output_format == "json":
    print(json.dumps(output, indent=2))
else:
    # Plain text output
    for p in results:
        print(f"--- Page {p['page']} ---")
        if "text" in p:
            print(p["text"])
        if "tables" in p:
            for t in p["tables"]:
                print(f"\n[Table: {t['row_count']} rows]")
                print(" | ".join(t["headers"]))
                print("-" * 60)
                for row in t["rows"][:20]:
                    print(" | ".join(row.values()))
        print()
PYEOF
