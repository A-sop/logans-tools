-- HWW (Health / Wealth / Wisdom) dashboard snapshots for production board.
-- Synced from local hww:build output; page reads Neon only on Vercel.

CREATE TABLE IF NOT EXISTS hww_summaries (
  id BIGSERIAL PRIMARY KEY,
  built_at TIMESTAMPTZ NOT NULL,
  provisional_wealth BOOLEAN NOT NULL DEFAULT TRUE,
  summary JSONB NOT NULL,
  flags JSONB NOT NULL DEFAULT '[]'::jsonb,
  sections JSONB NOT NULL DEFAULT '[]'::jsonb,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (built_at)
);

CREATE TABLE IF NOT EXISTS hww_records (
  id BIGSERIAL PRIMARY KEY,
  built_at TIMESTAMPTZ NOT NULL,
  stat TEXT NOT NULL,
  date TEXT NOT NULL,
  stat_week TEXT,
  value TEXT,
  unit TEXT,
  area TEXT,
  kind TEXT,
  source_file TEXT NOT NULL,
  source_key TEXT NOT NULL,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_hww_records_built_at ON hww_records (built_at DESC);
CREATE INDEX IF NOT EXISTS idx_hww_records_stat_date ON hww_records (stat, date);
CREATE INDEX IF NOT EXISTS idx_hww_summaries_built_at ON hww_summaries (built_at DESC);
