import { requireDabosDb } from '@/lib/dabos/api-utils';
import { getDabosSql } from '@/lib/dabos/db';
import { ingestCapture } from '@/lib/dabos/ingest';
import { slackPostMessage } from '@/lib/dabos/slack-client';
import {
  executeTier0Command,
  normalizeSlashCommandText,
  resolveSlackSlashInvocation,
  tier0HelpText,
} from '@/lib/dabos/tier0-commands';
import {
  isSlackChannelAllowed,
  isSlackUserAllowed,
} from '@/lib/dabos/slack-verify';

type SlackMessageEvent = {
  type?: string;
  subtype?: string;
  user?: string;
  text?: string;
  channel?: string;
  channel_type?: string;
  bot_id?: string;
  ts?: string;
  client_msg_id?: string;
};

function extractUrls(text: string): string[] {
  const re = /https?:\/\/[^\s<>"')\]]+/gi;
  return [...new Set((text.match(re) || []).map((u) => u.replace(/[.,;:!?)]+$/, '')))];
}

export async function handleSlackMessageEvent(event: SlackMessageEvent): Promise<void> {
  if (event.type !== 'message') return;
  if (event.subtype || event.bot_id) return;
  if (!event.channel || !event.text?.trim()) return;

  if (!isSlackUserAllowed(event.user)) {
    await slackPostMessage(event.channel, 'Not authorized.');
    return;
  }

  if (!isSlackChannelAllowed(event.channel, event.channel_type)) {
    return;
  }

  const text = event.text.trim();
  let commandText: string | null = null;

  if (text.startsWith('/')) {
    if (text.startsWith('/dabos')) {
      commandText = normalizeSlashCommandText(text.replace(/^\/dabos\s*/i, ''));
    } else {
      commandText = text;
    }
  } else {
    // I0 IN: free-text → shared ingest (Neon comm center)
    try {
      if (!requireDabosDb()) {
        await slackPostMessage(event.channel, 'Database not configured.');
        return;
      }
      const external_id = `slack:${event.channel}:${event.client_msg_id || event.ts || Date.now()}`;
      const result = await ingestCapture(getDabosSql(), {
        mouth: 'slack',
        external_id,
        text,
        urls: extractUrls(text),
      });
      await slackPostMessage(event.channel, result.ack);
    } catch (err) {
      await slackPostMessage(
        event.channel,
        `Ingest failed: ${err instanceof Error ? err.message : String(err)}`
      );
    }
    return;
  }

  if (!commandText) {
    await slackPostMessage(event.channel, tier0HelpText());
    return;
  }

  let reply: string;
  try {
    if (!requireDabosDb()) {
      reply = 'Database not configured.';
    } else {
      const sql = getDabosSql();
      reply = await executeTier0Command(sql, commandText, 'founder-slack');
    }
  } catch (err) {
    reply = `Error: ${err instanceof Error ? err.message : String(err)}`;
  }

  await slackPostMessage(event.channel, reply);
}

export async function handleSlackSlashCommand(params: {
  userId: string;
  channelId: string;
  command: string;
  text: string;
}): Promise<string> {
  if (!isSlackUserAllowed(params.userId)) {
    return 'Not authorized.';
  }

  const commandText = resolveSlackSlashInvocation(params.command, params.text);
  if (!commandText) {
    return tier0HelpText();
  }

  if (!requireDabosDb()) {
    return 'Database not configured.';
  }

  const sql = getDabosSql();
  return executeTier0Command(sql, commandText, 'founder-slack');
}
