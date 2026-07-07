#!/usr/bin/env npx tsx
/**
 * Update ESTO Round 1 status for one department (Neon SSOT).
 * Usage:
 *   npm run dabos:esto-status -- --dept Dept15 --status done
 *   npm run dabos:esto-status -- --dept Dept16 --status next
 *
 * When marking a dept done, pass --next Dept16 to advance the yellow "next" pointer.
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

const STATUSES = new Set(['done', 'next', 'pending']);

function parseArgs() {
  const args = process.argv.slice(2);
  let dept: string | undefined;
  let status: string | undefined;
  let next: string | undefined;
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--dept' && args[i + 1]) dept = args[++i];
    else if (args[i] === '--status' && args[i + 1]) status = args[++i];
    else if (args[i] === '--next' && args[i + 1]) next = args[++i];
  }
  return { dept, status, next };
}

async function main() {
  loadEnvLocal();
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    console.error('DATABASE_URL missing — set in .env.local');
    process.exit(1);
  }

  const { dept, status, next } = parseArgs();
  if (!dept?.match(/^Dept\d{1,2}$/) || !status || !STATUSES.has(status)) {
    console.error('Usage: npm run dabos:esto-status -- --dept Dept15 --status done [--next Dept16]');
    process.exit(1);
  }

  const sql = postgres(url, { max: 1 });
  try {
    await sql`
      UPDATE department_establishment
      SET esto_round1_status = ${status}, updated_at = NOW()
      WHERE department_id = ${dept}
    `;

    if (next?.match(/^Dept\d{1,2}$/)) {
      await sql`
        UPDATE department_establishment
        SET esto_round1_status = 'pending', updated_at = NOW()
        WHERE esto_round1_status = 'next' AND department_id <> ${next}
      `;
      await sql`
        UPDATE department_establishment
        SET esto_round1_status = 'next', updated_at = NOW()
        WHERE department_id = ${next}
      `;
    } else if (status === 'done') {
      const [{ id }] = await sql<{ id: string }[]>`
        SELECT department_id AS id FROM department_establishment
        WHERE esto_round1_status = 'next' LIMIT 1
      `;
      if (id) console.log(`Note: next pointer still ${id} — pass --next to advance`);
    }

    const rows = await sql`
      SELECT department_id, esto_round1_status
      FROM department_establishment
      ORDER BY department_id
    `;
    const done = rows.filter((r) => r.esto_round1_status === 'done').length;
    const nextRow = rows.find((r) => r.esto_round1_status === 'next');
    console.log(`ESTO Round 1: ${done}/21 done · next=${nextRow?.department_id ?? 'none'}`);
    console.log(`Updated ${dept} → ${status}`);
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
