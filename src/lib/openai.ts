/**
 * OpenAI integration — server-only.
 * Uses OPENAI_API_KEY from .env.local (see src/docs/INTEGRATIONS.md).
 */

export type TestCompletionResult = { ok: true; text: string } | { ok: false; error: string };

/** Minimal test: call OpenAI with a short prompt. For learning and connectivity checks. */
export async function testOpenAIConnection(): Promise<TestCompletionResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { ok: false, error: 'OPENAI_API_KEY not set in .env.local' };
  }

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: 'Reply with exactly: Connected. Executive Concierge is ready.',
          },
        ],
        max_tokens: 50,
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.error('[OpenAI] API error:', res.status, errBody);
      return { ok: false, error: `API error ${res.status}: ${errBody.slice(0, 100)}` };
    }

    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = data.choices?.[0]?.message?.content?.trim() ?? '';
    console.log('[OpenAI] Test completion OK, response length:', text.length);
    return { ok: true, text };
  } catch (err) {
    console.error('[OpenAI] Request failed:', err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}
