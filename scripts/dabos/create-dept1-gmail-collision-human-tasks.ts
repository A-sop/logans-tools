/**
 * Dept1 human follow-ups for Gmail identity collision (email triage).
 * Idempotent on ingest_external_id.
 *
 *   npx tsx scripts/dabos/create-dept1-gmail-collision-human-tasks.ts
 */
import { createDabosSql } from '../../src/lib/dabos/dabos-connection';
import { requireDatabaseUrl } from './load-env';

async function main() {
  const sql = createDabosSql(requireDatabaseUrl());

  const dept = await sql`
    SELECT id, division_id FROM departments WHERE id = 'Dept1' LIMIT 1
  `;
  if (!dept[0]) {
    console.error('Dept1 missing');
    process.exit(1);
  }
  const divisionId = String(dept[0].division_id);

  const seeds = [
    {
      externalId: 'gmail-collision-uber-1a-2026-11-06',
      title: 'Gmail collision: submit Uber wrong-email report (1A)',
      description: [
        'Human follow-up — Dept1 email triage / identity collision.',
        'Paste: C:\\DATA\\20_ADMIN\\reference\\contacts-and-vendors\\google\\collision-us-logan-da-williams\\uber-submit-paste.txt',
        'Help: https://help.uber.com/riders (Account). Do NOT password-reset into her Uber.',
        'Log ticket id in collision-us-logan-da-williams\\vendor-reports.md',
        'Case: ...\\google\\261006_gmail-identity-collision_uber_action-plan.md',
        'HZR Thunderbird NotMe/US-Logan-DA-Williams already wired.',
      ].join('\n'),
      priority: 2,
    },
    {
      externalId: 'gmail-collision-security-skim-2026-11-06',
      title: 'Gmail collision: skim Google linked apps + Gmail sensitive settings',
      description: [
        'Human follow-up — Phase 0 exclusive control (devices already verified Cologne-only, 2SV on).',
        'Open https://myaccount.google.com/security-checkup — finish Linked apps (17) + Gmail 2 sensitive settings.',
        'Also https://myaccount.google.com/connections — no unknown delegates/forwarding.',
        'Tick boxes in case file §4 + collision-us-logan-da-williams\\phase0-security-checklist.md',
      ].join('\n'),
      priority: 2,
    },
  ];

  const created: string[] = [];
  for (const s of seeds) {
    const existing = await sql`
      SELECT id::text AS id, title, status
      FROM tasks
      WHERE ingest_external_id = ${s.externalId}
      LIMIT 1
    `;
    if (existing[0]) {
      console.log(`exists\t${existing[0].id}\t${existing[0].status}\t${existing[0].title}`);
      created.push(String(existing[0].id));
      continue;
    }
    const rows = await sql`
      INSERT INTO tasks (
        workspace_id,
        division_id,
        department_id,
        title,
        description,
        type,
        status,
        priority,
        assigned_to,
        basket,
        ingest_source,
        ingest_external_id,
        ingest_meta
      ) VALUES (
        ${'dept01-mail-triage'},
        ${divisionId},
        ${'Dept1'},
        ${s.title},
        ${s.description},
        ${'human'},
        ${'todo'},
        ${s.priority},
        ${'founder'},
        ${'in'},
        ${'api'},
        ${s.externalId},
        ${JSON.stringify({
          lane: 'gmail-identity-collision',
          human_follow_up: true,
          hat: 'Dept1',
          stem: 'collision-us-logan-da-williams',
          created: '2026-11-06',
        })}::jsonb
      )
      RETURNING id::text AS id, title, type, assigned_to, basket
    `;
    console.log(`created\t${rows[0].id}\t${rows[0].type}\t${rows[0].assigned_to}\t${rows[0].title}`);
    created.push(String(rows[0].id));
  }

  console.log(`ids=${created.join(',')}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
