#!/usr/bin/env bash
# Comm-center wake: P3 rule + webhook. Payload: post, in_count, pending_count, oldest_in_age, reasons.
# Usage: wake.sh <post>   post = Div1..Div7 | LDW | DIGEST
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
. "$ROOT/lib.sh"

POST="${1:-}"
if [ -z "$POST" ]; then
  echo "usage: wake.sh <DivN|LDW|DIGEST>" >&2
  exit 64
fi

CC_ENV_FILE="${CC_ENV_FILE:-$HOME/.config/dabos/comm-center.env}"
CC_STATE_DIR="${CC_STATE_DIR:-$HOME/.local/state/dabos/comm-center}"
CC_LOG_FILE="${CC_LOG_FILE:-$CC_STATE_DIR/comm-center.jsonl}"
CC_CSV_FILE="${CC_CSV_FILE:-$CC_STATE_DIR/counts.csv}"
ERROR_WAKE_AFTER="${WAKE_ERROR_WAKE_AFTER:-2}"

mkdir -p "$CC_STATE_DIR"
cc_load_env "$CC_ENV_FILE"
if [ -f "$ROOT/clocks.env" ]; then cc_load_env "$ROOT/clocks.env"; fi
if [ -f "$ROOT/clocks.env.example" ] && ! env | grep -q '^COMM_CLOCK_'; then
  cc_load_env "$ROOT/clocks.env.example"
fi

export POST
cc_read_state "$POST"

STEM="$(cc_post_upper "$POST")"
URL_VAR="WAKE_${STEM}_URL"
KEY_VAR="WAKE_${STEM}_KEY"
URL="${!URL_VAR:-}"
KEY="${!KEY_VAR:-}"

DB_URL="${COMM_CENTER_DATABASE_URL:-${WAKE_DATABASE_URL:-${DATABASE_URL:-}}}"

# DIGEST post: build marker only (no agent wake) — skip unless forced
if [ "$POST" = "DIGEST" ]; then
  cc_log_json event=digest-slot decision=skip reason=digest-no-agent
  cc_csv_append "$POST" skip
  cc_write_state "$POST" "$STATE_LAST_WAKE" 0 "$STATE_IN_STREAK"
  exit 0
fi

json_str() {
  # Escape a string as a JSON string literal (no python required).
  local s="$1"
  s=${s//\\/\\\\}
  s=${s//\"/\\\"}
  s=${s//$'\n'/\\n}
  s=${s//$'\r'/}
  printf '"%s"' "$s"
}

do_wake() {
  local reasons="$1" in_count="$2" pending_count="$3" oldest="$4"
  local body
  body=$(printf '{"post":"%s","in_count":%s,"pending_count":%s,"oldest_in_age":%s,"reason":%s}' \
    "$POST" "$in_count" "$pending_count" \
    "$(json_str "$oldest")" \
    "$(json_str "$reasons")")
  if [ -z "$URL" ] || [ -z "$KEY" ]; then
    cc_log_json event=wake-missing-hook decision=error reason="$reasons"
    cc_csv_append "$POST" error
    cc_write_state "$POST" "$STATE_LAST_WAKE" "$((STATE_ERRORS + 1))" "$STATE_IN_STREAK"
    return 1
  fi
  if ! cc_post_webhook "$URL" "$KEY" "$body"; then
    cc_log_json event=wake-post-failed decision=error reason="$reasons"
    cc_csv_append "$POST" error
    cc_write_state "$POST" "$STATE_LAST_WAKE" "$((STATE_ERRORS + 1))" "$STATE_IN_STREAK"
    return 1
  fi
  cc_log_json event=woke decision=wake reason="$reasons"
  cc_csv_append "$POST" wake
  # After wake, IN streak increments if still non-empty (caller passes new streak)
  cc_write_state "$POST" "$(cc_iso_now)" 0 "${5:-$STATE_IN_STREAK}"
  return 0
}

if [ -z "$DB_URL" ]; then
  NEXT_ERRORS=$((STATE_ERRORS + 1))
  cc_log_json event=check-error decision=error reason=missing-db errors="$NEXT_ERRORS"
  if [ "$NEXT_ERRORS" -ge "$ERROR_WAKE_AFTER" ]; then
    do_wake "check-error" 0 0 "" "$STATE_IN_STREAK" || true
    exit 0
  fi
  cc_csv_append "$POST" error
  cc_write_state "$POST" "$STATE_LAST_WAKE" "$NEXT_ERRORS" "$STATE_IN_STREAK"
  exit 0
fi

# P3 query counts + reasons (no message bodies)
CHECK_SQL="$(cat <<SQL
SELECT
  count(*) FILTER (WHERE basket = 'in')::int AS in_count,
  count(*) FILTER (WHERE basket = 'pending')::int AS pending_count,
  count(*) FILTER (
    WHERE basket = 'pending'
      AND coalesce((ingest_meta->'pending'->>'cleared')::boolean, false)
  )::int AS cleared_count,
  count(*) FILTER (
    WHERE basket = 'pending'
      AND (ingest_meta->'pending'->>'clear_by') IS NOT NULL
      AND (ingest_meta->'pending'->>'clear_by')::timestamptz < NOW()
  )::int AS past_clear_by,
  count(*) FILTER (
    WHERE basket = 'pending'
      AND (
        (ingest_meta->'pending'->>'last_reviewed') IS NULL
        OR (ingest_meta->'pending'->>'last_reviewed')::timestamptz < NOW() - interval '72 hours'
      )
  )::int AS stale_review,
  coalesce(
    (NOW() - MIN(created_at) FILTER (WHERE basket = 'in'))::text,
    ''
  ) AS oldest_in_age
FROM tasks
WHERE
  CASE
    WHEN '${POST}' = 'LDW' THEN assigned_agent IN ('LDW','ldw','Ldw')
    ELSE (
      assigned_agent IN ('${POST}', lower('${POST}'), upper('${POST}'))
      OR (
        (assigned_agent IS NULL OR assigned_agent NOT IN ('LDW','ldw','Ldw','Div1','Div2','Div3','Div4','Div5','Div6','Div7','div1','div2','div3','div4','div5','div6','div7'))
        AND division_id IN ('${POST}', lower('${POST}'), upper('${POST}'))
      )
    )
  END;
SQL
)"

set +e
CHECK_OUT="$(psql "$DB_URL" -v ON_ERROR_STOP=1 -At -F '|' -c "$CHECK_SQL" 2>/tmp/cc-wake-err.$$)"
CHECK_RC=$?
set -e
CHECK_ERR="$(tr '\n' ' ' </tmp/cc-wake-err.$$ 2>/dev/null | head -c 200 || true)"
rm -f /tmp/cc-wake-err.$$

if [ "$CHECK_RC" -ne 0 ] || [ -z "$CHECK_OUT" ]; then
  NEXT_ERRORS=$((STATE_ERRORS + 1))
  cc_log_json event=check-error decision=error reason=check-failed errors="$NEXT_ERRORS"
  if [ "$NEXT_ERRORS" -ge "$ERROR_WAKE_AFTER" ]; then
    do_wake "check-error" 0 0 "" "$STATE_IN_STREAK" || true
    exit 0
  fi
  cc_csv_append "$POST" error
  cc_write_state "$POST" "$STATE_LAST_WAKE" "$NEXT_ERRORS" "$STATE_IN_STREAK"
  exit 0
fi

IFS='|' read -r IN_COUNT PENDING_COUNT CLEARED_COUNT PAST_CLEAR STALE_REVIEW OLDEST <<<"$CHECK_OUT"
IN_COUNT="${IN_COUNT:-0}"
PENDING_COUNT="${PENDING_COUNT:-0}"
CLEARED_COUNT="${CLEARED_COUNT:-0}"
PAST_CLEAR="${PAST_CLEAR:-0}"
STALE_REVIEW="${STALE_REVIEW:-0}"
OLDEST="${OLDEST:-}"

REASONS=()
[ "$IN_COUNT" -gt 0 ] && REASONS+=("in")
[ "$CLEARED_COUNT" -gt 0 ] && REASONS+=("blocker-cleared")
[ "$PAST_CLEAR" -gt 0 ] && REASONS+=("past-clear-by")
[ "$STALE_REVIEW" -gt 0 ] && REASONS+=("stale-review-72h")

# P4 streak is wake-based (incremented only on successful wake with IN>0).
if [ "${#REASONS[@]}" -eq 0 ]; then
  cc_log_json event=checked decision=skip reason=none
  cc_csv_append "$POST" skip
  # Empty IN resets the non-empty wake streak
  STREAK_OUT=0
  [ "$IN_COUNT" -gt 0 ] && STREAK_OUT="$STATE_IN_STREAK"
  cc_write_state "$POST" "$STATE_LAST_WAKE" 0 "$STREAK_OUT"
  exit 0
fi

# Stall notice when IN survived 2 prior wakes (streak already >= 2 entering this wake)
if [ "$IN_COUNT" -gt 0 ] && [ "$STATE_IN_STREAK" -ge 2 ] && [ -n "$DB_URL" ]; then
  BERLIN_DAY="$(TZ=Europe/Berlin date +%Y-%m-%d)"
  psql "$DB_URL" -v ON_ERROR_STOP=1 -c "
    INSERT INTO tasks (
      workspace_id, division_id, department_id, title, description,
      type, status, priority, basket, ingest_source, ingest_external_id, ingest_meta
    ) VALUES (
      'comm-center', 'Div1', 'Dept2',
      'Stall: ${POST} IN after 2 wakes',
      'Post ${POST} IN still non-empty after 2 consecutive wakes',
      'agent', 'todo', 2, 'in', 'dept2-stall',
      '${POST}:${BERLIN_DAY}:in-after-2-wakes',
      jsonb_build_object('stall_of', '${POST}', 'rule', 'in_after_2_wakes', 'from', 'comm-center-wake')
    ) ON CONFLICT DO NOTHING;
  " >/dev/null 2>/dev/null || true
  REASONS+=("in-after-2-wakes")
fi

NEW_STREAK="$STATE_IN_STREAK"
if [ "$IN_COUNT" -gt 0 ]; then
  NEW_STREAK=$((STATE_IN_STREAK + 1))
else
  NEW_STREAK=0
fi

REASON_STR="$(IFS=','; echo "${REASONS[*]}")"
do_wake "$REASON_STR" "$IN_COUNT" "$PENDING_COUNT" "$OLDEST" "$NEW_STREAK"
exit $?
