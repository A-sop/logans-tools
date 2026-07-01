/**
 * Remove demo seed stats (workspace_id = seed-ytd-2026).
 * Run: npm run dabos:clear-seed-stats
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
    if (m) process.env[m[1]] = m[2].trim();
  }
}

function resolveDatabaseUrl(): string | undefined {
  const candidates = [
    process.env.DATABASE_URL,
    process.env.POSTGRES_URL,
    process.env.POSTGRES_PRISMA_URL,
    process.env.DATABASE_URL_UNPOOLED,
    process.env.DABOS_DATABASE_URL,
  ];
  for (const raw of candidates) {
    const url = raw?.trim();
    if (!url) continue;
    try {
      const parsed = new URL(url.replace(/^postgresql:/, 'http:'));
      if (parsed.hostname && parsed.pathname && parsed.pathname !== '/') return url;
    } catch {
      /* try next */
    }
  }
  return undefined;
}

async function main() {
  loadEnvLocal();
  const url = resolveDatabaseUrl();
  if (!url) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }

  const sql = postgres(url, { max: 1 });
  const deleted = await sql`
    DELETE FROM stats WHERE workspace_id = 'seed-ytd-2026'
    RETURNING id
  `;
  console.log(`Deleted ${deleted.length} demo seed stat rows.`);
  console.log('Run npm run dabos:refresh-conditions to recompute conditions.');
  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
