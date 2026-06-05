#!/usr/bin/env npx tsx
/**
 * Apply numbered SQL migrations in ./migrations against DATABASE_URL.
 * Usage: npm run dabos:migrate
 */
import fs from 'fs';
import path from 'path';
import { neon, Pool } from '@neondatabase/serverless';
import postgres from 'postgres';

const root = path.join(process.cwd(), 'migrations');

function loadEnvLocal() {
  const envPath = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=(.*)$/);
    if (m) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
}

function isNeonUrl(url: string): boolean {
  try {
    const host = new URL(url.replace(/^postgresql:/, 'http:')).hostname;
    return host.includes('neon.tech');
  } catch {
    return false;
  }
}

async function main() {
  loadEnvLocal();
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    console.error('');
    console.error('DATABASE_URL not set.');
    console.error('');
    console.error('Path B (ln02): see Atlas/docs/admin/dabos-ln02-homelab-setup.md');
    console.error('Path A (Neon): paste postgresql://... into .env.local');
    console.error('');
    process.exit(1);
  }

  const useNeon = isNeonUrl(url);

  if (useNeon) {
    const sql = neon(url);
    await sql`CREATE TABLE IF NOT EXISTS dabos_migrations (
      id TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`;

    const appliedRows = await sql`SELECT id FROM dabos_migrations ORDER BY id`;
    const applied = new Set(appliedRows.map((r) => r.id as string));

    const files = fs
      .readdirSync(root)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      if (applied.has(file)) {
        console.log(`skip ${file}`);
        continue;
      }
      const body = fs.readFileSync(path.join(root, file), 'utf8');
      console.log(`apply ${file}...`);
      const pool = new Pool({ connectionString: url });
      try {
        await pool.query(body);
      } finally {
        await pool.end();
      }
      await sql`INSERT INTO dabos_migrations (id) VALUES (${file})`;
      console.log(`ok ${file}`);
    }

    const divCount = await sql`SELECT COUNT(*)::int AS c FROM divisions`;
    const deptCount = await sql`SELECT COUNT(*)::int AS c FROM departments`;
    console.log(
      `divisions: ${divCount[0]?.c ?? 0}, departments: ${deptCount[0]?.c ?? 0}`
    );
    return;
  }

  const sql = postgres(url, { max: 1 });

  await sql`CREATE TABLE IF NOT EXISTS dabos_migrations (
    id TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;

  const appliedRows = await sql`SELECT id FROM dabos_migrations ORDER BY id`;
  const applied = new Set(appliedRows.map((r) => r.id));

  const files = fs
    .readdirSync(root)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`skip ${file}`);
      continue;
    }
    const body = fs.readFileSync(path.join(root, file), 'utf8');
    console.log(`apply ${file}...`);
    await sql.unsafe(body);
    await sql`INSERT INTO dabos_migrations (id) VALUES (${file})`;
    console.log(`ok ${file}`);
  }

  const divCount = await sql`SELECT COUNT(*)::int AS c FROM divisions`;
  const deptCount = await sql`SELECT COUNT(*)::int AS c FROM departments`;
  console.log(`divisions: ${divCount[0]?.c ?? 0}, departments: ${deptCount[0]?.c ?? 0}`);

  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
