import * as path from 'path';
import { parseFilenameDateYYMMDD } from '@/lib/dabos-ops/document-intake/filename-heuristics';
import { buildDocumentNaming } from '@/lib/dabos-ops/document-intake/naming';
import { detectPartnerCode, type PartnerCodeAlias } from '@/lib/dabos-ops/document-intake/partner-code-aliases';
import { buildTaxBelegNaming, proposedTaxRelativePath } from '@/lib/dabos-ops/document-intake/tax-naming';
import type {
  ClassificationResult,
  DocRole,
  IntelligenceEnrichment,
  NamingTrack,
  ProposedBucket,
  RegistryClassification,
} from '@/lib/dabos-ops/document-intake/types';

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic', '.mp4', '.mov', '.avi', '.mkv']);
const MEDIA_EXT = new Set(['.mp3', '.wav', '.m4a']);

function inferDocRole(text: string, fileName: string): DocRole {
  const haystack = `${fileName}\n${text}`.slice(0, 3000);
  if (/\b(rechnung|invoice|beleg|quittung|kontoauszug|steuer|finanzamt|eÃ¼r|ust)\b/i.test(haystack)) {
    return 'tax_evidence';
  }
  if (/\b(versicherung|versicherungen|berufsunf|bu-leistung|police|policy|gedl|gedv|gedk)\b/i.test(haystack)) {
    return 'insurance';
  }
  if (/\b(vertrag|contract|agreement)\b/i.test(haystack)) return 'contract';
  if (/\b(rechnung|invoice)\b/i.test(haystack)) return 'invoice';
  if (/\b(passport|ausweis|id|steuer.?id|compliance)\b/i.test(haystack)) return 'compliance';
  const ext = path.extname(fileName).toLowerCase();
  if (IMAGE_EXT.has(ext) || MEDIA_EXT.has(ext)) return 'media';
  if (/\b(project|projekt|hackathon|course|kurs)\b/i.test(haystack)) return 'project_active';
  if (/\b(scan\d+|img_|dsc_|screenshot)\b/i.test(fileName)) return 'unknown';
  return 'reference';
}

function inferBucket(docRole: DocRole, fileName: string): ProposedBucket {
  const ext = path.extname(fileName).toLowerCase();
  if (docRole === 'tax_evidence' || docRole === 'compliance' || docRole === 'insurance' || docRole === 'contract') {
    return '20_ADMIN';
  }
  if (docRole === 'media' || IMAGE_EXT.has(ext) || MEDIA_EXT.has(ext)) return '40_MEDIA';
  if (docRole === 'project_active') return '30_PROJECTS';
  if (docRole === 'discard_candidate') return '90_ARCHIVE';
  return '20_ADMIN';
}

function sanitizeToken(value: string): string {
  return value
    .replace(/Ã¤/g, 'ae').replace(/Ã¶/g, 'oe').replace(/Ã¼/g, 'ue')
    .replace(/Ã„/g, 'Ae').replace(/Ã–/g, 'Oe').replace(/Ãœ/g, 'Ue').replace(/ÃŸ/g, 'ss')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^A-Za-z0-9_-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^[-_]+|[-_]+$/g, '');
}

/**
 * Human-readable proposal for a document whose partner code was recognised.
 * Encodes doc type + code (traceable token) + person + status; keeps the code so
 * derived/client versions stay linkable to the source form. PROPOSAL ONLY â€” the
 * review gate applies it; nothing is auto-renamed.
 */
function buildPartnerCodeNaming(
  classification: ClassificationResult,
  alias: PartnerCodeAlias,
  sourcePath: string
): { basename: string; displayTitle: string } {
  const ext = path.extname(sourcePath).toLowerCase() || '.pdf';
  const date = sanitizeToken(classification.documentDateYYMMDD) || '000000';
  const issuer = sanitizeToken(alias.issuer).toUpperCase() || 'UNKNOWNORG';
  const docType = sanitizeToken(alias.docType) || 'Dokument';
  const code = sanitizeToken(alias.code).toUpperCase();
  const person =
    classification.person && classification.person !== 'UnknownPerson'
      ? sanitizeToken(classification.person)
      : 'UnknownPerson';
  const status = sanitizeToken(classification.status).toLowerCase() || 'offen';
  const typeToken = code ? `${docType}-${code}` : docType;
  const basename = `${date}_${issuer}_${typeToken}_${person}_${status}${ext}`;
  const displayTitle = `${alias.issuerLegalName} â€” ${alias.docType} (${alias.code})`.slice(0, 120);
  return { basename, displayTitle };
}

function buildDisplayTitle(classification: ClassificationResult, docRole: DocRole): string {
  const parts = [
    classification.organization !== 'UnknownOrg' ? classification.organization : null,
    classification.documentType !== 'GeneralDocument' ? classification.documentType : null,
    docRole !== 'unknown' ? docRole.replace(/_/g, ' ') : null,
  ].filter(Boolean);
  if (parts.length === 0) return classification.summary.slice(0, 80) || 'Unclassified document';
  return parts.join(' â€” ').slice(0, 120);
}

export function enrichClassification(
  classification: ClassificationResult,
  sourcePath: string,
  extractedText: string
): RegistryClassification {
  const fileName = path.basename(sourcePath);
  const docRole = inferDocRole(extractedText, fileName);
  const proposedBucket = inferBucket(docRole, fileName);
  const warnings = [...classification.warnings];

  const partnerAlias = detectPartnerCode(fileName, extractedText);
  let displayTitle = buildDisplayTitle(classification, docRole);

  let namingTrack: NamingTrack = 'intake';
  let proposedBasename: string;
  let namingConfidence = classification.confidence;
  let taxFields: Partial<IntelligenceEnrichment> = {};

  if (partnerAlias) {
    // Recognised partner document code â†’ propose a human-readable name carrying the
    // partner doc type. Proposal only; the review gate applies it.
    namingTrack = 'intake';
    const partnerNaming = buildPartnerCodeNaming(classification, partnerAlias, sourcePath);
    proposedBasename = partnerNaming.basename;
    displayTitle = partnerNaming.displayTitle;
    namingConfidence = Math.max(classification.confidence, 0.7);
    warnings.push(
      `Recognised partner code ${partnerAlias.code} â†’ ${partnerAlias.issuer} / ${partnerAlias.docType}.`
    );
  } else if (docRole === 'tax_evidence') {
    namingTrack = 'tax_beleg';
    const tax = buildTaxBelegNaming(classification, sourcePath, extractedText);
    proposedBasename = tax.basename;
    namingConfidence = Math.min(classification.confidence, tax.enrichment.namingConfidence ?? 0.5);
    taxFields = tax.enrichment;
    warnings.push(...tax.warnings);
  } else if (classification.confidence < 0.65 || classification.organization === 'UnknownOrg') {
    namingTrack = 'human';
    proposedBasename = fileName;
    namingConfidence = Math.max(0.25, classification.confidence * 0.8);
    warnings.push('Keeping current filename â€” not confident enough to propose a rename.');
  } else {
    const intake = buildDocumentNaming(classification, sourcePath);
    proposedBasename = intake.finalFileName;
    namingConfidence = classification.confidence;
  }

  let proposedRelativePath: string;
  if (namingTrack === 'tax_beleg') {
    proposedRelativePath = proposedTaxRelativePath(proposedBasename, classification.documentDateYYMMDD);
  } else {
    proposedRelativePath = path.join(proposedBucket, proposedBasename).replace(/\//g, '\\');
  }

  const enrichment: IntelligenceEnrichment = {
    docRole,
    proposedBucket,
    proposedRelativePath,
    namingTrack,
    proposedBasename,
    displayTitle,
    namingConfidence,
    ...taxFields,
  };

  return {
    ...classification,
    enrichment,
    warnings,
    confidence: Math.min(classification.confidence, namingConfidence),
  };
}

export function metadataOnlyClassification(sourcePath: string): RegistryClassification {
  const fileName = path.basename(sourcePath);
  const base = fileName.replace(path.extname(fileName), '');
  const docRole = inferDocRole('', fileName);
  const proposedBucket = inferBucket(docRole, fileName);
  const ext = path.extname(fileName).toLowerCase() || '.bin';
  const documentDateYYMMDD =
    parseFilenameDateYYMMDD(fileName) ??
    (() => {
      const dateMatch = base.match(/\b(\d{2})(\d{2})(\d{2})\b/);
      if (dateMatch) return `${dateMatch[1]}${dateMatch[2]}${dateMatch[3]}`;
        const now = new Date();
        const yy = String(now.getFullYear()).slice(-2);
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        return `${yy}${mm}${dd}`;
      })();

  const classification: ClassificationResult = {
    documentDateYYMMDD,
    organization: 'UnknownOrg',
    action: 'GeneralReview',
    person: 'UnknownPerson',
    status: 'offen',
    documentType: 'UnsupportedType',
    actionRequired: 'Review and triage',
    summary: `Metadata-only (${ext}); no content extraction.`,
    confidence: 0.35,
    warnings: ['Unsupported extension for OCR pipeline.'],
  };

  const enrichment: IntelligenceEnrichment = {
    docRole,
    proposedBucket,
    proposedRelativePath: path.join(proposedBucket, fileName).replace(/\//g, '\\'),
    namingTrack: 'human',
    proposedBasename: fileName,
    displayTitle: base.slice(0, 80) || fileName,
    namingConfidence: 0.3,
  };

  return { ...classification, enrichment, warnings: classification.warnings };
}
