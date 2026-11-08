/**
 * GDS + department headline keys (Neon migration 023 / FPL 30 Sep 65 map).
 * Counting rules SSOT: DABOS docs/reference/dept03-perception/stat-counting-rules.md
 */
export const DIV_GDS = {
  Div1: { primary: 'comms_out', secondary: 'comms_in' },
  Div2: { primary: 'new_enrollments', secondary: 'product_sales' },
  Div3: { primary: 'collections_eur', secondary: 'bills_paid_eur' },
  Div4: { primary: 'completions', secondary: null },
  Div5: { primary: 'qual_cash_eur', secondary: null },
  Div6: { primary: 'fsm_commissions_paid_eur', secondary: 'new_cf_addresses' },
  Div7: { primary: 'gross_income_eur', secondary: null },
} as const;

export type DivisionId = keyof typeof DIV_GDS;

/** Department headline keys (seeded on departments.primary_metric_key). */
export const DEPT_HEADLINE: Record<string, string> = {
  Dept1: 'comms_in',
  Dept2: 'despatches_cleared',
  Dept3: 'stats_posted_on_time',
  Dept4: 'content_pieces_shipped',
  Dept5: 'fulfillments_shipped',
  Dept6: 'new_enrollments',
  Dept7: 'collections_eur',
  Dept8: 'bills_paid_eur',
  Dept9: 'reserves_eur',
  Dept10: 'designs_accepted',
  Dept11: 'build_completions',
  Dept12: 'completions',
  Dept13: 'verdicts_decided',
  Dept14: 'reviews_completed',
  Dept15: 'certs_issued',
  Dept16: 'new_cf_addresses',
  Dept17: 'fsm_commissions_paid_eur',
  Dept18: 'success_stories_published',
  Dept19: 'conditions_from_stats',
  Dept20: 'priorities_locked',
  Dept21: 'approvals_cleared',
};

/** Legacy substats still posted alongside GDS. */
export const LEGACY_UNDER_STATS = [
  'artifacts_indexed',
  'leads_or_touchpoints_created',
  'taxable_income_eur',
  'shipped_outputs',
  'qa_pass_rate',
  'plan_completion_rate',
  'conversions',
  'open_debts_eur',
] as const;
