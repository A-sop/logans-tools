# Acceptance: capture routing is agent-by-default (Dept1 intake rule)

Recorded before any code (criterion 2). Requested by LDW Communicator for Div1; built by Div4.

Rules enforced: Dept1 intake rule (captures never go to the founder) and agent-by-default.

Acceptance lines:

1. `ingestCapture` (src/lib/dabos/ingest.ts): a capture from any non-`api` mouth
   (`telegram`, `slack`, `buzz`) is inserted with `type = 'agent'` and `assigned_to = NULL`,
   whether or not it carries a `task:`/`agent:`/`despatch:` prefix.
2. `ingestCapture`: an `api`-mouth item with no work prefix (`is_agent = false`) keeps
   `type = 'human'`, `assigned_to = 'founder'` (unchanged behaviour).
3. `ingestCapture`: any item with a work prefix (`is_agent = true`) stays `type = 'agent'`,
   `assigned_to = NULL`, `assigned_agent = 'research'` (unchanged behaviour).
4. `scripts/dabos/route.ts` (tangent capture into the Dept1 inbox) inserts `type = 'agent'`,
   `assigned_to = NULL` instead of `human`/`founder`.
5. `src/lib/dabos/ingest.test.ts` covers lines 1-3; the full vitest suite passes.
6. No merge or production redeploy without Dept13 PASS and Logan's own yes. Production is behind
   main (#36 routing fields missing), so a redeploy also ships #36.
