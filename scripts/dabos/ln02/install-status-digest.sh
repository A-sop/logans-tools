#!/usr/bin/env bash
# RR-010 step 3: install the DABOS status digest user timer on ln02.
#
# DRY RUN by default: checks prerequisites and prints the rendered units. Changes nothing.
# Only with --apply does it write ~/.config/systemd/user/dabos-status-digest.{service,timer},
# run daemon-reload and enable the timer. Run only after Dept13 PASS and Logan's yes.
#
# Usage: scripts/dabos/ln02/install-status-digest.sh [--repo /path/to/logans-tools] [--apply]
#
# Secrets: this script never creates, reads out or prints a secret. It only checks that
# ~/.config/dabos/status-digest.env exists, is mode 600, and sets both names below (grep -q).
set -euo pipefail

APPLY=0
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$SCRIPT_DIR/../../.." && pwd)"
while [ $# -gt 0 ]; do
  case "$1" in
    --apply) APPLY=1 ;;
    --repo) REPO="$(cd "$2" && pwd)"; shift ;;
    -h|--help) sed -n '2,12p' "$0"; exit 0 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
  shift
done

ENV_FILE="$HOME/.config/dabos/status-digest.env"
UNIT_DIR="$HOME/.config/systemd/user"
REQUIRED_NAMES=(DABOS_DIGEST_DATABASE_URL DABOS_DIGEST_GITHUB_TOKEN)
fail=0
say() { printf '%s\n' "$*"; }
bad() { printf 'FAIL: %s\n' "$*" >&2; fail=1; }

say "repo: $REPO"
[ -f "$REPO/package.json" ] && grep -q '"dabos:status-digest"' "$REPO/package.json" \
  || bad "package.json in $REPO has no dabos:status-digest script"
[ -d "$REPO/node_modules" ] || bad "$REPO/node_modules missing (run npm ci there first)"

# Prefer nvm Node on ln02 (/usr/bin/node is often present without npm).
if [ -z "${NODE_BIN:-}" ]; then
  for cand in \
    "$HOME/.nvm/versions/node/v22.23.4/bin" \
    "$HOME/.nvm/versions/node/v22.22.3/bin" \
    "$(dirname "$(command -v node || true)")"
  do
    if [ -n "$cand" ] && [ -x "$cand/node" ] && [ -x "$cand/npm" ]; then
      NODE_BIN="$cand"
      break
    fi
  done
fi
if [ -z "${NODE_BIN:-}" ]; then bad "node+npm not found (set NODE_BIN or install nvm Node)"; NODE_BIN=/usr/bin; fi
[ -x "$NODE_BIN/npm" ] || bad "npm not found next to node in $NODE_BIN"
say "node bin: $NODE_BIN"

# Env file: existence, mode and names only. Values are never read out or printed.
if [ ! -f "$ENV_FILE" ]; then
  bad "$ENV_FILE missing (Logan places it; see the PR description for the two names)"
else
  mode="$(stat -c %a "$ENV_FILE")"
  [ "$mode" = "600" ] || bad "$ENV_FILE mode is $mode, expected 600"
  for name in "${REQUIRED_NAMES[@]}"; do
    grep -qE "^${name}=.+" "$ENV_FILE" || bad "$ENV_FILE does not set $name"
  done
  say "env file: present, mode $mode, names checked"
fi

command -v systemctl >/dev/null || bad "systemctl not found"
for spec in '*-*-* 00/2:00:00 Europe/Berlin' '*-*-* 12:25:00 Europe/Berlin' '*-*-* 20:40:00 Europe/Berlin'; do
  if command -v systemd-analyze >/dev/null; then
    systemd-analyze calendar "$spec" >/dev/null 2>&1 || bad "systemd-analyze rejects OnCalendar '$spec'"
  fi
done

render() {
  sed -e "s#@REPO@#${REPO}#g" -e "s#@NODE_BIN@#${NODE_BIN}#g" "$SCRIPT_DIR/$1"
}
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
render dabos-status-digest.service >"$TMP/dabos-status-digest.service"
render dabos-status-digest.timer >"$TMP/dabos-status-digest.timer"
if command -v systemd-analyze >/dev/null; then
  systemd-analyze --user verify "$TMP/dabos-status-digest.timer" >/dev/null 2>&1 \
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
  for f in dabos-status-digest.service dabos-status-digest.timer; do
    say "----- $f"
    cat "$TMP/$f"
  done
  say ""
  say "Re-run with --apply to install and enable the timer."
  exit 0
fi

mkdir -p "$UNIT_DIR" "$HOME/.local/state/dabos-status-digest"
install -m 644 "$TMP/dabos-status-digest.service" "$UNIT_DIR/dabos-status-digest.service"
install -m 644 "$TMP/dabos-status-digest.timer" "$UNIT_DIR/dabos-status-digest.timer"
systemctl --user daemon-reload
systemctl --user enable --now dabos-status-digest.timer
systemctl --user list-timers dabos-status-digest.timer --no-pager
say "Installed. First run: systemctl --user start dabos-status-digest.service; then read"
say "~/.local/state/dabos-status-digest/latest.md and journalctl --user -u dabos-status-digest -n 20"
say "Undo: systemctl --user disable --now dabos-status-digest.timer; rm $UNIT_DIR/dabos-status-digest.{service,timer}; systemctl --user daemon-reload"
