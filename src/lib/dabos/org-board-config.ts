/** DABOS organizing-board layout (Div7 → Div6 column order). */
export const BOARD_DIVISION_ORDER = [
  'Div7',
  'Div1',
  'Div2',
  'Div3',
  'Div4',
  'Div5',
  'Div6',
] as const;

/** Left block under DCO Executive Secretary */
export const DCO_DIVISION_IDS = ['Div7', 'Div1', 'Div2'] as const;
/** Right block under Organization Executive Secretary */
export const ORG_DIVISION_IDS = ['Div3', 'Div4', 'Div5', 'Div6'] as const;

/** @deprecated use DCO_DIVISION_IDS */
export const HCO_DIVISION_IDS = DCO_DIVISION_IDS;

export type BoardDivisionId = (typeof BOARD_DIVISION_ORDER)[number];

export const BOARD_PAGE_TITLE = 'DABOS Organizing Board';

/** Full expansion of the DABOS acronym (canonical: DABOS/docs/README.md). */
export const BOARD_PAGE_SUBTITLE = 'Digital Agent Business Orchestrator System';

export const EXECUTIVE_LABELS = {
  director: 'EXECUTIVE DIRECTOR',
  dcoSecretary: 'DCO EXECUTIVE SECRETARY',
  orgSecretary: 'ORGANIZATION EXECUTIVE SECRETARY',
} as const;

/** Drill-down targets for the executive tree (dashboard entry points). */
export const EXECUTIVE_HREFS = {
  director: '/dabos/divisions/Div7',
  dcoSecretary: '/dabos/divisions/Div1',
  orgSecretary: '/dabos/divisions/Div3',
} as const;

/** Roman-style division band titles (layout only; names come from DB). */
export const DIVISION_BAND_TITLE: Record<BoardDivisionId, string> = {
  Div7: 'DIVISION SEVEN',
  Div1: 'DIVISION ONE',
  Div2: 'DIVISION TWO',
  Div3: 'DIVISION THREE',
  Div4: 'DIVISION FOUR',
  Div5: 'DIVISION FIVE',
  Div6: 'DIVISION SIX',
};

/** Display overrides where operational_name differs from board label. */
export const DEPARTMENT_DISPLAY_OVERRIDES: Partial<
  Record<string, { bridge?: string; role?: string }>
> = {
  Dept21: { role: 'Office of LDW' },
};

export function deptNumberLabel(deptId: string, opts?: { short?: boolean }): string {
  const n = deptId.replace(/^Dept/i, '');
  return opts?.short ? `Dept. ${n}` : `Department ${n}`;
}

export function deptBridgeLabel(dept: { id: string; legacy_name: string }): string {
  return DEPARTMENT_DISPLAY_OVERRIDES[dept.id]?.bridge ?? dept.legacy_name;
}

export function deptRoleLabel(dept: {
  id: string;
  legacy_name: string;
  operational_name: string;
}): string {
  return (
    DEPARTMENT_DISPLAY_OVERRIDES[dept.id]?.role ??
    dept.operational_name
  );
}

export function divisionSecretaryLabel(operationalName: string): string {
  return `${operationalName} Secretary`;
}

export function divisionBandSubtitle(operationalName: string): string {
  return operationalName.toUpperCase();
}
