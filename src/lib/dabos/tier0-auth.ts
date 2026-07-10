import { NextResponse } from 'next/server';

import { requireDabosAuth } from '@/lib/dabos/clerk-auth';
import { authorizeDabosCron } from '@/lib/dabos/cron-auth';

/** Tier 0 + gateway bots: cron secret, dedicated tier0 secret, or Clerk session. */
export async function authorizeTier0(request: Request): Promise<NextResponse | null> {
  const cronDenied = authorizeDabosCron(request);
  if (cronDenied === null) return null;

  const tier0Secret = process.env.DABOS_TIER0_SECRET?.trim();
  if (tier0Secret) {
    const auth = request.headers.get('authorization');
    if (auth === `Bearer ${tier0Secret}`) return null;
    const header = request.headers.get('x-dabos-tier0-secret');
    if (header === tier0Secret) return null;
  }

  const authResult = await requireDabosAuth();
  if ('error' in authResult) return authResult.error;
  return null;
}
