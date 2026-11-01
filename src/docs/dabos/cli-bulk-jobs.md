# Cursor CLI bulk jobs (RR-010 item 4)

Unattended one-shot Cursor CLI runs. An agent **launches** a job and later **reads the report** —
no back-and-forth message chains. Never on the LDW laptop.

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
  <job-name> <prompt-file> --workdir <path>
```

ln02 (bash):

```bash
bash ~/Dev/logans-tools/ops/cli-jobs/run-cli-job.sh \
  <job-name> <prompt-file> --workdir <path>
```

CLI binaries (do not log the full command line — keys may appear in the process environment):

- HZR52: `C:\Users\LDW_HZR52\AppData\Local\cursor-agent\agent.ps1`
- ln02: `~/.local/bin/agent`
- Flags always: `-p --force --output-format text`

## Layout

Default jobs-root:

- HZR52: `%LOCALAPPDATA%\dabos\cli-jobs`
- ln02: `~/.local/state/dabos/cli-jobs`

Each run: `<jobs-root>/<job>/<ts>/report.md`, `status.json` (exit code, times, host, workdir,
prompt **path** only), `run.log`. One lock per job name under `_locks/`.

## Prompt discipline

- One prompt file, one job, a hard stop.
- Start from `ops/cli-jobs/prompt-template.md`.
- Keep jobs and Cursor CLI sessions lean (no chat chains, no lingering agent sessions); split large work into separate job names.
- PII / restricted work runs on **HZR52** only; everything else runs on **ln02**.
