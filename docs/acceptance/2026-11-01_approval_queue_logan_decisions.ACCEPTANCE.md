# Acceptance: approval_queue as the one place for Logan's yes/no (RR-010 step 2, Div4, not applied)

Recorded before any code, as its own commit. Built by Div4 (Dept10 Systems Design hat). Goes to
Dept13 for a PASS. The SQL is applied only after the PASS and Logan's own merge-and-apply yes.

## The order (Logan's words, relayed by LDW Communicator)

- Sun 1 Nov 2026, 14:44 Berlin: "why am I the one thinking of this? Someone is not wearing their hat"
- 14:54, on LDW Communicator's card: "Build the wake rules, the approval queue and one status digest on ln02? Yes to steps 1–3"

## What exists (read-only on Neon prod, project red-moon-24328019, branch br-damp-tree-b1h8mksl, 1 Nov 2026 ~15:00 CET)

- `approval_queue` exists (migration 012): id uuid pk, workspace_id, kind, title, body, payload
  jsonb, status, requested_by, decided_by, division_id, department_id, task_id, created_at,
  decided_at. 14 columns.
- Prod has **no CHECK and no FK constraints** on it (only NOT NULLs and the pk), although
  migration 012 declares CHECKs on kind/status and FKs. The same holds for `role_runs` (prod has
  role_type 'worker' rows, outside 012's CHECK list). This PR does not add them back.
- Indexes: pk, idx_approval_queue_status (status, created_at DESC).
- Rows: 2, both kind 'other', status 'approved', newest 11 Jul 2026. So it is unused today.
- Code: GET/POST `/api/dabos/tier0/approvals`, POST `/api/dabos/tier0/approvals/[id]`
  (approve/reject; only a 'pending' row can be decided), and the Tier0 text formatter.

## Done means

1. A written usage standard, `src/docs/dabos/approval-queue.md`: every item that needs Logan's
   yes (merge, prod apply, machine change, secret placement, policy) is one row; who files it,
   what the payload carries (repo, PR, head sha, Dept13 verdict sha, apply method, Logan's words
   when decided), how Logan or LDW Communicator decides it, how the doing agent reads it, and that
   a push after the decision expires it. No DVAG client data and no secret values in any row.
2. One small schema addition so filing is idempotent: a nullable `dedupe_key text` column, a
   format CHECK, and a unique partial index on it. Nothing else changes; no route change.
3. A dated SQL file `scripts/dabos/sql/2026-11-01_approval_queue_decision_keys.sql` following the
   repo pattern: one transaction, guards that RAISE on any unexpected state, idempotent re-run
   (end state re-verified, nothing written), and the 2 existing rows proven unchanged (whole-table
   digest with nullable columns coalesced). An undo file that removes only this PR's objects and
   refuses if any row already carries a dedupe_key.
4. A small helper (`src/lib/dabos/approval-queue-standard.ts`) that builds the dedupe key and
   validates the payload shape, so agents and scripts write rows the same way.
5. Tests: the SQL runs on an in-process Postgres shaped like prod (apply, re-run no-op, guard
   aborts on a partial state, undo, undo refusal), plus unit tests of the helper.
6. Not applied in this PR. No Whop data, no client data.
