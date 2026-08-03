-- Stats provenance (ideal Layer F): basis + recorded_by on every emit.
-- workspace_id already exists; remain required by application code.

ALTER TABLE stats
  ADD COLUMN IF NOT EXISTS basis JSONB,
  ADD COLUMN IF NOT EXISTS recorded_by TEXT;

COMMENT ON COLUMN stats.basis IS 'Provenance note: file path, query, ship row, or honest empty';
COMMENT ON COLUMN stats.recorded_by IS 'Emitter id: week-close-poster | ship-gate | gfp-poster | agent id';
