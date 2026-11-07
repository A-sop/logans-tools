#!/usr/bin/env bash
# Run one unattended Cursor CLI job from a prompt file (ln02).
# Usage: run-cli-job.sh <job-name> <prompt-file> [--workdir <path>] [--timeout <sec>]
# Never echoes the agent command line (may carry keys). RR-010 item 4.
set -euo pipefail

JOB_NAME="${1:-}"; shift || true
PROMPT_FILE="${1:-}"; shift || true
WORKDIR=""
JOBS_ROOT="${JOBS_ROOT:-$HOME/.local/state/dabos/cli-jobs}"
AGENT_BIN="${AGENT_BIN:-$HOME/.local/bin/agent}"
# Sensible default: 30 minutes. Override with CLI_JOB_TIMEOUT_SEC or --timeout.
TIMEOUT_SEC="${CLI_JOB_TIMEOUT_SEC:-1800}"

while [ $# -gt 0 ]; do
  case "$1" in
    --workdir|-workdir) WORKDIR="${2:-}"; shift 2 ;;
    --timeout|-timeout) TIMEOUT_SEC="${2:-}"; shift 2 ;;
    -h|--help)
      echo "usage: run-cli-job <job-name> <prompt-file> [--workdir <path>] [--timeout <sec>]"
      exit 0
      ;;
    *) echo "unknown argument: $1" >&2; exit 64 ;;
  esac
done

if [ -z "$JOB_NAME" ] || [ -z "$PROMPT_FILE" ]; then
  echo "usage: run-cli-job <job-name> <prompt-file> [--workdir <path>] [--timeout <sec>]" >&2
  exit 64
fi
case "$JOB_NAME" in
  *[!a-zA-Z0-9._-]*|"") echo "invalid job name" >&2; exit 64 ;;
esac
case "$TIMEOUT_SEC" in
  ''|*[!0-9]*|0) echo "invalid timeout" >&2; exit 64 ;;
esac
[ -f "$PROMPT_FILE" ] || { echo "prompt file not found" >&2; exit 1; }
PROMPT_FILE="$(cd "$(dirname "$PROMPT_FILE")" && pwd)/$(basename "$PROMPT_FILE")"
WORKDIR="${WORKDIR:-$(pwd)}"
[ -d "$WORKDIR" ] || { echo "workdir not found" >&2; exit 1; }
WORKDIR="$(cd "$WORKDIR" && pwd)"
[ -x "$AGENT_BIN" ] || [ -f "$AGENT_BIN" ] || { echo "agent CLI not found" >&2; exit 1; }

mkdir -p "$JOBS_ROOT/_locks"
LOCK="$JOBS_ROOT/_locks/${JOB_NAME}.lock"
LOCK_DIR="${LOCK}.d"

# Unique run id: timestamp + PID + random so same-second runs never share a directory.
TS="$(date -u +%Y%m%dT%H%M%S)"
RUN_ID="${TS}_$$_${RANDOM:-$RANDOM}"
RUN_DIR="$JOBS_ROOT/$JOB_NAME/$RUN_ID"
REPORT=""
STATUS=""
LOG=""
STARTED=""

init_run_dir() {
  mkdir -p "$RUN_DIR"
  REPORT="$RUN_DIR/report.md"
  STATUS="$RUN_DIR/status.json"
  LOG="$RUN_DIR/run.log"
}

write_status() {
  local code="$1" err="${2:-}"
  local ended
  ended="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  if [ -n "$err" ]; then
    printf '{"job":"%s","run_id":"%s","exit_code":%s,"error":"%s","host":"%s","workdir":"%s","prompt_path":"%s","started_at":"%s","ended_at":"%s","report":"%s","timeout_sec":%s}\n' \
      "$JOB_NAME" "$RUN_ID" "$code" "$err" "$(hostname)" "$WORKDIR" "$PROMPT_FILE" "$STARTED" "$ended" "$REPORT" "$TIMEOUT_SEC" >"$STATUS"
  else
    printf '{"job":"%s","run_id":"%s","exit_code":%s,"host":"%s","workdir":"%s","prompt_path":"%s","started_at":"%s","ended_at":"%s","report":"%s","timeout_sec":%s}\n' \
      "$JOB_NAME" "$RUN_ID" "$code" "$(hostname)" "$WORKDIR" "$PROMPT_FILE" "$STARTED" "$ended" "$REPORT" "$TIMEOUT_SEC" >"$STATUS"
  fi
}

release_lock() {
  if command -v flock >/dev/null 2>&1; then
    :
  else
    rmdir "$LOCK_DIR" 2>/dev/null || true
  fi
}

# TERM then KILL the whole process group (leader PID == PGID when started via setsid).
kill_agent_group() {
  local pid="$1"
  if [ -z "$pid" ]; then
    return 0
  fi
  # Negative PID = process group. Fall back to the single PID if group kill fails.
  kill -TERM -- "-$pid" 2>/dev/null || kill -TERM "$pid" 2>/dev/null || true
  sleep 1
  kill -KILL -- "-$pid" 2>/dev/null || kill -KILL "$pid" 2>/dev/null || true
}

# Lock BEFORE any write to a run directory (blocked runs must not touch a running job's files).
if command -v flock >/dev/null 2>&1; then
  exec 9>"$LOCK"
  if ! flock -n 9; then
    init_run_dir
    STARTED="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    write_status 75 lock-busy
    echo lock-busy >>"$LOG"
    exit 75
  fi
else
  # Portable lock (e.g. Git Bash): mkdir is atomic
  if ! mkdir "$LOCK_DIR" 2>/dev/null; then
    init_run_dir
    STARTED="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    write_status 75 lock-busy
    echo lock-busy >>"$LOG"
    exit 75
  fi
  trap release_lock EXIT
fi

init_run_dir
STARTED="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
printf '{"job":"%s","run_id":"%s","exit_code":null,"host":"%s","workdir":"%s","prompt_path":"%s","started_at":"%s","ended_at":null,"report":"%s","timeout_sec":%s}\n' \
  "$JOB_NAME" "$RUN_ID" "$(hostname)" "$WORKDIR" "$PROMPT_FILE" "$STARTED" "$REPORT" "$TIMEOUT_SEC" >"$STATUS"
echo "started job=$JOB_NAME run_id=$RUN_ID timeout_sec=$TIMEOUT_SEC" >>"$LOG"

# Do not echo argv. Prompt body stays in the file; agent is told the path.
AGENT_PROMPT="Read the prompt file at ${PROMPT_FILE} and carry it out completely. Work in ${WORKDIR}. Write nothing that contains secrets."
set +e
# Own session/process group so timeout can TERM/KILL the whole tree. Close lock fd 9
# in the child so a surviving agent cannot keep the flock.
set +m
if command -v setsid >/dev/null 2>&1; then
  (
    cd "$WORKDIR"
    exec 9>&-
    # Intentionally unlogged invocation:
    exec setsid "$AGENT_BIN" -p --force --output-format text -- "$AGENT_PROMPT" >"$REPORT" 2>"$RUN_DIR/stderr.txt"
  ) &
else
  # No setsid (e.g. Git Bash): enable job control so the background job gets its own PG.
  set -m
  (
    cd "$WORKDIR"
    exec 9>&-
    # Intentionally unlogged invocation:
    "$AGENT_BIN" -p --force --output-format text -- "$AGENT_PROMPT" >"$REPORT" 2>"$RUN_DIR/stderr.txt"
  ) &
  set +m
fi
AGENT_PID=$!
elapsed=0
TIMED_OUT=0
while kill -0 "$AGENT_PID" 2>/dev/null; do
  if [ "$elapsed" -ge "$TIMEOUT_SEC" ]; then
    TIMED_OUT=1
    kill_agent_group "$AGENT_PID"
    wait "$AGENT_PID" 2>/dev/null || true
    break
  fi
  sleep 1
  elapsed=$((elapsed + 1))
done
if [ "$TIMED_OUT" -eq 0 ]; then
  wait "$AGENT_PID"
  RC=$?
else
  RC=124
fi
set -e

if [ -f "$RUN_DIR/stderr.txt" ]; then
  echo "stderr_bytes=$(wc -c <"$RUN_DIR/stderr.txt" | tr -d ' ')" >>"$LOG"
fi
if [ "$TIMED_OUT" -eq 1 ]; then
  echo "ended exit=124 error=timeout" >>"$LOG"
  if [ ! -f "$REPORT" ]; then
    echo '# timed out before report' >"$REPORT"
  fi
  write_status 124 timeout
  exit 124
fi
echo "ended exit=$RC" >>"$LOG"
write_status "$RC"
exit "$RC"
