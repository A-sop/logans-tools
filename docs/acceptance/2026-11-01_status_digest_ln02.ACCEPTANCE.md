# Acceptance: one Div1–7 status digest on ln02 (RR-010 step 3)

Committed before any code. The code in this PR is judged against this file.

## The order

- Logan, Sun 1 Nov 2026 14:54 Berlin, on LDW's card: "Build the wake rules, the approval queue and one
  status digest on ln02? Yes to steps 1–3".
- LDW: "Go on 0–3, each with a Dept13 PASS first."
- Hosting rule: ln02 by default, HZR52 only where needed. The digest needs nothing from HZR52.

Why: status is to be **read**, not sent. Agents stop messaging each other "status" and
"done" notes; the digest is where those facts land, and LDW reads it at 12:30 and 20:45 Berlin.

## What this PR is (and is not)

- It adds code, unit files, an install script, an optional grants SQL file and tests.
- It does **not** install the timer, change ln02, create a Neon role, place any secret or apply any
  SQL. Those happen only after Dept13 PASS on this PR and Logan's yes (approval_queue / Tier0).

## Done means

1. `npm run dabos:status-digest` builds **one** digest covering Div1–Div7 from:
   - GitHub PR state for `A-sop/DABOS` and `A-sop/logans-tools`: open PRs, PRs merged in the last 24 h,
     and the latest `Dept13 PASS|FAIL|CONDITIONAL @<sha>` line on each open PR, flagged **stale** when
     that sha is not the PR's current head;
   - Neon: task **counts** by division / status / basket (no titles or descriptions), pending
     approval_queue rows, whether each division posted stats for the last closed org week, and the
     latest run of each cadence in role_runs;
   - ln02 user systemd timers: name, active/sub state, result, last and next trigger, and the names of
     failed user units. It never asks systemd for command lines (no `ExecStart`, no process lists).
2. Output: `latest.md` and `latest.json` in `~/.local/state/dabos-status-digest/` on ln02, written
   atomically, **and** one `role_runs` row (`role_id 'status_digest'`, `role_type 'cadence'`,
   `summary_json` carrying the markdown and counts). LDW reads the newest row or the file.
3. A source that fails (GitHub down, Neon down, no systemd) is listed under "Source errors" in the
   digest; the other sections still render. The run exits non-zero only when neither the file nor the
   row could be written.
4. Timer: every 2 h on the even hour, plus 12:25 and 20:40, all `Europe/Berlin`, `Persistent=true`, so
   the 12:30 and 20:45 reads see a digest at most 5 minutes old.
5. Secrets: the runner reads only `DABOS_DIGEST_DATABASE_URL` and `DABOS_DIGEST_GITHUB_TOKEN` from the
   environment, which systemd loads from `%h/.config/dabos/status-digest.env` (mode 600, placed by
   Logan). It never reads `.env.local`, never prints either value, and the unit files contain no
   secret. The install script checks the env file exists, is mode 600 and has both names set, without
   printing anything from it.
6. Install script is a dry run unless `--apply` is given.
7. No DVAG client data: tasks are counted, never listed; approval rows show title and kind only.
8. Tests cover the builder, PR→division mapping, Dept13 verdict parsing and staleness, systemctl
   parsing, the Neon readers on PGlite, the unit/timer text, the `--apply` gate and the env-file rule.
