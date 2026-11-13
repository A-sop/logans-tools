'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { requireDabosAuth } from '@/lib/dabos/clerk-auth';
import { getDabosSql, hasDabosDb } from '@/lib/dabos/db';
import { decideApproval } from '@/lib/dabos/tier0';

export async function decideApprovalAction(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '').trim();
  const actionRaw = String(formData.get('action') ?? '').trim();
  const founderReply = String(formData.get('founder_reply') ?? '');
  if (!id || (actionRaw !== 'approve' && actionRaw !== 'reject')) return;

  const authResult = await requireDabosAuth();
  if ('error' in authResult) return;
  if (!hasDabosDb()) return;

  const result = await decideApproval(
    getDabosSql(),
    id,
    actionRaw,
    'founder',
    founderReply
  );
  if (!result.ok) return;

  revalidatePath('/dabos');
  revalidatePath('/dabos/digest');
  revalidatePath('/dabos/approvals');
  revalidatePath(`/dabos/approvals/${id}`);
  redirect(`/dabos/approvals/${id}?decided=1`);
}
