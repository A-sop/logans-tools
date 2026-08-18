import { dabosDbUnavailable, jsonError, requireDabosDb } from '@/lib/dabos/api-utils';
import { requireDabosAuth } from '@/lib/dabos/clerk-auth';
import { markSipgateAssistConsumed } from '@/lib/dabos/sipgate-assist-db';
import { sipgateAssistGet, sipgateAssistPost, sipgateAssistProbe } from '@/lib/dabos/sipgate-assist-http';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  return sipgateAssistPost(request);
}

export async function GET(request: Request) {
  return sipgateAssistGet(request);
}

export async function HEAD(request: Request) {
  return sipgateAssistProbe(request);
}

export async function PATCH(request: Request) {
  const authResult = await requireDabosAuth();
  if ('error' in authResult) return authResult.error;
  if (!requireDabosDb()) return dabosDbUnavailable();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body');
  }

  const rec = body && typeof body === 'object' ? (body as { id?: unknown; consumed?: unknown }) : {};
  const id = typeof rec.id === 'string' ? rec.id : '';
  if (!id) return jsonError('id required');
  const consumed = rec.consumed !== false;
  const ok = await markSipgateAssistConsumed(id, consumed);
  if (!ok) return jsonError('Not found', 404);
  return Response.json({ ok: true });
}
