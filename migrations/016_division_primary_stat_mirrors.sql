-- P03-1 wiring: board charts / getLatestStatValue require department_id IS NULL.
-- Mirror known honest dept-level points up to the division primary metrics.

-- Div3: Proviso residual baseline (€2400 (venture:dvag) — already on Dept7 as baseline-dvag
INSERT INTO stats (workspace_id, division_id, department_id, metric_key, value, recorded_at)
SELECT 'baseline-dvag-div', 'Div3', NULL, 'taxable_income_eur', 2400::numeric, '2026-07-01T12:30:53.435918Z'::timestamptz
WHERE NOT EXISTS (
  SELECT 1 FROM stats s
  WHERE s.division_id = 'Div3'
    AND s.department_id IS NULL
    AND s.metric_key = 'taxable_income_eur'
);

-- Div4: ship-log T2 board PASS — already on Dept12 as ship-log-2026-07-11-t2
INSERT INTO stats (workspace_id, division_id, department_id, metric_key, value, recorded_at)
SELECT 'ship-log-2026-07-11-t2-div', 'Div4', NULL, 'shipped_outputs', 1::numeric, '2026-07-11T22:30:00Z'::timestamptz
WHERE NOT EXISTS (
  SELECT 1 FROM stats s
  WHERE s.division_id = 'Div4'
    AND s.department_id IS NULL
    AND s.metric_key = 'shipped_outputs'
);
