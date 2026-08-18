import { timingSafeEqual } from 'node:crypto';

export const SIPGATE_DEFAULT_ALLOW_IP = '217.116.118.254';
export const SIPGATE_RETENTION_DAYS = 30;

const TRANSCRIPT_KEYS = new Set(['transcription', 'transcriptions']);

export type SipgateActionItem = { text: string };

export type NormalizedSipgateAssist = {
  callId: string | null;
  direction: string | null;
  remoteNumber: string | null;
  localNumber: string | null;
  channelName: string | null;
  startedAt: Date | null;
  durationSeconds: number | null;
  headline: string | null;
  summary: string | null;
  actionItems: SipgateActionItem[];
  hasTranscript: boolean;
  payload: Record<string, unknown>;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

export function secretsEqual(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) {
    timingSafeEqual(b, b);
    return false;
  }
  return timingSafeEqual(a, b);
}

export function stripTranscriptFields(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripTranscriptFields);
  const rec = asRecord(value);
  if (!rec) return value;
  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(rec)) {
    if (TRANSCRIPT_KEYS.has(key.toLowerCase())) continue;
    out[key] = stripTranscriptFields(child);
  }
  return out;
}

export function payloadHasTranscript(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(payloadHasTranscript);
  const rec = asRecord(value);
  if (!rec) return false;
  for (const [key, child] of Object.entries(rec)) {
    if (TRANSCRIPT_KEYS.has(key.toLowerCase())) return true;
    if (payloadHasTranscript(child)) return true;
  }
  return false;
}

export function cleanSipgateWatermark(text: string | null): string | null {
  if (!text) return null;
  const cleaned = text
    .replace(/\[Erstellt mit sipgate AI\]\([^)]+\)/gi, '')
    .replace(/\[Erstellt mit sipgate AI\]/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return cleaned.length > 0 ? cleaned : null;
}

function durationSeconds(raw: unknown): number | null {
  const n = asNumber(raw);
  if (n === null) return null;
  if (n > 10_000) return Math.round(n / 1000);
  return Math.round(n);
}

function epochToDate(raw: unknown): Date | null {
  const n = asNumber(raw);
  if (n === null) {
    const s = asString(raw);
    if (!s) return null;
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const ms = n > 10_000_000_000 ? n : n * 1000;
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? null : d;
}

function pickCall(body: Record<string, unknown>): Record<string, unknown> {
  return asRecord(body.call) ?? {};
}

function pickAssist(body: Record<string, unknown>): Record<string, unknown> {
  return asRecord(body.assist) ?? {};
}

function extractActionItems(body: Record<string, unknown>): SipgateActionItem[] {
  const buckets = [body.actionItems, pickAssist(body).actionItems];
  const items: SipgateActionItem[] = [];
  for (const bucket of buckets) {
    if (!Array.isArray(bucket)) continue;
    for (const row of bucket) {
      const rec = asRecord(row);
      const text = asString(rec?.text) ?? asString(rec?.content);
      if (text) items.push({ text: cleanSipgateWatermark(text) ?? text });
    }
  }
  return items;
}

function extractSummary(body: Record<string, unknown>): string | null {
  const direct = asString(body.summary);
  if (direct) return cleanSipgateWatermark(direct);
  const assistSummary = pickAssist(body).summary;
  const rec = asRecord(assistSummary);
  if (rec) return cleanSipgateWatermark(asString(rec.content));
  return cleanSipgateWatermark(asString(assistSummary));
}

function extractHeadline(body: Record<string, unknown>): string | null {
  const direct = asString(body.callHeadline);
  if (direct) return cleanSipgateWatermark(direct);
  const assistHeadline = pickAssist(body).callHeadline;
  const rec = asRecord(assistHeadline);
  if (rec) return cleanSipgateWatermark(asString(rec.content));
  return cleanSipgateWatermark(asString(assistHeadline));
}

export function normalizeSipgateAssistPayload(
  body: unknown,
  storeTranscript: boolean
): NormalizedSipgateAssist | { error: string } {
  const rec = asRecord(body);
  if (!rec) return { error: 'JSON object required' };

  const call = pickCall(rec);
  const channel = asRecord(rec.channel) ?? asRecord(call.channel) ?? {};
  const hasTranscript = payloadHasTranscript(rec);
  const stored = storeTranscript ? rec : (stripTranscriptFields(rec) as Record<string, unknown>);

  const caller = asString(call.caller) ?? asString(call.from);
  const callee = asString(call.callee) ?? asString(call.to);
  const directionRaw = (asString(call.direction) ?? asString(rec.direction) ?? '').toLowerCase();
  const inbound = directionRaw === 'in' || directionRaw === 'inbound';
  const outbound = directionRaw === 'out' || directionRaw === 'outbound';

  return {
    callId: asString(call.id) ?? asString(rec.id),
    direction: inbound ? 'in' : outbound ? 'out' : directionRaw || null,
    remoteNumber: inbound ? caller : outbound ? callee : callee ?? caller,
    localNumber: inbound ? callee : outbound ? caller : caller ?? callee,
    channelName: asString(channel.name),
    startedAt: epochToDate(call.startTime) ?? epochToDate(rec.startTime),
    durationSeconds: durationSeconds(call.duration) ?? durationSeconds(rec.duration),
    headline: extractHeadline(rec),
    summary: extractSummary(rec),
    actionItems: extractActionItems(rec),
    hasTranscript,
    payload: stored,
  };
}

export function sipgateAllowIps(): string[] {
  const raw = process.env.SIPGATE_WEBHOOK_IPS?.trim();
  const source = raw && raw.length > 0 ? raw : SIPGATE_DEFAULT_ALLOW_IP;
  return source
    .split(',')
    .map((ip) => ip.trim())
    .filter(Boolean);
}

export function clientIpFromHeaders(headers: Headers): string | null {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first.replace(/^::ffff:/i, '');
  }
  const real = headers.get('x-real-ip')?.trim();
  if (real) return real.replace(/^::ffff:/i, '');
  const vercel = headers.get('x-vercel-forwarded-for')?.trim();
  if (vercel) return vercel.split(',')[0]?.trim().replace(/^::ffff:/i, '') ?? null;
  return null;
}

export function sipgateIpAllowed(ip: string | null, nodeEnv = process.env.NODE_ENV): boolean {
  if (process.env.SIPGATE_WEBHOOK_SKIP_IP?.trim() === '1') return true;
  if (nodeEnv !== 'production' && process.env.SIPGATE_WEBHOOK_ENFORCE_IP?.trim() !== '1') {
    return true;
  }
  if (!ip) return false;
  return sipgateAllowIps().includes(ip);
}

export function sipgateWebhookSecret(): string | null {
  const secret = process.env.SIPGATE_WEBHOOK_SECRET?.trim();
  return secret && secret.length > 0 ? secret : null;
}

/** Path token: /api/dabos/sipgate/assist/<secret> — Labs URL field often rejects ?k=. */
export function sipgateAssistPathToken(pathname: string): string | null {
  const parts = pathname.split('/').filter(Boolean);
  if (
    parts.length !== 5 ||
    parts[0] !== 'api' ||
    parts[1] !== 'dabos' ||
    parts[2] !== 'sipgate' ||
    parts[3] !== 'assist'
  ) {
    return null;
  }
  try {
    const token = decodeURIComponent(parts[4] ?? '').trim();
    return token || null;
  } catch {
    return null;
  }
}

export function isSipgateAssistProbeBody(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.length === 0 || trimmed === '{}' || trimmed === 'null';
}

export function providedSipgateSecret(request: Request, url: URL): string | null {
  const header =
    request.headers.get('x-sipgate-webhook-secret')?.trim() ||
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim() ||
    '';
  if (header) return header;
  const query = url.searchParams.get('k')?.trim();
  if (query) return query;
  return sipgateAssistPathToken(url.pathname);
}

export function storeTranscriptEnabled(): boolean {
  return process.env.SIPGATE_STORE_TRANSCRIPT?.trim() === '1';
}
