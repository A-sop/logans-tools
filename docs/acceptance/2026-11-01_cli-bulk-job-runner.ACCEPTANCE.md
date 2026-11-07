# Acceptance: Cursor CLI bulk job runner + runbook (RR-010 item 4)

Recorded before any code. Ordered by Logan on Sun 1 Nov 2026 ~18:51 Berlin via LDW
Communicator ("make it happen now" / "set that up now") for RR-010 items 3 and 4. Built by Div4.
Gate: Dept13 PASS before anything is relied on in production. No secrets in logs. Never run these
jobs on the LDW laptop. No messages to anyone in the build session.

## Purpose

One unattended Cursor CLI job from a prompt file, on HZR52 (PowerShell) or ln02 (bash). Agents
launch a job and read its report; no agent message chains.

## Acceptance lines

1. Scripts: `ops/cli-jobs/run-cli-job.ps1` (HZR52) and `ops/cli-jobs/run-cli-job.sh` (ln02).
   Invocation: `run-cli-job <job-name> <prompt-file> [--workdir <path>]` (PowerShell also accepts
   `-JobName` / `-PromptFile` / `-WorkDir`).
2. One lock per job name (second concurrent run for the same name exits non-zero without starting
   the CLI).
3. Each run creates `<jobs-root>/<job>/<ts>/` with `report.md` (CLI text output), `status.json`
   (exit code, started/ended timestamps, host, workdir, prompt path — never the prompt body or any
   command line), and a log file. Default jobs-root: HZR52
   `%LOCALAPPDATA%\dabos\cli-jobs`, ln02 `~/.local/state/dabos/cli-jobs`.
4. CLI binary: HZR52 `C:\Users\LDW_HZR52\AppData\Local\cursor-agent\agent.ps1`; ln02
   `~/.local/bin/agent`. Flags always: `-p --force --output-format text`. Command lines are never
   echoed (they can carry keys).
5. Runbook `src/docs/dabos/cli-bulk-jobs.md`: when to use HZR52 (PII: DVAG/client data, Paperless,
   bank imports, Twenty enrichment) vs ln02; keep jobs lean (one prompt, one job, hard stop);
   never on the LDW laptop; agents launch a job and read the report.
6. Prompt template `ops/cli-jobs/prompt-template.md` with the hard rules from the RR-010 unattended
   build (no force-push, no secrets, no DABOS wiki paths/slugs in logans-tools text, etc.).
7. Tests where practical (lock, report path convention, status recording, no command-line echo).
   Full suite green on the PR head aside from known pre-existing CRLF mutation flakes.
