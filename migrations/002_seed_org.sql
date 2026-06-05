-- Seed Div1–Div7 and Dept1–Dept21 (canonical IDs; names from DABOS org chart docs)

INSERT INTO divisions (id, operational_name, description, primary_metric_key) VALUES
  ('Div1', 'Comms & Intelligence', 'Indexing, discovery, and visibility — not a message bottleneck.', 'artifacts_indexed'),
  ('Div2', 'Dissemination', 'Content, channels, and outbound touchpoints.', 'leads_or_touchpoints_created'),
  ('Div3', 'Treasury', 'Capital, costs, and physical asset reserve.', 'net_eur'),
  ('Div4', 'Technical', 'Build, ship, and systems production.', 'shipped_outputs'),
  ('Div5', 'Qualification', 'Validation gate — approved outputs only count.', 'qa_pass_rate'),
  ('Div6', 'Public', 'Market interface, conversion, and retention.', 'conversions'),
  ('Div7', 'Executive', 'Priorities, conditions, and strategic decisions.', 'plan_completion_rate')
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
