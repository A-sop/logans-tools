#!/usr/bin/env npx tsx
/**
 * DABOS DB + org board smoke (no Next server). Used for A-190 / A-231 verify.
 */
import fs from 'fs';
import path from 'path';
import postgres from 'postgres';

function loadEnvLocal() {
  const envPath = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const quoted = trimmed.match(/^([A-Za-z0-9_]+)\s*=\s*"(.*)"\s*$/);
    const plain = trimmed.match(/^([A-Za-z0-9_]+)\s*=\s*(.*)$/);
    const m = quoted ?? plain;
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}

function resolveDatabaseUrl(): string | undefined {
  const candidates = [
    process.env.DATABASE_URL,
    process.env.POSTGRES_URL,
    process.env.DABOS_DATABASE_URL,
  ];
  for (const raw of candidates) {
    const url = raw?.trim();
    if (url) return url;
  }
  return undefined;
}

async function main() {
  loadEnvLocal();
  const url = resolveDatabaseUrl();
  if (!url) {
    console.error('FAIL: DATABASE_URL not set in .env.local');
    process.exit(1);
  }

  const sql = postgres(url, { max: 1 });

  const [divs, depts, tasks, migrations] = await Promise.all([
    sql`SELECT count(*)::int as c FROM divisions`,
    sql`SELECT count(*)::int as c FROM departments`,
    sql`SELECT count(*)::int as c FROM tasks`,
    sql`SELECT count(*)::int as c FROM dabos_migrations`,
  ]);

  const sampleDiv = await sql`
    SELECT id, operational_name FROM divisions ORDER BY id LIMIT 1
  `;

  await sql.end();

  const result = {
    ok: true,
    migrations: migrations[0].c,
    divisions: divs[0].c,
    departments: depts[0].c,
    tasks: tasks[0].c,
    sampleDivision: sampleDiv[0]?.operational_name ?? null,
  };

  console.log(JSON.stringify(result, null, 2));

  if (divs[0].c < 1 || depts[0].c < 1 || migrations[0].c < 1) {
    console.error('FAIL: schema or seed incomplete');
    process.exit(1);
  }

  console.log('SMOKE_OK — run UI at http://localhost:3001/dabos (Clerk sign-in required)');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
