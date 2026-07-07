/**
 * ESTO Round 1 interview progress — board tint helpers.
 * **SSOT:** Neon `department_establishment.esto_round1_status` (migration 011).
 * Static fallback is used only when DB row/column is missing (pre-migrate).
 * Canonical doc: DABOS/docs/reference/dept-briefs/esto-round1-progress.md
 */
export type EstoRound1Status = 'done' | 'next' | 'pending';

const ESTO_ROUND1_DONE_FALLBACK = new Set([
  'Dept1',
  'Dept2',
  'Dept3',
  'Dept4',
  'Dept5',
  'Dept6',
  'Dept7',
  'Dept8',
  'Dept9',
  'Dept10',
  'Dept11',
  'Dept12',
  'Dept13',
  'Dept14',
]);

const ESTO_ROUND1_NEXT_FALLBACK = 'Dept15';

/** Fallback when Neon row is absent (e.g. before migration 011). */
export function getEstoRound1StatusFallback(deptId: string): EstoRound1Status {
  if (ESTO_ROUND1_DONE_FALLBACK.has(deptId)) return 'done';
  if (deptId === ESTO_ROUND1_NEXT_FALLBACK) return 'next';
  return 'pending';
}

/** Prefer Neon value; fall back to static map. */
export function resolveEstoRound1Status(
  deptId: string,
  fromDb: EstoRound1Status | null | undefined
): EstoRound1Status {
  return fromDb ?? getEstoRound1StatusFallback(deptId);
}

export function estoRound1StatusLabel(status: EstoRound1Status): string {
  switch (status) {
    case 'done':
      return 'ESTO Round 1 complete';
    case 'next':
      return 'ESTO Round 1 — next';
    case 'pending':
      return 'ESTO Round 1 not started';
  }
}

export function estoRound1StatusClass(status: EstoRound1Status): string {
  switch (status) {
    case 'done':
      return 'dabos-org-board__dept-cell--esto-done';
    case 'next':
      return 'dabos-org-board__dept-cell--esto-next';
    case 'pending':
      return 'dabos-org-board__dept-cell--esto-pending';
  }
}

type DeptEstoInput = {
  id: string;
  establishment?: { esto_round1_status?: EstoRound1Status } | null;
};

export function estoRound1ProgressFromDepartments(departments: DeptEstoInput[]): {
  done: number;
  total: number;
  next: string | null;
} {
  let done = 0;
  let next: string | null = null;
  for (const dept of departments) {
    const status = resolveEstoRound1Status(dept.id, dept.establishment?.esto_round1_status);
    if (status === 'done') done += 1;
    if (status === 'next') next = dept.id;
  }
  return { done, total: departments.length || 21, next };
}

/** @deprecated use resolveEstoRound1Status */
export function getEstoRound1Status(deptId: string): EstoRound1Status {
  return getEstoRound1StatusFallback(deptId);
}

/** @deprecated use estoRound1ProgressFromDepartments */
export function estoRound1ProgressSummary(): {
  done: number;
  total: number;
  next: string;
} {
  return {
    done: ESTO_ROUND1_DONE_FALLBACK.size,
    total: 21,
    next: ESTO_ROUND1_NEXT_FALLBACK,
  };
}
