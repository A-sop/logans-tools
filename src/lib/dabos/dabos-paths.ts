import { BOARD_DIVISION_ORDER } from '@/lib/dabos/org-board-config';

/** Canonical department page — Dept ids are globally unique. */
export function dabosDeptHref(deptId: string): string {
  return `/dabos/depts/${deptId}`;
}

export function dabosDivisionHref(divisionId: string): string {
  return `/dabos/divisions/${divisionId}`;
}

export type BrowseDept = {
  id: string;
  division_id: string;
  legacy_name: string;
  operational_name: string;
};

/** Board column order, then numeric Dept id within each division. */
export function orderDepartmentsForBrowse(rows: BrowseDept[]): BrowseDept[] {
  const byDiv = new Map<string, BrowseDept[]>();
  for (const row of rows) {
    const list = byDiv.get(row.division_id) ?? [];
    list.push(row);
    byDiv.set(row.division_id, list);
  }
  for (const list of byDiv.values()) {
    list.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
  }

  const out: BrowseDept[] = [];
  const seen = new Set<string>();
  for (const divId of BOARD_DIVISION_ORDER) {
    const list = byDiv.get(divId);
    if (!list) continue;
    out.push(...list);
    seen.add(divId);
  }
  for (const [divId, list] of byDiv) {
    if (!seen.has(divId)) out.push(...list);
  }
  return out;
}

export function neighborsInBrowseChain(
  chain: BrowseDept[],
  currentDeptId: string
): { index: number; prev: BrowseDept | null; next: BrowseDept | null } {
  const index = chain.findIndex((d) => d.id === currentDeptId);
  if (index < 0 || chain.length === 0) {
    return { index: -1, prev: null, next: null };
  }
  if (chain.length === 1) {
    return { index, prev: null, next: null };
  }
  const prev = chain[(index - 1 + chain.length) % chain.length] ?? null;
  const next = chain[(index + 1) % chain.length] ?? null;
  return { index, prev, next };
}
