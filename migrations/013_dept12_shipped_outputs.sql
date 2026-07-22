-- P12-1: Dept12 shipped_outputs after ship-log row 2 (T2 board PASS 2026-07-11).
-- Source: DABOS/docs/registers/ship-log.md row 2 · Dept13 instance 3.
-- Idempotent: guarded insert + establishment flip.

INSERT INTO stats (workspace_id, division_id, department_id, metric_key, value, recorded_at)
SELECT 'ship-log-2026-07-11-t2', 'Div4', 'Dept12', 'shipped_outputs', 1::numeric, '2026-07-11T22:30:00Z'::timestamptz
WHERE NOT EXISTS (
  SELECT 1 FROM stats s
  WHERE s.workspace_id = 'ship-log-2026-07-11-t2'
    AND s.department_id = 'Dept12'
    AND s.metric_key = 'shipped_outputs'
);

UPDATE department_establishment SET
  stat_status = 'reported',
  stat_metric_key = 'shipped_outputs',
  stat_pointer = NULL,
  checked_at = '2026-07-11',
  updated_at = NOW()
WHERE department_id = 'Dept12';
