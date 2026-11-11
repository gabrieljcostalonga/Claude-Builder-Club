#!/usr/bin/env bash
# Sobe um Postgres temporário, aplica a migration e roda os testes de RLS.
# Requer binários do PostgreSQL (initdb/pg_ctl/psql). Uso: npm run test:db
set -euo pipefail
PGBIN="${PGBIN:-$(dirname "$(command -v initdb 2>/dev/null || ls /usr/lib/postgresql/*/bin/initdb | tail -1)")}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIR="$(mktemp -d)"
PORT="${PGPORT_TEST:-55432}"
trap '"$PGBIN/pg_ctl" -D "$DIR/data" stop -m immediate >/dev/null 2>&1 || true; rm -rf "$DIR"' EXIT

"$PGBIN/initdb" -D "$DIR/data" -U postgres -A trust >/dev/null
"$PGBIN/pg_ctl" -D "$DIR/data" -o "-p $PORT -k $DIR -c listen_addresses=''" -l "$DIR/log" start >/dev/null
PSQL=(psql -h "$DIR" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q)

"${PSQL[@]}" -f "$ROOT/supabase/tests/auth_stub.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do "${PSQL[@]}" -f "$f"; done
"${PSQL[@]}" -f "$ROOT/supabase/tests/rls_test.sql"
