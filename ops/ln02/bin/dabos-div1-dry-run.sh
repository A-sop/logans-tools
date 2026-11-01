#!/usr/bin/env bash
# dabos-div1-dry-run.sh - ln02: read-only Div1 artifacts_indexed check (SELECTs only, no Neon writes).
# Usage: ~/bin/dabos-div1-dry-run.sh [--week=YYYY-Www]   (default: the last closed org week)
# Uses the same env file as the week-close wrapper (parsed, not sourced; values never printed) and the
# same Div1 root as the week-close drop-in (DABOS_WIKI_REPO_ROOT, default ~/Dev/DABOS-weekclose).
# Exit: 0 ok (and equal to the active Neon row if one exists), 2 NOT POSTED, 3 differs, 1 error.
set -uo pipefail
REPO="${REPO:-$HOME/Dev/logans-tools}"
ENV_FILE="${ENV_FILE:-$HOME/.config/dabos/week-close.env}"
export DABOS_WIKI_REPO_ROOT="${DABOS_WIKI_REPO_ROOT:-$HOME/Dev/DABOS-weekclose}"

if ! command -v npm >/dev/null 2>&1; then
  for d in "$HOME"/.nvm/versions/node/*/bin; do [ -x "$d/npm" ] && { export PATH="$d:$PATH"; break; }; done
fi
[ -r "$ENV_FILE" ] || { echo "cannot read $ENV_FILE" >&2; exit 1; }
while IFS= read -r line || [ -n "$line" ]; do
  case "$line" in ''|'#'*) continue;; esac
  k="${line%%=*}"; v="${line#*=}"
  [[ "$k" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || continue
  case "$k" in DABOS_WIKI_REPO_ROOT|DABOS_REPO_ROOT|DABOS_WIKI_GIT_REF|DABOS_WIKI_SOURCE) continue;; esac
  v="${v%\"}"; v="${v#\"}"; v="${v%\'}"; v="${v#\'}"
  export "$k=$v"
done < "$ENV_FILE"
[ -x "$REPO/node_modules/.bin/tsx" ] || { echo "tsx missing in $REPO (run npm ci)" >&2; exit 1; }
cd "$REPO" || exit 1
exec "$REPO/node_modules/.bin/tsx" scripts/dabos/div1-artifacts-dry-run.ts "$@"
