-- GDS rename to FPL 30 Sep 65 map (founder common understanding 2026-11-07).
-- Dual GDSes use secondary_metric_key. Old keys remain valid as AdComm under-stats in `stats`.
-- Receipt: DABOS docs/reference/staff-status/receipts/gds-common-understanding-2026-11-07.md

ALTER TABLE divisions
  ADD COLUMN IF NOT EXISTS secondary_metric_key TEXT;

UPDATE divisions SET
  primary_metric_key = 'comms_out',
  secondary_metric_key = 'comms_in',
  description = 'Comm handled out/in (modern Letters Out / In). artifacts_indexed remains Dept1 under-stat.'
WHERE id = 'Div1';

UPDATE divisions SET
  primary_metric_key = 'new_enrollments',
  secondary_metric_key = 'product_sales',
  description = 'New enrollments (paid+started) and book/course/product sales. leads_or_touchpoints_created remains under-stat until tightened.'
WHERE id = 'Div2';

UPDATE divisions SET
  primary_metric_key = 'collections_eur',
  secondary_metric_key = 'bills_paid_eur',
  description = 'Collections vs bills paid (dual GDS). taxable_income_eur and open_debts_eur are under-stats — not the GDS.'
WHERE id = 'Div3';

UPDATE divisions SET
  primary_metric_key = 'completions',
  secondary_metric_key = NULL,
  description = 'Tech completions (finished exchangeable delivery). shipped_outputs may mirror until posters cut over.'
WHERE id = 'Div4';

UPDATE divisions SET
  primary_metric_key = 'qual_cash_eur',
  secondary_metric_key = NULL,
  description = 'Cash paid this week for Qual/correction services. qa_pass_rate remains health under-stat.'
WHERE id = 'Div5';

UPDATE divisions SET
  primary_metric_key = 'fsm_commissions_paid_eur',
  secondary_metric_key = 'new_cf_addresses',
  description = 'FSM/VB/affiliate commissions paid / new CF addresses (dual). conversions may remain GFP funnel under-stat.'
WHERE id = 'Div6';

UPDATE divisions SET
  primary_metric_key = 'gross_income_eur',
  secondary_metric_key = NULL,
  description = 'Gross Income of the org (Exec GDS). plan_completion_rate remains under-stat.'
WHERE id = 'Div7';

-- Optional headline per department (AdComm still posts any metric_key rows).
ALTER TABLE departments
  ADD COLUMN IF NOT EXISTS primary_metric_key TEXT;

UPDATE departments SET primary_metric_key = v.k
FROM (VALUES
  ('Dept1', 'comms_in'),
  ('Dept2', 'despatches_cleared'),
  ('Dept3', 'stats_posted_on_time'),
  ('Dept4', 'content_pieces_shipped'),
  ('Dept5', 'fulfillments_shipped'),
  ('Dept6', 'new_enrollments'),
  ('Dept7', 'collections_eur'),
  ('Dept8', 'bills_paid_eur'),
  ('Dept9', 'reserves_eur'),
  ('Dept10', 'designs_accepted'),
  ('Dept11', 'build_completions'),
  ('Dept12', 'completions'),
  ('Dept13', 'verdicts_decided'),
  ('Dept14', 'reviews_completed'),
  ('Dept15', 'certs_issued'),
  ('Dept16', 'new_cf_addresses'),
  ('Dept17', 'fsm_commissions_paid_eur'),
  ('Dept18', 'success_stories_published'),
  ('Dept19', 'conditions_from_stats'),
  ('Dept20', 'priorities_locked'),
  ('Dept21', 'approvals_cleared')
) AS v(id, k)
WHERE departments.id = v.id;
