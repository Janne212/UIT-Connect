#!/usr/bin/env bash
# Kiểm thử migration + RPC + RLS trên PostgreSQL 16 thường (không cần Docker/Supabase).
# Yêu cầu: psql kết nối được tới một server PostgreSQL 15+ có extension unaccent (gói contrib).
# Cách chạy (từ gốc repo):  PGURL=postgres://postgres@localhost:5432/postgres bash supabase/tests/local/run.sh
# Script tạo database tạm uitc_test, nạp stub Supabase, chạy 5 migration theo thứ tự rồi chạy bộ test.
set -euo pipefail
cd "$(dirname "$0")/../../.."
PGURL="${PGURL:-postgres://postgres@localhost:5432/postgres}"
DB=uitc_test
TESTURL="${PGURL%/*}/$DB"

psql "$PGURL" -v ON_ERROR_STOP=1 -q -c "drop database if exists $DB" -c "create database $DB"
psql "$TESTURL" -v ON_ERROR_STOP=1 -q -f supabase/tests/local/00_supabase_stub.sql
for f in supabase/migrations/*.sql; do
  echo "== migration: $f"
  psql "$TESTURL" -v ON_ERROR_STOP=1 -q -f "$f"
done
echo "== seed"
psql "$TESTURL" -v ON_ERROR_STOP=1 -q -f supabase/tests/local/10_test_accounts.sql
echo "== tests"
psql "$TESTURL" -v ON_ERROR_STOP=1 -q -f supabase/tests/local/20_tests.sql > /dev/null
echo "== ALL TESTS PASSED"
