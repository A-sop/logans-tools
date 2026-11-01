#!/usr/bin/env bash
# Shared helpers for wake-if-new. Never print secret values, URLs with keys, or message bodies.
# shellcheck disable=SC2034

wake_iso_now() { date -u +%Y-%m-%dT%H:%M:%SZ; }

wake_job_upper() {
  printf '%s' "$1" | tr '[:lower:]' '[:upper:]'
}

# Load KEY=VALUE lines from env file into the current shell. Values stay in memory only.
wake_load_env() {
  local f="${1:-}"
  [ -n "$f" ] && [ -f "$f" ] || return 0
  set -a
  # shellcheck disable=SC1090
  # Env file is KEY=VALUE lines placed by Logan (mode 600). Values are never logged.
  . "$f"
  set +a
}

wake_state_path() {
  printf '%s/%s.state.json' "${WAKE_STATE_DIR}" "$1"
}

wake_read_state() {
  # Sets: STATE_CURSOR STATE_LAST_WAKE STATE_ERRORS (defaults empty/0)
  local p; p="$(wake_state_path "$1")"
  STATE_CURSOR=""; STATE_LAST_WAKE=""; STATE_ERRORS=0
  [ -f "$p" ] || return 0
  STATE_CURSOR="$(sed -n 's/.*"cursor"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$p" | head -n1)"
  STATE_LAST_WAKE="$(sed -n 's/.*"last_wake"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$p" | head -n1)"
  STATE_ERRORS="$(sed -n 's/.*"consecutive_errors"[[:space:]]*:[[:space:]]*\([0-9][0-9]*\).*/\1/p' "$p" | head -n1)"
  STATE_ERRORS="${STATE_ERRORS:-0}"
}

wake_write_state() {
  local job="$1" cursor="$2" last_wake="$3" errors="$4"
  local p tmp
  p="$(wake_state_path "$job")"
  mkdir -p "$(dirname "$p")"
  tmp="${p}.tmp.$$"
  printf '{"cursor":"%s","last_wake":"%s","consecutive_errors":%s,"updated_at":"%s"}\n' \
    "${cursor//\"/}" "${last_wake//\"/}" "${errors}" "$(wake_iso_now)" >"$tmp"
  mv -f "$tmp" "$p"
}

wake_log_json() {
  # Args as key=value pairs; never pass secret values.
  local ts job_id="$JOB" pair k v line
  ts="$(wake_iso_now)"
  line="$(printf '{"ts":"%s","job":"%s"' "$ts" "$job_id")"
  for pair in "$@"; do
    k="${pair%%=*}"; v="${pair#*=}"
    line+="$(printf ',"%s":"%s"' "$k" "${v//\"/\\\"}")"
  done
  line+='}'
  mkdir -p "$(dirname "$WAKE_LOG_FILE")"
  printf '%s\n' "$line" >>"${WAKE_LOG_FILE}"
}

wake_csv_append() {
  local job="$1" decision="$2"
  mkdir -p "$(dirname "$WAKE_CSV_FILE")"
  [ -f "$WAKE_CSV_FILE" ] || printf 'job,ts,decision\n' >"$WAKE_CSV_FILE"
  printf '%s,%s,%s\n' "$job" "$(wake_iso_now)" "$decision" >>"$WAKE_CSV_FILE"
}

# POST webhook. Body is a small JSON object (no secrets). Returns 0 on HTTP 2xx.
wake_post_webhook() {
  local url="$1" key="$2" body="$3"
  local header_name="${WAKE_KEY_HEADER:-Authorization}"
  local scheme="${WAKE_KEY_SCHEME:-Bearer}"
  local auth
  if [ -n "$scheme" ]; then
    auth="${scheme} ${key}"
  else
    auth="$key"
  fi
  # Do not log url, key, or auth. curl -sS; fail on HTTP errors via -f when not dry-run.
  if [ "${WAKE_DRY_RUN:-0}" = "1" ]; then
    return 0
  fi
  curl -sS -f -X POST \
    -H "${header_name}: ${auth}" \
    -H 'Content-Type: application/json' \
    -d "$body" \
    --max-time "${WAKE_HTTP_TIMEOUT:-30}" \
    "$url" >/dev/null
}

wake_emit_check_result() {
  # Print one JSON line for the runner to parse.
  local ok="$1" decision="$2" cursor="$3" reason="$4" err="${5:-}"
  if [ "$ok" = "1" ]; then
    printf '{"ok":true,"decision":"%s","cursor":"%s","reason":"%s"}\n' "$decision" "$cursor" "$reason"
  else
    printf '{"ok":false,"error":"%s"}\n' "${err:-check-failed}"
  fi
}

# Accept ISO-8601-ish cursors only (digits, T, Z, :, ., -, +). Reject anything else.
wake_validate_cursor() {
  local c="${1:-}"
  if [ -z "$c" ]; then
    printf '%s' "1970-01-01T00:00:00Z"
    return 0
  fi
  case "$c" in
    *[!0-9TZ:+.-]*) return 1 ;;
  esac
  printf '%s' "$c"
}

wake_validate_uid_cursor() {
  local c="${1:-0}"
  case "$c" in
    ''|*[!0-9]*) printf '0' ;;
    *) printf '%s' "$c" ;;
  esac
}
