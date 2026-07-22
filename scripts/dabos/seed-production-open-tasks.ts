/**
 * Seed production open tasks (2026-07-11 session) into Neon.
 * Idempotent: replaces rows with workspace_id = production-open-2026-07-11.
 * Run: npm run dabos:seed-open-tasks
 */
import { createDabosSql } from '../../src/lib/dabos/dabos-connection';
import { requireDatabaseUrl } from './load-env';

const WORKSPACE_ID = 'production-open-2026-07-11';

type TaskSeed = {
  division_id: string;
  department_id: string;
  title: string;
  description: string;
  type: 'human' | 'agent' | 'approval';
  status: 'todo' | 'blocked' | 'done';
  priority: number;
};

const TASKS: TaskSeed[] = [
  {
    division_id: 'Div7',
    department_id: 'Dept21',
    title: 'Walk authenticated /dabos board (Dept13 T2)',
    description:
      'Logan A5: open /dabos signed in; verify 21 depts × 4 establishment boxes + stat, zero blanks. Closes dept13-validation-checklists instance 3.',
    type: 'human',
    status: 'todo',
    priority: 2,
  },
  {
    division_id: 'Div7',
    department_id: 'Dept21',
    title: 'Refresh PostHog personal API key (MCP + Atlas)',
    description:
      'Regenerate eu.posthog.com personal API key (query read). Update Cursor MCP + Atlas/.env.local POSTHOG_PERSONAL_API_KEY. Unblocks Dept13 instance 5 + Dept16 cold_touchpoints.',
    type: 'human',
    status: 'todo',
    priority: 2,
  },
  {
    division_id: 'Div7',
    department_id: 'Dept21',
    title: 'Slack Event Subscriptions + message.im (optional DM path)',
    description:
      'Only if DM /stats without slash is wanted. Atlas/docs/admin/dabos-slack-gateway.md P0 steps 2–4. Slash /dabos already live.',
    type: 'human',
    status: 'todo',
    priority: 4,
  },
  {
    division_id: 'Div5',
    department_id: 'Dept13',
    title: 'Close validation instance 3 after founder /dabos walk',
    description: 'Blocked on Dept21 walk. Pointer: docs/registers/dept13-validation-checklists.md instance 3.',
    type: 'agent',
    status: 'blocked',
    priority: 2,
  },
  {
    division_id: 'Div5',
    department_id: 'Dept13',
    title: 'Close validation instance 5 after PostHog key + event verify',
    description: 'Blocked on POSTHOG_PERSONAL_API_KEY. Verify visit retrievable for cold_touchpoints.',
    type: 'agent',
    status: 'blocked',
    priority: 2,
  },
  {
    division_id: 'Div6',
    department_id: 'Dept16',
    title: 'Retrieve cold_touchpoints from PostHog',
    description: 'After key fix: query $pageview on loganwilliams.com public pages. No DVAG/restricted data.',
    type: 'agent',
    status: 'blocked',
    priority: 3,
  },
  {
    division_id: 'Div1',
    department_id: 'Dept3',
    title: 'Wire real Div2–7 weekly stat ingest',
    description:
      'Production tier0 shows — for Div2–7. Do NOT run dabos:seed-stats without founder explicit approval (synthetic demo).',
    type: 'agent',
    status: 'todo',
    priority: 3,
  },
  {
    division_id: 'Div3',
    department_id: 'Dept8',
    title: 'Confirm obligations register T5 (A5)',
    description:
      'Review obligations-prefill-draft; copy into obligations-register.md. Unlocks runway_days + Dept7 floor.',
    type: 'human',
    status: 'todo',
    priority: 2,
  },
  {
    division_id: 'Div3',
    department_id: 'Dept8',
    title: 'GnuCash onboarding spike',
    description:
      'Local .gnucash + chart draft + one CSV import pilot. FinTS scope note. Layered SSOT: DATA local, Neon derived stats only.',
    type: 'agent',
    status: 'todo',
    priority: 3,
  },
  {
    division_id: 'Div3',
    department_id: 'Dept8',
    title: 'Treasury Triage R1 plan (DIL pattern)',
    description:
      'Staging, move-log, !!_ZOHO-BOOKS frozen. See DIL-V2-REVIEW-ROUND-2_2026-07-11.md + zoho-books-export-inventory.',
    type: 'agent',
    status: 'todo',
    priority: 3,
  },
  {
    division_id: 'Div1',
    department_id: 'Dept1',
    title: 'Bank CSV baseline (T6-BANK-CSV-JUN26 + 2025)',
    description: 'Register-only intake; treasury lane. Coordinate with Dept8.',
    type: 'agent',
    status: 'todo',
    priority: 3,
  },
  {
    division_id: 'Div1',
    department_id: 'Dept1',
    title: 'Financial-doc tranche scope (DIL mirror)',
    description: 'Sample before bulk; reversible batches. Follow P08-3 plan.',
    type: 'agent',
    status: 'todo',
    priority: 4,
  },
  {
    division_id: 'Div3',
    department_id: 'Dept7',
    title: 'Publish income vs floor on board',
    description: 'Blocked until Dept8 T5 obligations register confirmed.',
    type: 'agent',
    status: 'blocked',
    priority: 4,
  },
  {
    division_id: 'Div4',
    department_id: 'Dept11',
    title: 'PostHog MCP harness note (personal key vs OAuth)',
    description: 'Document fix path in Atlas agent-harness when MCP shows ready but INVALID_API_KEY on query.',
    type: 'agent',
    status: 'todo',
    priority: 4,
  },
  {
    division_id: 'Div1',
    department_id: 'Dept2',
    title: 'Fan out Treasury Triage R1 when founder says go',
    description: 'Route Dept1/8/7 tasks per open-tasks-production-2026-07-11.md.',
    type: 'agent',
    status: 'todo',
    priority: 4,
  },
];

async function main() {
  const url = requireDatabaseUrl();
  const sql = createDabosSql(url);

  await sql`
    DELETE FROM tasks WHERE workspace_id = ${WORKSPACE_ID}
  `;

  let inserted = 0;
  for (const t of TASKS) {
    await sql`
      INSERT INTO tasks (
        workspace_id, division_id, department_id, title, description,
        type, status, priority, research_tier
      ) VALUES (
        ${WORKSPACE_ID},
        ${t.division_id},
        ${t.department_id},
        ${t.title},
        ${t.description},
        ${t.type},
        ${t.status},
        ${t.priority},
        1
      )
    `;
    inserted += 1;
  }

  console.log(`Removed prior ${WORKSPACE_ID} tasks (if any)`);
  console.log(`Inserted ${inserted} production open tasks`);
  if ('end' in sql && typeof sql.end === 'function') {
    await sql.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
