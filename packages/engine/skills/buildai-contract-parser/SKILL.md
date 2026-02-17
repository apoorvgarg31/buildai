---
name: buildai-contract-parser
description: Parse construction contracts to extract key terms — parties, dates, scope, payment terms, insurance requirements, liquidated damages, change order procedures, and obligations.
metadata: {"engine":{"emoji":"📜","requires":{"anyBins":["python3"]}}}
---

# BuildAI Contract Parser

Extract key terms and obligations from construction contracts, subcontracts, and agreements.

## How to Use

```bash
bash skills/buildai-contract-parser/parse.sh <contract_pdf_path>
```

## Output

Returns JSON with:
- `parties` — Owner, contractor, subcontractor names
- `contract_value` — Original contract amount
- `dates` — Execution date, start date, completion date
- `scope_summary` — Brief scope description
- `payment_terms` — Payment schedule, retainage, billing cycle
- `insurance_requirements` — Required coverage types and limits
- `liquidated_damages` — LD rate if specified
- `change_order_process` — How changes are handled
- `warranty_period` — Warranty duration
- `key_clauses` — Notable contract provisions
- `raw_text` — Full text for verification

## Examples

```bash
bash skills/buildai-contract-parser/parse.sh "/workspace/files/gc-contract-terminal-a.pdf"
```

## Construction Use Cases
- Review subcontract terms before signing
- Extract insurance requirements for compliance tracking
- Identify payment milestones and retainage terms
- Flag onerous clauses or missing provisions
- Compare terms across multiple subcontracts
