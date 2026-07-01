-- Tag GFP baseline stat with explicit workspace_id (lineage)

UPDATE stats
SET workspace_id = 'baseline-gfp'
WHERE division_id = 'Div3'
  AND metric_key = 'taxable_income_eur'
  AND value = 2400
  AND workspace_id IS NULL;
