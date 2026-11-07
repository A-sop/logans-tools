#!/usr/bin/env bash
# Wake if Neon has new telegram captures since STATE_CURSOR.
# Env: WAKE_TELEGRAM_TRIAGE_DATABASE_URL (or WAKE_DATABASE_URL). Uses psql -tA via wake_psql.
# Never prints row titles/bodies — only counts and max created_at (ISO UTC).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck disable=SC1091
. "$ROOT/lib.sh"

DB="${WAKE_TELEGRAM_TRIAGE_DATABASE_URL:-${WAKE_DATABASE_URL:-}}"
if [ -z "$DB" ]; then
  wake_emit_check_result 0 "" "" "" "missing-WAKE_TELEGRAM_TRIAGE_DATABASE_URL"
  exit 1
fi
if ! command -v psql >/dev/null 2>&1; then
  wake_emit_check_result 0 "" "" "" "psql-not-found"
  exit 1
fi

if ! CURSOR="$(wake_validate_cursor "${STATE_CURSOR:-}")"; then
  wake_emit_check_result 0 "" "" "" "bad-cursor"
  exit 1
fi
# Two fields: n|max_ts  (max_ts empty when n=0). ISO from SQL — never strip interior spaces.
ROW="$(wake_psql "$DB" -tA -c \
  "SELECT count(*)::text || '|' || coalesce(to_char(max(created_at) AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"'),'')
   FROM tasks
   WHERE ingest_source = 'telegram'
     AND status NOT IN ('done','cancelled')
     AND created_at > '${CURSOR}'::timestamptz;")"
N="$(wake_trim_psql_field "${ROW%%|*}")"
MAX="$(wake_trim_psql_field "${ROW#*|}")"

if [ "${N:-0}" -gt 0 ]; then
  wake_emit_check_result 1 wake "${MAX}" "new-captures"
else
  wake_emit_check_result 1 skip "$CURSOR" "none"
fi
exit 0
