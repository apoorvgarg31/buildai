#!/usr/bin/env bash
# BuildAI Contract Parser — Extract key terms from construction contracts
set -euo pipefail

PDF_PATH="${1:-}"
if [ -z "$PDF_PATH" ] || [ ! -f "$PDF_PATH" ]; then
  echo '{"error": "Usage: parse.sh <contract_pdf_path>"}'
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
with pdfplumber.open(pdf_path) as pdf:
    for page in pdf.pages:
        t = page.extract_text() or ""
        text += t + "\n"

def find_all(pattern, text, flags=re.IGNORECASE|re.MULTILINE):
    return [m.group(1).strip() for m in re.finditer(pattern, text, flags)]

def find_first(pattern, text, group=1, default=""):
    m = re.search(pattern, text, re.IGNORECASE|re.MULTILINE)
    return m.group(group).strip() if m else default

def find_amount(pattern, text):
    m = re.search(pattern, text, re.IGNORECASE)
    if m:
        val = re.sub(r'[,$\s]', '', m.group(1))
        try: return float(val)
        except: pass
    return None

# Extract parties
parties = []
for pattern in [
    r'(?:owner|client)[:\s]*([A-Z][^\n,]{3,50})',
    r'(?:contractor|general\s*contractor)[:\s]*([A-Z][^\n,]{3,50})',
    r'(?:subcontractor|sub)[:\s]*([A-Z][^\n,]{3,50})',
    r'between\s+([A-Z][^,\n]{3,50})\s+(?:and|&)\s+([A-Z][^,\n]{3,50})',
]:
    found = re.findall(pattern, text, re.IGNORECASE)
    for f in found:
        if isinstance(f, tuple):
            parties.extend([p.strip() for p in f if p.strip()])
        elif f.strip():
            parties.append(f.strip())

# Extract dates
dates = {
    "execution_date": find_first(r'(?:dated?|executed?)\s*(?:as\s*of\s*)?(\w+\s+\d{1,2},?\s+\d{4})', text),
    "start_date": find_first(r'(?:commence|start|begin)\s*(?:date|on)?[:\s]*(\w+\s+\d{1,2},?\s+\d{4})', text),
    "completion_date": find_first(r'(?:complet|finish|end|substantial\s*completion)\s*(?:date|by|on)?[:\s]*(\w+\s+\d{1,2},?\s+\d{4})', text),
}

# Key financial terms
contract_value = find_amount(r'(?:contract\s*(?:sum|amount|price|value))[:\s]*\$?([\d,]+\.?\d*)', text)
retainage = find_first(r'(?:retainage|retention)[:\s]*(\d+(?:\.\d+)?)\s*%', text)
ld_rate = find_first(r'(?:liquidated\s*damages?)[:\s]*\$?([\d,]+(?:\.\d+)?)\s*(?:per|/)\s*(\w+)', text)

# Insurance
insurance_patterns = [
    r"(?:general\s*liability)[:\s]*\$?([\d,]+(?:\.\d+)?(?:\s*(?:million|mil|m))?)",
    r"(?:auto(?:mobile)?\s*liability)[:\s]*\$?([\d,]+(?:\.\d+)?(?:\s*(?:million|mil|m))?)",
    r"(?:worker.?s?\s*comp(?:ensation)?)",
    r"(?:umbrella|excess\s*liability)[:\s]*\$?([\d,]+(?:\.\d+)?(?:\s*(?:million|mil|m))?)",
    r"(?:professional\s*liability|e&o)[:\s]*\$?([\d,]+(?:\.\d+)?(?:\s*(?:million|mil|m))?)",
]
insurance = []
for pat in insurance_patterns:
    m = re.search(pat, text, re.IGNORECASE)
    if m:
        insurance.append(m.group(0).strip())

# Warranty
warranty = find_first(r'(?:warranty|guarantee)\s*(?:period)?[:\s]*(\d+)\s*(?:year|month|day)', text)

# Change orders
co_section = find_first(r'(?:change\s*order|changes?\s*(?:in|to)\s*(?:the\s*)?work)[:\s]*([^\n]{10,200})', text)

result = {
    "file": os.path.basename(pdf_path),
    "total_pages": len(text.split('\n--- Page')) if '--- Page' in text else "unknown",
    "parties": list(set(parties))[:5],
    "contract_value": contract_value,
    "dates": {k: v for k, v in dates.items() if v},
    "payment_terms": {
        "retainage": f"{retainage}%" if retainage else None,
    },
    "insurance_requirements": insurance,
    "liquidated_damages": ld_rate or None,
    "warranty_period": f"{warranty}" if warranty else None,
    "change_order_process": co_section or None,
    "key_clauses": [],
    "raw_text": text[:5000],
}

# Detect key clause types
clause_keywords = {
    "Indemnification": r'indemnif',
    "Termination": r'terminat',
    "Force Majeure": r'force\s*majeure',
    "Dispute Resolution": r'(?:arbitrat|mediat|dispute)',
    "Lien Waiver": r'lien\s*waiv',
    "Performance Bond": r'performance\s*bond',
    "Payment Bond": r'payment\s*bond',
}
for clause, pattern in clause_keywords.items():
    if re.search(pattern, text, re.IGNORECASE):
        result["key_clauses"].append(clause)

print(json.dumps(result, indent=2))
PYEOF
