#!/usr/bin/env bash
# BuildAI Invoice Parser — Extract structured data from PDF invoices
set -euo pipefail

PDF_PATH="${1:-}"
if [ -z "$PDF_PATH" ] || [ ! -f "$PDF_PATH" ]; then
  echo '{"error": "Usage: parse.sh <invoice_pdf_path>"}'
  exit 1
fi

python3 -c "import pdfplumber" 2>/dev/null || pip3 install -q pdfplumber 2>/dev/null

python3 - "$PDF_PATH" << 'PYEOF'
import sys, json, re, os

pdf_path = sys.argv[1]

try:
    import pdfplumber
except ImportError:
    print(json.dumps({"error": "pdfplumber not installed"}))
    sys.exit(1)

text = ""
tables = []
with pdfplumber.open(pdf_path) as pdf:
    for page in pdf.pages:
        t = page.extract_text() or ""
        text += t + "\n"
        for table in (page.extract_tables() or []):
            if table and len(table) > 1:
                tables.append(table)

# Extract common invoice fields using patterns
def find_pattern(pattern, text, group=1, default=""):
    m = re.search(pattern, text, re.IGNORECASE | re.MULTILINE)
    return m.group(group).strip() if m else default

def find_amount(pattern, text, default=0.0):
    m = re.search(pattern, text, re.IGNORECASE)
    if m:
        val = re.sub(r'[,$\s]', '', m.group(1))
        try: return float(val)
        except: pass
    return default

result = {
    "file": os.path.basename(pdf_path),
    "vendor": find_pattern(r'(?:from|vendor|contractor|company)[:\s]*([^\n]+)', text),
    "invoice_number": find_pattern(r'(?:invoice\s*(?:#|no|number)[:\s.]*)(\S+)', text),
    "date": find_pattern(r'(?:invoice\s*date|date)[:\s]*(\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4})', text),
    "due_date": find_pattern(r'(?:due\s*date|payment\s*due)[:\s]*(\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4})', text),
    "po_number": find_pattern(r'(?:p\.?o\.?\s*(?:#|no|number)?)[:\s]*(\S+)', text),
    "subtotal": find_amount(r'(?:sub\s*total)[:\s]*\$?([\d,]+\.?\d*)', text),
    "tax": find_amount(r'(?:tax|sales\s*tax|hst|gst)[:\s]*\$?([\d,]+\.?\d*)', text),
    "total": find_amount(r'(?:total\s*(?:due|amount)?|amount\s*due|balance\s*due)[:\s]*\$?([\d,]+\.?\d*)', text),
    "line_items": [],
    "raw_text": text[:3000],
}

# Try to extract line items from tables
for table in tables:
    headers = [str(h or "").lower().strip() for h in table[0]]
    # Look for amount/price columns
    has_amount = any(h in headers for h in ['amount', 'total', 'price', 'cost', 'ext', 'extended'])
    has_desc = any(h in headers for h in ['description', 'item', 'service', 'work', 'detail'])
    if has_amount or has_desc:
        for row in table[1:]:
            if not row or not any(cell for cell in row if cell):
                continue
            item = {}
            for i, h in enumerate(headers):
                if i < len(row) and row[i]:
                    val = str(row[i]).strip()
                    if h in ('description', 'item', 'service', 'work', 'detail'):
                        item['description'] = val
                    elif h in ('quantity', 'qty', 'units'):
                        item['quantity'] = val
                    elif h in ('unit_price', 'rate', 'price', 'unit'):
                        item['unit_price'] = val
                    elif h in ('amount', 'total', 'cost', 'ext', 'extended'):
                        item['amount'] = val
            if item.get('description') or item.get('amount'):
                result['line_items'].append(item)

print(json.dumps(result, indent=2))
PYEOF
