#!/usr/bin/env bash
# dabos-checkout-sync.sh - ln02: keep checkouts current with fetch + fast-forward ONLY.
# Never resets, never forces, never cleans, never pushes. Diverged/dirty/wrong branch -> log, leave
# the repo untouched, mark it failed. Versioned in logans-tools ops/ln02/ (RR-010 step 0).
#
# Env knobs (defaults in brackets):
#   SYNC_REPOS            space-separated repo paths [~/Dev/logans-tools ~/Dev/DABOS-weekclose]
#   SYNC_BRANCH           branch that must be checked out and is fast-forwarded to origin/<it> [main]
#   SYNC_NPM_CI           1 = run npm ci in a repo whose package-lock.json changed in the ff [1]
#   SYNC_FROM_WEEK_CLOSE  1 = called by dabos-week-close-ln02's ExecStartPre (skip the "close running" guard)
#   SYNC_SKIP_GUARDS      1 = skip the systemd and Thursday-window guards (tests only)
#   STATE_DIR [~/.local/state/dabos]   CONF_DIR [~/.config/dabos]
# Outputs: $STATE_DIR/checkout-sync.status.json; $STATE_DIR/checkout-sync.FAIL while any repo failed.
# Pause: touch $CONF_DIR/PAUSE-checkout-sync
set -uo pipefail
export GIT_TERMINAL_PROMPT=0 LC_ALL=C

STATE_DIR="${STATE_DIR:-$HOME/.local/state/dabos}"
CONF_DIR="${CONF_DIR:-$HOME/.config/dabos}"
SYNC_REPOS="${SYNC_REPOS:-$HOME/Dev/logans-tools $HOME/Dev/DABOS-weekclose}"
SYNC_BRANCH="${SYNC_BRANCH:-main}"
SYNC_NPM_CI="${SYNC_NPM_CI:-1}"
SYNC_FROM_WEEK_CLOSE="${SYNC_FROM_WEEK_CLOSE:-0}"
SYNC_SKIP_GUARDS="${SYNC_SKIP_GUARDS:-0}"
STATUS="$STATE_DIR/checkout-sync.status.json"
FAILFLAG="$STATE_DIR/checkout-sync.FAIL"
mkdir -p "$STATE_DIR"

log() { printf '%s %s\n' "$(date -u +%FT%TZ)" "$*" >&2; }
json_str() { local s=${1//\\/\\\\}; s=${s//\"/\\\"}; s=${s//$'\n'/ }; printf '"%s"' "$s"; }

STARTED_AT=$(date -u +%FT%TZ)
RESULTS=""   # JSON objects joined by ,
ANY_FAIL=0
add_result() { # repo state message before after
  local obj
  obj="{\"repo\":$(json_str "$1"),\"state\":$(json_str "$2"),\"message\":$(json_str "$3"),\"before\":$(json_str "${4:-}"),\"after\":$(json_str "${5:-}")}"
  RESULTS="${RESULTS:+$RESULTS,}$obj"
  case "$2" in ok|up_to_date|skipped) ;; *) ANY_FAIL=1 ;; esac
  log "$1: $2 - $3"
}
write_status() { # overall
  printf '{"state":%s,"started_at_utc":%s,"ended_at_utc":%s,"repos":[%s]}\n' \
    "$(json_str "$1")" "$(json_str "$STARTED_AT")" "$(json_str "$(date -u +%FT%TZ)")" "$RESULTS" > "$STATUS.tmp" \
    && mv "$STATUS.tmp" "$STATUS"
}

# Own lock (NOT the week-close lock: taking that would make the close skip itself).
if command -v flock >/dev/null 2>&1; then
  exec 8>"$STATE_DIR/checkout-sync.lock"
  flock -n 8 || { log "another sync holds the lock; exiting"; exit 0; }
fi

if [ -e "$CONF_DIR/PAUSE-checkout-sync" ]; then
  log "PAUSE-checkout-sync present -> nothing runs"
  write_status paused
  exit 0
fi

if [ "$SYNC_SKIP_GUARDS" != "1" ] && [ "$SYNC_FROM_WEEK_CLOSE" != "1" ] && command -v systemctl >/dev/null 2>&1; then
  wc_state=$(systemctl --user show -p ActiveState --value dabos-week-close-ln02.service 2>/dev/null || true)
  case "$wc_state" in
    active|activating|deactivating|reloading)
      log "dabos-week-close-ln02.service is $wc_state -> skipping this run"
      write_status skipped_week_close_running
      exit 0 ;;
  esac
fi

# Thursday 13:45-15:00 Berlin: do not touch logans-tools (npm ci must never overlap the close).
in_thursday_window() {
  [ "$SYNC_SKIP_GUARDS" = "1" ] && return 1
  local dow hm
  dow=$(TZ=Europe/Berlin date +%u); hm=$(TZ=Europe/Berlin date +%H%M)
  [ "$dow" = "4" ] && [ "$((10#$hm))" -ge 1345 ] && [ "$((10#$hm))" -lt 1500 ]
}

ensure_npm() {
  command -v npm >/dev/null 2>&1 && return 0
  local d
  for d in "$HOME"/.nvm/versions/node/*/bin; do
    [ -x "$d/npm" ] && { export PATH="$d:$PATH"; return 0; }
  done
  return 1
}

sync_repo() {
  local repo="$1" g branch before after remote_ref
  g=(git -C "$repo")
  remote_ref="origin/$SYNC_BRANCH"
  if [ ! -d "$repo" ]; then add_result "$repo" missing "path does not exist"; return; fi
  if [ "$("${g[@]}" rev-parse --is-inside-work-tree 2>/dev/null)" != "true" ]; then
    add_result "$repo" not_git "not a git work tree"; return
  fi
  if [ -e "$repo/package.json" ] && in_thursday_window && [ -e "$repo/package-lock.json" ]; then
    add_result "$repo" skipped "Thursday 13:45-15:00 Berlin window: node checkout left alone"; return
  fi
  branch=$("${g[@]}" symbolic-ref --quiet --short HEAD 2>/dev/null || echo DETACHED)
  if [ "$branch" != "$SYNC_BRANCH" ]; then
    add_result "$repo" wrong_branch "checked out '$branch', expected '$SYNC_BRANCH'; left untouched"; return
  fi
  if [ -n "$("${g[@]}" status --porcelain --untracked-files=no 2>/dev/null)" ]; then
    add_result "$repo" dirty "tracked files modified; left untouched"; return
  fi
  before=$("${g[@]}" rev-parse HEAD)
  if ! timeout 180 "${g[@]}" fetch --prune --quiet origin; then
    add_result "$repo" fetch_failed "git fetch origin failed (network or credential)" "$before" "$before"; return
  fi
  local target
  target=$("${g[@]}" rev-parse --verify --quiet "refs/remotes/$remote_ref^{commit}") || {
    add_result "$repo" no_remote_ref "$remote_ref missing after fetch" "$before" "$before"; return; }
  if [ "$before" = "$target" ]; then
    add_result "$repo" up_to_date "at $remote_ref ${target:0:8}" "$before" "$before"; return
  fi
  if ! "${g[@]}" merge-base --is-ancestor "$before" "$target"; then
    if "${g[@]}" merge-base --is-ancestor "$target" "$before"; then
      add_result "$repo" ahead "HEAD ${before:0:8} is ahead of $remote_ref ${target:0:8}; left untouched" "$before" "$before"
    else
      add_result "$repo" diverged "HEAD ${before:0:8} and $remote_ref ${target:0:8} diverged; left untouched for a human" "$before" "$before"
    fi
    return
  fi
  if ! "${g[@]}" merge --ff-only --quiet "$target"; then
    add_result "$repo" ff_failed "git merge --ff-only failed; see journal" "$before" "$("${g[@]}" rev-parse HEAD)"; return
  fi
  after=$("${g[@]}" rev-parse HEAD)
  if [ "$SYNC_NPM_CI" = "1" ] && [ -e "$repo/package-lock.json" ] \
     && ! "${g[@]}" diff --quiet "$before" "$after" -- package-lock.json; then
    log "$repo: package-lock.json changed -> npm ci"
    if ! ensure_npm; then
      add_result "$repo" npm_missing "fast-forwarded but npm not found; run npm ci by hand" "$before" "$after"; return
    fi
    if ! (cd "$repo" && npm ci --no-audit --no-fund >&2); then
      add_result "$repo" npm_ci_failed "fast-forwarded but npm ci failed; run it by hand" "$before" "$after"; return
    fi
    if [ ! -x "$repo/node_modules/.bin/tsx" ]; then
      add_result "$repo" npm_ci_failed "npm ci finished but node_modules/.bin/tsx is missing" "$before" "$after"; return
    fi
  fi
  add_result "$repo" ok "fast-forwarded ${before:0:8} -> ${after:0:8}" "$before" "$after"
}

for r in $SYNC_REPOS; do sync_repo "$r"; done

if [ "$ANY_FAIL" = "1" ]; then
  printf '%s see %s\n' "$(date -u +%FT%TZ)" "$STATUS" > "$FAILFLAG"
  write_status failed
  exit 1
fi
rm -f "$FAILFLAG"
write_status ok
exit 0
