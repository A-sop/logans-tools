#!/usr/bin/env bash
# install-wake-if-new.sh — install the ln02 wake-if-new gate (RR-010 item 3).
#   bash install-wake-if-new.sh                 plan only
#   bash install-wake-if-new.sh --apply         install (idempotent; replaced files backed up)
#   bash install-wake-if-new.sh --undo          plan the removal
#   bash install-wake-if-new.sh --undo --apply  remove what this script installs
# Never prints secret values. Does not create the env file (Logan places it).
set -euo pipefail

APPLY=0; UNDO=0
for a in "$@"; do
  case "$a" in
    --apply) APPLY=1 ;;
    --undo) UNDO=1 ;;
    -h|--help) sed -n '2,8p' "$0"; exit 0 ;;
    *) echo "unknown argument: $a" >&2; exit 64 ;;
  esac
done

SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")/wake-if-new" && pwd)"
SHARE="${SHARE:-$HOME/.local/share/dabos/wake-if-new}"
BIN_DIR="${BIN_DIR:-$HOME/bin}"
UNIT_DIR="${UNIT_DIR:-$HOME/.config/systemd/user}"
ENV_FILE="${ENV_FILE:-$HOME/.config/dabos/wake-if-new.env}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BAK="${BAK:-$HOME/.local/state/dabos/bak-wake-if-new-$STAMP}"

TIMERS=(
  dabos-wake-telegram-triage.timer
  dabos-wake-mail-triage.timer
  dabos-wake-status-reports.timer
  dabos-wake-morning-brief.timer
)
SERVICES=(
  dabos-wake-telegram-triage.service
  dabos-wake-mail-triage.service
  dabos-wake-status-reports.service
  dabos-wake-morning-brief.service
)

mode_word() { [ "$APPLY" = "1" ] && echo "APPLY" || echo "PLAN (no changes; add --apply)"; }
echo "== install-wake-if-new: $( [ "$UNDO" = "1" ] && echo UNDO || echo INSTALL ) - $(mode_word)"
echo "   source: $SRC"
CHANGES=0

backup() {
  [ -e "$1" ] || return 0
  mkdir -p "$BAK$(dirname "$1")"
  cp -a "$1" "$BAK$1"
  echo "   backup: $1 -> $BAK$1"
}

if [ "$UNDO" = "1" ]; then
  for t in "${TIMERS[@]}"; do
    if systemctl --user is-enabled --quiet "$t" 2>/dev/null; then
      echo "-- disable $t"; CHANGES=1
      [ "$APPLY" = "1" ] && systemctl --user disable --now "$t"
    fi
  done
  for u in "${SERVICES[@]}" "${TIMERS[@]}"; do
    dst="$UNIT_DIR/$u"
    if [ -e "$dst" ]; then
      echo "-- remove $dst"; CHANGES=1
      [ "$APPLY" = "1" ] && { backup "$dst"; rm -f "$dst"; }
    fi
  done
  for b in dabos-wake-if-new dabos-wake-status-all; do
    if [ -e "$BIN_DIR/$b" ]; then
      echo "-- remove $BIN_DIR/$b"; CHANGES=1
      [ "$APPLY" = "1" ] && { backup "$BIN_DIR/$b"; rm -f "$BIN_DIR/$b"; }
    fi
  done
  if [ -d "$SHARE" ]; then
    echo "-- remove $SHARE"; CHANGES=1
    [ "$APPLY" = "1" ] && { backup "$SHARE"; rm -rf "$SHARE"; }
  fi
  if [ "$APPLY" = "1" ] && [ "$CHANGES" = "1" ]; then
    systemctl --user daemon-reload
  fi
  echo "   kept: $ENV_FILE and ~/.local/state/dabos/wake-if-new (remove by hand if desired)"
  [ "$CHANGES" = "1" ] || echo "== no changes (nothing installed)"
  exit 0
fi

for t in bash curl flock python3; do
  command -v "$t" >/dev/null || { echo "missing tool: $t" >&2; exit 1; }
done
# psql is required for telegram/status checks at runtime; warn only at install.
command -v psql >/dev/null || echo "   WARN: psql not on PATH (telegram/status checks need it)"

# Env file: names only check
if [ ! -f "$ENV_FILE" ]; then
  echo "   WARN: $ENV_FILE missing (Logan places it; see ops/ln02/wake-if-new/env.example)"
else
  mode="$(stat -c %a "$ENV_FILE" 2>/dev/null || stat -f %A "$ENV_FILE")"
  [ "$mode" = "600" ] || echo "   WARN: $ENV_FILE mode is $mode, expected 600"
fi

# 1. share tree
if [ -d "$SHARE" ] && diff -rq "$SRC" "$SHARE" >/dev/null 2>&1; then
  echo "   same: $SHARE"
else
  CHANGES=1
  echo "-- install tree -> $SHARE"
  if [ "$APPLY" = "1" ]; then
    [ -d "$SHARE" ] && backup "$SHARE"
    mkdir -p "$(dirname "$SHARE")"
    rm -rf "$SHARE"
    mkdir -p "$SHARE"
    cp -a "$SRC"/. "$SHARE"/
    chmod -R a+rX "$SHARE"
    find "$SHARE" -type f -name '*.sh' -exec chmod 0755 {} \;
    find "$SHARE" -type f -name 'dabos-wake-*' -exec chmod 0755 {} \;
    chmod 0755 "$SHARE/runner.sh" "$SHARE/run-status-all.sh" "$SHARE/imap_new_uids.py" "$SHARE/gh_div_activity.py" 2>/dev/null || true
  fi
fi

# 2. bin wrappers
write_wrapper() {
  local name="$1" target="$2"
  local dst="$BIN_DIR/$name"
  local content
  content=$(cat <<EOF
#!/usr/bin/env bash
set -euo pipefail
export WAKE_IF_NEW_ROOT=${SHARE}
exec ${SHARE}/${target} "\$@"
EOF
)
  if [ -e "$dst" ] && [ "$(cat "$dst")" = "$content" ]; then
    echo "   same: $dst"
    return 0
  fi
  CHANGES=1
  echo "-- install $dst"
  if [ "$APPLY" = "1" ]; then
    backup "$dst"
    mkdir -p "$BIN_DIR"
    printf '%s\n' "$content" >"$dst"
    chmod 0755 "$dst"
  fi
}
write_wrapper dabos-wake-if-new runner.sh
write_wrapper dabos-wake-status-all run-status-all.sh

# 3. systemd units (rewrite ExecStart to share paths already in unit templates via ~/bin)
for u in "${SERVICES[@]}" "${TIMERS[@]}"; do
  src="$SRC/systemd/$u"
  dst="$UNIT_DIR/$u"
  [ -r "$src" ] || { echo "missing $src" >&2; exit 1; }
  if [ -e "$dst" ] && cmp -s "$src" "$dst"; then
    echo "   same: $dst"
    continue
  fi
  CHANGES=1
  echo "-- install $dst"
  if [ -e "$dst" ]; then
    diff -u --label "$dst (current)" --label "$dst (new)" "$dst" "$src" || true
  else
    diff -u --label /dev/null --label "$dst (new)" /dev/null "$src" || true
  fi
  if [ "$APPLY" = "1" ]; then
    backup "$dst"
    mkdir -p "$UNIT_DIR"
    install -m 0644 "$src" "$dst"
  fi
done

if [ "$APPLY" = "1" ] && [ "$CHANGES" = "1" ]; then
  systemctl --user daemon-reload
fi

for t in "${TIMERS[@]}"; do
  if ! systemctl --user is-enabled --quiet "$t" 2>/dev/null; then
    CHANGES=1
    echo "-- enable --now $t"
    [ "$APPLY" = "1" ] && systemctl --user enable --now "$t"
  else
    echo "   same: $t enabled"
  fi
done

if [ "$CHANGES" = "0" ]; then
  echo "== no changes (already installed)"
elif [ "$APPLY" = "1" ]; then
  echo "== applied. Verify: systemctl --user list-timers 'dabos-wake-*'"
  echo "   dry check: WAKE_DRY_RUN=1 ~/bin/dabos-wake-if-new telegram_triage"
else
  echo "== plan only; nothing changed. Re-run with --apply to install."
fi
