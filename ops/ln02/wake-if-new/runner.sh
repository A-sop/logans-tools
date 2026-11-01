#!/usr/bin/env bash
# wake-if-new runner: check whether a Grok routine has work, then POST its webhook or exit quiet.
# Usage: runner.sh <job>
#   job = telegram_triage | mail_triage | status_div1..status_div7 | morning_brief
# Env overrides (tests): WAKE_ENV_FILE WAKE_STATE_DIR WAKE_LOG_FILE WAKE_CSV_FILE WAKE_CHECK_BIN WAKE_DRY_RUN
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
. "$ROOT/lib.sh"

JOB="${1:-}"
if [ -z "$JOB" ]; then
  echo "usage: runner.sh <job>" >&2
  exit 64
fi

WAKE_ENV_FILE="${WAKE_ENV_FILE:-$HOME/.config/dabos/wake-if-new.env}"
WAKE_STATE_DIR="${WAKE_STATE_DIR:-$HOME/.local/state/dabos/wake-if-new}"
WAKE_LOG_FILE="${WAKE_LOG_FILE:-$WAKE_STATE_DIR/wake-if-new.jsonl}"
WAKE_CSV_FILE="${WAKE_CSV_FILE:-$WAKE_STATE_DIR/counts.csv}"
WAKE_LOCK_DIR="${WAKE_LOCK_DIR:-$WAKE_STATE_DIR}"
ERROR_WAKE_AFTER="${WAKE_ERROR_WAKE_AFTER:-2}"

mkdir -p "$WAKE_STATE_DIR" "$WAKE_LOCK_DIR"
wake_load_env "$WAKE_ENV_FILE"

LOCK="$WAKE_LOCK_DIR/${JOB}.lock"
exec 9>"$LOCK"
if command -v flock >/dev/null 2>&1; then
  if ! flock -n 9; then
    wake_log_json event=lock-busy decision=skip
    wake_csv_append "$JOB" skip
    exit 0
  fi
fi

wake_read_state "$JOB"
export STATE_CURSOR STATE_LAST_WAKE JOB
export STATE_CURSOR_TELEGRAM STATE_CURSOR_MAIL STATE_CURSOR_STATUS
export WAKE_STATE_DIR WAKE_ENV_FILE

# Resolve check module
CHECK_BIN="${WAKE_CHECK_BIN:-}"
if [ -z "$CHECK_BIN" ]; then
  case "$JOB" in
    telegram_triage) CHECK_BIN="$ROOT/checks/telegram_triage.sh" ;;
    mail_triage) CHECK_BIN="$ROOT/checks/mail_triage.sh" ;;
    status_div[1-7])
      CHECK_BIN="$ROOT/checks/status_report.sh"
      export STATUS_DIVISION="Div${JOB##status_div}"
      ;;
    morning_brief) CHECK_BIN="$ROOT/checks/morning_brief.sh" ;;
    *)
      echo "unknown job: $JOB" >&2
      exit 64
      ;;
  esac
fi

if [ ! -x "$CHECK_BIN" ] && [ ! -f "$CHECK_BIN" ]; then
  wake_log_json event=missing-check decision=error
  wake_csv_append "$JOB" error
  exit 1
fi

set +e
CHECK_OUT="$("$CHECK_BIN" 2>/tmp/wake-if-new-check.err.$$)"
CHECK_RC=$?
set -e
CHECK_ERR="$(tr '\n' ' ' </tmp/wake-if-new-check.err.$$ 2>/dev/null | head -c 200 || true)"
rm -f /tmp/wake-if-new-check.err.$$

parse_field() {
  # crude JSON field extract for our own one-line payloads
  printf '%s' "$1" | sed -n "s/.*\"$2\"[[:space:]]*:[[:space:]]*\"\\([^\"]*\\)\".*/\\1/p" | head -n1
}
parse_bool_ok() {
  printf '%s' "$1" | grep -q '"ok"[[:space:]]*:[[:space:]]*true'
}

DECISION=""; NEW_CURSOR=""; REASON=""; OK=0
NEW_CT=""; NEW_CM=""; NEW_CS=""
if [ "$CHECK_RC" -eq 0 ] && parse_bool_ok "$CHECK_OUT"; then
  OK=1
  DECISION="$(parse_field "$CHECK_OUT" decision)"
  NEW_CURSOR="$(parse_field "$CHECK_OUT" cursor)"
  REASON="$(parse_field "$CHECK_OUT" reason)"
  NEW_CT="$(parse_field "$CHECK_OUT" cursor_telegram)"
  NEW_CM="$(parse_field "$CHECK_OUT" cursor_mail)"
  NEW_CS="$(parse_field "$CHECK_OUT" cursor_status)"
fi

JOB_UPPER="$(wake_job_upper "$JOB")"
URL_VAR="WAKE_${JOB_UPPER}_URL"
KEY_VAR="WAKE_${JOB_UPPER}_KEY"
URL="${!URL_VAR:-}"
KEY="${!KEY_VAR:-}"

# Persist state keeping prior per-source cursors unless new ones are provided.
write_ok_state() {
  local cursor_out="$1" last_wake="$2" errors="$3"
  local ct cm cs
  ct="${NEW_CT:-$STATE_CURSOR_TELEGRAM}"
  cm="${NEW_CM:-$STATE_CURSOR_MAIL}"
  cs="${NEW_CS:-$STATE_CURSOR_STATUS}"
  wake_write_state "$JOB" "$cursor_out" "$last_wake" "$errors" "$ct" "$cm" "$cs"
}

# Keep prior cursors on failure (do not advance).
write_fail_state() {
  local errors="$1"
  wake_write_state "$JOB" "$STATE_CURSOR" "$STATE_LAST_WAKE" "$errors" \
    "$STATE_CURSOR_TELEGRAM" "$STATE_CURSOR_MAIL" "$STATE_CURSOR_STATUS"
}

do_wake() {
  local reason="$1" cursor_out="$2"
  local body
  body="$(printf '{"job":"%s","reason":"%s"}' "$JOB" "$reason")"
  if [ -z "$URL" ] || [ -z "$KEY" ]; then
    wake_log_json event=wake-missing-hook decision=error reason="$reason"
    wake_csv_append "$JOB" error
    write_fail_state "$((STATE_ERRORS + 1))"
    return 1
  fi
  if ! wake_post_webhook "$URL" "$KEY" "$body"; then
    wake_log_json event=wake-post-failed decision=error reason="$reason"
    wake_csv_append "$JOB" error
    write_fail_state "$((STATE_ERRORS + 1))"
    return 1
  fi
  wake_log_json event=woke decision=wake reason="$reason"
  wake_csv_append "$JOB" wake
  write_ok_state "${cursor_out:-$STATE_CURSOR}" "$(wake_iso_now)" 0
  return 0
}

if [ "$OK" -ne 1 ]; then
  # Check error — fail closed
  ERR_REASON="$(parse_field "$CHECK_OUT" error)"
  ERR_REASON="${ERR_REASON:-check-failed}"
  NEXT_ERRORS=$((STATE_ERRORS + 1))
  wake_log_json event=check-error decision=error reason="$ERR_REASON" errors="$NEXT_ERRORS"
  if [ "$NEXT_ERRORS" -ge "$ERROR_WAKE_AFTER" ]; then
    if do_wake "check-error" "$STATE_CURSOR"; then
      exit 0
    fi
    write_fail_state "$NEXT_ERRORS"
    exit 1
  fi
  wake_csv_append "$JOB" error
  write_fail_state "$NEXT_ERRORS"
  exit 0
fi

# Successful check
NEW_CURSOR="${NEW_CURSOR:-$STATE_CURSOR}"
case "$DECISION" in
  skip)
    wake_log_json event=checked decision=skip reason="${REASON:-none}"
    wake_csv_append "$JOB" skip
    write_ok_state "$NEW_CURSOR" "$STATE_LAST_WAKE" 0
    exit 0
    ;;
  wake)
    do_wake "${REASON:-new}" "$NEW_CURSOR"
    exit $?
    ;;
  *)
    wake_log_json event=bad-decision decision=error reason="${DECISION:-empty}"
    wake_csv_append "$JOB" error
    write_fail_state "$((STATE_ERRORS + 1))"
    exit 1
    ;;
esac
