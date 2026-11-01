# Acceptance: three-basket comm center v3 (IN / PENDING / OUT)

Committed before any code. The code in this PR is judged against this file and against
SCOPE v3 (Dept2, 1 Nov 19:14) + `dept02-wake-cadence-proposal.md` sections 4–5.

## The order

- Logan, Sun 1 Nov 2026 ~19:08 Berlin (relayed): "Yes to the change and the one-off move".
- Hold lifted SCOPE v3 (Dept2, 1 Nov 19:14): full scope including ln02 courier and wake.
- Spec v3 PENDING rules (P1–P6) and pick-up clocks override any earlier draft in the prompt body.
- Gate: Dept13 PASS on this PR head (exact first line `Dept13 PASS|FAIL @<full 40-hex sha>`,
  no CONDITIONAL) before any SQL apply or ln02 install. Merge and apply need Logan's yes.
- This build session does **not** write to any database and does **not** install on ln02.

## What this PR is (and is not)

- It adds: acceptance (this file), SQL (normalisation, re-basketing, `v_comm_station`, optional
  pending index) each with UNDO, a read-only rollback CSV exporter, PENDING validation in writers,
  ln02 courier + wake + systemd timers + installer, hat-receipt wake documentation, an additive
  digest section module with tests, a runbook, and Vitest coverage.
- It does **not** apply SQL, create Neon roles, place secrets, change Grok panels, or touch the
  fixed Thu 14:00 / 14:30 stat scripts or Div3's existing jobs.

## Done means

1. **No schema change** to `tasks` columns. Baskets stay `in` / `pending` / `out`. PENDING fields
   live under `ingest_meta.pending`: `reason`, `waiting_on`, `clear_by`, `last_reviewed`,
   `last_checked`, `since`, plus `cleared` when the courier clears a blocker. Keys `from`, `to`,
   `reply_to`, `filed_at` remain top-level in `ingest_meta`.

2. **`v_comm_station`** (SQL view, unapplied): one row per canonical post (`Div1`…`Div7`, `LDW`),
   with `in_count`, `pending_count`, `out_count`, `pending_cleared_count`, `pending_past_clear_by`,
   `oldest_in_age`, `oldest_pending_since`, `never_reviewed_count`. Read-only grants for existing
   digest/watch roles only, guarded like #61 (PG16+ CREATEROLE creator-admin nuance: memberships
   checked with `member = role`, not `roleid = role`).

3. **Normalisation SQL** (unapplied, one transaction): explicit mapping tables for
   `assigned_agent` and `division_id` (and dept id variants) onto the canonical set
   `Div1`…`Div7`, `LDW`, plus `Dept1`…`Dept21`. Includes lower-case `div4`. Any value present
   that is not mapped aborts with a list; never guess. UNDO restores from the rollback export
   path documented in the runbook.

4. **One-off re-basketing SQL** (~1,250 rows, unapplied, one transaction):
   - First step is always the **rollback CSV** exporter (TypeScript, read-only): every row that
     will be touched, columns `id,basket,status,assigned_agent,division_id,department_id,ingest_meta`,
     plus a sha256 of the CSV body; run before apply.
   - `done` / `cancelled` currently `in` → `out` with `ingest_meta.filed_at`.
   - `todo` stays `in`.
   - ~950 `reassess` rows → `pending` with `ingest_meta.pending.reason='reassess'`,
     `waiting_on` post `Div1/Dept1`, `since=now()`, `last_reviewed=now()` (no mass wakes / no
     immediate stalls).
   - Explicit status map; abort on any unmapped status. NOTICEs record before/after counts.
   - Receipt uses a whole-table digest with nullable columns coalesced. UNDO file ships with it.

5. **PENDING rules (code + courier/wake):**
   - **P1** Writers refuse `basket='pending'` without `reason` and `waiting_on`; set `since` and
     `last_reviewed`.
   - **P2** Courier marks `pending.cleared=true` when the blocker task is `out` / done / cancelled.
   - **P3** Wake if `IN>0` OR a blocker cleared OR `now>clear_by` OR `last_reviewed` older than 72h;
     webhook JSON carries `post`, `in_count`, `pending_count`, `oldest_in_age`, and reason(s).
   - **P4** Stalls: at most one Dept2 `IN` row per task per day, `ingest_source='dept2-stall'`,
     via the existing ingest idempotent unique index. Stall = pending >7d; >24h past `clear_by`;
     blocker pending >72h or in its own post's IN >24h; post IN still non-empty after 2 wakes.
   - **P5** Script writes `last_checked` every slot; agents write `last_reviewed` (runbook + hat
     receipts document this).
   - **P6** Optional partial index on `basket='pending'` as a separate SQL file (apply later,
     whole file one transaction).

6. **ln02 `ops/ln02/comm-center/`:** courier (OUT→IN one minute before each slot; file when no
   `to`; Dept2 IN on misroute), wake (env `WAKE_<NAME>_URL` / `WAKE_<NAME>_KEY`,
   `Authorization: Bearer`, same contract as wake-if-new), pick-up clocks in config
   (`~/.config/dabos/comm-center.env` / clocks file — not hardcoded), decision CSV
   `post,ts,decision` with `wake|skip|error`, two consecutive check errors → one wake with
   reason `check-error`, installer plan / `--apply` / `--undo --apply` like checkout-sync.
   Fixed Thu 14:00/14:30 stat scripts and Div3's jobs are left untouched.

7. **Hat receipts:** `npm run dabos:hat-receipt` is the standard on-every-wake receipt; runbook
   documents the one-line call; digest section flags posts that woke without a receipt.

8. **Logan's 20:45 digest:** additive section module (IN/PENDING/OUT + ages from `v_comm_station`,
   pending `approval_queue`, Dept13 lines) with tests — not a second digest. Runbook tells how
   it plugs into #61's status digest when that lands.

9. **Runbook** (`src/docs/dabos/comm-center.md`): apply order (rollback CSV → normalisation →
   re-basketing → view → ln02 install), env names Logan fills, exact Grok routines per post to
   convert to webhook triggers.

10. **Tests:** PGlite where the repo does that; bash runner tests for courier/wake; full suite
    green on two consecutive runs. Record counts in the report.

## Out of scope

- Applying SQL or installing on ln02; filling webhook secrets; changing Grok cron panels;
  watching Div3/stat timers; DABOS wiki path/slug text in logans-tools.
