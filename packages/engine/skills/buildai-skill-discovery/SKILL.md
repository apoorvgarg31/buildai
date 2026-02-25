---
name: buildai-skill-discovery
description: Recommend BuildAI marketplace skills based on user role, systems, and pain points.
metadata: {"engine":{"emoji":"🧭","requires":{"anyBins":["python3"]}}}
---

# BuildAI Skill Discovery

Use this skill during onboarding and strategy discussions to suggest the best marketplace skills.

## Usage

```bash
# Simple wrapper
bash skills/buildai-skill-discovery/recommend.sh \
  "Project Manager" \
  "procore,p6" \
  "overdue rfis" \
  "schedule slippage"

# Or direct python
python3 skills/buildai-skill-discovery/recommend.py \
  --role "Project Manager" \
  --systems "procore,p6" \
  --pain "overdue rfis" \
  --pain "schedule slippage"
```

## Output
Returns JSON with:
- `top_recommendations`: ranked skill IDs with rationale
- `quick_start`: install priority (1-2-3)
- `coverage_gaps`: pain points not covered yet

## Rules
- Prefer system-specific skills first (Procore/Unifier/Aconex/etc)
- Keep recommendations practical: start with 2-3 installs, not 10
- Explain recommendations in plain user language
