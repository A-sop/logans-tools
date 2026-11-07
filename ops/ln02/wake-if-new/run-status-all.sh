#!/usr/bin/env bash
# Run status_div1..status_div7 sequentially (12:30 / 20:45 timer).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
rc=0
for d in 1 2 3 4 5 6 7; do
  if ! "$ROOT/runner.sh" "status_div$d"; then
    rc=1
  fi
done
exit "$rc"
