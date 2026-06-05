-- PRD-004: expand condition enum to full upper ladder
ALTER TABLE conditions DROP CONSTRAINT IF EXISTS conditions_condition_check;

ALTER TABLE conditions ADD CONSTRAINT conditions_condition_check CHECK (
  condition IN (
    'Power Change',
    'Power',
    'Affluence',
    'Normal',
    'Emergency',
    'Danger',
    'Non-Existence'
  )
);
