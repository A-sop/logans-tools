#!/usr/bin/env bash
# Wake if overnight captures, mail, or any division change signal exists since STATE_CURSOR.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck disable=SC1091
. "$ROOT/lib.sh"

if ! CURSOR="$(wake_validate_cursor "${STATE_CURSOR:-}")"; then
  wake_emit_check_result 0 "" "" "" "bad-cursor"
  exit 1
fi
export STATE_CURSOR="$CURSOR"

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
NEW_CURSOR="$CURSOR"
ERRS=0
RAN=0

# Run a sub-check only when its source env is present; configured-source errors fail closed.
if [ -n "${WAKE_TELEGRAM_TRIAGE_DATABASE_URL:-${WAKE_DATABASE_URL:-}}" ]; then
  RAN=$((RAN + 1))
  OUT="$(run_sub "$ROOT/checks/telegram_triage.sh" || true)"
  if parse_ok "$OUT"; then
    if [ "$(parse_dec "$OUT")" = "wake" ]; then
      ANY=1
      c="$(parse_cur "$OUT")"; [ -n "$c" ] && NEW_CURSOR="$c"
    fi
  else
    ERRS=$((ERRS + 1))
  fi
fi
if [ -n "${WAKE_MAIL_IMAP_HOST:-${MAIL_TRIAGE_IMAP_HOST:-}}" ]; then
  RAN=$((RAN + 1))
  OUT="$(run_sub "$ROOT/checks/mail_triage.sh" || true)"
  if parse_ok "$OUT"; then
    if [ "$(parse_dec "$OUT")" = "wake" ]; then
      ANY=1
      c="$(parse_cur "$OUT")"; [ -n "$c" ] && NEW_CURSOR="$c"
    fi
  else
    ERRS=$((ERRS + 1))
  fi
fi

# Any-division Neon/GitHub: reuse status_report for Div1..Div7 until one wakes (stop early)
if [ -n "${WAKE_STATUS_DATABASE_URL:-${WAKE_DATABASE_URL:-}}" ] || [ -n "${WAKE_GITHUB_TOKEN:-}" ]; then
  RAN=$((RAN + 1))
  for d in 1 2 3 4 5 6 7; do
    export STATUS_DIVISION="Div$d"
    OUT="$(run_sub "$ROOT/checks/status_report.sh" || true)"
    if parse_ok "$OUT"; then
      if [ "$(parse_dec "$OUT")" = "wake" ]; then
        ANY=1
        c="$(parse_cur "$OUT")"; [ -n "$c" ] && NEW_CURSOR="$c"
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

if [ "$ANY" -eq 1 ]; then
  wake_emit_check_result 1 wake "$NEW_CURSOR" "overnight-new"
else
  wake_emit_check_result 1 skip "$CURSOR" "none"
fi
exit 0
