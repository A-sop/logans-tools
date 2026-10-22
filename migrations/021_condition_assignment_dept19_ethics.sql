-- 021: One condition-assignment rule (founder ruling 2026-10-22 22:31).
-- Dept19 Conditions + Dept3 Ethics assign conditions across the whole ladder
-- (Confusion..Power Change) on stat evidence: default path, condition_source 'dept19_ethics'.
-- The founder may override any condition at any time: condition_source 'founder_ruling'.
-- Supersedes the ED/founder-only assignment of lower conditions from 020 (020 itself is not edited;
-- it may already be applied). Upgrade gate unchanged: only a founder_ruling authorises a raise.
-- SSOT: DABOS docs/reference/conditions-ethics-ssot.md
-- Receipt: DABOS docs/reference/staff-status/receipts/founder-decision-condition-assignment-2026-10-22.md
-- Idempotent. Run with: npm run dabos:migrate (Logan only).

-- 1. Allow the Dept19 + Dept3 Ethics assignment source.
ALTER TABLE entity_condition_state DROP CONSTRAINT IF EXISTS entity_condition_state_condition_source_check;
ALTER TABLE entity_condition_state ADD CONSTRAINT entity_condition_state_condition_source_check CHECK (
  condition_source IN ('computed','formula','founder_ruling','dept19_ethics')
);

-- 2. Every assigned row (founder or Dept19 + Ethics) carries a date and a receipt ref.
ALTER TABLE entity_condition_state DROP CONSTRAINT IF EXISTS entity_condition_state_founder_ruling_fields_check;
ALTER TABLE entity_condition_state DROP CONSTRAINT IF EXISTS entity_condition_state_assignment_fields_check;
ALTER TABLE entity_condition_state ADD CONSTRAINT entity_condition_state_assignment_fields_check CHECK (
  condition_source NOT IN ('founder_ruling','dept19_ethics') OR (ruling_date IS NOT NULL AND ruling_ref IS NOT NULL)
);

-- 3. The append-only audit log records who assigned: founder override or Dept19 + Dept3 Ethics.
ALTER TABLE condition_founder_rulings DROP CONSTRAINT IF EXISTS condition_founder_rulings_ruled_by_check;
ALTER TABLE condition_founder_rulings ADD CONSTRAINT condition_founder_rulings_ruled_by_check CHECK (
  ruled_by IN ('founder','dept19_ethics')
);
-- Replace 020's unique key (auto-named, possibly truncated) so founder and Dept19 + Ethics rows can coexist.
DO $$
DECLARE c TEXT;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'condition_founder_rulings'::regclass AND contype = 'u'
      AND conname <> 'condition_founder_rulings_entity_date_label_by_key'
  LOOP
    EXECUTE format('ALTER TABLE condition_founder_rulings DROP CONSTRAINT %I', c);
  END LOOP;
END $$;
ALTER TABLE condition_founder_rulings DROP CONSTRAINT IF EXISTS condition_founder_rulings_entity_date_label_by_key;
ALTER TABLE condition_founder_rulings ADD CONSTRAINT condition_founder_rulings_entity_date_label_by_key
  UNIQUE (entity_type, entity_id, ruling_date, condition_label, ruled_by);
COMMENT ON TABLE condition_founder_rulings IS
  'Append-only condition assignment log: ruled_by founder (override) or dept19_ethics (default path). Ruling 2026-10-22 22:31.';