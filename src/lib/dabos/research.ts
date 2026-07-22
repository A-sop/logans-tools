import { DABOS_SYSTEM_CODE_V1 } from '@/lib/dabos/system-code';

export type ResearchRunResult =
  | {
      ok: true;
      summary: string;
      provider: 'ollama' | 'openai' | 'openrouter';
      tokensInput: number;
      tokensOutput: number;
      costEur: number | null;
    }
  | { ok: false; error: string };

const RESEARCH_MAX_TOKENS = 2000;

function estimateOpenAiCostEur(inputTokens: number, outputTokens: number): number {
  // gpt-4o-mini rough estimate (USD → EUR ~0.92)
  const usd = (inputTokens / 1_000_000) * 0.15 + (outputTokens / 1_000_000) * 0.6;
  return Math.round(usd * 0.92 * 10000) / 10000;
}

async function chatCompletion(params: {
  baseUrl: string;
  apiKey?: string;
  model: string;
  system: string;
  user: string;
  maxTokens: number;
  extraHeaders?: Record<string, string>;
}): Promise<{ text: string; tokensInput: number; tokensOutput: number }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(params.extraHeaders ?? {}),
  };
  if (params.apiKey) headers.Authorization = `Bearer ${params.apiKey}`;

  const res = await fetch(`${params.baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: params.model,
      messages: [
        { role: 'system', content: params.system },
        { role: 'user', content: params.user },
      ],
      max_tokens: params.maxTokens,
      temperature: 0.4,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`LLM ${res.status}: ${body.slice(0, 300)}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };

  return {
    text: data.choices?.[0]?.message?.content?.trim() ?? '',
    tokensInput: data.usage?.prompt_tokens ?? 0,
    tokensOutput: data.usage?.completion_tokens ?? 0,
  };
}

async function runCloudResearch(params: {
  system: string;
  user: string;
  maxTokens: number;
}): Promise<ResearchRunResult> {
  const openRouterKey = process.env.OPENROUTER_API_KEY?.trim();
  if (openRouterKey) {
    const result = await chatCompletion({
      baseUrl: process.env.OPENROUTER_BASE_URL?.trim() || 'https://openrouter.ai/api/v1',
      apiKey: openRouterKey,
      model: process.env.OPENROUTER_MODEL?.trim() || 'openai/gpt-4o-mini',
      system: params.system,
      user: params.user,
      maxTokens: params.maxTokens,
      extraHeaders: {
        'HTTP-Referer': 'https://dabos.logans.tools',
        'X-Title': 'DABOS research agent',
      },
    });
    return {
      ok: true,
      summary: result.text,
      provider: 'openrouter',
      tokensInput: result.tokensInput,
      tokensOutput: result.tokensOutput,
      costEur: estimateOpenAiCostEur(result.tokensInput, result.tokensOutput),
    };
  }

  const openAiKey = process.env.OPENAI_API_KEY?.trim();
  if (openAiKey) {
    const result = await chatCompletion({
      baseUrl: 'https://api.openai.com/v1',
      apiKey: openAiKey,
      model: process.env.DABOS_OPENAI_MODEL ?? 'gpt-4o-mini',
      system: params.system,
      user: params.user,
      maxTokens: params.maxTokens,
    });
    return {
      ok: true,
      summary: result.text,
      provider: 'openai',
      tokensInput: result.tokensInput,
      tokensOutput: result.tokensOutput,
      costEur: estimateOpenAiCostEur(result.tokensInput, result.tokensOutput),
    };
  }

  return {
    ok: false,
    error:
      'Cloud research needs OPENROUTER_API_KEY or OPENAI_API_KEY (Vercel cannot reach Tailscale Ollama)',
  };
}

export async function runResearchAgent(input: {
  title: string;
  description: string | null;
  tier: number;
  budgetTokens?: number | null;
}): Promise<ResearchRunResult> {
  const maxTokens = Math.min(
    RESEARCH_MAX_TOKENS,
    input.budgetTokens && input.budgetTokens > 0 ? input.budgetTokens : RESEARCH_MAX_TOKENS
  );

  const system = `${DABOS_SYSTEM_CODE_V1}

You are the DABOS Research capability agent. Produce concise, structured research notes:
- Direct answer (2-4 sentences)
- Key bullets (3-6)
- Recommended next actions (1-3)
Stay within token budget. No fluff.`;

  const user = `Task title: ${input.title}
Description: ${input.description ?? '(none)'}

Research this topic for the founder. Output markdown.`;

  const forceCloud =
    input.tier >= 2 ||
    process.env.DABOS_RESEARCH_TIER === '2' ||
    process.env.DABOS_RESEARCH_TIER === 'cloud' ||
    process.env.VERCEL === '1';

  try {
    if (forceCloud) {
      return await runCloudResearch({ system, user, maxTokens });
    }

    try {
      const ollamaBase = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434/v1';
      const model = process.env.OLLAMA_MODEL ?? 'llama3.2';
      const result = await chatCompletion({
        baseUrl: ollamaBase,
        model,
        system,
        user,
        maxTokens,
      });
      return {
        ok: true,
        summary: result.text,
        provider: 'ollama',
        tokensInput: result.tokensInput,
        tokensOutput: result.tokensOutput,
        costEur: null,
      };
    } catch (ollamaErr) {
      const cloud = await runCloudResearch({ system, user, maxTokens });
      if (cloud.ok) return cloud;
      return {
        ok: false,
        error: `Ollama failed (${ollamaErr instanceof Error ? ollamaErr.message : String(ollamaErr)}); ${cloud.error}`,
      };
    }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Research run failed',
    };
  }
}
