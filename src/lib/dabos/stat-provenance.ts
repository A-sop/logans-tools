/** Human-readable label for stats.workspace_id (data lineage). */
export function statSourceLabel(workspaceId: string | null | undefined): string {
  if (!workspaceId) return 'Manual / migration';
  if (workspaceId === 'seed-ytd-2026') return 'Demo seed (npm run dabos:seed-stats)';
  if (workspaceId === 'baseline-gfp' || workspaceId === 'baseline-dvag') {
    return 'DVAG residual baseline (~€2,400/mo average — Proviso)';
  }
  if (workspaceId === 'proviso') return 'Proviso monthly import (exact)';
  if (workspaceId.startsWith('gfp-live')) {
    return 'GFP funnel weekly poster (lead magnets + booked proxy for termin_clicks)';
  }
  if (workspaceId.startsWith('div-live')) {
    return 'Division weekly poster (registers + ship-log + Dept13 + establishment)';
  }
  if (workspaceId.startsWith('proviso-')) {
    return 'Proviso Abrechnung monthly (Diskont-Konto residual)';
  }
  if (workspaceId.startsWith('hat-corr-')) {
    return 'Dept1 hat correction (evidence-backed)';
  }
  return workspaceId;
}

export function isDemoStat(workspaceId: string | null | undefined): boolean {
  return workspaceId === 'seed-ytd-2026';
}

export function statSourceDescription(workspaceId: string | null | undefined): string {
  if (workspaceId === 'seed-ytd-2026') {
    return 'Synthetic weekly points for board/condition demo — not real money. Clear with npm run dabos:clear-seed-stats.';
  }
  if (workspaceId === 'baseline-gfp' || workspaceId === 'baseline-dvag') {
    return 'Planning average for venture:dvag. Replace with exact Proviso commission after monthly payout close.';
  }
  if (workspaceId === 'proviso') {
    return 'Imported from Proviso (C:\\Dev\\Proviso) monthly commission release — exact residual.';
  }
  if (workspaceId?.startsWith('gfp-live')) {
    return 'GFP campaign_leads week rollup. termin_clicks value is Cal booked proxy until PostHog CTA ingest.';
  }
  if (workspaceId?.startsWith('div-live')) {
    return 'Div2 content factory + pipeline; Div4 ship-log Counts=yes; Div5 Dept13 PASS rate; Div7 establishment reported/21. Skips when local sources missing (Vercel-safe).';
  }
  if (workspaceId?.startsWith('proviso-')) {
    return 'Sum of Proviso commission_events Diskont-Konto for VB 2106750 that Monat (digitale Abrechnung). Other incomes post as separate workspaces when added.';
  }
  if (workspaceId?.startsWith('hat-corr-')) {
    return 'Real hat/doc fix cycle for Dept1. Spot-checkable evidence in role_runs + founder-office flap.';
  }
  if (!workspaceId) {
    return 'Entered via the board UI or a one-off migration.';
  }
  return `Tagged source: ${workspaceId}`;
}
