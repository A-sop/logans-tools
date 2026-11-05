# Build receipts / stall alarm — Amendment 3 (Dept13 FAIL @4e4b82cd round, 5 Nov 2026)

Committed on its own, after prior acceptance + Amendments 1–2 and before any further code on
this round. Dept13 checks the build against the base acceptance as amended. Verdict format:
exact first line `Dept13 PASS|FAIL @<full 40-hex sha>` (no CONDITIONAL).

All five prior FAIL points and Amendment 2 (no-receipt) remain MET. This branch previously
contained #66 @34ef805b, so #66's remaining defects FAILed #67 too. Criteria below require the
fixed #66 head (and current main) to be merged in.

## A3.1 Inherit fixed #66 courier addressing + errexit

After merge of `origin/div4/comm-center-baskets`, courier step 3 updates both addressing fields
(DEPT clears/updates `assigned_agent`; DIV updates `department_id` consistently) and
`cc_psql` / `cc_post_webhook` restore caller errexit. `git merge-base --is-ancestor` of the
new #66 head into this branch is 0.

## A3.2 Merge current origin/main; resolve pglite-dabos.ts

Branch is mergeable into current `origin/main` (resolve any `src/test/pglite-dabos.ts`
conflict). No force-push. Full suite twice + `tsc --noEmit` green.
