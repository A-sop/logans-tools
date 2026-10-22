/**
 * Write a condition assignment to entity_condition_state + audit log.
 * NOT run automatically. Requires migrations 020 and 021.
 *
 * One rule (founder ruling 2026-10-22 22:31): Dept19 Conditions + Dept3 Ethics assign
 * conditions across the whole ladder on stat evidence (default path: --by dept19_ethics).
 * The founder may override any condition at any time (--by founder, the default here).
 * Upgrade gate (founder ruling 2026-10-22): a dept19_ethics assignment that RAISES the
 * stored condition is refused unless --go-ahead <receipt of the founder's written
 * per-department go-ahead> is given; the raise is then recorded as a founder_ruling.
 *
 * Usage (dry run is default; add --apply to write):
 *   npm run dabos:founder-ruling -- --preset 2026-10-16-confusion
 *   npm run dabos:founder-ruling -- --entity-type department --ids Dept3,Dept4 \
 *     --condition Danger --date 2026-10-22 --ref <receipt path> [--note "..."] \
 *     [--by founder|dept19_ethics] [--go-ahead <founder go-ahead receipt>] --apply
 *
 * @see DABOS docs/reference/conditions-ethics-ssot.md
 */
import { createDabosSql } from '../../src/lib/dabos/dabos-connection';
import { conditionSeverity, isConditionLabel, type ConditionLabel } from '../../src/lib/dabos/condition-ladder';
import { FOUNDER_RULING_PRESETS } from '../../src/lib/dabos/founder-rulings';
import { requireDatabaseUrl } from './load-env';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

export type AssignedBy = 'founder' | 'dept19_ethics';

/**
 * Decide how an assignment is recorded. Founder: always applies (override).
 * Dept19 + Ethics: applies for downgrades and same rung; a raise needs the
 * founder's written go-ahead (upgrade gate) and is then recorded as founder_ruling.
 */
export function planAssignment(
  by: AssignedBy,
  previous: ConditionLabel | null,
  proposed: ConditionLabel,
  goAheadRef: string | null
): { ok: true; source: 'founder_ruling' | 'dept19_ethics' } | { ok: false; reason: string } {
  if (by === 'founder') return { ok: true, source: 'founder_ruling' };
  const isUpgrade = previous !== null && conditionSeverity(proposed) < conditionSeverity(previous);
  if (!isUpgrade) return { ok: true, source: 'dept19_ethics' };
  if (goAheadRef) return { ok: true, source: 'founder_ruling' };
  return { ok: false, reason: `upgrade ${previous} -> ${proposed} needs the founder's written go-ahead (--go-ahead)` };
}

async function main() {
  const apply = process.argv.includes('--apply');
  const presetKey = arg('preset');
  const preset = presetKey ? FOUNDER_RULING_PRESETS[presetKey] : undefined;
  if (presetKey && !preset) throw new Error(`Unknown preset: ${presetKey}`);

  const by = (preset ? 'founder' : (arg('by') ?? 'founder')) as AssignedBy;
  if (by !== 'founder' && by !== 'dept19_ethics') throw new Error('--by must be founder or dept19_ethics');
  const goAhead = arg('go-ahead') ?? null;
  const entityType = preset?.entity_type ?? arg('entity-type') ?? 'department';
  const ids = preset?.entity_ids ?? (arg('ids') ?? '').split(',').filter(Boolean);
  const condition = preset?.condition ?? arg('condition') ?? '';
  const date = preset?.ruling_date ?? arg('date');
  const ref = preset?.ruling_ref ?? arg('ref');
  const note = preset?.ruling_note ?? arg('note') ?? null;

  if (!isConditionLabel(condition)) throw new Error(`Invalid condition: ${condition}`);
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('--date YYYY-MM-DD required');
  if (!ref) throw new Error('--ref (receipt path) required');
  if (ids.length === 0) throw new Error('No entity ids');

  console.log(`${apply ? 'APPLY' : 'DRY RUN'} (by ${by}): ${entityType} ${ids.join(',')} -> ${condition} (${date}, ${ref})`);
  if (!apply) return;

  const sql = createDabosSql(requireDatabaseUrl());
  for (const id of ids) {
    const rows = (await sql`
      SELECT working_condition FROM entity_condition_state
      WHERE entity_type = ${entityType} AND entity_id = ${id}
    `) as { working_condition: string | null }[];
    const prevRaw = rows[0]?.working_condition ?? null;
    const previous = prevRaw && isConditionLabel(prevRaw) ? prevRaw : null;
    const plan = planAssignment(by, previous, condition, goAhead);
    if (!plan.ok) {
      console.log(`${entityType} ${id}: REFUSED - ${plan.reason}`);
      continue;
    }
    const ruledBy = plan.source === 'founder_ruling' ? 'founder' : 'dept19_ethics';
    const rowRef = plan.source === 'founder_ruling' && by === 'dept19_ethics' && goAhead ? goAhead : ref;
    await sql`
      INSERT INTO condition_founder_rulings (entity_type, entity_id, condition_label, ruling_date, ruling_ref, ruling_note, ruled_by)
      VALUES (${entityType}, ${id}, ${condition}, ${date}::date, ${rowRef}, ${note}, ${ruledBy})
      ON CONFLICT (entity_type, entity_id, ruling_date, condition_label, ruled_by) DO NOTHING
    `;
    await sql`
      INSERT INTO entity_condition_state (
        entity_type, entity_id, working_condition, condition_source, ruling_date, ruling_ref, ruling_note, updated_at
      )
      VALUES (${entityType}, ${id}, ${condition}, ${plan.source}, ${date}::date, ${rowRef}, ${note}, NOW())
      ON CONFLICT (entity_type, entity_id) DO UPDATE SET
        working_condition = EXCLUDED.working_condition,
        condition_source = EXCLUDED.condition_source,
        ruling_date = EXCLUDED.ruling_date,
        ruling_ref = EXCLUDED.ruling_ref,
        ruling_note = EXCLUDED.ruling_note,
        updated_at = NOW()
    `;
    console.log(`${entityType} ${id} -> ${condition} (${plan.source} ${date})`);
  }
}

if (process.argv[1] && /apply-founder-ruling/.test(process.argv[1])) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}