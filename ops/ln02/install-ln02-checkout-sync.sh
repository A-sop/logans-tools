#!/usr/bin/env bash
# install-ln02-checkout-sync.sh - install the ln02 checkout sync + week-close Div1 drop-in (RR-010 step 0).
#   bash install-ln02-checkout-sync.sh                 plan only: prints what would change + diffs, changes nothing
#   bash install-ln02-checkout-sync.sh --apply         install (idempotent; replaced files backed up)
#   bash install-ln02-checkout-sync.sh --undo          plan the removal
#   bash install-ln02-checkout-sync.sh --undo --apply  remove what this script installs (the clone is kept)
# Never touches the week-close unit/timer/wrapper themselves, the env files, or any secret.
set -euo pipefail

APPLY=0; UNDO=0
for a in "$@"; do
  case "$a" in
    --apply) APPLY=1 ;;
    --undo) UNDO=1 ;;
    -h|--help) sed -n '2,7p' "$0"; exit 0 ;;
    *) echo "unknown argument: $a" >&2; exit 64 ;;
  esac
done

SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
UNIT_DIR="${UNIT_DIR:-$HOME/.config/systemd/user}"
BIN_DIR="${BIN_DIR:-$HOME/bin}"
CLONE="${CLONE:-$HOME/Dev/DABOS-weekclose}"
CLONE_URL="${CLONE_URL:-git@github-dabos:A-sop/DABOS.git}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BAK="${BAK:-$HOME/.local/state/dabos/bak-checkout-sync-$STAMP}"
DROPIN_DIR="$UNIT_DIR/dabos-week-close-ln02.service.d"

# source -> destination, mode
FILES=(
  "bin/dabos-checkout-sync.sh|$BIN_DIR/dabos-checkout-sync.sh|0755"
  "bin/dabos-div1-dry-run.sh|$BIN_DIR/dabos-div1-dry-run.sh|0755"
  "systemd/dabos-checkout-sync.service|$UNIT_DIR/dabos-checkout-sync.service|0644"
  "systemd/dabos-checkout-sync.timer|$UNIT_DIR/dabos-checkout-sync.timer|0644"
  "systemd/dabos-week-close-ln02.service.d/10-div1-wiki-clone.conf|$DROPIN_DIR/10-div1-wiki-clone.conf|0644"
)

mode_word() { [ "$APPLY" = "1" ] && echo "APPLY" || echo "PLAN (no changes; add --apply)"; }
echo "== install-ln02-checkout-sync: $( [ "$UNDO" = "1" ] && echo UNDO || echo INSTALL ) - $(mode_word)"
echo "   source: $SRC"
CHANGES=0

backup() { # path
  [ -e "$1" ] || return 0
  mkdir -p "$BAK$(dirname "$1")"
  cp -a "$1" "$BAK$1"
  echo "   backup: $1 -> $BAK$1"
}

if [ "$UNDO" = "1" ]; then
  if systemctl --user is-enabled --quiet dabos-checkout-sync.timer 2>/dev/null; then
    echo "-- disable dabos-checkout-sync.timer"; CHANGES=1
    [ "$APPLY" = "1" ] && systemctl --user disable --now dabos-checkout-sync.timer
  fi
  for f in "${FILES[@]}"; do
    dst="${f#*|}"; dst="${dst%%|*}"
    if [ -e "$dst" ]; then
      echo "-- remove $dst"; CHANGES=1
      [ "$APPLY" = "1" ] && { backup "$dst"; rm -f "$dst"; }
    fi
  done
  if [ "$APPLY" = "1" ] && [ "$CHANGES" = "1" ]; then
    rmdir "$DROPIN_DIR" 2>/dev/null || true
    systemctl --user daemon-reload
  fi
  [ -d "$CLONE" ] && echo "   kept: $CLONE (remove by hand with: rm -rf $CLONE)"
  [ "$CHANGES" = "1" ] || echo "== no changes (nothing installed)"
  exit 0
fi

# Preflight (read-only)
for t in git systemctl; do command -v "$t" >/dev/null || { echo "missing tool: $t" >&2; exit 1; }; done
for f in "${FILES[@]}"; do src="${f%%|*}"; [ -r "$SRC/$src" ] || { echo "missing source file $SRC/$src" >&2; exit 1; }; done

# 1. files
for f in "${FILES[@]}"; do
  src="$SRC/${f%%|*}"; rest="${f#*|}"; dst="${rest%%|*}"; mode="${rest##*|}"
  if [ -e "$dst" ] && cmp -s "$src" "$dst"; then
    echo "   same: $dst"
    continue
  fi
  CHANGES=1
  echo "-- install $dst (mode $mode)"
  if [ -e "$dst" ]; then
    diff -u --label "$dst (current)" --label "$dst (new)" "$dst" "$src" || true
  else
    diff -u --label /dev/null --label "$dst (new)" /dev/null "$src" || true
  fi
  if [ "$APPLY" = "1" ]; then
    backup "$dst"
    mkdir -p "$(dirname "$dst")"
    install -m "$mode" "$src" "$dst"
  fi
done

# 2. dedicated DABOS clone (full history; never a fetch on the Seagate mirror)
if [ -d "$CLONE/.git" ]; then
  url="$(git -C "$CLONE" remote get-url origin 2>/dev/null || true)"
  if [ "$url" != "$CLONE_URL" ]; then
    echo "REFUSE: $CLONE exists with a different origin; fix or remove it by hand" >&2; exit 2
  fi
  [ "$(git -C "$CLONE" rev-parse --is-shallow-repository)" = "false" ] \
    || { echo "REFUSE: $CLONE is shallow (Div1 needs full history)" >&2; exit 2; }
  echo "   same: clone $CLONE (origin ok, full history)"
elif [ -e "$CLONE" ]; then
  echo "REFUSE: $CLONE exists and is not a git clone" >&2; exit 2
else
  CHANGES=1
  echo "-- clone $CLONE_URL -> $CLONE (full history, branch main)"
  if [ "$APPLY" = "1" ]; then
    mkdir -p "$(dirname "$CLONE")"
    GIT_TERMINAL_PROMPT=0 git clone --branch main "$CLONE_URL" "$CLONE"
  else
    GIT_TERMINAL_PROMPT=0 timeout 30 git ls-remote "$CLONE_URL" -h refs/heads/main >/dev/null \
      && echo "   preflight: $CLONE_URL reachable with ln02's deploy key" \
      || echo "   WARN: $CLONE_URL not reachable now (deploy key / network); --apply would fail here"
  fi
fi

# 3. systemd
if [ "$APPLY" = "1" ] && [ "$CHANGES" = "1" ]; then
  systemctl --user daemon-reload
fi
if ! systemctl --user is-enabled --quiet dabos-checkout-sync.timer 2>/dev/null; then
  CHANGES=1
  echo "-- enable --now dabos-checkout-sync.timer"
  [ "$APPLY" = "1" ] && systemctl --user enable --now dabos-checkout-sync.timer
else
  echo "   same: dabos-checkout-sync.timer enabled"
fi

if [ "$CHANGES" = "0" ]; then
  echo "== no changes (already installed)"
elif [ "$APPLY" = "1" ]; then
  echo "== applied. Verify: systemctl --user start dabos-checkout-sync.service && cat ~/.local/state/dabos/checkout-sync.status.json"
  echo "   then: ~/bin/dabos-div1-dry-run.sh --week=2026-W44"
else
  echo "== plan only; nothing changed. Re-run with --apply to install."
fi
