#!/usr/bin/env bash
# Wake if Migadu IMAP has new UIDs since STATE_CURSOR (UID integer).
# Source found: DABOS triage_mail_imap.py → mail@loganwilliams.com via MAIL_TRIAGE_IMAP_*.
# Never fetches bodies.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck disable=SC1091
. "$ROOT/lib.sh"

HOST="${WAKE_MAIL_IMAP_HOST:-${MAIL_TRIAGE_IMAP_HOST:-}}"
USER="${WAKE_MAIL_IMAP_USER:-${MAIL_TRIAGE_IMAP_USER:-}}"
PASS="${WAKE_MAIL_IMAP_PASSWORD:-${MAIL_TRIAGE_IMAP_PASSWORD:-}}"
if [ -z "$HOST" ] || [ -z "$USER" ] || [ -z "$PASS" ]; then
  wake_emit_check_result 0 "" "" "" "missing-imap-env"
  exit 1
fi
if ! command -v python3 >/dev/null 2>&1; then
  wake_emit_check_result 0 "" "" "" "python3-not-found"
  exit 1
fi

export STATE_CURSOR
CURSOR="$(wake_validate_uid_cursor "${STATE_CURSOR:-0}")"
export STATE_CURSOR="$CURSOR"

set +e
OUT="$(python3 "$ROOT/imap_new_uids.py" 2>/tmp/wake-mail.err.$$)"
RC=$?
set -e
ERR="$(tr '\n' ' ' </tmp/wake-mail.err.$$ 2>/dev/null | head -c 120 || true)"
rm -f /tmp/wake-mail.err.$$

if [ "$RC" -ne 0 ]; then
  wake_emit_check_result 0 "" "" "" "imap-error"
  exit 1
fi

N="$(printf '%s' "$OUT" | sed -n 's/.*"n"[[:space:]]*:[[:space:]]*\([0-9][0-9]*\).*/\1/p' | head -n1)"
MAX="$(printf '%s' "$OUT" | sed -n 's/.*"max_uid"[[:space:]]*:[[:space:]]*\([0-9][0-9]*\).*/\1/p' | head -n1)"
N="${N:-0}"
MAX="${MAX:-$CURSOR}"

if [ "$N" -gt 0 ]; then
  wake_emit_check_result 1 wake "$MAX" "new-mail"
else
  wake_emit_check_result 1 skip "$CURSOR" "none"
fi
exit 0
