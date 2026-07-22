import { NextResponse } from 'next/server';

import { handleSlackSlashCommand } from '@/lib/dabos/slack-handler';
import { verifySlackRequestSignature } from '@/lib/dabos/slack-verify';

export const dynamic = 'force-dynamic';

/** Slack sends GET ?ssl_check=1 to verify TLS before saving slash command URLs. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get('ssl_check') === '1') {
    return new NextResponse('', { status: 200 });
  }
  return new NextResponse('', { status: 200 });
}

export async function POST(request: Request) {
  const signingSecret = process.env.SLACK_SIGNING_SECRET?.trim();
  if (!signingSecret) {
    return NextResponse.json({ error: 'SLACK_SIGNING_SECRET not configured' }, { status: 503 });
  }

  const rawBody = await request.text();
  const timestamp = request.headers.get('x-slack-request-timestamp');
  const signature = request.headers.get('x-slack-signature');

  if (!verifySlackRequestSignature(signingSecret, rawBody, timestamp, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const params = new URLSearchParams(rawBody);
  const userId = params.get('user_id') ?? '';
  const channelId = params.get('channel_id') ?? '';
  const command = params.get('command') ?? '/dabos';
  const text = params.get('text') ?? '';

  let responseText: string;
  try {
    responseText = await handleSlackSlashCommand({ userId, channelId, command, text });
  } catch (err) {
    responseText = `Error: ${err instanceof Error ? err.message : String(err)}`;
  }

  return NextResponse.json({
    response_type: 'ephemeral',
    text: responseText,
  });
}
