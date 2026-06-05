-- DABOS v1 core schema (PRD-001)

CREATE TABLE IF NOT EXISTS divisions (
  id TEXT PRIMARY KEY,
  operational_name TEXT NOT NULL,
  description TEXT,
  primary_metric_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS departments (
  id TEXT PRIMARY KEY,
  division_id TEXT NOT NULL REFERENCES divisions(id) ON DELETE CASCADE,
  legacy_name TEXT NOT NULL,
  operational_name TEXT NOT NULL,
  policy_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id TEXT,
  division_id TEXT NOT NULL REFERENCES divisions(id),
  department_id TEXT REFERENCES departments(id),
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'human' CHECK (type IN ('human', 'agent', 'approval')),
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'doing', 'blocked', 'done', 'cancelled')),
  priority INTEGER NOT NULL DEFAULT 3,
  assigned_to TEXT,
  assigned_agent TEXT,
  research_tier INTEGER NOT NULL DEFAULT 1,
  budget_tokens INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id TEXT,
  division_id TEXT NOT NULL REFERENCES divisions(id),
  department_id TEXT REFERENCES departments(id),
  metric_key TEXT NOT NULL,
  value NUMERIC NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS conditions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('division', 'department', 'workspace', 'project')),
  entity_id TEXT NOT NULL,
  condition TEXT CHECK (condition IN ('Normal', 'Emergency', 'Danger')),
  confidence NUMERIC,
  basis JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id TEXT,
  division_id TEXT REFERENCES divisions(id),
  department_id TEXT REFERENCES departments(id),
  task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  type TEXT NOT NULL DEFAULT 'document',
  summary TEXT NOT NULL,
  storage_uri TEXT,
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  permissions JSONB,
  created_by TEXT NOT NULL DEFAULT 'human',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cost_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id TEXT,
  task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  agent_name TEXT NOT NULL,
  provider TEXT NOT NULL,
  tokens_input INTEGER,
  tokens_output INTEGER,
  cost_eur NUMERIC,
  category TEXT NOT NULL DEFAULT 'llm' CHECK (category IN ('llm', 'saas', 'other')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stats_division_metric ON stats (division_id, metric_key, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_division_status ON tasks (division_id, status);
CREATE INDEX IF NOT EXISTS idx_conditions_entity ON conditions (entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_artifacts_task ON artifacts (task_id);

CREATE TABLE IF NOT EXISTS dabos_migrations (
  id TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
