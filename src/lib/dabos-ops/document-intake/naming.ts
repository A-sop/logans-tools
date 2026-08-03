import * as path from 'path';
import type { ClassificationResult, NamingResult } from '@/lib/dabos-ops/document-intake/types';

const INVALID_FILENAME_CHARS = /[<>:"/\\|?*\x00-\x1f]/g;

function transliterateSegment(value: string): string {
  return value
    .replace(/Ã¤/g, 'ae')
    .replace(/Ã¶/g, 'oe')
    .replace(/Ã¼/g, 'ue')
    .replace(/Ã„/g, 'Ae')
    .replace(/Ã–/g, 'Oe')
    .replace(/Ãœ/g, 'Ue')
    .replace(/ÃŸ/g, 'ss');
}

function sanitizeSegment(value: string): string {
  const asciiReady = transliterateSegment(value);
  return (
    asciiReady
      .trim()
      .replace(/\s+/g, '')
      .replace(INVALID_FILENAME_CHARS, '')
      .replace(/[^a-zA-Z0-9_-]/g, '')
      .replace(/_+/g, '_')
      .replace(/-+/g, '-')
      .replace(/^[-_]+|[-_]+$/g, '') || 'Unknown'
  );
}

function toPascalToken(value: string): string {
  if (!value) return '';
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function splitCamelCaseWords(value: string): string[] {
  const matches = value.match(/[A-Z]?[a-z]+|[A-Z]+(?![a-z])|\d+/g);
  return matches ?? [value];
}

function normalizeOrganizationSegment(value: string): string {
  const clean = sanitizeSegment(value);
  return clean ? clean.toUpperCase() : 'UNKNOWNORG';
}

function normalizeActionSegment(value: string): string {
  const clean = sanitizeSegment(value);
  return clean || 'GeneralReview';
}

function normalizePersonPart(value: string): string {
  return sanitizeSegment(value).replace(/[^a-zA-Z0-9]/g, '');
}

function normalizePersonSegment(value: string): string {
  const raw = transliterateSegment(value).trim();
  if (!raw) return 'UnknownPerson';
  if (raw === 'UnknownPerson') return raw;

  // Preferred explicit format: Lastname1Lastname2-Firstname1Firstname2
  if (raw.includes('-')) {
    const [left, right] = raw.split('-', 2);
    const last = normalizePersonPart(left);
    const first = normalizePersonPart(right);
    if (!last || !first) return 'UnknownPerson';
    return `${last}-${first}`;
  }

  // Space-delimited names are interpreted as Firstname(s) Lastname.
  const words = raw
    .split(/\s+/)
    .map((word) => normalizePersonPart(word))
    .filter(Boolean);
  if (words.length >= 2) {
    const last = words[words.length - 1] ?? '';
    const firstJoined = words.slice(0, -1).join('');
    if (last && firstJoined) return `${last}-${firstJoined}`;
  }

  // CamelCase fallback for already concatenated tokens.
  const compact = normalizePersonPart(raw);
  const camelWords = splitCamelCaseWords(compact);
  if (camelWords.length >= 2) {
    const firstToken = toPascalToken(camelWords[0] ?? '');
    const remaining = camelWords.slice(1).map((word) => toPascalToken(word)).join('');
    if (firstToken && remaining) return `${firstToken}-${remaining}`;
  }

  return compact || 'UnknownPerson';
}

function normalizeStatus(status: string): string {
  const clean = sanitizeSegment(status).toLowerCase();
  return clean || 'offen';
}

export function buildDocumentNaming(
  classification: ClassificationResult,
  sourceFilePath: string
): NamingResult {
  const extension = path.extname(sourceFilePath).toLowerCase() || '.bin';
  const date = sanitizeSegment(classification.documentDateYYMMDD);
  const organization = normalizeOrganizationSegment(classification.organization);
  const action = normalizeActionSegment(classification.action);
  const person = normalizePersonSegment(classification.person);
  const status = normalizeStatus(classification.status);
  const baseName = `${date}_${organization}_${action}_${person}_${status}`;

  return {
    baseName,
    finalFileName: `${baseName}${extension}`,
    markdownFileName: `${baseName}.md`,
  };
}
