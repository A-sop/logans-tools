-- B4 approval queue (PRD-013 step 3) — closes Dept21 comm_line B4 when channel named.

CREATE TABLE IF NOT EXISTS approval_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id TEXT,
  kind TEXT NOT NULL CHECK (kind IN ('send_message', 'spend', 'exec_capture', 'external_commit', 'other')),
  title TEXT NOT NULL,
  body TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
  requested_by TEXT NOT NULL DEFAULT 'system',
  decided_by TEXT,
  division_id TEXT REFERENCES divisions(id),
  department_id TEXT REFERENCES departments(id),
  task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_approval_queue_status ON approval_queue (status, created_at DESC);

-- Dept21: B4 channel = Tier 0 API + board (Slack when emails exist)
UPDATE department_establishment
SET
  comm_line_named = TRUE,
  comm_line = 'Tier 0 API + dabos board (/api/dabos/tier0); Slack pending LDW emails',
  updated_at = NOW()
WHERE department_id = 'Dept21';
