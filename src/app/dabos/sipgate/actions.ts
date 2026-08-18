'use server';

import { revalidatePath } from 'next/cache';

import { requireDabosAuth } from '@/lib/dabos/clerk-auth';
import { markSipgateAssistConsumed } from '@/lib/dabos/sipgate-assist-db';

export async function setSipgateAssistConsumed(id: string, consumed: boolean) {
  const authResult = await requireDabosAuth();
  if ('error' in authResult) return { ok: false as const, error: 'Unauthorized' };
  const ok = await markSipgateAssistConsumed(id, consumed);
  if (!ok) return { ok: false as const, error: 'Not found' };
  revalidatePath('/dabos/sipgate');
  return { ok: true as const };
}
