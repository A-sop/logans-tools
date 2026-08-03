import * as path from 'path';
import type { TextQuality } from '@/lib/atlas-ops/document-intake/types';

/** Scanner names like doc04343120260605085130.pdf embed YYYYMMDD… */
export function parseFilenameDateYYMMDD(fileName: string): string | null {
  const base = fileName.replace(path.extname(fileName), '');
  const match = base.match(/(20\d{2})(\d{2})(\d{2})/);
  if (!match) return null;
  return `${match[1]!.slice(2)}${match[2]}${match[3]}`;
}

/** Stable short token from scanner/inbox names for collision-free basenames. */
export function extractScanToken(fileName: string): string {
  const base = fileName.replace(path.extname(fileName), '');
  // Scanner pattern: doc04343120260605085130 → doc + 6-digit id, then YYYYMMDD…
  const docMatch = base.match(/^(doc\d{6})(?:20\d{6}|$)/i);
  if (docMatch) return docMatch[1]!.toLowerCase();
  const compact = base.replace(/[^a-zA-Z0-9]/g, '').slice(0, 16);
  return compact || 'scan';
}

/** PDF text that looks empty but exceeds the old 80-char OCR skip threshold. */
export function isLowInformationPdfText(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return true;

  const withoutPageMarkers = trimmed.replace(/--\s*\d+\s+of\s+\d+\s*--/gi, '').trim();
  if (withoutPageMarkers.length < 40) return true;

  const letters = (trimmed.match(/[a-zA-ZäöüÄÖÜß]/g) ?? []).length;
  const letterRatio = letters / Math.max(trimmed.length, 1);
  if (trimmed.length > 80 && letterRatio < 0.35) return true;

  return false;
}

/** U+FFFD replacement char + C0 control chars (excluding tab/LF/FF/CR). */
function countCorruptionChars(text: string): number {
  let count = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    const isControl =
      code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0c && code !== 0x0d;
    if (code === 0xfffd || isControl) count++;
  }
  return count;
}

/**
 * Grade extracted text for trustworthiness. Catches CID-corruption ("garbage
 * text layer") that a length check misses — the COR1389 failure mode, where a
 * PDF's embedded text is long but is one junk glyph per real glyph.
 *
 * Discriminators (all local, deterministic):
 * - replacement/control-char ratio — a strong corruption signal;
 * - word-shaped-token ratio — fraction of whitespace tokens containing a 3+ letter
 *   run. Real prose is ~0.7–0.95; CID gibberish is near zero even when it maps
 *   into the Latin range. This is the key signal length/letterRatio both miss.
 * - letter ratio — secondary; kept deliberately loose so numeric-heavy but real
 *   docs (invoices, tax Belege) grade `low`, not `garbage`.
 *
 * Bias: only strong evidence yields `garbage` (it blocks delete + forces review);
 * `low` is informational and does not force review.
 */
export function scoreTextQuality(text: string): TextQuality {
  const body = text.replace(/--\s*\d+\s+of\s+\d+\s*--/gi, '').trim();
  if (body.length < 40) return 'garbage';

  const len = body.length;
  const letters = (body.match(/[a-zA-ZäöüÄÖÜß]/g) ?? []).length;
  const letterRatio = letters / len;

  const replacementRatio = countCorruptionChars(body) / len;

  const wordTokens = (body.match(/[a-zA-ZäöüÄÖÜß]{3,}/g) ?? []).length;
  const tokens = body.split(/\s+/).filter(Boolean).length;
  const wordShapedRatio = tokens > 0 ? wordTokens / tokens : 0;

  // Strong evidence of corruption → garbage (blocks delete, forces review).
  if (replacementRatio > 0.02) return 'garbage';
  if (wordShapedRatio < 0.15) return 'garbage';
  if (letterRatio < 0.1) return 'garbage';

  // Real but sparse (numeric-heavy docs land here) → usable, not delete-safe.
  if (wordShapedRatio < 0.4 || letterRatio < 0.45) return 'low';

  return 'clean';
}
