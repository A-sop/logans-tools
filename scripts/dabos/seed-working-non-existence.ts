/**
 * Reset working_condition to Non-Existence for all divisions + departments.
 * Stat-indicated values are left null here; run dabos:refresh-conditions after for stats.
 *
 * Usage: npm run dabos:seed-working-non-existence
 * @see DABOS/docs/PRD-004-conditions-memory-governance.md § New post climb
 */
import { createDabosSql } from '../../src/lib/dabos/dabos-connection';
import { requireDatabaseUrl } from './load-env';

async function main() {
  const url = requireDatabaseUrl();

  const sql = createDabosSql(url);

  const divisions = await sql`SELECT id FROM divisions ORDER BY id`;
  const departments = await sql`SELECT id FROM departments ORDER BY id`;

  for (const row of divisions) {
    const id = row.id as string;
    await sql`
      INSERT INTO entity_condition_state (
        entity_type, entity_id, working_condition, stat_indicated_condition, stat_indicated_at, updated_at
      )
      VALUES ('division', ${id}, 'Non-Existence', NULL, NULL, NOW())
      ON CONFLICT (entity_type, entity_id) DO UPDATE SET
        working_condition = 'Non-Existence',
        updated_at = NOW()
    `;
    console.log(`division ${id} → working Non-Existence`);
  }

  for (const row of departments) {
    const id = row.id as string;
    await sql`
      INSERT INTO entity_condition_state (
        entity_type, entity_id, working_condition, stat_indicated_condition, stat_indicated_at, updated_at
      )
      VALUES ('department', ${id}, 'Non-Existence', NULL, NULL, NOW())
      ON CONFLICT (entity_type, entity_id) DO UPDATE SET
        working_condition = 'Non-Existence',
        updated_at = NOW()
    `;
    console.log(`department ${id} → working Non-Existence`);
  }

  console.log(
    `\nDone: ${divisions.length} divisions + ${departments.length} departments at working Non-Existence.`
  );
  console.log('Next: npm run dabos:refresh-conditions (stat-indicated only; working stays until formula EP).');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
