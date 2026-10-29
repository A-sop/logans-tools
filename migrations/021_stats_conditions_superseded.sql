-- 021: Supersede marker on stats + conditions.
-- Why: Dept13 FAIL 2026-10-29 on the W44 week-close poster (ln02 @2474654). Wrong rows are
--   marked superseded instead of deleted, so the correction is reversible and auditable.
-- Readers used by the board, stat crawl, morning plan, establishment and department pages
--   filter `superseded_at IS NULL`. Those readers have NO missing-column fallback:
--   this migration MUST be applied before deploying the reader change.
-- DEPLOY ORDER: run this migration BEFORE any deploy of code that filters superseded_at
--   (see README > Deploy). Otherwise those readers error at runtime.
-- Idempotent (ADD COLUMN IF NOT EXISTS). Additive, nullable, no default: SAFE.
-- Run with: npm run dabos:migrate (Logan only, after Dept13 PASS).
--
-- Down / rollback (manual; drops any supersede marks, so un-mark or export them first):
--   -- 1. Revert/redeploy reader code that references superseded_at FIRST.
--   ALTER TABLE stats      DROP COLUMN IF EXISTS superseded_reason, DROP COLUMN IF EXISTS superseded_at;
--   ALTER TABLE conditions DROP COLUMN IF EXISTS superseded_reason, DROP COLUMN IF EXISTS superseded_at;
--   DELETE FROM dabos_migrations WHERE id = '021_stats_conditions_superseded.sql';

ALTER TABLE stats
  ADD COLUMN IF NOT EXISTS superseded_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS superseded_reason TEXT NULL;

ALTER TABLE conditions
  ADD COLUMN IF NOT EXISTS superseded_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS superseded_reason TEXT NULL;

COMMENT ON COLUMN stats.superseded_at IS 'Set when the row is superseded (wrong/replaced); readers skip rows where this is NOT NULL';
COMMENT ON COLUMN stats.superseded_reason IS 'Why the row was superseded (e.g. Dept13 FAIL ref)';
COMMENT ON COLUMN conditions.superseded_at IS 'Set when the row is superseded (wrong/replaced); readers skip rows where this is NOT NULL';
COMMENT ON COLUMN conditions.superseded_reason IS 'Why the row was superseded (e.g. Dept13 FAIL ref)';
