# CLI bulk job runner — Amendment 1 (Dept13 FAIL @cf7d727f round, 1 Nov 2026)

Committed on its own, after the base acceptance and before any further code on this round.
Dept13 checks the build against the base acceptance as amended by this file.
Verdict format: exact first line `Dept13 PASS|FAIL @<full 40-hex sha>` (no CONDITIONAL).

## A1.1 run-cli-job.sh committed executable

`ops/cli-jobs/run-cli-job.sh` is git mode `100755` so the flock concurrent path (and ln02) can
exec it directly. Full suite green including the concurrent-lock test (no CHILD_RC=126).

## A1.2 Runbook: owner post, schedule, creds path

`src/docs/dabos/cli-bulk-jobs.md` names: owner post (Div4 / Dept11), schedule (explicit
on-demand-only if no timer), and config/creds path **names only** for the CLI agent login on
each host (no secret values).

## A1.3 Unique run IDs; lock before any write

A blocked/concurrent run in the same second must not overwrite the running job's `status.json`
or `run.log`. Run directories are unique (PID/random), and the lock is checked before any run-dir
write. A test covers same-second collision.

## A1.4 PowerShell prompt quoting + spaces test

`run-cli-job.ps1` must not pass the prompt unquoted through `Start-Process -ArgumentList` in a
way that splits on spaces. Quote properly or pass prompt-via-file. A test covers a prompt and
path that contain spaces.

## A1.5 Configurable timeout

Runner has a configurable max runtime (sensible default). On expiry it kills the process tree
and records a timeout status. Documented in the runbook.
