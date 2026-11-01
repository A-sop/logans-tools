-- UNDO for 2026-11-01_comm_center_normalise_addressees.sql
-- Restores assigned_agent / division_id / department_id from the rollback CSV written before apply.
-- This file does NOT embed row data. Logan (or Div4) loads the CSV into a staging table, then runs:
--
--   BEGIN;
--   -- stage CSV (columns match rollback export) then:
--   UPDATE tasks t
--      SET basket = s.basket,
--          status = s.status,
--          assigned_agent = NULLIF(s.assigned_agent, ''),
--          division_id = s.division_id,
--          department_id = NULLIF(s.department_id, ''),
--          ingest_meta = s.ingest_meta::jsonb,
--          updated_at = NOW()
--     FROM comm_center_rollback_stage s
--    WHERE t.id = s.id::uuid;
--   COMMIT;
--
-- Refuses to run a blind reverse map (would re-introduce unmapped variants).

DO $$
BEGIN
  RAISE EXCEPTION
    'UNDO is CSV restore only: load the pre-apply rollback CSV into comm_center_rollback_stage, then UPDATE from it (see header). Refusing a blind reverse map.';
END $$;
