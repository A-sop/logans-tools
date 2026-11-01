#!/usr/bin/env bash
# Wake if this division has new Neon rows or matching GitHub PR activity since STATE_CURSOR.
# Env: WAKE_STATUS_DATABASE_URL (or WAKE_DATABASE_URL), WAKE_GITHUB_TOKEN (read-only).
# STATUS_DIVISION=Div1..Div7 (set by runner).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck disable=SC1091
. "$ROOT/lib.sh"

DIV="${STATUS_DIVISION:-}"
case "$DIV" in
  Div1|Div2|Div3|Div4|Div5|Div6|Div7) ;;
  *) wake_emit_check_result 0 "" "" "" "bad-STATUS_DIVISION"; exit 1 ;;
esac

if ! CURSOR="$(wake_validate_cursor "${STATE_CURSOR:-}")"; then
  wake_emit_check_result 0 "" "" "" "bad-cursor"
  exit 1
fi

DB="${WAKE_STATUS_DATABASE_URL:-${WAKE_DATABASE_URL:-}}"
GH="${WAKE_GITHUB_TOKEN:-}"
if [ -z "$DB" ] && [ -z "$GH" ]; then
  wake_emit_check_result 0 "" "" "" "missing-status-sources"
  exit 1
fi

depts_sql() {
  case "$1" in
    Div1) printf "'Dept1','Dept2','Dept3'" ;;
    Div2) printf "'Dept4','Dept5','Dept6'" ;;
    Div3) printf "'Dept7','Dept8','Dept9'" ;;
    Div4) printf "'Dept10','Dept11','Dept12'" ;;
    Div5) printf "'Dept13','Dept14','Dept15'" ;;
    Div6) printf "'Dept16','Dept17','Dept18'" ;;
    Div7) printf "'Dept19','Dept20','Dept21'" ;;
  esac
}

CHANGED=0
NEW_CURSOR="$CURSOR"
DEPTS="$(depts_sql "$DIV")"

if [ -n "$DB" ]; then
  if ! command -v psql >/dev/null 2>&1; then
    wake_emit_check_result 0 "" "" "" "psql-not-found"
    exit 1
  fi
  ROW="$(psql "$DB" -v ON_ERROR_STOP=1 -tA -c "
    WITH bounds AS (SELECT '${CURSOR}'::timestamptz AS c),
    hits AS (
      SELECT created_at AS ts FROM approval_queue, bounds
        WHERE created_at > bounds.c
          AND (division_id = '${DIV}' OR department_id IN (${DEPTS}))
      UNION ALL
      SELECT created_at FROM stats, bounds
        WHERE created_at > bounds.c AND division_id = '${DIV}'
      UNION ALL
      SELECT ran_at FROM role_runs, bounds
        WHERE ran_at > bounds.c AND role_id IN (${DEPTS})
    )
    SELECT count(*)::text || '|' || coalesce(max(ts)::text,'') FROM hits;
  ")"
  N="${ROW%%|*}"; MAX="${ROW#*|}"; N="${N//[[:space:]]/}"; MAX="${MAX//[[:space:]]/}"
  if [ "${N:-0}" -gt 0 ]; then
    CHANGED=1
    [ -n "$MAX" ] && NEW_CURSOR="$MAX"
  fi
fi

if [ -n "$GH" ]; then
  if ! command -v python3 >/dev/null 2>&1; then
    wake_emit_check_result 0 "" "" "" "python3-not-found"
    exit 1
  fi
  export STATE_CURSOR="$CURSOR" STATUS_DIVISION="$DIV" WAKE_GITHUB_TOKEN="$GH"
  set +e
  HIT="$(python3 "$ROOT/gh_div_activity.py")"
  RC=$?
  set -e
  if [ "$RC" -ne 0 ]; then
    wake_emit_check_result 0 "" "" "" "github-error"
    exit 1
  fi
  HN="${HIT%%|*}"; HM="${HIT#*|}"; HN="${HN:-0}"
  if [ "$HN" -gt 0 ]; then
    CHANGED=1
    [ -n "$HM" ] && NEW_CURSOR="$HM"
  fi
fi

if [ "$CHANGED" -eq 1 ]; then
  wake_emit_check_result 1 wake "$NEW_CURSOR" "div-changed"
else
  wake_emit_check_result 1 skip "$CURSOR" "none"
fi
exit 0
