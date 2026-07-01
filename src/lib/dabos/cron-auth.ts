import { NextResponse } from 'next/server';

/** Authorize Vercel Cron / external schedulers via DABOS_CRON_SECRET or Vercel CRON_SECRET. */
export function authorizeDabosCron(request: Request): NextResponse | null {
  const secret =
    process.env.DABOS_CRON_SECRET?.trim() ?? process.env.CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: 'DABOS_CRON_SECRET not configured' }, { status: 503 });
  }
  const auth = request.headers.get('authorization');
  if (auth === `Bearer ${secret}`) return null;
  const header = request.headers.get('x-dabos-cron-secret');
  if (header === secret) return null;
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
