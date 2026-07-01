-- Role activation audit trail (A-249 Phase 1)

CREATE TABLE IF NOT EXISTS role_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id TEXT NOT NULL,
  role_type TEXT NOT NULL CHECK (role_type IN ('executive', 'division', 'department', 'capability', 'cadence')),
  ran_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  summary_json JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_role_runs_role_ran ON role_runs (role_id, ran_at DESC);
CREATE INDEX IF NOT EXISTS idx_role_runs_type_ran ON role_runs (role_type, ran_at DESC);
