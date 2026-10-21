/**
 * Write a founder condition ruling (override) to entity_condition_state + audit log.
 * NOT run automatically. Requires migration 020.
 *
 * Usage (dry run is default; add --apply to write):
 *   npm run dabos:founder-ruling -- --preset 2026-10-16-confusion
 *   npm run dabos:founder-ruling -- --preset 2026-10-16-confusion --apply
 *   npm run dabos:founder-ruling -- --entity-type department --ids Dept3,Dept4 \
 *     --condition Confusion --date 2026-10-16 --ref <receipt path> [--note "..."] --apply
 *
 * @see DABOS docs/reference/conditions-ethics-ssot.md (Founder overrides)
 */
import { createDabosSql } from '../../src/lib/dabos/dabos-connection';
import { isConditionLabel } from '../../src/lib/dabos/condition-ladder';
import { FOUNDER_RULING_PRESETS } from '../../src/lib/dabos/founder-rulings';
import { requireDatabaseUrl } from './load-env';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const apply = process.argv.includes('--apply');
  const presetKey = arg('preset');
  const preset = presetKey ? FOUNDER_RULING_PRESETS[presetKey] : undefined;
  if (presetKey && !preset) throw new Error(`Unknown preset: ${presetKey}`);

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

  console.log(`${apply ? 'APPLY' : 'DRY RUN'}: ${entityType} ${ids.join(',')} -> ${condition} (${date}, ${ref})`);
  if (!apply) return;

  const sql = createDabosSql(requireDatabaseUrl());
  for (const id of ids) {
    await sql`
      INSERT INTO condition_founder_rulings (entity_type, entity_id, condition_label, ruling_date, ruling_ref, ruling_note)
      VALUES (${entityType}, ${id}, ${condition}, ${date}::date, ${ref}, ${note})
      ON CONFLICT (entity_type, entity_id, ruling_date, condition_label) DO NOTHING
    `;
    await sql`
      INSERT INTO entity_condition_state (
        entity_type, entity_id, working_condition, condition_source, ruling_date, ruling_ref, ruling_note, updated_at
      )
      VALUES (${entityType}, ${id}, ${condition}, 'founder_ruling', ${date}::date, ${ref}, ${note}, NOW())
      ON CONFLICT (entity_type, entity_id) DO UPDATE SET
        working_condition = EXCLUDED.working_condition,
        condition_source = 'founder_ruling',
        ruling_date = EXCLUDED.ruling_date,
        ruling_ref = EXCLUDED.ruling_ref,
        ruling_note = EXCLUDED.ruling_note,
        updated_at = NOW()
    `;
    console.log(`${entityType} ${id} -> ${condition} (founder ruling ${date})`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
