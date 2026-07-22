-- W0 GFP funnel: Dept16 lead_magnets_shipped + Dept17 termin_clicks establishment pointers.
-- Stats rows are posted weekly by scripts/dabos/post-gfp-weekly-stats.ts (workspace_id: gfp-live).
-- Idempotent: only updates establishment when still why-unknown.

UPDATE department_establishment SET
  stat_status = 'reported',
  stat_metric_key = 'lead_magnets_shipped',
  stat_pointer = 'gfp-live:campaign_leads + PostHog lead_magnet_downloaded',
  checked_at = CURRENT_DATE,
  updated_at = NOW()
WHERE department_id = 'Dept16'
  AND stat_status = 'why-unknown';

UPDATE department_establishment SET
  stat_status = 'reported',
  stat_metric_key = 'termin_clicks',
  stat_pointer = 'gfp-live:PostHog termin_click + money_manual_book_click; booked via Cal webhook',
  checked_at = CURRENT_DATE,
  updated_at = NOW()
WHERE department_id = 'Dept17'
  AND stat_status = 'why-unknown';
