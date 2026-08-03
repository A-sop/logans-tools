import * as path from 'path';
import { matchEuerLine } from '@/lib/dabos-ops/document-intake/euer-lines';
import { taxYearFolder } from '@/lib/dabos-ops/document-intake/registry-config';
import type { ClassificationResult, IntelligenceEnrichment } from '@/lib/dabos-ops/document-intake/types';
import { buildDocumentNaming } from '@/lib/dabos-ops/document-intake/naming';

const INVALID_FILENAME_CHARS = /[<>:"/\\|?*\x00-\x1f]/g;

function sanitizeToken(value: string): string {
  return (
    value
      .trim()
      .replace(/\s+/g, '')
      .replace(INVALID_FILENAME_CHARS, '')
      .replace(/[^a-zA-Z0-9_-]/g, '')
      .replace(/_+/g, '_')
      .replace(/^[-_]+|[-_]+$/g, '') || 'ohne-Nr'
  );
}

function extractInvoiceNumber(text: string): string {
  const patterns = [
    /\b(?:rechnung(?:s)?(?:nr|nummer)?|invoice|ref(?:erence)?)\s*[:#]?\s*([A-Z0-9][A-Z0-9/_-]{3,24})\b/i,
    /\b(RG[-_]?\d{4,12})\b/i,
    /\b(\d{8,14})\b/,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return sanitizeToken(match[1]);
  }
  return 'ohne-Nr';
}

function isPrivateHat(text: string, organization: string): boolean {
  if (/\b(privat|private|pers[oÃ¶]nlich|krankenkasse|arzt|health)\b/i.test(text)) return true;
  if (/\b(N26|DKB|ING|Sparkasse)\b/i.test(text) && /\b(privat|personal)\b/i.test(text)) return true;
  return organization === 'UnknownOrg' && /\b(kontoauszug|bank)\b/i.test(text) && !/\b(gewerbe|business|firma|gmbh)\b/i.test(text);
}

export interface TaxNamingResult {
  basename: string;
  enrichment: Pick<
    IntelligenceEnrichment,
    'taxHat' | 'euerZeile' | 'euerKurzbezeichnungDe' | 'anbieter' | 'rechnungsnummer' | 'namingConfidence'
  >;
  warnings: string[];
}

export function buildTaxBelegNaming(
  classification: ClassificationResult,
  sourceFilePath: string,
  extractedText: string
): TaxNamingResult {
  const warnings: string[] = [];
  const ext = path.extname(sourceFilePath).toLowerCase() || '.pdf';
  const date = classification.documentDateYYMMDD;
  const anbieter = sanitizeToken(classification.organization === 'UnknownOrg' ? 'Unknown' : classification.organization);
  const rechnungsnummer = extractInvoiceNumber(extractedText);

  const privateHat = isPrivateHat(extractedText, classification.organization);
  if (privateHat) {
    const basename = `${date}_PR_${anbieter}_${rechnungsnummer}${ext}`;
    return {
      basename,
      enrichment: {
        taxHat: 'PR',
        anbieter,
        rechnungsnummer,
        namingConfidence: 0.5,
      },
      warnings: ['Classified as PR (private); verify hat.'],
    };
  }

  const lineMatch = matchEuerLine(extractedText);
  if (!lineMatch) {
    warnings.push('No EÃœR Zeile matched; using intake naming fallback for basename.');
    const intake = buildDocumentNaming(classification, sourceFilePath);
    return {
      basename: intake.finalFileName,
      enrichment: {
        taxHat: 'GW',
        anbieter,
        rechnungsnummer,
        namingConfidence: 0.35,
      },
      warnings,
    };
  }

  const { entry, confidence: zeileConfidence } = lineMatch;
  if (zeileConfidence < 0.6) {
    warnings.push(`Low confidence for EÃœR Zeile ${entry.zeile}.`);
  }

  const basename = `${date}_GW-${entry.zeile}-${entry.kurzbezeichnungDe}_${anbieter}_${rechnungsnummer}${ext}`;
  return {
    basename,
    enrichment: {
      taxHat: 'GW',
      euerZeile: entry.zeile,
      euerKurzbezeichnungDe: entry.kurzbezeichnungDe,
      anbieter,
      rechnungsnummer,
      namingConfidence: zeileConfidence,
    },
    warnings,
  };
}

export function proposedTaxRelativePath(basename: string, documentDateYYMMDD: string): string {
  const yearFolder = taxYearFolder(documentDateYYMMDD);
  return path.join('20_ADMIN', yearFolder, basename).replace(/\//g, '\\');
}
