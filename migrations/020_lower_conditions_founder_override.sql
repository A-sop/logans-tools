-- 020: Lower conditions (below Non-Existence) + founder-ruling override
-- Ruling: Logan Williams, 21 Oct 2026 (relayed by LDW Communicator).
-- Scale (best -> worst): Power Change, Power, Affluence, Normal, Emergency, Danger,
--   Non-Existence, Liability, Doubt, Enemy, Treason, Confusion.
-- SSOT: DABOS docs/reference/conditions-ethics-ssot.md
-- Idempotent. Run with: npm run dabos:migrate (Logan only).

-- 1. Widen allowed condition values (existing values kept).
ALTER TABLE conditions DROP CONSTRAINT IF EXISTS conditions_condition_check;
ALTER TABLE conditions ADD CONSTRAINT conditions_condition_check CHECK (
  condition IN ('Power Change','Power','Affluence','Normal','Emergency','Danger','Non-Existence',
                'Liability','Doubt','Enemy','Treason','Confusion')
);

ALTER TABLE entity_condition_state DROP CONSTRAINT IF EXISTS entity_condition_state_working_condition_check;
ALTER TABLE entity_condition_state ADD CONSTRAINT entity_condition_state_working_condition_check CHECK (
  working_condition IN ('Power Change','Power','Affluence','Normal','Emergency','Danger','Non-Existence',
                        'Liability','Doubt','Enemy','Treason','Confusion')
);

ALTER TABLE entity_condition_state DROP CONSTRAINT IF EXISTS entity_condition_state_stat_indicated_condition_check;
ALTER TABLE entity_condition_state ADD CONSTRAINT entity_condition_state_stat_indicated_condition_check CHECK (
  stat_indicated_condition IS NULL OR stat_indicated_condition IN (
    'Power Change','Power','Affluence','Normal','Emergency','Danger','Non-Existence',
    'Liability','Doubt','Enemy','Treason','Confusion')
);

ALTER TABLE condition_formula_completions DROP CONSTRAINT IF EXISTS condition_formula_completions_condition_label_check;
ALTER TABLE condition_formula_completions ADD CONSTRAINT condition_formula_completions_condition_label_check CHECK (
  condition_label IN ('Power Change','Power','Affluence','Normal','Emergency','Danger','Non-Existence',
                      'Liability','Doubt','Enemy','Treason','Confusion')
);

-- 2. Founder-ruling override on the working condition.
--    condition_source: 'computed' (stats/default), 'formula' (verified EP advance), 'founder_ruling'.
--    A founder_ruling row is never overwritten by stat refresh; only a verified formula
--    advance (or a newer founder ruling) changes it.
ALTER TABLE entity_condition_state
  ADD COLUMN IF NOT EXISTS condition_source TEXT NOT NULL DEFAULT 'computed',
  ADD COLUMN IF NOT EXISTS ruling_date DATE,
  ADD COLUMN IF NOT EXISTS ruling_ref TEXT,
  ADD COLUMN IF NOT EXISTS ruling_note TEXT;

ALTER TABLE entity_condition_state DROP CONSTRAINT IF EXISTS entity_condition_state_condition_source_check;
ALTER TABLE entity_condition_state ADD CONSTRAINT entity_condition_state_condition_source_check CHECK (
  condition_source IN ('computed','formula','founder_ruling')
);

ALTER TABLE entity_condition_state DROP CONSTRAINT IF EXISTS entity_condition_state_founder_ruling_fields_check;
ALTER TABLE entity_condition_state ADD CONSTRAINT entity_condition_state_founder_ruling_fields_check CHECK (
  condition_source <> 'founder_ruling' OR (ruling_date IS NOT NULL AND ruling_ref IS NOT NULL)
);

-- 3. Append-only audit log of founder rulings.
CREATE TABLE IF NOT EXISTS condition_founder_rulings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('division','department','workspace','project')),
  entity_id TEXT NOT NULL,
  condition_label TEXT NOT NULL CHECK (
    condition_label IN ('Power Change','Power','Affluence','Normal','Emergency','Danger','Non-Existence',
                        'Liability','Doubt','Enemy','Treason','Confusion')
  ),
  ruling_date DATE NOT NULL,
  ruling_ref TEXT NOT NULL,
  ruling_note TEXT,
  ruled_by TEXT NOT NULL DEFAULT 'founder',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (entity_type, entity_id, ruling_date, condition_label)
);

CREATE INDEX IF NOT EXISTS idx_condition_founder_rulings_entity
  ON condition_founder_rulings (entity_type, entity_id, ruling_date DESC);
