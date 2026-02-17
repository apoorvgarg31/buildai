#!/bin/bash
# BuildAI Database Skill — Execute read-only SQL queries
# Usage: bash query.sh "SELECT * FROM projects LIMIT 5"
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Load .env if it exists
if [ -f "$SCRIPT_DIR/.env" ]; then
  set -a
  source "$SCRIPT_DIR/.env"
  set +a
fi

# Validate required env vars
: "${DB_NAME:?DB_NAME is required}"
DB_HOST="${DB_HOST:-}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-}"
DB_PASSWORD="${DB_PASSWORD:-}"

SQL="$1"

if [ -z "$SQL" ]; then
  echo '{"error": "No SQL query provided"}' >&2
  exit 1
fi

# Safety: block dangerous statements
if echo "$SQL" | grep -qiE '\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|GRANT|REVOKE|EXEC)\b'; then
  echo '{"error": "Only SELECT/WITH queries are allowed. Blocked dangerous keyword."}' >&2
  exit 1
fi

# Safety: only allow SELECT and WITH at the start
FIRST_WORD=$(echo "$SQL" | sed 's/^[[:space:]]*//' | awk '{print toupper($1)}')
if [ "$FIRST_WORD" != "SELECT" ] && [ "$FIRST_WORD" != "WITH" ]; then
  echo "{\"error\": \"Query must start with SELECT or WITH, got: $FIRST_WORD\"}" >&2
  exit 1
fi

# Add LIMIT if not present
if ! echo "$SQL" | grep -qiE '\bLIMIT\b'; then
  SQL="$SQL LIMIT 100"
fi

# Build psql connection args
PSQL_ARGS=()
if [ -n "$DB_HOST" ]; then PSQL_ARGS+=(-h "$DB_HOST"); fi
if [ -n "$DB_PORT" ]; then PSQL_ARGS+=(-p "$DB_PORT"); fi
if [ -n "$DB_USER" ]; then PSQL_ARGS+=(-U "$DB_USER"); fi
PSQL_ARGS+=(-d "$DB_NAME")

# Execute query and return JSON
export PGPASSWORD="$DB_PASSWORD"
psql "${PSQL_ARGS[@]}" \
  -v ON_ERROR_STOP=1 \
  --tuples-only --no-align \
  -c "SET statement_timeout = '30s';" \
  -c "SELECT COALESCE(json_agg(t), '[]'::json) FROM ($SQL) t;" 2>&1 | grep -v "^SET$"

EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
  exit $EXIT_CODE
fi
