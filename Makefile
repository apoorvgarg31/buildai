SHELL := /usr/bin/env bash
.PHONY: help setup start stop reset restart status logs lint test test-backend build security-check fix-line-endings

help:
	@echo "BuildAI local dev commands"
	@echo "  make setup        Install deps and create web env file"
	@echo "  make start        Start BuildAI engine + web app"
	@echo "  make stop         Stop local BuildAI services"
	@echo "  make reset        Stop services and wipe local runtime state/cache/log/data for a fresh start"
	@echo "  make status       Show running status"
	@echo "  make logs         Tail recent service logs"

# Fix \r line endings on any platform (idempotent, safe to run always)
fix-line-endings:
	@find scripts packages/engine -name '*.sh' -type f -exec perl -pi -e 's/\r\n/\n/g; s/\r/\n/g' {} +
	@find . -maxdepth 3 -name '*.env*' -type f -exec perl -pi -e 's/\r\n/\n/g; s/\r/\n/g' {} +

setup: fix-line-endings
	npm install
	@if [ ! -f packages/web/.env.local ]; then cp .env.example packages/web/.env.local; echo "Created packages/web/.env.local from .env.example"; fi

start: fix-line-endings
	bash scripts/dev-start.sh

stop:
	bash scripts/dev-stop.sh

reset:
	bash scripts/dev-reset.sh

restart: stop start

status:
	bash scripts/dev-status.sh

logs:
	@echo "=== web log ==="; tail -n 80 .run/web.log 2>/dev/null || true
	@echo "=== engine log ==="; tail -n 80 .run/engine.log 2>/dev/null || true

lint:
	npm run lint --workspace=packages/web

test:
	npm run test:web

test-backend:
	npm run test:engine

build:
	npm run build --workspace=packages/web

security-check:
	@echo "Running lightweight secret scan..."
	@bash scripts/security-check.sh
