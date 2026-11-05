/**
 * Ad Council Neon writers/readers (migration 022).
 * Founder 2026-11-05: each Div Sec INSERTs condition_recommend with actor_id;
 * Div7 must post council_decide to seal (FPL 30 Sept 1965 form). Ethics cross-checks
 * separately. Does NOT assign working conditions (upgrade gate / condition_founder_rulings).
 */
import type { DabosSql } from '@/lib/dabos/dabos-connection';
import {
  closedOrgWeek,
  closedOrgWeekForIsoWeek,
  formatStatWeekId,
  type OrgStatWeek,
} from '@/lib/dabos/org-week';

export const AD_COUNCIL_PURPOSES = ['week_close', 'week_plan', 'ad_hoc'] as const;
export type AdCouncilPurpose = (typeof AD_COUNCIL_PURPOSES)[number];

export const AD_COUNCIL_ACTOR_KINDS = [
  'division_secretary',
  'div7_chair',
  'dept19',
  'dept3_ethics',
  'communicator',
  'founder',
] as const;
export type AdCouncilActorKind = (typeof AD_COUNCIL_ACTOR_KINDS)[number];

export const AD_COUNCIL_DECISION_KINDS = [
  'condition_recommend',
  'plan_recommend',
  'council_decide',
  'founder_decide',
  'agenda_item',
  'ethics_crosscheck',
  'blocking_issue',
] as const;
export type AdCouncilDecisionKind = (typeof AD_COUNCIL_DECISION_KINDS)[number];

export type AdCouncilSession = {
  id: string;
  session_key: string;
  stat_week_id: string;
  purpose: AdCouncilPurpose;
  status: string;
};

function parseWeek(week?: string): OrgStatWeek {
  if (!week) return closedOrgWeek();
  const m = /^(\d{4})-W(\d{2})$/.exec(week.trim());
  if (!m) throw new Error(`Invalid week '${week}': expected YYYY-Www`);
  const year = Number(m[1]);
  const isoWeek = Number(m[2]);
  const w = closedOrgWeekForIsoWeek(year, isoWeek);
  if (w.isoYear !== year || w.isoWeek !== isoWeek) {
    throw new Error(`Invalid week '${week}'`);
  }
  return w;
}

export function sessionKeyFor(weekId: string, purpose: AdCouncilPurpose): string {
  return `${weekId}-${purpose === 'week_close' ? 'close' : purpose === 'week_plan' ? 'plan' : 'adhoc'}`;
}

/** Open (or return live) session for a week purpose. */
export async function ensureAdCouncilSession(
  sql: DabosSql,
  opts: {
    week?: string;
    purpose: AdCouncilPurpose;
    recordedBy: string;
    statsWorkspaces?: string[];
    statsRowIds?: string[];
    statsReadAt?: Date;
    notesMd?: string;
  }
): Promise<AdCouncilSession> {
  const w = parseWeek(opts.week);
  const weekId = formatStatWeekId(w.isoYear, w.isoWeek);
  const key = sessionKeyFor(weekId, opts.purpose);
  const existing = await sql`
    SELECT id, session_key, stat_week_id, purpose, status
    FROM ad_council_sessions
    WHERE session_key = ${key} AND superseded_at IS NULL
    LIMIT 1
  `;
  if (existing[0]) {
    return existing[0] as AdCouncilSession;
  }
  const workspaces =
    opts.statsWorkspaces ??
    ([`div-live-${weekId}`, `gfp-live-${weekId}`] as string[]);
  const rowIds = opts.statsRowIds ?? [];
  const inserted = await sql`
    INSERT INTO ad_council_sessions (
      session_key, stat_week_id, week_start_at, week_close_at, purpose,
      stats_workspaces, stats_row_ids, stats_read_at, notes_md, recorded_by
    )
    VALUES (
      ${key},
      ${weekId},
      ${w.start.toISOString()}::timestamptz,
      ${w.end.toISOString()}::timestamptz,
      ${opts.purpose},
      ${workspaces}::text[],
      ${rowIds}::uuid[],
      ${opts.statsReadAt ? opts.statsReadAt.toISOString() : null}::timestamptz,
      ${opts.notesMd ?? null},
      ${opts.recordedBy}
    )
    RETURNING id, session_key, stat_week_id, purpose, status
  `;
  return inserted[0] as AdCouncilSession;
}

export type InsertDecisionInput = {
  sessionId: string;
  actorKind: AdCouncilActorKind;
  actorId: string;
  decisionKind: AdCouncilDecisionKind;
  subject: string;
  bodyMd?: string;
  entityType?: 'division' | 'department' | 'workspace' | 'project';
  entityId?: string;
  recommendedCondition?: string;
  ownerDivisionId?: string;
  targetMetricKey?: string;
  targetValue?: number;
  agendaStatus?: 'proposed' | 'accepted' | 'amended' | 'dropped' | 'done' | 'missed';
  activityKind?: 'standing_nonnegotiable' | 'conditions_handling' | 'other';
  recordedBy: string;
};

/** Pure guards (founder Q4 + secretary actor_id). `recommendCount` = live condition_recommend rows. */
export function assertAdCouncilDecisionAllowed(
  input: Pick<InsertDecisionInput, 'decisionKind' | 'actorKind' | 'actorId'>,
  recommendCount: number
): void {
  if (input.decisionKind === 'condition_recommend') {
    if (input.actorKind !== 'division_secretary') {
      throw new Error('condition_recommend requires actor_kind=division_secretary');
    }
    if (!/^Div[1-7]$/.test(input.actorId)) {
      throw new Error(`condition_recommend actor_id must be Div1..Div7, got '${input.actorId}'`);
    }
  }
  if (input.decisionKind === 'council_decide') {
    if (input.actorKind !== 'div7_chair' && input.actorId !== 'Div7') {
      throw new Error('council_decide requires Div7 chair (actor_kind=div7_chair or actor_id=Div7)');
    }
    if (recommendCount < 1) {
      throw new Error(
        'council_decide blocked: no live condition_recommend rows on this session (founder 2026-11-05 / FPL 30 Sept 1965)'
      );
    }
  }
}

/**
 * Insert a decision row. Enforces founder Q4: council_decide only from div7_chair,
 * and only when at least one live condition_recommend exists on the session.
 */
export async function insertAdCouncilDecision(
  sql: DabosSql,
  input: InsertDecisionInput
): Promise<{ id: string }> {
  let recommendCount = 0;
  if (input.decisionKind === 'council_decide') {
    const recs = await sql`
      SELECT count(*)::int AS n
      FROM ad_council_decisions
      WHERE session_id = ${input.sessionId}::uuid
        AND decision_kind = 'condition_recommend'
        AND superseded_at IS NULL
    `;
    recommendCount = Number((recs[0] as { n: number }).n);
  }
  assertAdCouncilDecisionAllowed(input, recommendCount);

  const rows = await sql`
    INSERT INTO ad_council_decisions (
      session_id, actor_kind, actor_id, decision_kind, subject, body_md,
      entity_type, entity_id, recommended_condition,
      owner_division_id, target_metric_key, target_value, agenda_status, activity_kind,
      recorded_by
    )
    VALUES (
      ${input.sessionId}::uuid,
      ${input.actorKind},
      ${input.actorId},
      ${input.decisionKind},
      ${input.subject},
      ${input.bodyMd ?? null},
      ${input.entityType ?? null},
      ${input.entityId ?? null},
      ${input.recommendedCondition ?? null},
      ${input.ownerDivisionId ?? null},
      ${input.targetMetricKey ?? null},
      ${input.targetValue ?? null},
      ${input.agendaStatus ?? null},
      ${input.activityKind ?? null},
      ${input.recordedBy}
    )
    RETURNING id
  `;
  return { id: String((rows[0] as { id: string }).id) };
}

export async function listLiveDecisions(
  sql: DabosSql,
  sessionId: string
): Promise<
  Array<{
    id: string;
    actor_kind: string;
    actor_id: string;
    decision_kind: string;
    subject: string;
    recommended_condition: string | null;
    recorded_at: string;
  }>
> {
  const rows = await sql`
    SELECT id, actor_kind, actor_id, decision_kind, subject, recommended_condition,
           recorded_at::text AS recorded_at
    FROM ad_council_decisions
    WHERE session_id = ${sessionId}::uuid AND superseded_at IS NULL
    ORDER BY recorded_at ASC
  `;
  return rows as Array<{
    id: string;
    actor_kind: string;
    actor_id: string;
    decision_kind: string;
    subject: string;
    recommended_condition: string | null;
    recorded_at: string;
  }>;
}

/** True when a live council_decide exists (session sealed per founder Q4). */
export async function sessionHasCouncilDecide(sql: DabosSql, sessionId: string): Promise<boolean> {
  const rows = await sql`
    SELECT 1
    FROM ad_council_decisions
    WHERE session_id = ${sessionId}::uuid
      AND decision_kind = 'council_decide'
      AND superseded_at IS NULL
    LIMIT 1
  `;
  return rows.length > 0;
}
