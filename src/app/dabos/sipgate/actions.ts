'use server';

import { revalidatePath } from 'next/cache';

import { requireDabosAuth } from '@/lib/dabos/clerk-auth';
import { markSipgateAssistConsumed } from '@/lib/dabos/sipgate-assist-db';

export async function setSipgateAssistConsumed(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '');
  const consumed = formData.get('consumed') === '1';
  if (!id) return;

  const authResult = await requireDabosAuth();
  if ('error' in authResult) return;
  await markSipgateAssistConsumed(id, consumed);
  revalidatePath('/dabos/sipgate');
}
