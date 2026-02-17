# Contributing Rules

## Rule 1: NO SECRETS IN GIT

**Never commit credentials, API keys, tokens, passwords, or any sensitive information.**

- Use environment variables (`process.env.VARIABLE_NAME`)
- Document required vars in `.env.example` (with placeholder values only)
- All `.env*` files are gitignored
- No hardcoded fallbacks for secrets — if the env var is missing, throw an error
- Before every commit: double-check for leaked secrets

This is non-negotiable. No exceptions.
