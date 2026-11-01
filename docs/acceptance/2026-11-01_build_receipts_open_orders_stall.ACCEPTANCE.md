# Acceptance: build hand-off receipts, open-order digest lines, stall alarm

Committed before any code. The code in this PR is judged against this file.

## The order

- Logan, Sun 1 Nov 2026 21:57 Berlin, on HZR52: Div4 batch 2 — build receipts + digest
  open-order lines + stall alarm (stacked on #66 and #61).
- Gate: Dept13 PASS on this PR head (exact first line `Dept13 PASS|FAIL @<full 40-hex sha>`,
  no CONDITIONAL) before any SQL apply or ln02 install. Merge and apply need Logan's yes.
- This build session does **not** write to any database and does **not** install on ln02.

## What this PR is (and is not)

- It adds: this acceptance file; a zero-token `build-receipt` CLI (`start` / `finish`) that
  writes Div4 OUT-basket rows; a PowerShell wrapper for the HZR52 `agent.ps1` launch pattern;
  an "Open orders" section on the #61 status digest; stall routing to Dept2 IN reusing #66 P4
  dedupe (`dept2-stall`, at most once per order per Berlin day); optional grants SQL (files
  only); and Vitest coverage for each behaviour plus ACL guards against prod-like datacl.
- It does **not** apply SQL, create Neon roles, place secrets, install timers, or push to
  branches of #59–#66.

## Done means

1. **`build-receipt start`** — args: `order_id`, `repo`, `branch`, `machine`, `expected_finish`
   (ISO), optional PR links. Writes one OUT-basket `tasks` row with sender Div4,
   `ingest_source='build-receipt'`, `ingest_external_id='<order_id>:start'`, and
   `ingest_meta` carrying `kind='build-receipt'`, `phase='start'`, start time, repo, branch,
   machine, expected finish, optional PR links. No LLM. Idempotent via the existing
   `(ingest_source, ingest_external_id)` unique index (second start for the same order is a
   no-op success).

2. **`build-receipt finish`** — writes a second OUT row with
   `ingest_external_id='<order_id>:finish'`, `phase='finish'`, status `done|failed`, PR links,
   finish time. Idempotent the same way. Never sets `basket='pending'`.

3. **PowerShell wrapper** usable from the HZR52 CLI launch pattern (`Start-Process` …
   `agent.ps1`): writes the start receipt before launch and the finish receipt after exit
   (exit 0 → `done`, else `failed`). Does not print secrets or full process command lines.

4. **Status digest "Open orders"** — one line per open order: `running` | `done` | `stalled`,
   repo, branch, machine, last activity time (Berlin). An order is open from its start receipt
   until 24 h after its finish receipt. Stalled = start present, no finish, and
   `now > expected_finish`.

5. **Stall alarm** — each stalled order is routed to Dept2 IN with `ingest_source='dept2-stall'`,
   reusing #66 P4 routing/dedupe: at most once per order per Berlin day
   (`ingest_external_id='<order_id>:<YYYY-MM-DD>'`, `ON CONFLICT DO NOTHING`). Routing never
   sets `basket='pending'`.

6. **SQL / ACL** — any grants or migration SQL is whole-file, one transaction, applyable as a
   unit. Guards refuse PUBLIC CREATE on the database but **not** PUBLIC TEMPORARY (prod datacl
   is `=Tc/neondb_owner`). Membership checks use `member = role` and allow the PG16+
   CREATEROLE creator ADMIN grant. No prod apply in this PR.

7. **Tests** cover start/finish/idempotence, digest lines for running/done/stalled, stall
   routing once per day (second insert same Berlin day is a no-op), and ACL guard behaviour
   against prod-like datacl (TEMPORARY allowed, CREATE refused).
