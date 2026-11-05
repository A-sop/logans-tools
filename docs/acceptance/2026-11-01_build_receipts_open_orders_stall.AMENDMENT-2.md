# Build receipts / stall alarm — Amendment 2 (stall reason `no-receipt`)

Committed on its own, after AMENDMENT-1 and before any code for this addition.
Dept13 checks the build against the base acceptance as amended by AMENDMENT-1 and
this file. Verdict format: exact first line `Dept13 PASS|FAIL @<full 40-hex sha>`
(no CONDITIONAL).

Source: Div1/Dept2 three-basket rules §6 R4 + Wiring (LDW relay of Logan order
1 Nov 2026 21:57 Berlin). Repo A-sop/logans-tools, branch `div4/build-receipts`,
machine HZR52 (R1: every order and report names repo, branch, machine).

## A6 Stall reason `no-receipt` on build-order stalls

An open build order with a start receipt, no finish/completion receipt, and
`now` past its expected finish (`expected_finish`, or `clear_by` when that is the
stated due time) counts as stalled.

`dabos:route-stalls` / `routeStalledBuildOrders` writes the Dept2 IN row with:

- `ingest_source` stays `'dept2-stall'` (P4 source unchanged);
- `ingest_meta.reason` = `'no-receipt'` (next to the existing source);
- `ingest_meta` also carries the order's `repo`, `branch`, and `machine`;
- dedupe stays once per order per Berlin day (`ingest_external_id='<order_id>:<YYYY-MM-DD>'`,
  `ON CONFLICT DO NOTHING`);
- routing never sets `basket='pending'`.

Existing P4 stall kinds from the #66 courier/wake path keep their own `rule` /
reason values (`pending_gt_7d`, `clear_by_gt_24h`, `blocker_pending_gt_72h`,
`blocker_in_gt_24h`, `in_after_2_wakes`). This amendment only adds `no-receipt`
for build-receipt stalls.

## A7 Digest Open orders line shows `no-receipt`

The status digest "## Open orders" line for a stalled build order includes the
stall reason `no-receipt` (alongside repo, branch, machine, last activity Berlin).
Running and done lines are unchanged in shape. Digest remains display-only (A1).

## A8 Tests

Tests cover: route-stalls row carries `reason='no-receipt'` + repo/branch/machine
with source `dept2-stall` and once-per-day dedupe; digest stalled line shows
`no-receipt`; existing P4 reason strings are not rewritten by this change.
