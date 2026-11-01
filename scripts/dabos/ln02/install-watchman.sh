#!/usr/bin/env bash
# RR-010 step 1: install the DABOS watchman user timer on ln02.
#
# DRY RUN by default: checks prerequisites and prints the rendered units. Changes nothing.
#   --apply          write ~/.config/systemd/user/dabos-watchman.{service,timer}, daemon-reload,
#                    enable --now the timer. Run only after Dept13 PASS and Logan's yes.
#   --undo           show what the undo would remove (dry run); with --apply, do it.
#   --gate-dry-run   run one watchman tick in dry-run mode with the env file (reads Neon, writes
#                    nothing, POSTs nothing) and print its decisions. Needs no installed units.
#   --repo PATH      logans-tools checkout (default: the one holding this script)
#
# Secrets: this script never creates, reads out or prints a secret. It checks that
# ~/.config/dabos/watchman.env exists, is mode 600 and sets the names below (grep -q). The one value
# it reads is WATCHMAN_AGENTS (a list of agent ids, not secret), to know which hook names to check.
set -euo pipefail

APPLY=0
UNDO=0
GATE_DRY_RUN=0
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$SCRIPT_DIR/../../.." && pwd)"
while [ $# -gt 0 ]; do
  case "$1" in
    --apply) APPLY=1 ;;
    --undo) UNDO=1 ;;
    --gate-dry-run) GATE_DRY_RUN=1 ;;
    --repo) REPO="$(cd "$2" && pwd)"; shift ;;
    -h|--help) sed -n '2,17p' "$0"; exit 0 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
  shift
done

ENV_FILE="$HOME/.config/dabos/watchman.env"
UNIT_DIR="$HOME/.config/systemd/user"
UNITS=(dabos-watchman.service dabos-watchman.timer)
KNOWN_AGENTS=" ldw div1 div2 div3 div4 div5 div6 div7 "
fail=0
say() { printf '%s\n' "$*"; }
bad() { printf 'FAIL: %s\n' "$*" >&2; fail=1; }

if [ "$UNDO" -eq 1 ]; then
  say "Undo plan: systemctl --user disable --now dabos-watchman.timer; rm $UNIT_DIR/{${UNITS[0]},${UNITS[1]}}; systemctl --user daemon-reload"
  say "(The env file, the state dir ~/.local/state/dabos-watchman and the Neon table are left alone;"
  say " the table has its own UNDO SQL.)"
  if [ "$APPLY" -ne 1 ]; then
    say "DRY RUN. Re-run with --undo --apply to remove the timer."
    exit 0
  fi
  systemctl --user disable --now dabos-watchman.timer 2>/dev/null || true
  rm -f "$UNIT_DIR/${UNITS[0]}" "$UNIT_DIR/${UNITS[1]}"
  systemctl --user daemon-reload
  say "Removed."
  exit 0
fi

say "repo: $REPO"
[ -f "$REPO/package.json" ] && grep -q '"dabos:watchman"' "$REPO/package.json" \
  || bad "package.json in $REPO has no dabos:watchman script"
[ -d "$REPO/node_modules" ] || bad "$REPO/node_modules missing (run npm ci there first)"

NODE_PATH_BIN="$(command -v node || true)"
if [ -z "$NODE_PATH_BIN" ]; then bad "node not on PATH"; NODE_BIN=/usr/bin; else NODE_BIN="$(dirname "$NODE_PATH_BIN")"; fi
[ -x "$NODE_BIN/npm" ] || bad "npm not found next to node in $NODE_BIN"
say "node bin: $NODE_BIN"

# Env file: existence, mode and names only. Secret values are never read out or printed.
if [ ! -f "$ENV_FILE" ]; then
  bad "$ENV_FILE missing (Logan places it; see the PR description for the names)"
else
  mode="$(stat -c %a "$ENV_FILE")"
  [ "$mode" = "600" ] || bad "$ENV_FILE mode is $mode, expected 600"
  grep -qE "^WATCHMAN_DATABASE_URL=.+" "$ENV_FILE" || bad "$ENV_FILE does not set WATCHMAN_DATABASE_URL"
  agents="$(sed -n 's/^WATCHMAN_AGENTS=//p' "$ENV_FILE" | head -n1 | tr -d "\"' ")"
  if ! printf '%s' "$agents" | grep -qE '^[a-z0-9,]+$'; then
    bad "$ENV_FILE: WATCHMAN_AGENTS missing or not a comma list of agent ids"
  else
    IFS=',' read -r -a agent_list <<<"$agents"
    for a in "${agent_list[@]}"; do
      case "$KNOWN_AGENTS" in *" $a "*) ;; *) bad "WATCHMAN_AGENTS names unknown agent id: $a"; continue ;; esac
      up="$(printf '%s' "$a" | tr '[:lower:]' '[:upper:]')"
      for name in "WATCHMAN_HOOK_${up}_URL" "WATCHMAN_HOOK_${up}_KEY"; do
        grep -qE "^${name}=.+" "$ENV_FILE" || bad "$ENV_FILE does not set $name"
      done
    done
    say "env file: present, mode $mode, names checked for agents: $agents"
  fi
fi

command -v systemctl >/dev/null || bad "systemctl not found"
if command -v systemd-analyze >/dev/null; then
  systemd-analyze calendar '*-*-* *:00/5:00' >/dev/null 2>&1 || bad "systemd-analyze rejects the OnCalendar spec"
fi

if [ "$GATE_DRY_RUN" -eq 1 ]; then
  # Gate dry run needs only the database name; hooks may still be missing.
  [ -f "$REPO/package.json" ] || exit 1
  [ -f "$ENV_FILE" ] || exit 1
  say "Gate dry run (reads Neon, writes nothing, POSTs nothing):"
  exec systemd-run --user --wait --pipe --quiet --collect \
    -p "EnvironmentFile=$ENV_FILE" -p "WorkingDirectory=$REPO" \
    -E "PATH=$NODE_BIN:/usr/local/bin:/usr/bin:/bin" -E WATCHMAN_DRY_RUN=1 \
    "$NODE_BIN/npm" run --silent dabos:watchman -- --dry-run
fi

render() {
  sed -e "s#@REPO@#${REPO}#g" -e "s#@NODE_BIN@#${NODE_BIN}#g" "$SCRIPT_DIR/$1"
}
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
for f in "${UNITS[@]}"; do render "$f" >"$TMP/$f"; done
if command -v systemd-analyze >/dev/null; then
  systemd-analyze --user verify "$TMP/dabos-watchman.timer" >/dev/null 2>&1 \
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
  for f in "${UNITS[@]}"; do
    say "----- $f"
    cat "$TMP/$f"
  done
  say ""
  say "Re-run with --apply to install and enable the timer."
  exit 0
fi

mkdir -p "$UNIT_DIR" "$HOME/.local/state/dabos-watchman"
install -m 644 "$TMP/dabos-watchman.service" "$UNIT_DIR/dabos-watchman.service"
install -m 644 "$TMP/dabos-watchman.timer" "$UNIT_DIR/dabos-watchman.timer"
systemctl --user daemon-reload
systemctl --user enable --now dabos-watchman.timer
systemctl --user list-timers dabos-watchman.timer --no-pager
say "Installed. Watch: journalctl --user -u dabos-watchman -n 20; state: ~/.local/state/dabos-watchman/state.json"
say "Undo: $0 --undo --apply"
