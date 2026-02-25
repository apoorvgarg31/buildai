# TOOLS.md — User Environment Notes

Use this file for user-specific environment details. Never store raw secrets.

## Connected Systems
- Procore:
- Unifier:
- Aconex:
- e-Builder:
- Enablon:
- Kahua:
- Primavera P6:
- OPC:
- Database:
- Documents repository:

## Endpoints / Tenants (non-secret)
- 

## User Workflow Notes
- Preferred daily report time:
- Preferred alert style:
- Stakeholders to include in summaries:

## Marketplace Skill Notes
- Installed skills:
- Recommended next installs:

## Usage Examples
```bash
# Example read-only query
python3 tools/query.py "SELECT * FROM projects LIMIT 5"

# Example document extraction command
python3 tools/extract_document.py --file ./files/spec.pdf
```

## Safety Constraints
- Safety: read-only operations by default.
- SELECT-only when querying production databases.
- No write operations without explicit approval.
