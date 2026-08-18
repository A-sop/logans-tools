import { NextResponse } from 'next/server';

import { dabosDbUnavailable, jsonError, requireDabosDb } from '@/lib/dabos/api-utils';
import { requireDabosAuth } from '@/lib/dabos/clerk-auth';
import {
  insertSipgateAssistEvent,
  listSipgateAssistEvents,
  markSipgateAssistConsumed,
  pruneExpiredSipgateAssistEvents,
} from '@/lib/dabos/sipgate-assist-db';
import {
  clientIpFromHeaders,
  normalizeSipgateAssistPayload,
  providedSipgateSecret,
  secretsEqual,
  sipgateIpAllowed,
  sipgateWebhookSecret,
  storeTranscriptEnabled,
} from '@/lib/dabos/sipgate-assist';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const expected = sipgateWebhookSecret();
  if (!expected) {
    return NextResponse.json({ error: 'SIPGATE_WEBHOOK_SECRET not configured' }, { status: 503 });
  }

  const url = new URL(request.url);
  const provided = providedSipgateSecret(request, url);
  if (!provided || !secretsEqual(provided, expected)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sourceIp = clientIpFromHeaders(request.headers);
  if (!sipgateIpAllowed(sourceIp)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (!requireDabosDb()) return dabosDbUnavailable();

  let body: unknown;
  try {
    body = JSON.parse(await request.text());
  } catch {
    return jsonError('Invalid JSON');
  }

  const normalized = normalizeSipgateAssistPayload(body, storeTranscriptEnabled());
  if ('error' in normalized) return jsonError(normalized.error);

  try {
    await pruneExpiredSipgateAssistEvents();
    const saved = await insertSipgateAssistEvent(normalized, sourceIp);
    return NextResponse.json({ ok: true, id: saved.id, duplicate: saved.duplicate });
  } catch {
    console.error('sipgate assist ingest failed');
    return NextResponse.json({ error: 'Ingest failed' }, { status: 500 });
  }
}

export async function GET() {
  const authResult = await requireDabosAuth();
  if ('error' in authResult) return authResult.error;
  if (!requireDabosDb()) return dabosDbUnavailable();

  const events = await listSipgateAssistEvents();
  return NextResponse.json({ events });
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
  return NextResponse.json({ ok: true });
}
