import type { Locale } from '@/lib/i18n';
import { SEARCH_INDEX, type SearchDocument } from './index';

type SearchResult = SearchDocument & { score: number };

function scoreDocument(query: string, doc: SearchDocument): number {
  const q = query.trim().toLowerCase();
  const title = doc.title.toLowerCase();
  const description = doc.description.toLowerCase();
  const keywords = doc.keywords.join(' ').toLowerCase();

  let score = 0;
  if (title.includes(q)) score += 6;
  if (description.includes(q)) score += 3;
  if (keywords.includes(q)) score += 2;
  return score;
}

export function searchDocuments(
  query: string,
  locale: Locale,
  limit = 8,
): SearchResult[] {
  const normalized = query.trim();
  if (!normalized) return [];

  return SEARCH_INDEX.filter((doc) => doc.locale === locale)
    .map((doc) => ({ ...doc, score: scoreDocument(normalized, doc) }))
    .filter((doc) => doc.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

