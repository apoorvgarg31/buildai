.PHONY: setup start stop restart status logs lint test test-backend build security-check

setup:
	npm install
	@if [ ! -f packages/web/.env.local ]; then cp .env.example packages/web/.env.local; echo "Created packages/web/.env.local from .env.example"; fi

start:
	bash scripts/dev-start.sh

stop:
	bash scripts/dev-stop.sh

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
