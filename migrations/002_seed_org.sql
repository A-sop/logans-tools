-- Seed Div1–Div7 and Dept1–Dept21 (canonical IDs; names from DABOS org chart docs)

-- GDS keys per FPL 30 Sep 65 map (migration 023 duals secondary_metric_key on live DB).
INSERT INTO divisions (id, operational_name, description, primary_metric_key) VALUES
  ('Div1', 'Comms & Intelligence', 'Comm handled out/in (modern Letters).', 'comms_out'),
  ('Div2', 'Dissemination', 'New enrollments + product/book/course sales.', 'new_enrollments'),
  ('Div3', 'Treasury', 'Collections vs bills paid (dual GDS).', 'collections_eur'),
  ('Div4', 'Technical', 'Completions — finished exchangeable delivery.', 'completions'),
  ('Div5', 'Qualification', 'Cash paid for Qual/correction services.', 'qual_cash_eur'),
  ('Div6', 'Public', 'FSM commissions paid / new CF addresses.', 'fsm_commissions_paid_eur'),
  ('Div7', 'Executive', 'Gross Income of the org.', 'gross_income_eur')
ON CONFLICT (id) DO UPDATE SET
  operational_name = EXCLUDED.operational_name,
  description = EXCLUDED.description,
  primary_metric_key = EXCLUDED.primary_metric_key;

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
