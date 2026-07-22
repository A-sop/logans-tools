-- E3 establishment sprint (T3 wiring): Dept9 flips to-report -> reported.
-- The T3 script ran 2026-07-05 and produced a real number; source artifact:
-- C:\DATA\10_WORK\dabos-registers\headroom-report-2026-07-05.md (Atlas scripts/dabos/Run-HeadroomBackupReport.ps1).
-- Value = minimum disk_headroom_pct across the three machines (office-pc 21.6, ln01 88.3, ln02 75)
-- so the board shows the tightest disk, which is the number Dept9 acts on.
-- Idempotent: guarded insert + upsert; safe to re-run.

INSERT INTO stats (workspace_id, division_id, department_id, metric_key, value, recorded_at)
SELECT 'headroom-2026-07-05', 'Div3', 'Dept9', 'disk_headroom_pct', 21.6::numeric, '2026-07-05T03:15:00Z'::timestamptz
WHERE NOT EXISTS (
  SELECT 1 FROM stats s
  WHERE s.workspace_id = 'headroom-2026-07-05'
    AND s.department_id = 'Dept9'
    AND s.metric_key = 'disk_headroom_pct'
);

UPDATE department_establishment SET
  stat_status = 'reported',
  stat_metric_key = 'disk_headroom_pct',
  stat_pointer = NULL,
  checked_at = '2026-07-05',
  updated_at = NOW()
WHERE department_id = 'Dept9';
