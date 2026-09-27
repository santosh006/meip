#!/usr/bin/env bash
set -euo pipefail
: "${TEST_DATABASE_URL:?Set TEST_DATABASE_URL to a disposable PostgreSQL database}"
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f tests/bootstrap.sql
for migration in supabase/migrations/*.sql; do
  psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f "$migration"
done
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f tests/database.sql
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f tests/accepted-news-policy.sql
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f tests/hosted-news.sql
