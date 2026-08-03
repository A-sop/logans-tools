import type { ClassificationResult } from '@/lib/dabos-ops/document-intake/types';

interface LlmConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

function readEnv(name: string): string | null {
  const value = process.env[name];
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function getLlmConfig(): LlmConfig | null {
  const groqKey = readEnv('GROQ_API_KEY');
  if (groqKey) {
    return {
      baseUrl: 'https://api.groq.com/openai/v1',
      apiKey: groqKey,
      model: readEnv('LLM_MODEL') ?? 'llama-3.1-8b-instant',
    };
  }

  const base = readEnv('LLM_API_BASE');
  if (base) {
    return {
      baseUrl: base.replace(/\/$/, ''),
      apiKey: readEnv('LLM_API_KEY') ?? readEnv('OPENAI_API_KEY') ?? '',
      model: readEnv('LLM_MODEL') ?? 'gpt-4o-mini',
    };
  }

  const openAiKey = readEnv('OPENAI_API_KEY');
  if (openAiKey) {
    return {
      baseUrl: 'https://api.openai.com/v1',
      apiKey: openAiKey,
      model: readEnv('LLM_MODEL') ?? 'gpt-4o-mini',
    };
  }

  return null;
}

function isMissingCriticalField(classification: ClassificationResult): boolean {
  return (
    classification.organization === 'UnknownOrg' ||
    classification.person === 'UnknownPerson' ||
    classification.confidence < 0.7
  );
}

export async function maybeInterpretWithLlm(
  extractedText: string,
  baseline: ClassificationResult,
  enabled: boolean
): Promise<ClassificationResult | null> {
  if (!enabled) return null;
  if (!isMissingCriticalField(baseline)) return null;
  if (!extractedText.trim()) return null;

  const config = getLlmConfig();
  if (!config) return null;

  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
    },
    body: JSON.stringify({
      model: config.model,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You extract document metadata for file naming.
Return JSON with keys:
- documentDateYYMMDD
- organization
- action
- person
- status
- documentType
- actionRequired
- summary
- confidence (0..1)
Only return JSON.`,
        },
        {
          role: 'user',
          content: extractedText.slice(0, 12000),
        },
      ],
    }),
  });
  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) return null;

  try {
    const parsed = JSON.parse(content) as Partial<ClassificationResult>;
    if (
      typeof parsed.documentDateYYMMDD !== 'string' ||
      typeof parsed.organization !== 'string' ||
      typeof parsed.action !== 'string' ||
      typeof parsed.person !== 'string' ||
      typeof parsed.status !== 'string'
    ) {
      return null;
    }

    return {
      documentDateYYMMDD: parsed.documentDateYYMMDD,
      organization: parsed.organization,
      action: parsed.action,
      person: parsed.person,
      status: parsed.status,
      documentType:
        typeof parsed.documentType === 'string' ? parsed.documentType : baseline.documentType,
      actionRequired:
        typeof parsed.actionRequired === 'string' ? parsed.actionRequired : baseline.actionRequired,
      summary: typeof parsed.summary === 'string' ? parsed.summary : baseline.summary,
      confidence:
        typeof parsed.confidence === 'number' && parsed.confidence > 0 && parsed.confidence <= 1
          ? parsed.confidence
          : baseline.confidence,
      warnings: [...baseline.warnings, 'LLM interpretation used for semantic enrichment.'],
    };
  } catch {
    return null;
  }
}
