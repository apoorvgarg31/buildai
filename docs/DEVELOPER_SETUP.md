# BuildAI Developer Setup (Single-command Start/Stop)

This setup keeps developer friction low and uses one command to start/stop **web + BuildAI clawdbot engine**.

## 1) Prerequisites
- Node.js 20+
- npm
- Python3 (for some skills)

## 2) Install + minimal env
```bash
cd /home/apoorvgarg/buildai
make setup
```

This will:
- install dependencies
- create `packages/web/.env.local` from `.env.example` (if missing)

Now edit only this file with required values:
- `packages/web/.env.local`

## 3) Start everything (single command)
```bash
make start
```

Starts:
- Next.js web app (`npm run dev:web`)
- BuildAI engine gateway (`packages/engine/start-buildai.sh`)

## 4) Stop everything (single command)
```bash
make stop
```

## 5) Useful commands
```bash
make status          # show web + engine process state
make logs            # tail both logs
make lint            # web lint
make test            # web tests
make test-backend    # engine tests
make build           # web compile/build
make security-check  # secret-pattern scan on tracked files
```

## 6) Pre-push quality gate
Run this before commit/push:
```bash
make lint
make test
make test-backend
make build
make security-check
```

## Notes
- Keep env files local only. Never commit `.env.local`.
- If you accidentally exposed a key, rotate it immediately.
