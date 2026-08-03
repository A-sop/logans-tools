export type DocumentKind = 'pdf' | 'image' | 'unsupported';

export type ProcessingState =
  | 'queued'
  | 'processing'
  | 'review_required'
  | 'done'
  | 'failed'
  | 'metadata_only';

export type NamingTrack = 'intake' | 'human' | 'tax_beleg';

export type DocRole =
  | 'compliance'
  | 'tax_evidence'
  | 'insurance'
  | 'contract'
  | 'invoice'
  | 'reference'
  | 'media'
  | 'project_active'
  | 'discard_candidate'
  | 'unknown';

export type ProposedBucket = '10_WORK' | '20_ADMIN' | '30_PROJECTS' | '40_MEDIA' | '90_ARCHIVE';

export interface IntelligenceEnrichment {
  docRole: DocRole;
  proposedBucket: ProposedBucket;
  proposedRelativePath: string;
  namingTrack: NamingTrack;
  proposedBasename: string;
  displayTitle: string;
  namingConfidence: number;
  taxHat?: 'GW' | 'PR';
  euerZeile?: string;
  euerKurzbezeichnungDe?: string;
  anbieter?: string;
  rechnungsnummer?: string;
}

export interface RegistryClassification extends ClassificationResult {
  enrichment: IntelligenceEnrichment;
}

export interface FileRoutingResult {
  kind: DocumentKind;
  mimeType: string;
  extension: string;
  detectedByMagicBytes: boolean;
  detectedByMimeLookup: boolean;
  detectedByExtension: boolean;
  isSupported: boolean;
}

/**
 * Quality of extracted text, used as a delete-safety gate.
 * - `clean`: trustworthy; downstream may treat the original as redundant.
 * - `low`: sparse but real (e.g. numeric-heavy invoices); usable, not delete-safe on its own.
 * - `garbage`: empty or CID-corruption soup; never trust, never eligible to delete original.
 */
export type TextQuality = 'clean' | 'low' | 'garbage';

export interface ExtractionResult {
  extractedText: string;
  warnings: string[];
  pageCount?: number;
  /** Quality of the finally-chosen text (embedded or OCR). */
  textQuality?: TextQuality;
  /** True when OCR output was chosen over the embedded PDF text layer. */
  ocrUsed?: boolean;
}

export interface ClassificationResult {
  documentDateYYMMDD: string;
  organization: string;
  action: string;
  person: string;
  status: string;
  documentType: string;
  actionRequired: string;
  summary: string;
  confidence: number;
  warnings: string[];
}

export type LearningRuleType =
  | 'organization_alias'
  | 'person_alias'
  | 'action_synonym'
  | 'status_synonym'
  | 'date_correction';

export interface AcceptedClassification {
  documentDateYYMMDD: string;
  organization: string;
  action: string;
  person: string;
  status: string;
}

export interface AcceptedOutcomeRecord {
  documentId: number;
  fileHash: string;
  acceptanceSource: string;
  acceptedAtIso: string;
  modelVersion: string;
  ruleVersion: number;
  predictedJson: string;
  acceptedJson: string;
  deltaJson: string;
}

export interface CandidateRuleRecord {
  ruleType: LearningRuleType;
  sourceValue: string;
  targetValue: string;
  supportCount: number;
  precisionScore: number;
  status: 'candidate' | 'promoted' | 'rejected';
  firstSeenAtIso: string;
  lastSeenAtIso: string;
}

export interface LearningThresholds {
  minSupportCount: number;
  minPrecisionScore: number;
}

export interface NamingResult {
  baseName: string;
  finalFileName: string;
  markdownFileName: string;
}

export interface PipelinePaths {
  root: string;
  inbox: string;
  processed: string;
  markdown: string;
  failed: string;
  indexDir: string;
  sqliteDbPath: string;
}

export interface ProcessedDocumentRecord {
  sourceFileName: string;
  sourcePath: string;
  processedFileName: string;
  processedPath: string;
  markdownPath: string;
  fileHash: string;
  mimeType: string;
  detectedType: DocumentKind;
  lifecycleStatus: ProcessingState;
  classificationJson: string;
  confidence: number;
  warningsJson: string;
  errorMessage: string | null;
  processedAtIso: string;
}

export interface ProcessSingleFileResult {
  state: ProcessingState;
  sourcePath: string;
  processedPath?: string;
  markdownPath?: string;
  warningCount: number;
  error?: string;
}

export interface ProcessInboxResult {
  scannedCount: number;
  processedCount: number;
  reviewRequiredCount: number;
  failedCount: number;
  skippedCount: number;
  learning?: {
    candidateCount: number;
    updatedCount: number;
    promotedCount: number;
    rejectedCount: number;
    promotedRuleVersion: number;
  };
}

export interface ProcessOptions {
  forceReprocess?: boolean;
}
