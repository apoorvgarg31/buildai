# BuildAI Security Review (2026-02-25)

## Scope
- Web API routes (chat, files, personality, watchlist, marketplace/admin hardening work)
- Local workspace file access and path safety
- Secrets handling in repo and env usage
- Developer startup workflow

## Findings Summary

### ✅ Good
1. **Route auth guards are present** on admin/personality/files/watchlist routes (`requireSignedIn`, `requireAdmin`, `canAccessAgent`).
2. **Path traversal protections are in place** (`isValidAgentId`, `safeJoinWithin`) before file writes/deletes.
3. **Marketplace token validation** is enforced with safer secret behavior (no insecure prod default fallback).
4. **Watchlist writes are scoped per workspace** and synced into a managed HEARTBEAT block.
5. **Secrets files are gitignored** (`.env*`, `.secrets/`, `.procore-tokens.json`, generated workspaces).

### ⚠️ Risks / Actions
1. **Local secret exposure risk**: developers may keep API keys in local `.env.local` and runtime state files.
   - Action: never commit local env/runtime state, rotate any leaked key immediately.
2. **Generated artifacts can contain sensitive strings** (e.g., `.next/`, local state dirs).
   - Action: keep them out of git and clear before sharing archives.
3. **Lightweight secret scan only** by default.
   - Action: run `make security-check` in CI and optionally add gitleaks later.

## Security Controls Added in This Pass
- Added repeatable secret scan script: `scripts/security-check.sh`
- Added `make security-check` command
- Added explicit startup/stop scripts (reduces ad-hoc manual process mistakes)

## Recommended Operational Policy
- Rotate keys if ever pasted in chat or shell history.
- Use least-privilege API keys where providers support scopes.
- Keep one key per integration purpose (dev/prod separation).
- Run before push:
  - `make lint`
  - `make test`
  - `make build`
  - `make security-check`
