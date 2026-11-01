#!/usr/bin/env bash
# Div4: install the build-receipt route-stalls user timer on ln02.
#
# DRY RUN by default: checks prerequisites and prints the rendered units. Changes nothing.
# Only with --apply does it write ~/.config/systemd/user/dabos-route-stalls.{service,timer},
# run daemon-reload and enable the timer. Run only after Dept13 PASS and Logan's yes.
# Never install on the LDW laptop — ln02 only.
#
# Usage: scripts/dabos/ln02/install-route-stalls.sh [--repo /path/to/logans-tools] [--apply]
#
# Secrets: this script never creates, reads out or prints a secret. It only checks that
# ~/.config/dabos/build-receipt.env exists, is mode 600, and sets DABOS_BUILD_RECEIPT_DATABASE_URL
# (grep -q on the name only).
set -euo pipefail

APPLY=0
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$SCRIPT_DIR/../../.." && pwd)"
while [ $# -gt 0 ]; do
  case "$1" in
    --apply) APPLY=1 ;;
    --repo) REPO="$(cd "$2" && pwd)"; shift ;;
    -h|--help) sed -n '2,14p' "$0"; exit 0 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
  shift
done

ENV_FILE="$HOME/.config/dabos/build-receipt.env"
UNIT_DIR="$HOME/.config/systemd/user"
REQUIRED_NAMES=(DABOS_BUILD_RECEIPT_DATABASE_URL)
fail=0
say() { printf '%s\n' "$*"; }
bad() { printf 'FAIL: %s\n' "$*" >&2; fail=1; }

say "repo: $REPO"
[ -f "$REPO/package.json" ] && grep -q '"dabos:route-stalls"' "$REPO/package.json" \
  || bad "package.json in $REPO has no dabos:route-stalls script"
[ -d "$REPO/node_modules" ] || bad "$REPO/node_modules missing (run npm ci there first)"

NODE_PATH_BIN="$(command -v node || true)"
if [ -z "$NODE_PATH_BIN" ]; then bad "node not on PATH"; NODE_BIN=/usr/bin; else NODE_BIN="$(dirname "$NODE_PATH_BIN")"; fi
[ -x "$NODE_BIN/npm" ] || bad "npm not found next to node in $NODE_BIN"
say "node bin: $NODE_BIN"

# Env file: existence, mode and names only. Values are never read out or printed.
if [ ! -f "$ENV_FILE" ]; then
  bad "$ENV_FILE missing (Logan places it; see src/docs/dabos/build-receipt.md for the name)"
else
  mode="$(stat -c %a "$ENV_FILE")"
  [ "$mode" = "600" ] || bad "$ENV_FILE mode is $mode, expected 600"
  for name in "${REQUIRED_NAMES[@]}"; do
    grep -qE "^${name}=.+" "$ENV_FILE" || bad "$ENV_FILE does not set $name"
  done
  say "env file: present, mode $mode, names checked"
fi

command -v systemctl >/dev/null || bad "systemctl not found"
if command -v systemd-analyze >/dev/null; then
  systemd-analyze calendar '*-*-* *:00:00 Europe/Berlin' >/dev/null 2>&1 \
    || bad "systemd-analyze rejects OnCalendar '*-*-* *:00:00 Europe/Berlin'"
fi

render() {
  sed -e "s#@REPO@#${REPO}#g" -e "s#@NODE_BIN@#${NODE_BIN}#g" "$SCRIPT_DIR/$1"
}
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
render dabos-route-stalls.service >"$TMP/dabos-route-stalls.service"
render dabos-route-stalls.timer >"$TMP/dabos-route-stalls.timer"
if command -v systemd-analyze >/dev/null; then
  systemd-analyze --user verify "$TMP/dabos-route-stalls.timer" >/dev/null 2>&1 \
    || say "note: systemd-analyze verify reported warnings (check after install)"
fi

if [ "$(loginctl show-user "$USER" -p Linger --value 2>/dev/null || echo unknown)" != "yes" ]; then
  say "note: linger is not enabled for $USER; the timer only runs while a session is open"
fi

if [ "$fail" -ne 0 ]; then
  echo "Prerequisites failed; nothing installed." >&2
  exit 1
fi

if [ "$APPLY" -ne 1 ]; then
  say ""
  say "DRY RUN. Would install to $UNIT_DIR:"
  for f in dabos-route-stalls.service dabos-route-stalls.timer; do
    say "----- $f"
    cat "$TMP/$f"
  done
  say ""
  say "Re-run with --apply to install and enable the timer."
  exit 0
fi

mkdir -p "$UNIT_DIR"
install -m 644 "$TMP/dabos-route-stalls.service" "$UNIT_DIR/dabos-route-stalls.service"
install -m 644 "$TMP/dabos-route-stalls.timer" "$UNIT_DIR/dabos-route-stalls.timer"
systemctl --user daemon-reload
systemctl --user enable --now dabos-route-stalls.timer
systemctl --user list-timers dabos-route-stalls.timer --no-pager
say "Installed. First run: systemctl --user start dabos-route-stalls.service; then"
say "journalctl --user -u dabos-route-stalls -n 20"
say "Undo: systemctl --user disable --now dabos-route-stalls.timer; rm $UNIT_DIR/dabos-route-stalls.{service,timer}; systemctl --user daemon-reload"
