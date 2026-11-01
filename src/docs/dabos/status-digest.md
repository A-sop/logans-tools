# DABOS status digest (ln02)

One Div1–7 digest, built on ln02 by a user systemd timer and **read, not sent**. Nobody is woken by
it. LDW reads it at 12:30 and 20:45 Berlin; any agent may read it instead of asking another agent for
status.

## Where it lands

- `~/.local/state/dabos-status-digest/latest.md` and `latest.json` on ln02 (replaced atomically).
- Neon `role_runs`: newest row with `role_id = 'status_digest'`, `role_type = 'cadence'`.
  `summary_json->>'markdown'` is the full digest; `needsLogan`, `needsDept13`, `machineAlerts`,
  `divisions` and `sourceErrors` are structured.

```sql
SELECT ran_at, summary_json->>'markdown'
FROM role_runs WHERE role_id = 'status_digest'
ORDER BY ran_at DESC LIMIT 1;
```

## What it shows

| Section | Source |
|---|---|
| Needs Logan | open PRs whose latest Dept13 verdict is PASS at the current head; pending approval_queue rows |
| Needs Dept13 | open non-draft PRs with no verdict, or a verdict on an older sha (STALE) |
| FAIL / CONDITIONAL | open PRs whose current-head verdict is not PASS |
| Divisions table | PRs by title prefix (`Div N`, else `Dept N` → division), task counts, approvals, stats posted for the last closed org week |
| Merged in 24 h | both repos |
| Cadences | latest `role_runs` per cadence role |
| ln02 user timers | state, last/next trigger and last service result; failed user units by name |
| Source errors | any source that could not be read this run |

Dept13 verdicts are read from PR reviews and comments whose first line is
`Dept13 PASS|FAIL|CONDITIONAL @<sha>`.

Tasks are counted only; titles and descriptions never enter the digest.

## Schedule

`*-*-* 00/2:00:00`, `12:25:00` and `20:40:00`, all `Europe/Berlin`, `Persistent=true`.

## Secrets (names only)

| Name | What | Where |
|---|---|---|
| `DABOS_DIGEST_DATABASE_URL` | Neon connection string for role `dabos_status_digest` (SELECT on six tables, INSERT on role_runs) | ln02 `~/.config/dabos/status-digest.env`, mode 600 |
| `DABOS_DIGEST_GITHUB_TOKEN` | fine-grained PAT, read-only *Pull requests* + *Metadata* on `A-sop/DABOS` and `A-sop/logans-tools` | same file |

Logan places both. The runner never reads `.env.local`; the install script checks only that the file
exists, is mode 600 and sets both names.

## Install / undo

See `scripts/dabos/ln02/install-status-digest.sh` (dry run unless `--apply`) and
`scripts/dabos/sql/2026-11-01_status_digest_role_grants.sql` (+ `.UNDO.sql`).
