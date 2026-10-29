#!/usr/bin/env bash
# Kiểm thử backend giai đoạn 1 end-to-end mà không cần project Supabase:
#   PostgreSQL 15+ (có contrib unaccent) + PostgREST v12 (https://github.com/PostgREST/postgrest/releases)
# Cách chạy (từ gốc repo):
#   PGURL=postgres://postgres:<mật khẩu>@localhost:5432/postgres POSTGREST_BIN=/đường/dẫn/postgrest bash tests/backend/run.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
: "${PGURL:?Đặt PGURL tới server PostgreSQL (quyền superuser)}"
: "${POSTGREST_BIN:?Đặt POSTGREST_BIN tới file chạy PostgREST}"
DB=uitc_backend_test
TESTURL="${PGURL%/*}/$DB"
export TEST_JWT_SECRET="${TEST_JWT_SECRET:-uitc-local-test-secret-at-least-32-characters}"
export TEST_POSTGREST_URL="http://127.0.0.1:3010"

psql "$PGURL" -v ON_ERROR_STOP=1 -q -c "drop database if exists $DB" -c "create database $DB"
psql "$TESTURL" -v ON_ERROR_STOP=1 -q -f supabase/tests/local/00_supabase_stub.sql
for f in supabase/migrations/*.sql; do psql "$TESTURL" -v ON_ERROR_STOP=1 -q -f "$f" 2>/dev/null; done
psql "$TESTURL" -v ON_ERROR_STOP=1 -q -f supabase/tests/local/10_test_accounts.sql
# Role "authenticator" giống Supabase: PostgREST đăng nhập bằng role này rồi chuyển sang anon/authenticated theo JWT
psql "$TESTURL" -v ON_ERROR_STOP=1 -q <<'SQL'
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'authenticator') then
    create role authenticator login noinherit password 'authenticator';
  end if;
end $$;
grant anon, authenticated, service_role to authenticator;
SQL

HOSTPART="${PGURL#*@}"; HOSTPART="${HOSTPART%%/*}"
PGRST_DB_URI="postgres://authenticator:authenticator@${HOSTPART}/${DB}" \
PGRST_DB_SCHEMAS=public PGRST_DB_ANON_ROLE=anon PGRST_JWT_SECRET="$TEST_JWT_SECRET" \
PGRST_SERVER_PORT=3010 PGRST_SERVER_HOST=127.0.0.1 PGRST_LOG_LEVEL=warn \
  "$POSTGREST_BIN" > /tmp/uitc-postgrest.log 2>&1 &
PGRST_PID=$!
trap 'kill $PGRST_PID 2>/dev/null || true' EXIT
for _ in $(seq 1 50); do curl -s -o /dev/null http://127.0.0.1:3010/ && break; sleep 0.2; done

npx tsx --test --test-reporter=spec tests/backend/phase1.test.ts
