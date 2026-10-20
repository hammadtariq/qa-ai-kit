#!/usr/bin/env bash
# QA Kit: prepare the app for E2E in CI. Called by .github/actions/qa-app-setup after dependencies
# are installed. /qa-kit:setup-project fills this in for the repo; keep it idempotent and quiet.
#
# Staging mode (BASE_URL set): usually nothing to do here.
# Local-app mode (BASE_URL unset): create the database, migrate, seed test data, build the app.
# Anything written to "$GITHUB_ENV" is visible to the test steps (mask secrets with ::add-mask::).
set -euo pipefail

if [ -n "${BASE_URL:-}" ]; then
  echo "BASE_URL is set: testing a deployed environment, no local app setup."
  exit 0
fi

# --- Example: Postgres service from the workflow (uncomment the service block there too) ---
# export PGPASSWORD=postgres
# psql -h localhost -U postgres -c "CREATE DATABASE app_e2e;"
# echo "DATABASE_URL=postgres://postgres:postgres@localhost:5432/app_e2e" >> "$GITHUB_ENV"

# --- Example: a fresh test login for this run ---
# PASS="Qa-$(openssl rand -hex 12)"; echo "::add-mask::$PASS"
# { echo "QA_USER_EMAIL=qa@example.test"; echo "QA_USER_PASSWORD=$PASS"; } >> "$GITHUB_ENV"

# --- Example: migrate, seed and build (use the repo's package manager) ---
# npm run db:migrate
# npm run db:seed
# npm run build

echo "No app setup steps configured in .qa/app-setup.sh"
