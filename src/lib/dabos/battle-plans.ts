import type { ConditionLabel } from '@/lib/dabos/types';

/** Weekly battle-plan staples per department (promotion cadence checklist). */
export const DEPT_BATTLE_PLAN_WEEKLY: Record<string, string> = {
  Dept1: 'Clear wiki inbox backlog; org board + hats current; fast intake routing.',
  Dept2: 'Mailings on schedule; internal tickets cleared; policy materials issued.',
  Dept3: 'Post division graphs; inspection notes; rollup to Div7 by Thu 14:00.',
  Dept4: 'Ship one content piece; execute one campaign step.',
  Dept5: 'Verify shelf/stock; fulfillment latency check.',
  Dept6: 'CRM hygiene; warm outreach batch; pipeline scheduled ahead.',
  Dept7: 'Cash collection follow-up; reconcile Proviso monthly vs DABOS stat.',
  Dept8: 'Bills paid on time; vendor payment review.',
  Dept9: 'Backup/reserve check; homelab headroom.',
  Dept10: 'Intake UX / PRD review — one design decision logged.',
  Dept11: 'One implementation milestone shipped.',
  Dept12: 'Ship one deliverable; escalate blockers early.',
  Dept13: 'Clear validation queue; no false passes.',
  Dept14: 'One hatting / standards audit item.',
  Dept15: 'Review open compliance items (Meta, DVAG local rules).',
  Dept16: 'One cold-public touch (SEO, ad, intro content).',
  Dept17: 'Pipeline / consult follow-up; mine interest files.',
  Dept18: 'Partner or success-story touch; Proviso client lane.',
  Dept19: 'Run refresh-conditions; publish rollup artifact.',
  Dept20: 'Audit dropped promotion items; assign human tasks.',
  Dept21: 'Clear approval queue; Executive Council ≤3 priorities.',
};

export const CONDITION_BATTLE_EMPHASIS: Partial<Record<ConditionLabel, string>> = {
  'Non-Existence': 'Minimum viable stat only — activate one promotion item.',
  Danger: 'Danger formula: bypass → change → deliver → economize → stiffen → promote.',
  Emergency: 'Stabilize primary stat before new promotion.',
  Normal: 'Execute standard weekly battle plan.',
  Affluence: 'Reinforce what works; do not break the winning loop.',
  Power: 'Hold gains; document what produced the up-stat.',
  'Power Change': 'Align hats and programs to new level; avoid reorg churn.',
};

export function battlePlanForDept(
  deptId: string,
  condition: ConditionLabel | null
): string {
  const weekly = DEPT_BATTLE_PLAN_WEEKLY[deptId] ?? 'Execute standard promotion for this hat.';
  const emphasis = condition ? CONDITION_BATTLE_EMPHASIS[condition] : null;
  return emphasis ? `${emphasis} ${weekly}` : weekly;
}

export const DIVISION_BATTLE_PLAN_WEEKLY: Record<string, string> = {
  Div7: 'Executive Council: GDS review, opportunity brief, ≤3 priorities for new week.',
  Div1: 'Perception strong: graphs posted, inspection before drama.',
  Div2: 'Known-audience promotion; keep cold traffic in Div6.',
  Div3: 'Treasury truth: taxable income from Proviso monthly; no false GI.',
  Div4: 'Ship outputs; validation before stats count.',
  Div5: 'Reality gate: nothing counts until Qual approves.',
  Div6: 'Public funnel + GFP income ladder toward €7,600/mo.',
};
