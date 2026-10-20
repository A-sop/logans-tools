import postgres from 'postgres';
import { requireDatabaseUrl } from '../dabos/load-env';

async function main() {
  const fallback = requireDatabaseUrl();
  const url = process.env.DATABASE_URL_UNPOOLED?.trim() || fallback;
  const sql = postgres(url, { max: 1, prepare: false });
  try {
    const s = await sql`
      SELECT built_at, synced_at FROM hww_summaries ORDER BY built_at DESC LIMIT 1
    `;
    if (!s.length) {
      console.log('NEON_EMPTY');
      return;
    }
    const builtAt = s[0].built_at as string;
    const r = await sql`
      SELECT COUNT(*)::int AS n FROM hww_records WHERE built_at = ${builtAt}
    `;
    console.log('NEON_SUMMARY_built_at', builtAt);
    console.log('NEON_SUMMARY_synced_at', s[0].synced_at);
    console.log('NEON_RECORDS', r[0].n);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main();
