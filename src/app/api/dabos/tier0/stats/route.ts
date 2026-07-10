import { NextResponse } from 'next/server';

import { dabosDbUnavailable, requireDabosDb } from '@/lib/dabos/api-utils';
import { getDabosSql } from '@/lib/dabos/db';
import { authorizeTier0 } from '@/lib/dabos/tier0-auth';
import { formatTier0Stats } from '@/lib/dabos/tier0';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const denied = await authorizeTier0(request);
  if (denied) return denied;
  if (!requireDabosDb()) return dabosDbUnavailable();

  const sql = getDabosSql();
  const text = await formatTier0Stats(sql);
  const format = new URL(request.url).searchParams.get('format');
  if (format === 'json') {
    return NextResponse.json({ tier: 0, command: 'stats', text });
  }
  return new NextResponse(text, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
