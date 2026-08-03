import { NextResponse } from 'next/server';

import { authorizeDabosCron } from '@/lib/dabos/cron-auth';
import { createDabosSql } from '@/lib/dabos/dabos-connection';
import { runStatCrawl } from '@/lib/dabos/stat-crawl';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** GET — Dept3 missing-primary crawl (ideal Layer E). After Thursday week-close. */
export async function GET(request: Request) {
  const denied = authorizeDabosCron(request);
  if (denied) return denied;

  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    return NextResponse.json({ error: 'DATABASE_URL not set' }, { status: 503 });
  }

  const sql = createDabosSql(url);
  try {
    const result = await runStatCrawl({ dabosSql: sql });
    return NextResponse.json({ ok: true, job: 'stat_crawl', ...result });
  } finally {
    if ('end' in sql && typeof sql.end === 'function') {
      await sql.end({ timeout: 5 });
    }
  }
}
