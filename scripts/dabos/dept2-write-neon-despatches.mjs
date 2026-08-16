import postgres from 'postgres';
import { readFileSync } from 'fs';

const env = readFileSync('C:/Dev/DABOS/.env.local', 'utf8');
for (const line of env.split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
  if (!m) continue;
  let v = m[2].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  process.env[m[1]] = v;
}

const packet = {
  parent: 'A-314',
  issues: [
    { identifier: 'A-315', dept: 'Dept8', title: 'Dept8 — GnuCash SSOT imbalance clear (in progress)', division_id: 'Div3', priority: 2 },
    { identifier: 'A-316', dept: 'Dept9', title: 'Dept9 — Reza Surface cutover (Paperless off HZR)', division_id: 'Div4', priority: 2 },
    { identifier: 'A-317', dept: 'Dept8', title: 'Dept8 — Treasury FOSS / DKB FinTS (blocked laptop LDW)', division_id: 'Div3', priority: 3 },
    { identifier: 'A-318', dept: 'Dept1', title: 'Dept1 — Watch grind (after books/taxes)', division_id: 'Div1', priority: 4 },
    { identifier: 'A-319', dept: 'Dept11', title: 'Dept11 — logans-tools / DABOS proper CI', division_id: 'Div4', priority: 3 },
  ],
};

const sql = postgres(process.env.DATABASE_URL, { max: 1, ssl: 'require' });
await sql`
  INSERT INTO role_runs (role_id, role_type, summary_json)
  VALUES (
    'Dept2',
    'department',
    ${JSON.stringify({
      action: 'despatch_packet',
      date: '2026-08-16',
      parent_linear: packet.parent,
      issues: packet.issues.map((i) => i.identifier),
      note: 'Routed open-loops hot wall to owning hats',
    })}
  )
`;
console.log('role_runs Dept2 ok');

for (const i of packet.issues) {
  const existing = await sql`
    SELECT id FROM tasks
    WHERE department_id = ${i.dept}
      AND title = ${i.title}
      AND status = 'todo'
    LIMIT 1
  `;
  if (existing.length) {
    console.log('exists', i.identifier, i.dept);
    continue;
  }
  await sql`
    INSERT INTO tasks (
      workspace_id, division_id, department_id, title, description,
      type, status, priority, assigned_to
    ) VALUES (
      ${`dept2-despatch-${i.identifier.toLowerCase()}`},
      ${i.division_id},
      ${i.dept},
      ${i.title},
      ${`Linear ${i.identifier}. Despatched by Dept2 2026-08-16. Parent ${packet.parent}.`},
      'human',
      'todo',
      ${i.priority},
      'founder'
    )
  `;
  console.log('created neon', i.identifier, i.dept);
}
await sql.end({ timeout: 2 });
