---
name: buildai-invoice-parser
description: Extract structured data from construction invoices — vendor, amounts, line items, dates, PO numbers. Parse PDF invoices into JSON for budget tracking and payment processing.
metadata: {"engine":{"emoji":"🧾","requires":{"anyBins":["python3"]}}}
---

# BuildAI Invoice Parser

Parse construction invoices (PDF) into structured data for budget tracking and payment processing.

## How to Use

```bash
bash skills/buildai-invoice-parser/parse.sh <invoice_pdf_path>
```

## Output

Returns JSON with:
- `vendor` — Vendor/contractor name
- `invoice_number` — Invoice number
- `date` — Invoice date
- `due_date` — Payment due date
- `po_number` — Purchase order reference
- `line_items` — Array of {description, quantity, unit_price, amount}
- `subtotal`, `tax`, `total` — Summary amounts
- `raw_text` — Full extracted text for verification

## Examples

```bash
bash skills/buildai-invoice-parser/parse.sh "/workspace/files/invoice-mech-042.pdf"
```

## Construction Use Cases
- Parse subcontractor payment applications
- Extract line items from vendor invoices
- Cross-reference invoiced amounts against budget
- Track payment schedules and due dates
- Audit invoice amounts against change orders
