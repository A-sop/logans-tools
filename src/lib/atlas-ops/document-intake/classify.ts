import { parseFilenameDateYYMMDD } from '@/lib/atlas-ops/document-intake/filename-heuristics';
import type { ClassificationResult } from '@/lib/atlas-ops/document-intake/types';

export interface ClassifyOptions {
  sourcePath?: string;
}

const STATUS_KEYWORDS: Array<{ keyword: RegExp; status: string }> = [
  { keyword: /\b(policiert)\b/i, status: 'policiert' },
  { keyword: /\b(unterschrieben|signed)\b/i, status: 'unterschrieben' },
  { keyword: /\b(eingereicht|submitted)\b/i, status: 'eingereicht' },
  { keyword: /\b(archiviert|archived)\b/i, status: 'archiviert' },
  { keyword: /\b(info|information)\b/i, status: 'info' },
  { keyword: /\b(offen|pending|review)\b/i, status: 'offen' },
];

const ACTION_KEYWORDS: Array<{ keyword: RegExp; action: string; documentType: string }> = [
  {
    keyword: /\b(policy|police|versicherung|versicherungen|berufsunf|bu-leistung)\b/i,
    action: 'PolicyUpdate',
    documentType: 'Insurance',
  },
  {
    keyword: /\b(contract|vertrag)\b/i,
    action: 'ContractReview',
    documentType: 'Contract',
  },
  {
    keyword: /\b(invoice|rechnung)\b/i,
    action: 'InvoiceCheck',
    documentType: 'Invoice',
  },
  { keyword: /\b(application|antrag)\b/i, action: 'ApplicationReview', documentType: 'Application' },
];

const ORG_KEYWORDS: Array<{ keyword: RegExp; organization: string }> = [
  { keyword: /\bGEDL\b/i, organization: 'GEDL' },
  { keyword: /\bGEDV\b/i, organization: 'GEDV' },
  { keyword: /\bGEDK\b/i, organization: 'GEDK' },
  { keyword: /\bADVOCARD\b/i, organization: 'ADVOCARD' },
  { keyword: /\bGenerali\b/i, organization: 'Generali' },
  { keyword: /\bDVAG\b/i, organization: 'DVAG' },
];

function todayYYMMDD(): string {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yy}${mm}${dd}`;
}

function resolveDocumentDateYYMMDD(text: string, sourcePath?: string): string {
  if (sourcePath) {
    const fromName = parseFilenameDateYYMMDD(sourcePath);
    if (fromName) return fromName;
  }
  return extractDateYYMMDD(text);
}

function extractDateYYMMDD(text: string): string {
  const isoMatch = text.match(/\b(20\d{2})[-/.](\d{2})[-/.](\d{2})\b/);
  if (isoMatch) {
    return `${isoMatch[1]!.slice(2)}${isoMatch[2]}${isoMatch[3]}`;
  }

  const deMatch = text.match(/\b(\d{2})[.](\d{2})[.](20\d{2})\b/);
  if (deMatch) {
    return `${deMatch[3]!.slice(2)}${deMatch[2]}${deMatch[1]}`;
  }

  return todayYYMMDD();
}

function extractPerson(text: string): string {
  const personMatch = text.match(/\b(?:Herr|Frau|Mr\.?|Ms\.?)\s+([A-Z][a-zA-Z]+)\s+([A-Z][a-zA-Z]+)/);
  if (personMatch) {
    return `${personMatch[2]}${personMatch[1]}`;
  }

  return 'UnknownPerson';
}

export function classifyExtractedText(
  extractedText: string,
  options: ClassifyOptions = {}
): ClassificationResult {
  const warnings: string[] = [];
  const trimmedText = extractedText.trim();
  const preview = trimmedText.slice(0, 1200);
  const normalizedText = preview.replace(/\s+/g, ' ');

  let organization = 'UnknownOrg';
  for (const candidate of ORG_KEYWORDS) {
    if (candidate.keyword.test(preview)) {
      organization = candidate.organization;
      break;
    }
  }
  if (organization === 'UnknownOrg') warnings.push('Organization could not be confidently detected.');

  let action = 'GeneralReview';
  let documentType = 'GeneralDocument';
  for (const candidate of ACTION_KEYWORDS) {
    if (candidate.keyword.test(preview)) {
      action = candidate.action;
      documentType = candidate.documentType;
      break;
    }
  }

  let status = 'offen';
  for (const candidate of STATUS_KEYWORDS) {
    if (candidate.keyword.test(preview)) {
      status = candidate.status;
      break;
    }
  }

  const person = extractPerson(preview);
  if (person === 'UnknownPerson') warnings.push('Person could not be confidently detected.');

  const confidenceBase =
    trimmedText.length > 100 && !/^[|\s\-:]+$/.test(normalizedText.slice(0, 40)) ? 0.72 : 0.55;
  const confidencePenalty = warnings.length * 0.14;
  const confidence = Math.max(0.2, Math.min(0.95, confidenceBase - confidencePenalty));
  const actionRequired =
    status === 'offen' ? 'Review and triage' : status === 'eingereicht' ? 'Await response' : 'Archive or verify';

  return {
    documentDateYYMMDD: resolveDocumentDateYYMMDD(preview, options.sourcePath),
    organization,
    action,
    person,
    status,
    documentType,
    actionRequired,
    summary: normalizedText.slice(0, 320) || 'No text extracted.',
    confidence,
    warnings,
  };
}
