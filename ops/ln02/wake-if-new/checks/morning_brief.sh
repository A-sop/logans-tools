#!/usr/bin/env bash
# Wake if overnight captures, mail, or any division change signal exists.
# Separate cursors per source (telegram timestamp / mail UID / status timestamp).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck disable=SC1091
. "$ROOT/lib.sh"

# Primary/legacy cursor (timestamp-ish) for status fallback
if ! PRIMARY="$(wake_validate_cursor "${STATE_CURSOR:-}")"; then
  wake_emit_check_result 0 "" "" "" "bad-cursor"
  exit 1
fi

CUR_TELE="${STATE_CURSOR_TELEGRAM:-$PRIMARY}"
CUR_MAIL="$(wake_validate_uid_cursor "${STATE_CURSOR_MAIL:-0}")"
CUR_STATUS="${STATE_CURSOR_STATUS:-$PRIMARY}"

if ! CUR_TELE="$(wake_validate_cursor "$CUR_TELE")"; then
  wake_emit_check_result 0 "" "" "" "bad-cursor-telegram"
  exit 1
fi
if ! CUR_STATUS="$(wake_validate_cursor "$CUR_STATUS")"; then
  wake_emit_check_result 0 "" "" "" "bad-cursor-status"
  exit 1
fi

run_sub() {
  local script="$1"
  local out rc
  set +e
  out="$("$script")"
  rc=$?
  set -e
  printf '%s\n' "$out"
  return "$rc"
}

parse_dec() { printf '%s' "$1" | sed -n 's/.*"decision"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n1; }
parse_cur() { printf '%s' "$1" | sed -n 's/.*"cursor"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n1; }
parse_ok() { printf '%s' "$1" | grep -q '"ok"[[:space:]]*:[[:space:]]*true'; }

ANY=0
ERRS=0
RAN=0
OUT_TELE="$CUR_TELE"
OUT_MAIL="$CUR_MAIL"
OUT_STATUS="$CUR_STATUS"

if [ -n "${WAKE_TELEGRAM_TRIAGE_DATABASE_URL:-${WAKE_DATABASE_URL:-}}" ]; then
  RAN=$((RAN + 1))
  export STATE_CURSOR="$CUR_TELE"
  OUT="$(run_sub "$ROOT/checks/telegram_triage.sh" || true)"
  if parse_ok "$OUT"; then
    c="$(parse_cur "$OUT")"; [ -n "$c" ] && OUT_TELE="$c"
    if [ "$(parse_dec "$OUT")" = "wake" ]; then
      ANY=1
    fi
  else
    ERRS=$((ERRS + 1))
  fi
fi
if [ -n "${WAKE_MAIL_IMAP_HOST:-${MAIL_TRIAGE_IMAP_HOST:-}}" ]; then
  RAN=$((RAN + 1))
  export STATE_CURSOR="$CUR_MAIL"
  OUT="$(run_sub "$ROOT/checks/mail_triage.sh" || true)"
  if parse_ok "$OUT"; then
    c="$(parse_cur "$OUT")"; [ -n "$c" ] && OUT_MAIL="$c"
    if [ "$(parse_dec "$OUT")" = "wake" ]; then
      ANY=1
    fi
  else
    ERRS=$((ERRS + 1))
  fi
fi

if [ -n "${WAKE_STATUS_DATABASE_URL:-${WAKE_DATABASE_URL:-}}" ] || [ -n "${WAKE_GITHUB_TOKEN:-}" ]; then
  RAN=$((RAN + 1))
  for d in 1 2 3 4 5 6 7; do
    export STATUS_DIVISION="Div$d"
    export STATE_CURSOR="$CUR_STATUS"
    OUT="$(run_sub "$ROOT/checks/status_report.sh" || true)"
    if parse_ok "$OUT"; then
      if [ "$(parse_dec "$OUT")" = "wake" ]; then
        ANY=1
        c="$(parse_cur "$OUT")"; [ -n "$c" ] && OUT_STATUS="$c"
        break
      fi
    else
      ERRS=$((ERRS + 1))
      break
    fi
  done
fi

if [ "$RAN" -eq 0 ]; then
  wake_emit_check_result 0 "" "" "" "missing-morning-sources"
  exit 1
fi
if [ "$ANY" -eq 0 ] && [ "$ERRS" -gt 0 ]; then
  wake_emit_check_result 0 "" "" "" "morning-subcheck-error"
  exit 1
fi

# Primary cursor stays a timestamp (max of telegram/status); mail stays in cursor_mail only.
PRIMARY_OUT="$(wake_cursor_max "$OUT_TELE" "$OUT_STATUS")"
WAKE_EMIT_EXTRA="$(printf ',"cursor_telegram":"%s","cursor_mail":"%s","cursor_status":"%s"' \
  "$OUT_TELE" "$OUT_MAIL" "$OUT_STATUS")"
export WAKE_EMIT_EXTRA

if [ "$ANY" -eq 1 ]; then
  wake_emit_check_result 1 wake "$PRIMARY_OUT" "overnight-new"
else
  wake_emit_check_result 1 skip "$PRIMARY_OUT" "none"
fi
exit 0
