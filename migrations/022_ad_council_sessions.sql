-- 022: Ad Council sessions + decisions (founder design 2026-11-05).
-- PLAN → APPLY: Neon SSOT for council read/recommend/decide; does not assign conditions.
-- Condition assignments stay on entity_condition_state / condition_founder_rulings.
-- Writers: each Div Sec INSERT with actor_id; Dept19 / Dept3 Ethics (OSA) cross-check.
-- Idempotent CREATE IF NOT EXISTS. Run: npm run dabos:migrate (after Dept13 PASS when required).

CREATE TABLE IF NOT EXISTS ad_council_sessions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_key       TEXT NOT NULL,
  stat_week_id      TEXT NOT NULL,
  timezone          TEXT NOT NULL DEFAULT 'Europe/Berlin',
  week_start_at     TIMESTAMPTZ NOT NULL,
  week_close_at     TIMESTAMPTZ NOT NULL,
  purpose           TEXT NOT NULL CHECK (purpose IN ('week_close', 'week_plan', 'ad_hoc')),
  status            TEXT NOT NULL DEFAULT 'open'
                      CHECK (status IN ('open', 'packet_sent', 'founder_pending', 'closed', 'superseded')),
  stats_workspaces  TEXT[] NOT NULL DEFAULT '{}',
  stats_row_ids     UUID[] NOT NULL DEFAULT '{}',
  stats_read_at     TIMESTAMPTZ,
  stats_snapshot    JSONB,
  conditions_basis  JSONB,
  notes_md          TEXT,
  recorded_by       TEXT NOT NULL,
  recorded_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  superseded_at     TIMESTAMPTZ,
  superseded_reason TEXT,
  UNIQUE (session_key)
);

CREATE INDEX IF NOT EXISTS idx_ad_council_sessions_week
  ON ad_council_sessions (stat_week_id, purpose)
  WHERE superseded_at IS NULL;

CREATE TABLE IF NOT EXISTS ad_council_decisions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id        UUID NOT NULL REFERENCES ad_council_sessions(id),
  actor_kind        TEXT NOT NULL CHECK (actor_kind IN (
                      'division_secretary', 'div7_chair', 'dept19', 'dept3_ethics',
                      'communicator', 'founder'
                    )),
  actor_id          TEXT NOT NULL,
  decision_kind     TEXT NOT NULL CHECK (decision_kind IN (
                      'condition_recommend',
                      'plan_recommend',
                      'council_decide',
                      'founder_decide',
                      'agenda_item',
                      'ethics_crosscheck',
                      'blocking_issue'
                    )),
  subject           TEXT NOT NULL,
  body_md           TEXT,
  entity_type       TEXT CHECK (entity_type IS NULL OR entity_type IN (
                      'division','department','workspace','project'
                    )),
  entity_id         TEXT,
  recommended_condition TEXT,
  founder_ruling_id UUID REFERENCES condition_founder_rulings(id),
  owner_division_id TEXT REFERENCES divisions(id),
  target_metric_key TEXT,
  target_value      NUMERIC,
  agenda_status     TEXT CHECK (agenda_status IS NULL OR agenda_status IN (
                      'proposed','accepted','amended','dropped','done','missed'
                    )),
  -- standing battle-plan staple vs conditions-formula activity (founder: both)
  activity_kind     TEXT CHECK (activity_kind IS NULL OR activity_kind IN (
                      'standing_nonnegotiable', 'conditions_handling', 'other'
                    )),
  recorded_by       TEXT NOT NULL,
  recorded_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  superseded_at     TIMESTAMPTZ,
  superseded_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_ad_council_decisions_session
  ON ad_council_decisions (session_id, decision_kind)
  WHERE superseded_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_ad_council_decisions_actor
  ON ad_council_decisions (actor_id, recorded_at DESC)
  WHERE superseded_at IS NULL;

-- Hot path for Div1 / Communicator live week reads
CREATE INDEX IF NOT EXISTS idx_stats_workspace_div_metric_live
  ON public.stats (workspace_id, division_id, metric_key, recorded_at DESC)
  WHERE superseded_at IS NULL;

COMMENT ON TABLE ad_council_sessions IS 'One Ad Council sitting / week close or plan; refs stats ids; supersede pattern';
COMMENT ON TABLE ad_council_decisions IS 'Secretary recommends, council decides, founder decides, agenda; ethics cross-check rows; does not assign conditions';
