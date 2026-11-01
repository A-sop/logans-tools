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

Amended 1 Nov 2026 after Dept13 FAIL on #61 @fd7d139bc23d7651b71d28732192856a1e5eafce: line 1
(verdict format and staleness; checkout-sync input), new lines 9 and 10, line 11 (was 8).

1. `npm run dabos:status-digest` builds **one** digest covering Div1–Div7 from:
   - GitHub PR state for `A-sop/DABOS` and `A-sop/logans-tools`: open PRs, PRs merged in the last 24 h,
     and the latest Dept13 verdict on each open PR. A verdict is PASS or FAIL only. It counts only
     when the **first line** of a review or comment body is exactly `Dept13 PASS @<sha>` or
     `Dept13 FAIL @<sha>` with `<sha>` the full 40-hex sha (no other text on that line, nothing
     between the verdict and `@`; a verdict on a later line is ignored). It is **current** only when
     that full 40-hex sha equals the PR's head sha; a shorter or longer string never matches and is
     never truncated. Otherwise it is flagged **stale**;
   - Neon: task **counts** by division / status / basket (no titles or descriptions), pending
     approval_queue rows, whether each division posted stats for the last closed org week, and the
     latest run of each cadence in role_runs;
   - ln02 user systemd timers: name, active/sub state, result, last and next trigger, and the names of
     failed user units. It never asks systemd for command lines (no `ExecStart`, no process lists).
   - ln02 checkout sync (logans-tools #59): `~/.local/state/dabos/checkout-sync.FAIL` and
     `checkout-sync.status.json`. While the FAIL flag exists the digest raises a machine alert that
     names the failing repos and the owner post, Dept12 Production (Div4).
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
9. Grants SQL guard 3 (after the GRANTs, inside the same transaction) refuses unless the role has
   exactly the intended privileges and nothing else on **any** object in the database: SELECT on the
   six tables, INSERT on role_runs, USAGE on schema public. Checked: direct grants to the role on
   every table, view, sequence, column, function, schema, type, language, database, tablespace,
   foreign server/wrapper, large object and parameter; effective table/sequence privileges
   (including PUBLIC grants) on every non-system relation; no CREATE on any schema or the database;
   no role memberships in either direction; the role owns no object; no default privileges for or
   by the role. PUBLIC's PostgreSQL defaults (EXECUTE on functions, CONNECT/TEMP on the database,
   USAGE on system schemas) are not grants to the role and are not refused.
10. Runbook owner: a failed digest run, a missing digest or one older than 2 h 30 min, and a
    `checkout-sync.FAIL` shown in the digest are owned by Dept12 Production (Div4). The digest
    header and `src/docs/dabos/status-digest.md` name that post.
11. Tests cover the builder, PR→division mapping, Dept13 verdict parsing (exact first line, full
    40-hex sha only) and staleness, systemctl parsing, the checkout-sync reader and alert, the Neon
    readers on PGlite, every guard 3 refusal on PGlite, the unit/timer text, the `--apply` gate and
    the env-file rule.
