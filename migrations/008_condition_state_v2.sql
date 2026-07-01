-- PRD-004 v2: working condition + formula completions (sequential climb)

CREATE TABLE IF NOT EXISTS entity_condition_state (
  entity_type TEXT NOT NULL CHECK (entity_type IN ('division', 'department', 'workspace', 'project')),
  entity_id TEXT NOT NULL,
  working_condition TEXT NOT NULL CHECK (
    working_condition IN (
      'Power Change',
      'Power',
      'Affluence',
      'Normal',
      'Emergency',
      'Danger',
      'Non-Existence'
    )
  ),
  stat_indicated_condition TEXT CHECK (
    stat_indicated_condition IS NULL OR stat_indicated_condition IN (
      'Power Change',
      'Power',
      'Affluence',
      'Normal',
      'Emergency',
      'Danger',
      'Non-Existence'
    )
  ),
  stat_indicated_at TIMESTAMPTZ,
  danger_why JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (entity_type, entity_id)
);

CREATE TABLE IF NOT EXISTS condition_formula_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('division', 'department', 'workspace', 'project')),
  entity_id TEXT NOT NULL,
  condition_label TEXT NOT NULL CHECK (
    condition_label IN (
      'Power Change',
      'Power',
      'Affluence',
      'Normal',
      'Emergency',
      'Danger',
      'Non-Existence'
    )
  ),
  steps_completed JSONB NOT NULL DEFAULT '[]'::jsonb,
  probable_why TEXT,
  danger_why_basis JSONB,
  attested_by TEXT NOT NULL DEFAULT 'human',
  verified_by TEXT,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_condition_formula_completions_entity
  ON condition_formula_completions (entity_type, entity_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_entity_condition_state_working
  ON entity_condition_state (working_condition);
