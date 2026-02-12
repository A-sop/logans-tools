/**
 * Ahrefs API v3 client (server-only).
 * Docs: https://docs.ahrefs.com/docs/api/reference/introduction
 *
 * Base URL: Get from Ahrefs dashboard — open any report, click the API button for the exact cURL/URL.
 * Common patterns: api.ahrefs.com, api-v3.ahrefs.com — verify in your account.
 */

const AHREFS_API_BASE =
  process.env.AHREFS_API_BASE ?? 'https://api.ahrefs.com/v3';
const AHREFS_API_KEY = process.env.AHREFS_API_KEY;

export type AhrefsApiError = {
  error?: string;
  message?: string;
  code?: number;
};

async function ahrefsFetch<T>(
  path: string,
  params?: Record<string, string | number | undefined>
): Promise<T> {
  if (!AHREFS_API_KEY?.trim()) {
    throw new Error(
      'AHREFS_API_KEY is not set. Add it to .env.local. See src/docs/ahrefs-setup.md'
    );
  }

  const url = new URL(path, AHREFS_API_BASE);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== '') url.searchParams.set(k, String(v));
    }
  }

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${AHREFS_API_KEY}`,
      Accept: 'application/json',
    },
  });

  const data = (await res.json().catch(() => ({}))) as T | AhrefsApiError;

  if (!res.ok) {
    const err = data as AhrefsApiError;
    throw new Error(
      err?.message ?? err?.error ?? `Ahrefs API error: ${res.status} ${res.statusText}`
    );
  }

  return data as T;
}

/**
 * Subscription / limits — does not consume API units.
 * Use to verify your key works and check remaining capacity.
 */
export async function getSubscriptionInfo(): Promise<unknown> {
  return ahrefsFetch('/subscription/info');
}

/**
 * Keywords Explorer: metrics for a single keyword.
 * Non-Enterprise: use "ahrefs.com" or "wordcount.com" as free test targets.
 * Enterprise: any keyword.
 */
export async function getKeywordMetrics(keyword: string): Promise<unknown> {
  return ahrefsFetch('/keywords-explorer/metrics', { keyword });
}

/**
 * Keywords Explorer: keyword ideas (matching terms, related terms, etc.).
 */
export async function getKeywordIdeas(
  keyword: string,
  mode: 'matching_terms' | 'related_terms' | 'search_suggestions' = 'matching_terms'
): Promise<unknown> {
  return ahrefsFetch('/keywords-explorer/ideas', { keyword, mode });
}
