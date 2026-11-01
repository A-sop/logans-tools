# Build hand-off receipts (Div4)

Zero-token OUT-basket receipts for agent builds. Stacked on comm-center baskets (#66) and
status digest (#61). Acceptance:
`docs/acceptance/2026-11-01_build_receipts_open_orders_stall.ACCEPTANCE.md`.

## CLI

```
npm run dabos:build-receipt -- start --order-id <id> --repo <r> --branch <b> \
  --machine <m> --expected-finish <ISO> [--pr <url>]...
npm run dabos:build-receipt -- finish --order-id <id> --status done|failed [--pr <url>]...
npm run dabos:build-receipt -- route-stalls
```

Idempotent via `ingest_source='build-receipt'` + `ingest_external_id='<order_id>:<phase>'`.

## HZR52 wrapper

`ops/cli-jobs/run-with-build-receipt.ps1` writes start before `Start-Process` … `agent.ps1`
and finish after exit. Does not echo the agent argument list.

## Digest

The status digest gains an **Open orders** section: one line per order still open (from start
until 24 h after finish) as `running` | `done` | `stalled`. Stalled orders are also routed to
Dept2 IN with `ingest_source='dept2-stall'` (at most once per order per Berlin day). Routing
never sets `basket='pending'`.

## SQL (files only)

Optional grants: `scripts/dabos/sql/2026-11-01_build_receipt_role_grants.sql` (and `.UNDO.sql`).
Not applied by this PR. Guards refuse PUBLIC CREATE but not PUBLIC TEMPORARY.
