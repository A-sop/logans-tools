# Cursor CLI bulk jobs (RR-010 item 4)

Unattended one-shot Cursor CLI runs. An agent **launches** a job and later **reads the report** —
no back-and-forth message chains. Never on the LDW laptop.

## Owner and schedule

- Owner post: **Div4 / Dept11**.
- Schedule: **on-demand only** — no systemd timer, no Windows Task Scheduler entry, no cron.
  An agent or operator starts one job; nothing wakes these runners on a clock.

## Host choice

| Host | Use when |
|---|---|
| **HZR52** | PII / restricted: DVAG or client data, Paperless, bank imports, Twenty enrichment, anything under `C:\DATA` that must stay local |
| **ln02** | Non-PII repo / ops work (public A-sop repos, ln02 systemd, Neon via approved env names only) |
| **LDW laptop** | **Never** for these jobs |

## Commands

HZR52 (PowerShell):

```powershell
powershell -NoProfile -File C:\Dev\logans-tools\ops\cli-jobs\run-cli-job.ps1 `
  <job-name> <prompt-file> --workdir <path> [--timeout <sec>]
```

ln02 (bash):

```bash
bash ~/Dev/logans-tools/ops/cli-jobs/run-cli-job.sh \
  <job-name> <prompt-file> --workdir <path> [--timeout <sec>]
```

CLI binaries (do not log the full command line — keys may appear in the process environment):

- HZR52: `C:\Users\LDW_HZR52\AppData\Local\cursor-agent\agent.ps1`
- ln02: `~/.local/bin/agent`
- Flags always: `-p --force --output-format text`

## Timeout

Default max runtime is **1800 seconds** (30 minutes). Override with `--timeout <sec>` or
`CLI_JOB_TIMEOUT_SEC`. On expiry the runner kills the agent process tree, writes
`status.json` with `exit_code: 124` and `error: "timeout"`, and exits 124.

## CLI agent login (path names only — never print values)

Login / session files the Cursor agent CLI already uses on each host (names only):

| Host | Path names (no values) |
|---|---|
| **HZR52** | `%APPDATA%\Cursor\auth.json`; `%USERPROFILE%\.cursor\cli-config.json`; `%USERPROFILE%\.cursor\agent-cli-state.json` |
| **ln02** | `~/.cursor/cli-config.json`; `~/.cursor/agent-cli-state.json` (and Cursor auth under `~/.config/Cursor/` when present) |

Operators place or refresh login on the host; these runners never read or echo those files.

## Layout

Default jobs-root:

- HZR52: `%LOCALAPPDATA%\dabos\cli-jobs`
- ln02: `~/.local/state/dabos/cli-jobs`

Each run: `<jobs-root>/<job>/<run-id>/report.md`, `status.json` (exit code, times, host, workdir,
prompt **path** only, `run_id`, timeout), `run.log`. Run ids are
`<utc-ts>_<pid>_<random>` so same-second starts never share a directory. The per-job lock is
taken **before** any write under that run directory. One lock per job name under `_locks/`.

## Prompt discipline

- One prompt file, one job, a hard stop.
- Start from `ops/cli-jobs/prompt-template.md`.
- Keep jobs and Cursor CLI sessions lean (no chat chains, no lingering agent sessions); split large work into separate job names.
- PII / restricted work runs on **HZR52** only; everything else runs on **ln02**.
