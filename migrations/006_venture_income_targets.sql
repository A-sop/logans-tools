-- Venture income baselines and targets (IW ladder + Proviso feed)

CREATE TABLE IF NOT EXISTS venture_income_targets (
  venture_tag TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  baseline_eur_monthly NUMERIC,
  target_eur_monthly NUMERIC NOT NULL DEFAULT 7600,
  metric_key TEXT NOT NULL DEFAULT 'taxable_income_eur',
  source_system TEXT,
  source_note TEXT,
  division_id TEXT REFERENCES divisions(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO venture_income_targets (
  venture_tag, label, baseline_eur_monthly, target_eur_monthly, source_system, source_note, division_id
) VALUES (
  'venture:gfp',
  'GFP consulting (DVAG advisory)',
  2400,
  7600,
  'proviso',
  'Average monthly residual; authoritative commission stats released monthly from Proviso (C:\Dev\Proviso).',
  'Div3'
) ON CONFLICT (venture_tag) DO UPDATE SET
  baseline_eur_monthly = EXCLUDED.baseline_eur_monthly,
  target_eur_monthly = EXCLUDED.target_eur_monthly,
  source_system = EXCLUDED.source_system,
  source_note = EXCLUDED.source_note,
  division_id = EXCLUDED.division_id,
  updated_at = NOW();

-- Seed baseline stat point for board (founder baseline 2026-06-30)
INSERT INTO stats (workspace_id, division_id, department_id, metric_key, value, recorded_at)
SELECT 'baseline-gfp', 'Div3', 'Dept7', 'taxable_income_eur', 2400, NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM stats
  WHERE division_id = 'Div3'
    AND metric_key = 'taxable_income_eur'
    AND workspace_id = 'baseline-gfp'
);

UPDATE divisions SET primary_metric_key = 'taxable_income_eur' WHERE id = 'Div3';
