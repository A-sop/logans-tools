import { NextResponse } from 'next/server';

import { handleSlackMessageEvent } from '@/lib/dabos/slack-handler';
import { verifySlackRequestSignature } from '@/lib/dabos/slack-verify';

export const dynamic = 'force-dynamic';

type SlackEventPayload = {
  type?: string;
  challenge?: string;
  event?: Parameters<typeof handleSlackMessageEvent>[0];
};

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

  let payload: SlackEventPayload;
  try {
    payload = JSON.parse(rawBody) as SlackEventPayload;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (payload.type === 'url_verification' && payload.challenge) {
    return NextResponse.json({ challenge: payload.challenge });
  }

  if (payload.type === 'event_callback' && payload.event) {
    void handleSlackMessageEvent(payload.event).catch((err) => {
      console.error('Slack event handler error:', err);
    });
  }

  return new NextResponse('', { status: 200 });
}
