-- ESTO Round 1 interview progress tint on org board (Logan 2026-07-07).
-- Source of truth: DABOS/docs/reference/dept-briefs/esto-round1-progress.md
-- Update via dabos:migrate after each dept riff (edit this file or scripts/dabos/update-esto-round1.ts).

ALTER TABLE department_establishment
  ADD COLUMN IF NOT EXISTS esto_round1_status TEXT NOT NULL DEFAULT 'pending'
  CHECK (esto_round1_status IN ('done', 'next', 'pending'));

-- Depts 1–14 riff captured (2026-07-07)
UPDATE department_establishment
SET esto_round1_status = 'done', updated_at = NOW()
WHERE department_id IN (
  'Dept1', 'Dept2', 'Dept3', 'Dept4', 'Dept5', 'Dept6', 'Dept7', 'Dept8', 'Dept9',
  'Dept10', 'Dept11', 'Dept12', 'Dept13', 'Dept14'
);

UPDATE department_establishment
SET esto_round1_status = 'next', updated_at = NOW()
WHERE department_id = 'Dept15';

UPDATE department_establishment
SET esto_round1_status = 'pending', updated_at = NOW()
WHERE department_id IN ('Dept16', 'Dept17', 'Dept18', 'Dept19', 'Dept20', 'Dept21');
