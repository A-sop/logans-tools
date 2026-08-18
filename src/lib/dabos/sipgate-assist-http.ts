import { NextResponse } from 'next/server';

import { dabosDbUnavailable, jsonError, requireDabosDb } from '@/lib/dabos/api-utils';
import { requireDabosAuth } from '@/lib/dabos/clerk-auth';
import {
  insertSipgateAssistEvent,
  listSipgateAssistEvents,
  pruneExpiredSipgateAssistEvents,
} from '@/lib/dabos/sipgate-assist-db';
import {
  clientIpFromHeaders,
  isSipgateAssistProbeBody,
  normalizeSipgateAssistPayload,
  providedSipgateSecret,
  secretsEqual,
  sipgateAssistPathToken,
  sipgateIpAllowed,
  sipgateWebhookSecret,
  storeTranscriptEnabled,
} from '@/lib/dabos/sipgate-assist';

function unauthorized(): NextResponse {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

function secretOk(request: Request): boolean {
  const expected = sipgateWebhookSecret();
  if (!expected) return false;
  const url = new URL(request.url);
  const provided = providedSipgateSecret(request, url);
  return Boolean(provided && secretsEqual(provided, expected));
}

/** Labs Speichern often GET/HEADs the destination before storing it. */
export async function sipgateAssistProbe(request: Request): Promise<NextResponse> {
  if (!sipgateWebhookSecret()) {
    return NextResponse.json({ error: 'SIPGATE_WEBHOOK_SECRET not configured' }, { status: 503 });
  }
  if (!secretOk(request)) return unauthorized();
  if (request.method === 'HEAD') return new NextResponse(null, { status: 200 });
  return NextResponse.json({ ok: true });
}

export async function sipgateAssistGet(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  if (sipgateAssistPathToken(url.pathname) || url.searchParams.get('k')) {
    return sipgateAssistProbe(request);
  }

  const authResult = await requireDabosAuth();
  if ('error' in authResult) return authResult.error;
  if (!requireDabosDb()) return dabosDbUnavailable();

  const events = await listSipgateAssistEvents();
  return NextResponse.json({ events });
}

export async function sipgateAssistPost(request: Request): Promise<NextResponse> {
  const expected = sipgateWebhookSecret();
  if (!expected) {
    return NextResponse.json({ error: 'SIPGATE_WEBHOOK_SECRET not configured' }, { status: 503 });
  }
  if (!secretOk(request)) return unauthorized();

  const text = await request.text();
  if (isSipgateAssistProbeBody(text)) {
    return NextResponse.json({ ok: true, probe: true });
  }

  const sourceIp = clientIpFromHeaders(request.headers);
  if (!sipgateIpAllowed(sourceIp)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (!requireDabosDb()) return dabosDbUnavailable();

  let body: unknown;
  try {
    body = JSON.parse(text);
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
