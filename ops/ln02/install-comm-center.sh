#!/usr/bin/env bash
# install-comm-center.sh — install ln02 three-basket courier + wake (Dept2 v3).
#   bash install-comm-center.sh                 plan only
#   bash install-comm-center.sh --apply         install (idempotent; replaced files backed up)
#   bash install-comm-center.sh --undo          plan the removal
#   bash install-comm-center.sh --undo --apply  remove what this script installs
# Never prints secret values. Does not create or fill the env file (Logan places it).
# Does not touch Thu 14:00/14:30 stat units or Div3's existing jobs.
set -euo pipefail

APPLY=0; UNDO=0
for a in "$@"; do
  case "$a" in
    --apply) APPLY=1 ;;
    --undo) UNDO=1 ;;
    -h|--help) sed -n '2,9p' "$0"; exit 0 ;;
    *) echo "unknown argument: $a" >&2; exit 64 ;;
  esac
done

SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")/comm-center" && pwd)"
SHARE="${SHARE:-$HOME/.local/share/dabos/comm-center}"
BIN_DIR="${BIN_DIR:-$HOME/bin}"
UNIT_DIR="${UNIT_DIR:-$HOME/.config/systemd/user}"
ENV_FILE="${ENV_FILE:-$HOME/.config/dabos/comm-center.env}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BAK="${BAK:-$HOME/.local/state/dabos/bak-comm-center-$STAMP}"

TIMERS=(dabos-comm-center.timer)
SERVICES=(dabos-comm-center.service)

mode_word() { [ "$APPLY" = "1" ] && echo "APPLY" || echo "PLAN (no changes; add --apply)"; }
echo "== install-comm-center: $( [ "$UNDO" = "1" ] && echo UNDO || echo INSTALL ) - $(mode_word)"
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
  if [ -e "$BIN_DIR/dabos-comm-center" ]; then
    echo "-- remove $BIN_DIR/dabos-comm-center"; CHANGES=1
    [ "$APPLY" = "1" ] && { backup "$BIN_DIR/dabos-comm-center"; rm -f "$BIN_DIR/dabos-comm-center"; }
  fi
  if [ -d "$SHARE" ]; then
    echo "-- remove $SHARE"; CHANGES=1
    [ "$APPLY" = "1" ] && { backup "$SHARE"; rm -rf "$SHARE"; }
  fi
  if [ "$APPLY" = "1" ] && [ "$CHANGES" = "1" ]; then
    systemctl --user daemon-reload
  fi
  echo "   kept: $ENV_FILE and ~/.local/state/dabos/comm-center (remove by hand if desired)"
  [ "$CHANGES" = "1" ] || echo "== no changes (nothing installed)"
  exit 0
fi

for t in bash curl; do
  command -v "$t" >/dev/null || { echo "missing tool: $t" >&2; exit 1; }
done
command -v psql >/dev/null || echo "   WARN: psql not on PATH (courier/wake need it)"
command -v python3 >/dev/null || echo "   WARN: python3 not on PATH (wake JSON encode / clock fallback)"

if [ ! -f "$ENV_FILE" ]; then
  echo "   WARN: $ENV_FILE missing (Logan places it; see ops/ln02/comm-center/env.example)"
else
  mode="$(stat -c %a "$ENV_FILE" 2>/dev/null || stat -f %A "$ENV_FILE")"
  [ "$mode" = "600" ] || echo "   WARN: $ENV_FILE mode is $mode, expected 600"
fi

# 1. share tree
if [ -d "$SHARE" ] && diff -rq "$SRC" "$SHARE" >/dev/null 2>&1; then
  echo "   same: $SHARE"
else
  CHANGES=1
  echo "-- install tree $SHARE"
  if [ "$APPLY" = "1" ]; then
    [ -d "$SHARE" ] && backup "$SHARE"
    mkdir -p "$(dirname "$SHARE")"
    rm -rf "$SHARE"
    mkdir -p "$SHARE"
    cp -a "$SRC/." "$SHARE/"
    chmod -R a+rX "$SHARE"
    find "$SHARE" -type f -name '*.sh' -exec chmod 0755 {} \;
    find "$SHARE/bin" -type f -exec chmod 0755 {} \; 2>/dev/null || true
  fi
fi

# 2. wrapper
WRAP_SRC="$SRC/bin/dabos-comm-center"
WRAP_DST="$BIN_DIR/dabos-comm-center"
if [ -e "$WRAP_DST" ] && cmp -s "$WRAP_SRC" "$WRAP_DST"; then
  echo "   same: $WRAP_DST"
else
  CHANGES=1
  echo "-- install $WRAP_DST"
  if [ "$APPLY" = "1" ]; then
    backup "$WRAP_DST"
    mkdir -p "$BIN_DIR"
    # Rewrite COMM_CENTER_ROOT default into a tiny wrapper
    cat >"$WRAP_DST" <<EOF
#!/usr/bin/env bash
set -euo pipefail
export COMM_CENTER_ROOT="$SHARE"
exec bash "\$COMM_CENTER_ROOT/slot-runner.sh" "\$@"
EOF
    chmod 0755 "$WRAP_DST"
  fi
fi

# 3. systemd units
for u in dabos-comm-center.service dabos-comm-center.timer; do
  src="$SRC/systemd/$u"
  dst="$UNIT_DIR/$u"
  if [ -e "$dst" ] && cmp -s "$src" "$dst"; then
    echo "   same: $dst"
    continue
  fi
  CHANGES=1
  echo "-- install $dst"
  if [ -e "$dst" ]; then
    diff -u --label "$dst (current)" --label "$dst (new)" "$dst" "$src" || true
  fi
  if [ "$APPLY" = "1" ]; then
    backup "$dst"
    mkdir -p "$UNIT_DIR"
    install -m 0644 "$src" "$dst"
  fi
done

if [ "$APPLY" = "1" ] && [ "$CHANGES" = "1" ]; then
  systemctl --user daemon-reload
  systemctl --user enable --now dabos-comm-center.timer
  echo "   enabled: dabos-comm-center.timer"
fi

[ "$CHANGES" = "1" ] || echo "== no changes (already installed)"
exit 0
