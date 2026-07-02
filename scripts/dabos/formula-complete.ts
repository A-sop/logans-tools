/**
 * Record formula EP and optionally advance working condition one rung.
 * Usage: npm run dabos:formula-complete -- --file scripts/dabos/ep-payloads/dept19-non-existence.json
 */
import fs from 'fs';
import path from 'path';

import { createDabosSql } from '../../src/lib/dabos/dabos-connection';
import type { DangerWhyBasis, EntityType, FormulaStepNote } from '../../src/lib/dabos/condition-state';
import {
  advanceEntityWorkingCondition,
  getEntityConditionState,
  recordFormulaCompletion,
  upsertEntityConditionState,
} from '../../src/lib/dabos/condition-state-queries';
import type { ConditionLabel } from '../../src/lib/dabos/condition-ladder';
import { requireDatabaseUrl } from './load-env';

type Payload = {
  entity_type: EntityType;
  entity_id: string;
  condition_label: ConditionLabel;
  steps_completed: FormulaStepNote[];
  probable_why?: string;
  danger_why_basis?: DangerWhyBasis;
  attested_by?: string;
  verified_by?: string;
  advance?: boolean;
};

async function main() {
  const fileArg = process.argv.indexOf('--file');
  const filePath =
    fileArg !== -1 && process.argv[fileArg + 1]
      ? process.argv[fileArg + 1]
      : process.argv[2];

  if (!filePath) {
    console.error('Usage: npx tsx scripts/dabos/formula-complete.ts --file <payload.json>');
    console.error('   or: npx tsx scripts/dabos/formula-complete.ts <payload.json>');
    process.exit(1);
  }

  const payload = JSON.parse(fs.readFileSync(path.resolve(filePath), 'utf8')) as Payload;

  const url = requireDatabaseUrl();
  const sql = createDabosSql(url);

  const completion = await recordFormulaCompletion(sql, payload);

  if (payload.danger_why_basis && payload.condition_label === 'Danger') {
    const state = await getEntityConditionState(sql, payload.entity_type, payload.entity_id);
    if (state?.working_condition) {
      await upsertEntityConditionState(sql, {
        entity_type: payload.entity_type,
        entity_id: payload.entity_id,
        working_condition: state.working_condition,
        stat_indicated_condition: state.stat_indicated_condition,
        danger_why: payload.danger_why_basis,
      });
    }
  }

  let advance = { advanced: false, working_condition: null as ConditionLabel | null };
  if (payload.advance && payload.verified_by) {
    advance = await advanceEntityWorkingCondition(sql, payload.entity_type, payload.entity_id);
  }

  const state = await getEntityConditionState(sql, payload.entity_type, payload.entity_id);
  console.log(JSON.stringify({ completion, entity_state: state, advance }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
