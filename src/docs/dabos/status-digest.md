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
| FAIL at current head | open PRs whose current-head Dept13 verdict is FAIL |
| Divisions table | PRs by title prefix (`Div N`, else `Dept N` → division), task counts, approvals, stats posted for the last closed org week |
| Merged in 24 h | both repos |
| Cadences | latest `role_runs` per cadence role |
| ln02 user timers | state, last/next trigger and last service result; failed user units by name |
| ln02 checkout sync | `~/.local/state/dabos/checkout-sync.FAIL` and `checkout-sync.status.json` from logans-tools #59's sync; the FAIL flag is a machine alert naming the failing repos and the owner post |
| Source errors | any source that could not be read this run |

Dept13 verdicts are PASS or FAIL only. A review or comment body carries a verdict only when its
**first line** is exactly `Dept13 PASS @<sha>` or `Dept13 FAIL @<sha>`, with `<sha>` the full 40-hex
head sha and nothing else on the line (`parseDept13Verdict`, `VERDICT_LINE_RE`). Free text such as
`Dept13 PASS (...) @<sha>`, markdown around the line, a short or long sha, or a verdict on a later
line is not a verdict. A verdict is **current** only when its full 40-hex sha equals the PR's head
sha (`shaMatches`: no prefix match, no truncation); otherwise the PR is listed as STALE under Needs
Dept13.

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

## Runbook: owner post

Owner: **Dept12 Production (Div4)** (`OWNER_POST` in the code; the digest header names it).

| Signal | Who notices | What the owner does |
|---|---|---|
| Digest run failed (`systemctl --user status dabos-status-digest.service` not success, or a `role_runs` row is missing for a scheduled slot) | LDW at its 12:30 / 20:45 read, or any reader | read `journalctl --user -u dabos-status-digest -n 50` on ln02, fix, re-run `systemctl --user start dabos-status-digest.service` |
| Digest missing or stale: `latest.md` absent, or `generatedAt` in `latest.json` / newest `role_runs` row older than 2 h 30 min | same | check the timer (`systemctl --user list-timers dabos-status-digest.timer`) and the last run; same fix |
| `checkout-sync.FAIL` shown under machine alerts / "ln02 checkout sync" | the digest itself | read `~/.local/state/dabos/checkout-sync.status.json`, fix the named repo by hand (the sync never resets or forces), then let the next full sync run clear the flag |

A reader that sees one of these sends one batched message to Dept12 Production (Div4), per the
agent wake rules; it is priority only if it blocks a Thursday close or Logan is waiting.
