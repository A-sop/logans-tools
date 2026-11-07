# CLI bulk job prompt template (RR-010 item 4)

Copy this file, fill the **Task** section, keep the hard rules. One prompt = one job = a hard stop.
Launch with `ops/cli-jobs/run-cli-job.ps1` (HZR52) or `ops/cli-jobs/run-cli-job.sh` (ln02). Agents
read `<jobs-root>/<job>/<ts>/report.md` when done — no agent message chains.

## Hard rules (do not remove)

- Unattended, lean. Commit with `git -c user.name=Logan -c user.email=inbox@loganwilliams.com` when
  the task asks for commits.
- Never force-push; never touch `C:\Dev\logans-tools` or `C:\Dev\DABOS` main checkouts (read-only
  reads of DABOS files are fine when the task says so).
- Never read/print secrets, tokens or `.env` values; never list process command lines.
- No DABOS wiki paths/slugs in logans-tools text; never write `core.autocrlf` to shared config.
- No DB writes, no messages to anyone, unless the Task section explicitly requires a named write
  that Logan already approved.
- Never run on the LDW laptop. PII / DVAG / client / Paperless / bank / Twenty enrichment → HZR52
  only. Non-PII repo work may use ln02.
- Keep the job lean: finish the Task, write the report the runner captures, stop.

## Task

<!-- Replace this block with the single job. -->

1. …
2. …

## Report

When finished, summarise outcomes in your final reply (the runner saves stdout as `report.md`).
Include PR URLs / SHAs / test counts only when the Task asks for them.
