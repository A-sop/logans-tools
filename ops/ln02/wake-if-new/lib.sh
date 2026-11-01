#!/usr/bin/env bash
# Shared helpers for wake-if-new. Never print secret values, URLs with keys, or message bodies.
# shellcheck disable=SC2034

wake_iso_now() { date -u +%Y-%m-%dT%H:%M:%SZ; }

wake_job_upper() {
  printf '%s' "$1" | tr '[:lower:]' '[:upper:]'
}

# Parse literal KEY=VALUE lines (no shell source / expansion). Refuses mode wider than 600
# or owner ≠ current uid on POSIX. NTFS/MSYS cannot honour chmod 600 — skip mode there.
wake_load_env() {
  local f="${1:-}"
  [ -n "$f" ] && [ -f "$f" ] || return 0

  local mode owner me base enforce=1
  base="$(basename "$f")"
  case "$(uname -s 2>/dev/null || true)" in
    MINGW*|MSYS*|CYGWIN*) enforce=0 ;;
  esac
  case "$base" in
    *.example) enforce=0 ;;
  esac

  if [ "$enforce" = "1" ]; then
    mode="$(stat -c '%a' "$f" 2>/dev/null || stat -f '%OLp' "$f" 2>/dev/null || echo "")"
    owner="$(stat -c '%u' "$f" 2>/dev/null || stat -f '%u' "$f" 2>/dev/null || echo "")"
    me="$(id -u)"
    if [ -z "$mode" ] || [ -z "$owner" ]; then
      echo "wake_load_env: cannot stat $f" >&2
      return 1
    fi
    if [ "$owner" != "$me" ]; then
      echo "wake_load_env: refusing $f (owner is not current user)" >&2
      return 1
    fi
    case "$mode" in
      *[!0-7]*|????*)
        echo "wake_load_env: refusing $f (unrecognised mode $mode)" >&2
        return 1
        ;;
    esac
    if [ "$((8#$mode & 8#077))" -ne 0 ]; then
      echo "wake_load_env: refusing $f (mode $mode wider than 600)" >&2
      return 1
    fi
  fi

  local line key val
  while IFS= read -r line || [ -n "$line" ]; do
    line="${line%$'\r'}"
    case "$line" in
      ''|\#*) continue ;;
    esac
    case "$line" in
      *=*) ;;
      *) continue ;;
    esac
    key="${line%%=*}"
    val="${line#*=}"
    case "$key" in
      [A-Za-z_][A-Za-z0-9_]*) ;;
      *) continue ;;
    esac
    if [ "${#val}" -ge 2 ]; then
      case "$val" in
        \"*\") val="${val:1:${#val}-2}" ;;
        \'*\') val="${val:1:${#val}-2}" ;;
      esac
    fi
    printf -v "$key" '%s' "$val"
    export "$key"
  done <"$f"
}

wake_state_path() {
  printf '%s/%s.state.json' "${WAKE_STATE_DIR}" "$1"
}

wake_read_state() {
  # Sets: STATE_CURSOR STATE_LAST_WAKE STATE_ERRORS
  #        STATE_CURSOR_TELEGRAM STATE_CURSOR_MAIL STATE_CURSOR_STATUS
  local p
  p="$(wake_state_path "$1")"
  STATE_CURSOR=""; STATE_LAST_WAKE=""; STATE_ERRORS=0
  STATE_CURSOR_TELEGRAM=""; STATE_CURSOR_MAIL=""; STATE_CURSOR_STATUS=""
  [ -f "$p" ] || return 0
  STATE_CURSOR="$(sed -n 's/.*"cursor"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$p" | head -n1)"
  STATE_LAST_WAKE="$(sed -n 's/.*"last_wake"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$p" | head -n1)"
  STATE_ERRORS="$(sed -n 's/.*"consecutive_errors"[[:space:]]*:[[:space:]]*\([0-9][0-9]*\).*/\1/p' "$p" | head -n1)"
  STATE_ERRORS="${STATE_ERRORS:-0}"
  STATE_CURSOR_TELEGRAM="$(sed -n 's/.*"cursor_telegram"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$p" | head -n1)"
  STATE_CURSOR_MAIL="$(sed -n 's/.*"cursor_mail"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$p" | head -n1)"
  STATE_CURSOR_STATUS="$(sed -n 's/.*"cursor_status"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$p" | head -n1)"
}

# Args: job cursor last_wake errors [cursor_telegram cursor_mail cursor_status]
wake_write_state() {
  local job="$1" cursor="$2" last_wake="$3" errors="$4"
  local ct="${5-}" cm="${6-}" cs="${7-}"
  local p tmp
  p="$(wake_state_path "$job")"
  mkdir -p "$(dirname "$p")"
  tmp="${p}.tmp.$$"
  printf '{"cursor":"%s","cursor_telegram":"%s","cursor_mail":"%s","cursor_status":"%s","last_wake":"%s","consecutive_errors":%s,"updated_at":"%s"}\n' \
    "${cursor//\"/}" "${ct//\"/}" "${cm//\"/}" "${cs//\"/}" \
    "${last_wake//\"/}" "${errors}" "$(wake_iso_now)" >"$tmp"
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

# Strip only CR/LF and outer whitespace — never interior spaces (timestamptz corruption).
wake_trim_psql_field() {
  local s="$1"
  s="${s//$'\r'/}"
  s="${s//$'\n'/}"
  # leading/trailing space/tab only
  s="${s#"${s%%[![:space:]]*}"}"
  s="${s%"${s##*[![:space:]]}"}"
  printf '%s' "$s"
}

# Later of two ISO-8601 cursors (lexicographic works for zero-padded ISO). Empty loses.
wake_cursor_max() {
  local a="${1:-}" b="${2:-}"
  if [ -z "$a" ]; then printf '%s' "$b"; return 0; fi
  if [ -z "$b" ]; then printf '%s' "$a"; return 0; fi
  if [[ "$a" > "$b" ]]; then printf '%s' "$a"; else printf '%s' "$b"; fi
}

wake_urldecode() {
  local s="${1//+/ }"
  printf '%b' "${s//%/\\x}"
}

# Export PG* / PGPASSFILE from a postgres URL. Password never on argv.
wake_export_pg_from_url() {
  local url="$1"
  [ -n "$url" ] || return 1
  case "$url" in
    postgres://*|postgresql://*) ;;
    *)
      echo "wake_export_pg_from_url: unsupported URL scheme" >&2
      return 1
      ;;
  esac

  local rest userinfo hostpath hostport dbqs user pass host port db qs
  rest="${url#postgres://}"
  rest="${rest#postgresql://}"
  userinfo="${rest%%@*}"
  hostpath="${rest#*@}"
  if [ "$userinfo" = "$rest" ]; then
    echo "wake_export_pg_from_url: missing userinfo" >&2
    return 1
  fi

  user="${userinfo%%:*}"
  pass="${userinfo#*:}"
  if [ "$pass" = "$userinfo" ]; then pass=""; fi
  user="$(wake_urldecode "$user")"
  pass="$(wake_urldecode "$pass")"

  hostport="${hostpath%%/*}"
  dbqs="${hostpath#*/}"
  if [ "$hostport" = "$hostpath" ]; then
    dbqs=""
  fi
  case "$hostport" in
    *:*)
      host="${hostport%:*}"
      port="${hostport##*:}"
      ;;
    *)
      host="$hostport"
      port="5432"
      ;;
  esac

  db="${dbqs%%\?*}"
  qs=""
  case "$dbqs" in
    *\?*) qs="${dbqs#*\?}" ;;
  esac
  db="$(wake_urldecode "$db")"

  local sslmode="require"
  local pair k v
  IFS='&' read -r -a pairs <<<"$qs"
  for pair in "${pairs[@]+"${pairs[@]}"}"; do
    [ -n "$pair" ] || continue
    k="${pair%%=*}"
    v="${pair#*=}"
    case "$k" in
      sslmode) sslmode="$(wake_urldecode "$v")" ;;
    esac
  done

  export PGHOST="$host"
  export PGPORT="$port"
  export PGUSER="$user"
  export PGDATABASE="$db"
  export PGSSLMODE="$sslmode"
  export PGPASSWORD="$pass"

  local pgpass
  pgpass="$(mktemp "${TMPDIR:-/tmp}/wake-pgpass.XXXXXX")"
  chmod 600 "$pgpass"
  printf '%s:%s:%s:%s:%s\n' "$host" "$port" "$db" "$user" "$pass" >"$pgpass"
  export PGPASSFILE="$pgpass"
  WAKE_PGPASS_TMP="$pgpass"
}

wake_cleanup_pgpass() {
  if [ -n "${WAKE_PGPASS_TMP:-}" ] && [ -f "${WAKE_PGPASS_TMP}" ]; then
    rm -f "${WAKE_PGPASS_TMP}"
  fi
  unset WAKE_PGPASS_TMP
}

# Run psql from env URL — never put the URL on argv.
# Usage: wake_psql <url> [psql args...]
wake_psql() {
  local url="$1"
  shift
  if [ -z "$url" ]; then
    echo "wake_psql: database URL required" >&2
    return 1
  fi
  wake_export_pg_from_url "$url" || return 1
  local rc
  set +e
  psql -v ON_ERROR_STOP=1 "$@"
  rc=$?
  wake_cleanup_pgpass
  set +e
  return "$rc"
}

# POST webhook. Key and URL never appear on curl argv (curl --config + -H @file + body on stdin).
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
  if [ "${WAKE_DRY_RUN:-0}" = "1" ]; then
    return 0
  fi

  local tmp hdr cfg
  tmp="$(mktemp -d "${TMPDIR:-/tmp}/wake-curl.XXXXXX")"
  hdr="$tmp/hdr"
  cfg="$tmp/curl.cfg"
  printf '%s: %s\n' "$header_name" "$auth" >"$hdr"
  chmod 600 "$hdr" "$cfg" 2>/dev/null || true
  {
    printf 'url = "%s"\n' "${url//\\/\\\\}"
    printf 'header = "@%s"\n' "$hdr"
    printf 'header = "Content-Type: application/json"\n'
  } >"$cfg"

  local rc
  set +e
  printf '%s' "$body" | curl -sS -f -X POST \
    --config "$cfg" \
    -d @- \
    --max-time "${WAKE_HTTP_TIMEOUT:-30}" \
    >/dev/null
  rc=$?
  rm -rf "$tmp"
  set +e
  return "$rc"
}

wake_emit_check_result() {
  # Print one JSON line for the runner to parse.
  # Optional extra fields via WAKE_EMIT_EXTRA (already-formatted JSON fragment, e.g. ,"cursor_mail":"1")
  local ok="$1" decision="$2" cursor="$3" reason="$4" err="${5:-}"
  if [ "$ok" = "1" ]; then
    printf '{"ok":true,"decision":"%s","cursor":"%s","reason":"%s"%s}\n' \
      "$decision" "$cursor" "$reason" "${WAKE_EMIT_EXTRA:-}"
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
