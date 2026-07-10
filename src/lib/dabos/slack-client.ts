const SLACK_API = 'https://slack.com/api';

export async function slackPostMessage(channel: string, text: string): Promise<void> {
  const token = process.env.SLACK_BOT_TOKEN?.trim();
  if (!token) {
    console.error('SLACK_BOT_TOKEN not configured');
    return;
  }

  const chunks = text.match(/[\s\S]{1,3900}/g) ?? [text];
  for (const chunk of chunks) {
    const res = await fetch(`${SLACK_API}/chat.postMessage`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify({ channel, text: chunk }),
    });
    const data = (await res.json()) as { ok?: boolean; error?: string };
    if (!data.ok) {
      console.error('Slack chat.postMessage failed:', data.error ?? res.status);
    }
  }
}
