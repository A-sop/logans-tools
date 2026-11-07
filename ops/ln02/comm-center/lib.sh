#!/usr/bin/env bash
# Shared helpers for comm-center courier + wake. Never print secrets, URLs with keys, or message bodies.
# shellcheck disable=SC2034

cc_iso_now() { date -u +%Y-%m-%dT%H:%M:%SZ; }

cc_post_upper() {
  printf '%s' "$1" | tr '[:lower:]' '[:upper:]'
}

# Parse literal KEY=VALUE lines (no shell source / expansion). Refuses mode wider than 600
# or owner ≠ current uid, except *.example files (clocks templates; no secrets).
cc_load_env() {
  local f="${1:-}"
  [ -n "$f" ] && [ -f "$f" ] || return 0

  local mode owner me base enforce=1
  base="$(basename "$f")"
  # NTFS under MSYS/MINGW often cannot honour chmod 600; ln02 is Linux and enforces.
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
      echo "cc_load_env: cannot stat $f" >&2
      return 1
    fi
    if [ "$owner" != "$me" ]; then
      echo "cc_load_env: refusing $f (owner is not current user)" >&2
      return 1
    fi
    # Wider than 600 ⇒ any group/other permission bit set (mode & 077 != 0).
    case "$mode" in
      *[!0-7]*|????*)
        echo "cc_load_env: refusing $f (unrecognised mode $mode)" >&2
        return 1
        ;;
    esac
    if [ "$((8#$mode & 8#077))" -ne 0 ]; then
      echo "cc_load_env: refusing $f (mode $mode wider than 600)" >&2
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
    # Strip one layer of matching single or double quotes only (literal; no expansion).
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

# Percent-decode for URL userinfo / path segments (best-effort; no secrets logged).
cc_urldecode() {
  local s="${1//+/ }"
  printf '%b' "${s//%/\\x}"
}

# Export PG* / PGPASSFILE from a postgres URL. Never prints the URL or password.
# Password goes to PGPASSFILE (mode 600) and PGPASSWORD; never on argv.
cc_export_pg_from_url() {
  local url="$1"
  [ -n "$url" ] || return 1
  case "$url" in
    postgres://*|postgresql://*) ;;
    *)
      echo "cc_export_pg_from_url: unsupported URL scheme" >&2
      return 1
      ;;
  esac

  local rest userinfo hostpath hostport dbqs user pass host port db qs
  rest="${url#postgres://}"
  rest="${rest#postgresql://}"
  userinfo="${rest%%@*}"
  hostpath="${rest#*@}"
  if [ "$userinfo" = "$rest" ]; then
    echo "cc_export_pg_from_url: missing userinfo" >&2
    return 1
  fi

  user="${userinfo%%:*}"
  pass="${userinfo#*:}"
  if [ "$pass" = "$userinfo" ]; then pass=""; fi
  user="$(cc_urldecode "$user")"
  pass="$(cc_urldecode "$pass")"

  hostport="${hostpath%%/*}"
  dbqs="${hostpath#*/}"
  if [ "$hostport" = "$hostpath" ]; then
    dbqs=""
  fi
  case "$hostport" in
    \[*\].*) # unlikely IPv6 — take as host only if no port parse
      host="$hostport"
      port="5432"
      ;;
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
  db="$(cc_urldecode "$db")"

  local sslmode="require"
  local pair k v
  IFS='&' read -r -a pairs <<<"$qs"
  for pair in "${pairs[@]+"${pairs[@]}"}"; do
    [ -n "$pair" ] || continue
    k="${pair%%=*}"
    v="${pair#*=}"
    case "$k" in
      sslmode) sslmode="$(cc_urldecode "$v")" ;;
    esac
  done

  export PGHOST="$host"
  export PGPORT="$port"
  export PGUSER="$user"
  export PGDATABASE="$db"
  export PGSSLMODE="$sslmode"
  export PGPASSWORD="$pass"

  local pgpass
  pgpass="$(mktemp "${TMPDIR:-/tmp}/cc-pgpass.XXXXXX")"
  chmod 600 "$pgpass"
  # hostname:port:database:username:password
  printf '%s:%s:%s:%s:%s\n' "$host" "$port" "$db" "$user" "$pass" >"$pgpass"
  export PGPASSFILE="$pgpass"
  CC_PGPASS_TMP="$pgpass"
}

cc_cleanup_pgpass() {
  if [ -n "${CC_PGPASS_TMP:-}" ] && [ -f "${CC_PGPASS_TMP}" ]; then
    rm -f "${CC_PGPASS_TMP}"
  fi
  unset CC_PGPASS_TMP
}

# Run psql with connection from env URL helpers — never put the URL on argv.
cc_psql() {
  local url="${COMM_CENTER_DATABASE_URL:-${WAKE_DATABASE_URL:-${DATABASE_URL:-}}}"
  if [ -z "$url" ]; then
    echo "cc_psql: COMM_CENTER_DATABASE_URL (or WAKE_DATABASE_URL) required" >&2
    return 1
  fi
  cc_export_pg_from_url "$url" || return 1
  local rc had_e=$-
  set +e
  psql -v ON_ERROR_STOP=1 "$@"
  rc=$?
  cc_cleanup_pgpass
  [[ $had_e == *e* ]] && set -e
  return "$rc"
}

# POST webhook. Key and URL never appear on curl argv (curl --config + -H @file + body on stdin).
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

  local tmp hdr cfg
  tmp="$(mktemp -d "${TMPDIR:-/tmp}/cc-curl.XXXXXX")"
  hdr="$tmp/hdr"
  cfg="$tmp/curl.cfg"
  printf '%s: %s\n' "$header_name" "$auth" >"$hdr"
  chmod 600 "$hdr" "$cfg" 2>/dev/null || true
  # curl config: url + headers via @file — no secret in process argv list.
  {
    printf 'url = "%s"\n' "${url//\\/\\\\}"
    printf 'header = "@%s"\n' "$hdr"
    printf 'header = "Content-Type: application/json"\n'
  } >"$cfg"

  local rc had_e=$-
  set +e
  printf '%s' "$body" | curl -sS -f -X POST \
    --config "$cfg" \
    -d @- \
    --max-time "${WAKE_HTTP_TIMEOUT:-30}" \
    >/dev/null
  rc=$?
  rm -rf "$tmp"
  [[ $had_e == *e* ]] && set -e
  return "$rc"
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
