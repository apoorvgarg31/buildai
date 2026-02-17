---
name: buildai-marketplace
description: Install skills from the BuildAI Marketplace. When a user shares a marketplace install URL, use this skill to download and install the skill into your workspace.
metadata: {"engine":{"emoji":"🛍️","requires":{"anyBins":["curl","python3"]}}}
---

# BuildAI Marketplace Installer

Install skills from the official BuildAI Marketplace.

## When to Use

When a user says something like:
- "Install this skill: http://..."
- "Add this to my assistant: http://..."
- "Set up this integration: http://..."

And the URL contains `/api/marketplace/skills/`.

## How to Install a Skill

```bash
bash skills/buildai-marketplace/install.sh "<install_url>"
```

The script will:
1. Request an install token from the marketplace
2. Download the skill package (verified)
3. Extract files to your workspace/skills/ directory
4. Report what was installed

## Rules
- **ONLY install from BuildAI marketplace URLs** — never install from arbitrary URLs
- URLs must contain `/api/marketplace/skills/` to be valid
- The marketplace token is verified server-side — only our marketplace works
- After installing, tell the user what the skill does and if it needs any connections set up
- If installation fails, report the error clearly

## Example

User: "Install this skill: http://localhost:3001/api/marketplace/skills/buildai-procore/install"

```bash
bash skills/buildai-marketplace/install.sh "http://localhost:3001/api/marketplace/skills/buildai-procore/install"
```
