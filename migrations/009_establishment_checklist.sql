-- E3 establishment sprint (T1): department establishment flags + first stats.
-- Data source: DABOS/docs/reference/dept-briefs/establishment-checklist.md (2026-07-04).
-- Idempotent: upserts + guarded inserts; safe to re-run manually.

-- 1. Refresh the 21 departments (legacy_name + operational_name per HANDOVER).
INSERT INTO departments (id, division_id, legacy_name, operational_name) VALUES
  ('Dept1', 'Div1', 'Recognition', 'Intake & Classification'),
  ('Dept2', 'Div1', 'Communication', 'Coordination Layer'),
  ('Dept3', 'Div1', 'Perception', 'Stats & Visibility Layer'),
  ('Dept4', 'Div2', 'Content', 'Content Production'),
  ('Dept5', 'Div2', 'Channels', 'Channel Distribution'),
  ('Dept6', 'Div2', 'Outreach', 'Audience Touchpoints'),
  ('Dept7', 'Div3', 'Energy', 'Capital Flow'),
  ('Dept8', 'Div3', 'Accounts', 'Ledger & Accounts'),
  ('Dept9', 'Div3', 'Body', 'Physical Assets & Reserve'),
  ('Dept10', 'Div4', 'Architecture', 'Systems Design'),
  ('Dept11', 'Div4', 'Engineering', 'Implementation'),
  ('Dept12', 'Div4', 'Production', 'Ship & Deploy'),
  ('Dept13', 'Div5', 'Result', 'Output Validation'),
  ('Dept14', 'Div5', 'Standards', 'Quality Standards'),
  ('Dept15', 'Div5', 'Audit', 'Compliance Review'),
  ('Dept16', 'Div6', 'Market', 'Market Interface'),
  ('Dept17', 'Div6', 'Sales', 'Conversion'),
  ('Dept18', 'Div6', 'Service', 'Customer Success'),
  ('Dept19', 'Div7', 'Conditions', 'Condition & Planning Loop'),
  ('Dept20', 'Div7', 'Strategy', 'Strategic Priorities'),
  ('Dept21', 'Div7', 'Office', 'Executive Office')
ON CONFLICT (id) DO UPDATE SET
  division_id = EXCLUDED.division_id,
  legacy_name = EXCLUDED.legacy_name,
  operational_name = EXCLUDED.operational_name;

-- 2. Establishment flags + stat status per department.
--    stat_status 'reported' rows carry a metric key (value lives in stats);
--    'to-report' rows carry only a pointer string. No third state.
CREATE TABLE IF NOT EXISTS department_establishment (
  department_id TEXT PRIMARY KEY REFERENCES departments(id) ON DELETE CASCADE,
  hat_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  stat_defined BOOLEAN NOT NULL DEFAULT FALSE,
  comm_line_named BOOLEAN NOT NULL DEFAULT FALSE,
  first_output_named BOOLEAN NOT NULL DEFAULT FALSE,
  comm_line TEXT,
  stat_status TEXT NOT NULL CHECK (stat_status IN ('reported', 'to-report')),
  stat_metric_key TEXT,
  stat_pointer TEXT,
  checked_at DATE NOT NULL DEFAULT CURRENT_DATE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT establishment_stat_shape CHECK (
    (stat_status = 'reported' AND stat_metric_key IS NOT NULL)
    OR (stat_status = 'to-report' AND stat_pointer IS NOT NULL)
  )
);

INSERT INTO department_establishment (
  department_id, hat_confirmed, stat_defined, comm_line_named, first_output_named,
  comm_line, stat_status, stat_metric_key, stat_pointer, checked_at
) VALUES
  ('Dept1',  TRUE, TRUE, TRUE,  TRUE, 'Dept2 routing',                          'to-report', NULL, 'intake counts, wiki inbox', '2026-07-04'),
  ('Dept2',  TRUE, TRUE, TRUE,  TRUE, 'all depts (router)',                     'to-report', NULL, 'task system', '2026-07-04'),
  ('Dept3',  TRUE, TRUE, TRUE,  TRUE, 'Dept19 rollup',                          'to-report', NULL, 'artifacts_indexed once registers exist', '2026-07-04'),
  ('Dept4',  TRUE, TRUE, TRUE,  TRUE, 'Dept5 handoff',                          'to-report', NULL, 'content_items_shipped, content_runway', '2026-07-04'),
  ('Dept5',  TRUE, TRUE, TRUE,  TRUE, 'Dept4/Dept6',                            'to-report', NULL, 'publish log', '2026-07-04'),
  ('Dept6',  TRUE, TRUE, TRUE,  TRUE, 'Dept5/Dept18 boundary',                  'to-report', NULL, 'CRM truth (Block D)', '2026-07-04'),
  ('Dept7',  TRUE, TRUE, TRUE,  TRUE, 'Dept8 + Logan (25th)',                   'to-report', NULL, 'income SSOT, next window 10th/25th', '2026-07-04'),
  ('Dept8',  TRUE, TRUE, TRUE,  TRUE, 'Logan (payments)',                       'to-report', NULL, 'obligations register C:\DATA\dabos-registers\', '2026-07-04'),
  ('Dept9',  TRUE, TRUE, TRUE,  TRUE, 'Dept8 register feed',                    'to-report', NULL, 'disk_headroom_pct script (T3)', '2026-07-04'),
  ('Dept10', TRUE, TRUE, TRUE,  TRUE, 'Dept11 handdown',                        'reported',  'prds_indexed', NULL, '2026-07-04'),
  ('Dept11', TRUE, TRUE, TRUE,  TRUE, 'Dept10/Dept12',                          'to-report', NULL, 'first completions entry (sprint tasks count)', '2026-07-04'),
  ('Dept12', TRUE, TRUE, TRUE,  TRUE, 'Dept11/Div5 gate',                       'to-report', NULL, 'ship log after first validated ship', '2026-07-04'),
  ('Dept13', TRUE, TRUE, TRUE,  TRUE, 'validation queue',                       'to-report', NULL, 'qa_pass_rate after first verdicts', '2026-07-04'),
  ('Dept14', TRUE, TRUE, TRUE,  TRUE, 'Dept13/Dept20',                          'reported',  'hat_card_coverage_pct', NULL, '2026-07-04'),
  ('Dept15', TRUE, TRUE, TRUE,  TRUE, 'ticket intake',                          'reported',  'compliance_open_count', NULL, '2026-07-04'),
  ('Dept16', TRUE, TRUE, TRUE,  TRUE, 'Dept17 handoff',                         'to-report', NULL, 'Ahrefs + PostHog (T4)', '2026-07-04'),
  ('Dept17', TRUE, TRUE, TRUE,  TRUE, 'Dept7 close-to-collect',                 'to-report', NULL, 'pipeline register (Logan seeds deals)', '2026-07-04'),
  ('Dept18', TRUE, TRUE, TRUE,  TRUE, 'Dept4/Dept17 feeds',                     'reported',  'testimonials_collected', NULL, '2026-07-04'),
  ('Dept19', TRUE, TRUE, TRUE,  TRUE, 'Thursday rollup',                        'to-report', NULL, 'first Thursday rollup 2026-07-09', '2026-07-04'),
  ('Dept20', TRUE, TRUE, TRUE,  TRUE, 'org board itself',                       'reported',  'establishment_coverage_depts', NULL, '2026-07-04'),
  ('Dept21', TRUE, TRUE, FALSE, TRUE, 'approval-queue channel unsettled (B4)',  'reported',  'council_artifacts', NULL, '2026-07-04')
ON CONFLICT (department_id) DO UPDATE SET
  hat_confirmed = EXCLUDED.hat_confirmed,
  stat_defined = EXCLUDED.stat_defined,
  comm_line_named = EXCLUDED.comm_line_named,
  first_output_named = EXCLUDED.first_output_named,
  comm_line = EXCLUDED.comm_line,
  stat_status = EXCLUDED.stat_status,
  stat_metric_key = EXCLUDED.stat_metric_key,
  stat_pointer = EXCLUDED.stat_pointer,
  checked_at = EXCLUDED.checked_at,
  updated_at = NOW();

-- 3. The six reported stat values (bare numbers only), tagged for lineage.
--    Guarded: re-running never duplicates rows.
INSERT INTO stats (workspace_id, division_id, department_id, metric_key, value, recorded_at)
SELECT v.workspace_id, v.division_id, v.department_id, v.metric_key, v.value, v.recorded_at
FROM (VALUES
  ('establishment-2026-07-04', 'Div4', 'Dept10', 'prds_indexed',                 15::numeric, '2026-07-04T12:00:00Z'::timestamptz),
  ('establishment-2026-07-04', 'Div5', 'Dept14', 'hat_card_coverage_pct',        100::numeric, '2026-07-04T12:00:00Z'::timestamptz),
  ('establishment-2026-07-04', 'Div5', 'Dept15', 'compliance_open_count',        4::numeric, '2026-07-04T12:00:00Z'::timestamptz),
  ('establishment-2026-07-04', 'Div6', 'Dept18', 'testimonials_collected',       1::numeric, '2026-07-04T12:00:00Z'::timestamptz),
  ('establishment-2026-07-04', 'Div7', 'Dept20', 'establishment_coverage_depts', 21::numeric, '2026-07-04T12:00:00Z'::timestamptz),
  ('establishment-2026-07-04', 'Div7', 'Dept21', 'council_artifacts',            1::numeric, '2026-07-04T12:00:00Z'::timestamptz)
) AS v(workspace_id, division_id, department_id, metric_key, value, recorded_at)
WHERE NOT EXISTS (
  SELECT 1 FROM stats s
  WHERE s.workspace_id = v.workspace_id
    AND s.department_id = v.department_id
    AND s.metric_key = v.metric_key
);

-- 4. Ground rule 1 (checklist): all working conditions are Non-Existence.
INSERT INTO entity_condition_state (entity_type, entity_id, working_condition)
SELECT 'department', id, 'Non-Existence' FROM departments
ON CONFLICT (entity_type, entity_id) DO UPDATE SET
  working_condition = 'Non-Existence',
  updated_at = NOW();

INSERT INTO entity_condition_state (entity_type, entity_id, working_condition)
SELECT 'division', id, 'Non-Existence' FROM divisions
ON CONFLICT (entity_type, entity_id) DO UPDATE SET
  working_condition = 'Non-Existence',
  updated_at = NOW();
