#!/usr/bin/env bash
# Shared helpers for comm-center courier + wake. Never print secrets, URLs with keys, or message bodies.
# shellcheck disable=SC2034

cc_iso_now() { date -u +%Y-%m-%dT%H:%M:%SZ; }

cc_post_upper() {
  printf '%s' "$1" | tr '[:lower:]' '[:upper:]'
}

cc_load_env() {
  local f="${1:-}"
  [ -n "$f" ] && [ -f "$f" ] || return 0
  set -a
  # shellcheck disable=SC1090
  . "$f"
  set +a
}

cc_state_path() {
  printf '%s/%s.state.json' "${CC_STATE_DIR}" "$1"
}

cc_read_state() {
  local p
  p="$(cc_state_path "$1")"
  STATE_LAST_WAKE=""
  STATE_ERRORS=0
  STATE_IN_STREAK=0
  [ -f "$p" ] || return 0
  STATE_LAST_WAKE=$(sed -n 's/.*"last_wake"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$p" | head -n1)
  STATE_ERRORS=$(sed -n 's/.*"consecutive_errors"[[:space:]]*:[[:space:]]*\([0-9][0-9]*\).*/\1/p' "$p" | head -n1)
  STATE_IN_STREAK=$(sed -n 's/.*"in_nonempty_streak"[[:space:]]*:[[:space:]]*\([0-9][0-9]*\).*/\1/p' "$p" | head -n1)
  STATE_ERRORS="${STATE_ERRORS:-0}"
  STATE_IN_STREAK="${STATE_IN_STREAK:-0}"
}

cc_write_state() {
  local post="$1" last_wake="$2" errors="$3" streak="$4"
  local p tmp
  p="$(cc_state_path "$post")"
  mkdir -p "$(dirname "$p")"
  tmp="${p}.tmp.$$"
  printf '{"last_wake":"%s","consecutive_errors":%s,"in_nonempty_streak":%s,"updated_at":"%s"}\n' \
    "${last_wake//\"/}" "${errors}" "${streak}" "$(cc_iso_now)" >"$tmp"
  mv -f "$tmp" "$p"
}

cc_log_json() {
  local ts pair k v line
  local post_id="${POST}"
  ts="$(cc_iso_now)"
  line=$(printf '{"ts":"%s","post":"%s"' "$ts" "$post_id")
  for pair in "$@"; do
    k="${pair%%=*}"
    v="${pair#*=}"
    line+=$(printf ',"%s":"%s"' "$k" "${v//\"/\\\"}")
  done
  line+='}'
  mkdir -p "$(dirname "$CC_LOG_FILE")"
  printf '%s\n' "$line" >>"${CC_LOG_FILE}"
}

cc_csv_append() {
  local post="$1" decision="$2"
  mkdir -p "$(dirname "$CC_CSV_FILE")"
  [ -f "$CC_CSV_FILE" ] || printf 'post,ts,decision\n' >"$CC_CSV_FILE"
  printf '%s,%s,%s\n' "$post" "$(cc_iso_now)" "$decision" >>"$CC_CSV_FILE"
}

cc_post_webhook() {
  local url="$1" key="$2" body="$3"
  local header_name="${WAKE_KEY_HEADER:-Authorization}"
  local scheme="${WAKE_KEY_SCHEME:-Bearer}"
  local auth
  if [ -n "$scheme" ]; then
    auth="${scheme} ${key}"
  else
    auth="$key"
  fi
  if [ "${CC_DRY_RUN:-0}" = "1" ] || [ "${WAKE_DRY_RUN:-0}" = "1" ]; then
    return 0
  fi
  curl -sS -f -X POST \
    -H "${header_name}: ${auth}" \
    -H "Content-Type: application/json" \
    -d "$body" \
    --max-time "${WAKE_HTTP_TIMEOUT:-30}" \
    "$url" >/dev/null
}

# Berlin "now" parts: CC_DOW (mon..sun) CC_HM (HH:MM)
cc_berlin_now() {
  local tz="${COMM_TZ:-Europe/Berlin}"
  CC_DOW=$(TZ="$tz" date +%a | tr '[:upper:]' '[:lower:]')
  case "$CC_DOW" in
    mon|tue|wed|thu|fri|sat|sun) ;;
    *) CC_DOW=$(TZ="$tz" date +%A | cut -c1-3 | tr '[:upper:]' '[:lower:]') ;;
  esac
  CC_HM=$(TZ="$tz" date +%H:%M)
}

# Collect COMM_CLOCK_<STEM>* values into CC_CLOCK_ENTRIES (newline-separated).
cc_collect_clocks() {
  local stem="$1"
  local prefix="COMM_CLOCK_${stem}"
  CC_CLOCK_ENTRIES=""
  while IFS='=' read -r k v; do
    case "$k" in
      "$prefix"|"$prefix"_*)
        CC_CLOCK_ENTRIES+="${v}"$'\n'
        ;;
    esac
  done < <(compgen -e | while read -r name; do
    printf '%s=%s\n' "$name" "${!name}"
  done)
}

# Return 0 if HH:MM matches a COMM_CLOCK_* entry for post (considering dow).
# Courier offset: if CC_COURIER_MODE=1, match when configured slot == now+1min.
cc_post_due_now() {
  local post="$1"
  local stem want_hm entry times dow_rule t
  stem="$(cc_post_upper "$post")"
  cc_berlin_now
  want_hm="$CC_HM"
  if [ "${CC_COURIER_MODE:-0}" = "1" ]; then
    local tz="${COMM_TZ:-Europe/Berlin}"
    want_hm=$(TZ="$tz" date -d "1 minute" +%H:%M 2>/dev/null || TZ="$tz" date -v+1M +%H:%M 2>/dev/null || echo "")
    [ -n "$want_hm" ] || want_hm="$CC_HM"
  fi

  cc_collect_clocks "$stem"
  while IFS= read -r entry; do
    [ -n "$entry" ] || continue
    times="${entry%%;*}"
    dow_rule="daily"
    case "$entry" in
      *";dow="*) dow_rule="${entry#*;dow=}" ;;
    esac
    case "$dow_rule" in
      daily) ;;
      thu) [ "$CC_DOW" = "thu" ] || continue ;;
      mon-fri)
        case "$CC_DOW" in mon|tue|wed|thu|fri) ;; *) continue ;; esac
        ;;
      sat-sun)
        case "$CC_DOW" in sat|sun) ;; *) continue ;; esac
        ;;
      *) continue ;;
    esac
    oldifs=$IFS
    IFS=','
    # shellcheck disable=SC2086
    set -- $times
    IFS=$oldifs
    for t in "$@"; do
      t=$(printf '%s' "$t" | tr -d '[:space:]')
      [ "$t" = "$want_hm" ] && return 0
    done
  done <<< "$CC_CLOCK_ENTRIES"
  return 1
}
