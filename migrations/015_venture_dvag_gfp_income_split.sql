-- Split DVAG residual (Proviso) from GFP product venture tags.
-- Founder ruling 2026-07-15: ~€2400 is average residual under venture:dvag;
-- exact only after monthly commission close. GFP product starts at €0.

INSERT INTO venture_income_targets (
  venture_tag, label, baseline_eur_monthly, target_eur_monthly, source_system, source_note, division_id
) VALUES (
  'venture:dvag',
  'DVAG advisory residual (Proviso)',
  2400,
  7600,
  'proviso',
  'Average residual for planning (~€2400). Exact taxable amount posted only after monthly commission payouts are final (Proviso month-close).',
  'Div3'
) ON CONFLICT (venture_tag) DO UPDATE SET
  label = EXCLUDED.label,
  baseline_eur_monthly = EXCLUDED.baseline_eur_monthly,
  target_eur_monthly = EXCLUDED.target_eur_monthly,
  source_system = EXCLUDED.source_system,
  source_note = EXCLUDED.source_note,
  division_id = EXCLUDED.division_id,
  updated_at = NOW();

UPDATE venture_income_targets SET
  label = 'GFP online products (site / magnets / consult product)',
  baseline_eur_monthly = 0,
  target_eur_monthly = 7600,
  source_system = 'gfp-neon',
  source_note = 'GFP product taxable income only. DVAG Proviso residual is venture:dvag — keep separate even when commercial feed-through exists.',
  updated_at = NOW()
WHERE venture_tag = 'venture:gfp';

-- Retarget legacy baseline row if still named baseline-gfp
UPDATE stats SET workspace_id = 'baseline-dvag'
WHERE workspace_id = 'baseline-gfp'
  AND division_id = 'Div3'
  AND metric_key = 'taxable_income_eur';

INSERT INTO stats (workspace_id, division_id, department_id, metric_key, value, recorded_at)
SELECT 'baseline-dvag', 'Div3', 'Dept7', 'taxable_income_eur', 2400, NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM stats
  WHERE workspace_id = 'baseline-dvag'
    AND division_id = 'Div3'
    AND metric_key = 'taxable_income_eur'
);
