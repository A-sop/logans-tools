#!/usr/bin/env bash
# Run one unattended Cursor CLI job from a prompt file (ln02).
# Usage: run-cli-job.sh <job-name> <prompt-file> [--workdir <path>]
# Never echoes the agent command line (may carry keys). RR-010 item 4.
set -euo pipefail

JOB_NAME="${1:-}"; shift || true
PROMPT_FILE="${1:-}"; shift || true
WORKDIR=""
JOBS_ROOT="${JOBS_ROOT:-$HOME/.local/state/dabos/cli-jobs}"
AGENT_BIN="${AGENT_BIN:-$HOME/.local/bin/agent}"

while [ $# -gt 0 ]; do
  case "$1" in
    --workdir|-workdir) WORKDIR="${2:-}"; shift 2 ;;
    -h|--help)
      echo "usage: run-cli-job <job-name> <prompt-file> [--workdir <path>]"
      exit 0
      ;;
    *) echo "unknown argument: $1" >&2; exit 64 ;;
  esac
done

if [ -z "$JOB_NAME" ] || [ -z "$PROMPT_FILE" ]; then
  echo "usage: run-cli-job <job-name> <prompt-file> [--workdir <path>]" >&2
  exit 64
fi
case "$JOB_NAME" in
  *[!a-zA-Z0-9._-]*|"") echo "invalid job name" >&2; exit 64 ;;
esac
[ -f "$PROMPT_FILE" ] || { echo "prompt file not found" >&2; exit 1; }
PROMPT_FILE="$(cd "$(dirname "$PROMPT_FILE")" && pwd)/$(basename "$PROMPT_FILE")"
WORKDIR="${WORKDIR:-$(pwd)}"
[ -d "$WORKDIR" ] || { echo "workdir not found" >&2; exit 1; }
WORKDIR="$(cd "$WORKDIR" && pwd)"
[ -x "$AGENT_BIN" ] || [ -f "$AGENT_BIN" ] || { echo "agent CLI not found" >&2; exit 1; }

TS="$(date -u +%Y%m%dT%H%M%S)"
RUN_DIR="$JOBS_ROOT/$JOB_NAME/$TS"
mkdir -p "$RUN_DIR" "$JOBS_ROOT/_locks"
REPORT="$RUN_DIR/report.md"
STATUS="$RUN_DIR/status.json"
LOG="$RUN_DIR/run.log"
LOCK="$JOBS_ROOT/_locks/${JOB_NAME}.lock"

write_status() {
  local code="$1" err="${2:-}"
  local ended
  ended="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  if [ -n "$err" ]; then
    printf '{"job":"%s","exit_code":%s,"error":"%s","host":"%s","workdir":"%s","prompt_path":"%s","started_at":"%s","ended_at":"%s","report":"%s"}\n' \
      "$JOB_NAME" "$code" "$err" "$(hostname)" "$WORKDIR" "$PROMPT_FILE" "$STARTED" "$ended" "$REPORT" >"$STATUS"
  else
    printf '{"job":"%s","exit_code":%s,"host":"%s","workdir":"%s","prompt_path":"%s","started_at":"%s","ended_at":"%s","report":"%s"}\n' \
      "$JOB_NAME" "$code" "$(hostname)" "$WORKDIR" "$PROMPT_FILE" "$STARTED" "$ended" "$REPORT" >"$STATUS"
  fi
}

LOCK_DIR="${LOCK}.d"
release_lock() {
  if command -v flock >/dev/null 2>&1; then
    :
  else
    rmdir "$LOCK_DIR" 2>/dev/null || true
  fi
}
if command -v flock >/dev/null 2>&1; then
  exec 9>"$LOCK"
  if ! flock -n 9; then
    STARTED="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    write_status 75 lock-busy
    echo lock-busy >>"$LOG"
    exit 75
  fi
else
  # Portable lock (e.g. Git Bash): mkdir is atomic
  if ! mkdir "$LOCK_DIR" 2>/dev/null; then
    STARTED="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    write_status 75 lock-busy
    echo lock-busy >>"$LOG"
    exit 75
  fi
  trap release_lock EXIT
fi

STARTED="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
printf '{"job":"%s","exit_code":null,"host":"%s","workdir":"%s","prompt_path":"%s","started_at":"%s","ended_at":null,"report":"%s"}\n' \
  "$JOB_NAME" "$(hostname)" "$WORKDIR" "$PROMPT_FILE" "$STARTED" "$REPORT" >"$STATUS"
echo "started job=$JOB_NAME" >>"$LOG"

# Do not echo argv. Prompt body stays in the file; agent is told the path.
AGENT_PROMPT="Read the prompt file at ${PROMPT_FILE} and carry it out completely. Work in ${WORKDIR}. Write nothing that contains secrets."
set +e
(
  cd "$WORKDIR"
  # Intentionally unlogged invocation:
  "$AGENT_BIN" -p --force --output-format text -- "$AGENT_PROMPT" >"$REPORT" 2>"$RUN_DIR/stderr.txt"
)
RC=$?
set -e

if [ -f "$RUN_DIR/stderr.txt" ]; then
  echo "stderr_bytes=$(wc -c <"$RUN_DIR/stderr.txt" | tr -d ' ')" >>"$LOG"
fi
echo "ended exit=$RC" >>"$LOG"
write_status "$RC"
exit "$RC"
