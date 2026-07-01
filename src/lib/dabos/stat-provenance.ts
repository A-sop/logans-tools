/** Human-readable label for stats.workspace_id (data lineage). */
export function statSourceLabel(workspaceId: string | null | undefined): string {
  if (!workspaceId) return 'Manual / migration';
  if (workspaceId === 'seed-ytd-2026') return 'Demo seed (npm run dabos:seed-stats)';
  if (workspaceId === 'baseline-gfp') return 'Founder baseline (€2,400/mo placeholder)';
  if (workspaceId === 'proviso') return 'Proviso monthly import';
  return workspaceId;
}

export function isDemoStat(workspaceId: string | null | undefined): boolean {
  return workspaceId === 'seed-ytd-2026';
}

export function statSourceDescription(workspaceId: string | null | undefined): string {
  if (workspaceId === 'seed-ytd-2026') {
    return 'Synthetic weekly points for board/condition demo — not real money. Clear with npm run dabos:clear-seed-stats.';
  }
  if (workspaceId === 'baseline-gfp') {
    return 'Placeholder until Proviso monthly import runs. Replace with real Proviso commission data.';
  }
  if (workspaceId === 'proviso') {
    return 'Imported from Proviso (C:\\Dev\\Proviso) monthly commission release.';
  }
  if (!workspaceId) {
    return 'Entered via the board UI or a one-off migration.';
  }
  return `Tagged source: ${workspaceId}`;
}
