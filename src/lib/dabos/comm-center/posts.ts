/**
 * Canonical comm-center posts (Dept2 pick-up schedule v3).
 * Addressee resolution: assigned_agent → division_id → LDW.
 */

export const COMM_POSTS = ['Div1', 'Div2', 'Div3', 'Div4', 'Div5', 'Div6', 'Div7', 'LDW'] as const;
export type CommPost = (typeof COMM_POSTS)[number];

export const DEPT_IDS = Array.from({ length: 21 }, (_, i) => `Dept${i + 1}` as const);
export type DeptId = (typeof DEPT_IDS)[number];

/** Explicit division_id / assigned_agent variants → canonical post. Abort if missing. */
export const DIVISION_ID_MAP: Readonly<Record<string, CommPost>> = {
  Div1: 'Div1',
  Div2: 'Div2',
  Div3: 'Div3',
  Div4: 'Div4',
  Div5: 'Div5',
  Div6: 'Div6',
  Div7: 'Div7',
  div1: 'Div1',
  div2: 'Div2',
  div3: 'Div3',
  div4: 'Div4',
  div5: 'Div5',
  div6: 'Div6',
  div7: 'Div7',
  DIV1: 'Div1',
  DIV2: 'Div2',
  DIV3: 'Div3',
  DIV4: 'Div4',
  DIV5: 'Div5',
  DIV6: 'Div6',
  DIV7: 'Div7',
  'Div 1': 'Div1',
  'Div 2': 'Div2',
  'Div 3': 'Div3',
  'Div 4': 'Div4',
  'Div 5': 'Div5',
  'Div 6': 'Div6',
  'Div 7': 'Div7',
};

/** assigned_agent values that name a post (not a capability like research). */
export const ASSIGNED_AGENT_POST_MAP: Readonly<Record<string, CommPost>> = {
  ...DIVISION_ID_MAP,
  LDW: 'LDW',
  ldw: 'LDW',
  Ldw: 'LDW',
};

/** Dept id string variants → canonical DeptN. */
export const DEPARTMENT_ID_MAP: Readonly<Record<string, DeptId>> = Object.fromEntries(
  DEPT_IDS.flatMap((id) => {
    const n = id.slice(4);
    return [
      [id, id],
      [id.toLowerCase(), id],
      [id.toUpperCase(), id],
      [`dept${n}`, id],
      [`DEPT${n}`, id],
      [`Dept ${n}`, id],
      [`dept ${n}`, id],
    ];
  })
) as Readonly<Record<string, DeptId>>;

export function isCommPost(v: string): v is CommPost {
  return (COMM_POSTS as readonly string[]).includes(v);
}

/** Resolve the station post for a task row. */
export function resolveCommPost(row: {
  assigned_agent?: string | null;
  division_id?: string | null;
}): CommPost | null {
  const agent = row.assigned_agent?.trim() ?? '';
  if (agent && agent in ASSIGNED_AGENT_POST_MAP) {
    return ASSIGNED_AGENT_POST_MAP[agent]!;
  }
  const div = row.division_id?.trim() ?? '';
  if (div && div in DIVISION_ID_MAP) {
    return DIVISION_ID_MAP[div]!;
  }
  return null;
}

/** Wake env stem: Div4 → DIV4, LDW → LDW → WAKE_DIV4_URL / WAKE_LDW_URL. */
export function wakeEnvStem(post: CommPost): string {
  return post.toUpperCase();
}
