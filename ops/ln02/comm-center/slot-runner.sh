#!/usr/bin/env bash
# One pick-up slot: courier (OUT→IN) then wake for posts due at this Berlin minute.
# Timers fire every minute (or at known minutes); due posts are selected from COMM_CLOCK_*.
# Fixed Thu 14:00/14:30 stat scripts and Div3's own jobs are NOT started here.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
. "$ROOT/lib.sh"

CC_ENV_FILE="${CC_ENV_FILE:-$HOME/.config/dabos/comm-center.env}"
CC_STATE_DIR="${CC_STATE_DIR:-$HOME/.local/state/dabos/comm-center}"
CC_LOG_FILE="${CC_LOG_FILE:-$CC_STATE_DIR/comm-center.jsonl}"
CC_CSV_FILE="${CC_CSV_FILE:-$CC_STATE_DIR/counts.csv}"

mkdir -p "$CC_STATE_DIR"
cc_load_env "$CC_ENV_FILE"
[ -f "$ROOT/clocks.env" ] && cc_load_env "$ROOT/clocks.env"
if [ -f "$ROOT/clocks.env.example" ] && ! env | grep -q '^COMM_CLOCK_'; then
  cc_load_env "$ROOT/clocks.env.example"
fi

MODE="${1:-auto}" # auto | courier-only | wake-only | post <name>

# Validate post names
POSTS=(Div1 Div2 Div3 Div4 Div5 Div6 Div7 LDW DIGEST)

run_courier() {
  CC_COURIER_MODE=1 "$ROOT/courier.sh" || return $?
}

due_posts_for_wake() {
  local p
  CC_COURIER_MODE=0
  for p in "${POSTS[@]}"; do
    [ "$p" = "DIGEST" ] && continue
    if cc_post_due_now "$p"; then
      printf '%s\n' "$p"
    fi
  done
  # digest clock
  if cc_post_due_now DIGEST; then
    printf 'DIGEST\n'
  fi
}

case "$MODE" in
  courier-only)
    run_courier
    exit $?
    ;;
  wake-only)
    shift || true
    TARGET="${1:-}"
    if [ -n "$TARGET" ]; then
      "$ROOT/wake.sh" "$TARGET"
      exit $?
    fi
    while IFS= read -r p; do
      "$ROOT/wake.sh" "$p" || true
    done < <(due_posts_for_wake)
    exit 0
    ;;
  post)
    TARGET="${2:-}"
    [ -n "$TARGET" ] || { echo "usage: slot-runner.sh post <DivN|LDW>" >&2; exit 64; }
    run_courier || exit $?
    "$ROOT/wake.sh" "$TARGET"
    exit $?
    ;;
  auto|*)
    # Courier always at slot-1min; if anything is due for courier this minute, run once.
    NEED_COURIER=0
    CC_COURIER_MODE=1
    for p in Div1 Div2 Div3 Div4 Div5 Div6 Div7 LDW; do
      if cc_post_due_now "$p"; then NEED_COURIER=1; break; fi
    done
    if [ "$NEED_COURIER" = "1" ]; then
      run_courier || exit $?
    fi
    while IFS= read -r p; do
      "$ROOT/wake.sh" "$p" || true
    done < <(due_posts_for_wake)
    exit 0
    ;;
esac
