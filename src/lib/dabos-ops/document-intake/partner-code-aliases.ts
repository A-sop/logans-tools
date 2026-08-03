import * as fs from 'fs';
import * as path from 'path';

/**
 * Partner document-code alias map. Maps a partner's internal code (e.g. Generali
 * `LA40`) to a human-readable issuer + document type, so proposed names carry the
 * partner doc type instead of an opaque code. The original code is preserved as a
 * traceable token in derived/client-version names.
 *
 * Vocabulary source of record: src/docs/document-intake/partner-code-aliases.md.
 * Seeded/refreshed via scripts/document-intake/import-seed-aliases.ts --partner-codes.
 */
export interface PartnerCodeAlias {
  code: string;
  issuer: string;
  issuerLegalName: string;
  docType: string;
}

export function partnerCodeAliasDocPath(): string {
  return (
    (process.env.DOC_INTAKE_PARTNER_CODE_DOC?.trim() || '') ||
    path.join(process.cwd(), 'src', 'docs', 'document-intake', 'partner-code-aliases.md')
  );
}

const LINE_RE =
  /^-\s*`?([A-Za-z0-9][A-Za-z0-9_-]*)`?\s*=>\s*issuer:\s*([^(|]+?)(?:\s*\(([^)]*)\))?\s*\|\s*docType:\s*(.+?)`?\s*$/;

export function parsePartnerCodeAliases(content: string): PartnerCodeAlias[] {
  const out: PartnerCodeAlias[] = [];
  let inCodesSection = false;
  let inHtmlComment = false;
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();

    // Only parse rows under the `## Codes` heading; ignore format examples elsewhere.
    if (line.startsWith('## ')) {
      inCodesSection = /^##\s+codes\b/i.test(line);
      continue;
    }
    if (!inCodesSection) continue;

    // Skip HTML-comment blocks (the "add more like this" examples).
    if (inHtmlComment) {
      if (line.includes('-->')) inHtmlComment = false;
      continue;
    }
    if (line.startsWith('<!--')) {
      if (!line.includes('-->')) inHtmlComment = true;
      continue;
    }

    if (!line.startsWith('-') || !line.includes('=>')) continue;
    const m = line.match(LINE_RE);
    if (!m) continue;
    const [, code, issuer, legal, docType] = m;
    if (!code || !issuer || !docType) continue;
    out.push({
      code: code.trim(),
      issuer: issuer.trim(),
      issuerLegalName: (legal ?? '').trim() || issuer.trim(),
      docType: docType.trim(),
    });
  }
  return out;
}

let cachedMap: Map<string, PartnerCodeAlias> | null = null;

/** Case-insensitive code → alias lookup, parsed from the vocabulary doc (cached). */
export function loadPartnerCodeAliasMap(docPath?: string): Map<string, PartnerCodeAlias> {
  if (cachedMap && !docPath) return cachedMap;
  const resolved = docPath ?? partnerCodeAliasDocPath();
  const map = new Map<string, PartnerCodeAlias>();
  try {
    const content = fs.readFileSync(resolved, 'utf8');
    for (const alias of parsePartnerCodeAliases(content)) {
      map.set(alias.code.toLowerCase(), alias);
    }
  } catch {
    // No doc / unreadable → empty map; pipeline degrades to code-free naming.
  }
  if (!docPath) cachedMap = map;
  return map;
}

/**
 * Detect the first partner code present in the filename or extracted text and
 * return its alias, or null. Filename is checked first (most reliable signal).
 */
export function detectPartnerCode(
  fileName: string,
  extractedText: string,
  map: Map<string, PartnerCodeAlias> = loadPartnerCodeAliasMap()
): PartnerCodeAlias | null {
  if (map.size === 0) return null;
  const haystackName = fileName;
  const haystackText = (extractedText || '').slice(0, 4000);
  for (const alias of map.values()) {
    // nosemgrep: javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp -- alias.code escaped via escapeRe; map is local markdown seed
    const codeRe = new RegExp(`(^|[^A-Za-z0-9])${escapeRe(alias.code)}([^A-Za-z0-9]|$)`, 'i');
    if (codeRe.test(haystackName)) return alias;
  }
  for (const alias of map.values()) {
    // nosemgrep: javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp -- alias.code escaped via escapeRe; map is local markdown seed
    const codeRe = new RegExp(`(^|[^A-Za-z0-9])${escapeRe(alias.code)}([^A-Za-z0-9]|$)`, 'i');
    if (codeRe.test(haystackText)) return alias;
  }
  return null;
}

function escapeRe(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
