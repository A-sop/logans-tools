import { createHmac, timingSafeEqual } from 'node:crypto';

const MAX_AGE_SEC = 60 * 5;

export function verifySlackRequestSignature(
  signingSecret: string,
  rawBody: string,
  timestamp: string | null,
  signature: string | null
): boolean {
  if (!timestamp || !signature) return false;

  const ts = Number.parseInt(timestamp, 10);
  if (!Number.isFinite(ts)) return false;
  const ageSec = Math.abs(Date.now() / 1000 - ts);
  if (ageSec > MAX_AGE_SEC) return false;

  const base = `v0:${timestamp}:${rawBody}`;
  const digest = createHmac('sha256', signingSecret).update(base).digest('hex');
  const expected = `v0=${digest}`;

  try {
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(signature, 'utf8');
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function slackAllowedUserIds(): Set<string> {
  const raw = process.env.SLACK_ALLOWED_USER_IDS?.trim() ?? '';
  return new Set(
    raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  );
}

export function isSlackUserAllowed(userId: string | undefined): boolean {
  const allowed = slackAllowedUserIds();
  if (allowed.size === 0) return false;
  if (!userId) return false;
  return allowed.has(userId);
}

export function slackFounderChannelIds(): Set<string> {
  const raw = process.env.SLACK_FOUNDER_CHANNEL_IDS?.trim() ?? '';
  return new Set(
    raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  );
}

export function isSlackChannelAllowed(channelId: string | undefined, channelType?: string): boolean {
  if (!channelId) return false;
  if (channelType === 'im') return true;
  const channels = slackFounderChannelIds();
  if (channels.size === 0) return false;
  return channels.has(channelId);
}
