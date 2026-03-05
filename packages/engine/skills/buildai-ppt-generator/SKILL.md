---
name: buildai-ppt-generator
description: Generate PowerPoint (.pptx) decks from JSON outlines or simple prompts. Saves output files to artifacts so they appear in BuildAI UI.
metadata: {"engine":{"emoji":"📽️","requires":{"anyBins":["python3"]}}}
---

# BuildAI PPT Generator

Create presentation decks as `.pptx` files.

## Usage

```bash
# 1) From JSON outline via stdin
echo '{
  "title": "Q2 Project Update",
  "subtitle": "Terminal A Expansion",
  "slides": [
    {"title":"Executive Summary","bullets":["Budget on track","2 critical risks","RFI closure improving"]},
    {"title":"Risks","bullets":["HVAC lead time","Permit dependency"]}
  ]
}' | bash skills/buildai-ppt-generator/generate.sh --output "artifacts/q2-update.pptx"

# 2) Quick mode (auto-creates simple structure from topic)
bash skills/buildai-ppt-generator/generate.sh --topic "Investor update for BuildAI" --slides 8 --output "artifacts/investor-update.pptx"
```

## Options
- `--output <file.pptx>` (required)
- `--input <json-file>` optional; otherwise reads stdin JSON
- `--topic <text>` quick mode topic
- `--slides <n>` quick mode slide count (default 8)
- `--title <text>` override title in quick mode

## Output contract
Returns JSON:
```json
{ "ok": true, "output": ".../deck.pptx", "slides": 10 }
```

## Notes
- Save files under `artifacts/` to show in BuildAI Artifacts UI.
- If JSON includes `slides[].image`, it is rendered as an image slide when path exists.
