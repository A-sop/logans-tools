# Comm center v3 — Amendment 3 (Dept13 FAIL @34ef805b round, 5 Nov 2026)

Committed on its own, after the base acceptance + Amendments 1–2 and before any further code
on this round. Dept13 checks the build against the base acceptance as amended by this file.
Verdict format: exact first line `Dept13 PASS|FAIL @<full 40-hex sha>` (no CONDITIONAL).

Keep (unchanged): routing never sets `basket='pending'`; P1–P6 stand. Prior Amendment 2
points remain MET.

## A3.1 Courier routing updates both addressing fields

Courier step 3 must set both fields so wake.sh Post IN counts land on the new holder:
- DEPT routing: set `department_id` (and owning `division_id`) and clear/update
  `assigned_agent` so the row leaves the old Post's IN.
- DIV/LDW routing: set `assigned_agent` and update `department_id` consistently (clear or
  align with the destination Post).

A test covers Div5→Dept10 (and the reverse class) proving the old Post no longer sees the
row in its IN predicate.

## A3.2 cc_psql / cc_post_webhook restore caller errexit

Same bar as wake-if-new: save and restore the caller's `set -e` state (not end with a bare
`set +e`). A test proves errexit is on after a successful helper.

## A3.3 Merge/rebase onto current origin/main

Branch is mergeable into current `origin/main` (resolve any `src/test/pglite-dabos.ts`
conflict). No force-push.
