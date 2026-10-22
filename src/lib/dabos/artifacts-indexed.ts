/**
 * Div1 primary: artifacts_indexed = unique wiki pages in the DABOS wiki index
 * (Logan ruling 2026-10-21: count unique pages, not table rows).
 *
 * Basis: every Markdown link target in DABOS/docs/wiki/index.md, normalised
 * (\ -> /, leading ./ dropped, trailing / dropped, lowercase), external links and
 * pure anchors skipped, then de-duplicated. At DABOS head 368cfd9e this is 232
 * (237 catalog rows, 229 unique catalog pages + SCHEMA, log, inbox/).
 */
import { existsSync, readFileSync } from 'fs';
import path from 'path';

const DABOS_REPO_ROOT = process.env.DABOS_REPO_ROOT?.trim() || path.join('C:', 'Dev', 'DABOS');
export const DABOS_WIKI_INDEX =
  process.env.DABOS_WIKI_INDEX?.trim() || path.join(DABOS_REPO_ROOT, 'docs', 'wiki', 'index.md');

export type ArtifactsIndexedCount = {
  total: number;
  rows: number;
  sourcesPresent: boolean;
  source: string;
};

const LINK_RE = /\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;

export function normaliseWikiTarget(raw: string): string | null {
  let t = raw.trim().split('#')[0];
  if (!t || /^[a-z][a-z0-9+.-]*:/i.test(t)) return null; // http:, mailto:, ...
  t = t.replace(/\\/g, '/').replace(/^(\.\/)+/, '').replace(/\/+$/, '');
  return t ? t.toLowerCase() : null;
}

/** Unique page targets linked from the wiki index text. */
export function countUniqueWikiPages(indexText: string): { unique: number; rows: number } {
  const pages = new Set<string>();
  let rows = 0;
  for (const line of indexText.split(/\r?\n/)) {
    if (/^\|\s*\[/.test(line)) rows += 1;
    for (const m of line.matchAll(LINK_RE)) {
      const t = normaliseWikiTarget(m[1]);
      if (t) pages.add(t);
    }
  }
  return { unique: pages.size, rows };
}

export function countArtifactsIndexed(indexPath: string = DABOS_WIKI_INDEX): ArtifactsIndexedCount {
  if (!existsSync(indexPath)) {
    return { total: 0, rows: 0, sourcesPresent: false, source: indexPath };
  }
  const { unique, rows } = countUniqueWikiPages(readFileSync(indexPath, 'utf8'));
  return { total: unique, rows, sourcesPresent: true, source: indexPath };
}

export const ARTIFACTS_INDEXED_BASIS = {
  ssot: 'DABOS/docs/wiki/index.md',
  rule: 'unique link targets (Logan ruling 2026-10-21)',
  path: DABOS_WIKI_INDEX,
};
