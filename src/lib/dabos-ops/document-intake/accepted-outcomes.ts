import { learningModelVersion } from '@/lib/dabos-ops/document-intake/config';
import { SqliteDocumentIndex } from '@/lib/dabos-ops/document-intake/index-sqlite';
import type { AcceptedClassification } from '@/lib/dabos-ops/document-intake/types';

export interface AcceptedClassificationOverrides {
  documentDateYYMMDD?: string;
  organization?: string;
  action?: string;
  person?: string;
  status?: string;
}

function parsePredictedClassification(classificationJson: string): AcceptedClassification {
  const parsed = JSON.parse(classificationJson) as Partial<AcceptedClassification>;
  return {
    documentDateYYMMDD:
      typeof parsed.documentDateYYMMDD === 'string' ? parsed.documentDateYYMMDD : '000000',
    organization: typeof parsed.organization === 'string' ? parsed.organization : 'UnknownOrg',
    action: typeof parsed.action === 'string' ? parsed.action : 'GeneralReview',
    person: typeof parsed.person === 'string' ? parsed.person : 'UnknownPerson',
    status: typeof parsed.status === 'string' ? parsed.status : 'offen',
  };
}

function buildAcceptedClassification(
  predicted: AcceptedClassification,
  overrides: AcceptedClassificationOverrides
): AcceptedClassification {
  return {
    documentDateYYMMDD: overrides.documentDateYYMMDD ?? predicted.documentDateYYMMDD,
    organization: overrides.organization ?? predicted.organization,
    action: overrides.action ?? predicted.action,
    person: overrides.person ?? predicted.person,
    status: overrides.status ?? predicted.status,
  };
}

function buildDelta(predicted: AcceptedClassification, accepted: AcceptedClassification): Record<string, boolean> {
  return {
    documentDateYYMMDDChanged: predicted.documentDateYYMMDD !== accepted.documentDateYYMMDD,
    organizationChanged: predicted.organization !== accepted.organization,
    actionChanged: predicted.action !== accepted.action,
    personChanged: predicted.person !== accepted.person,
    statusChanged: predicted.status !== accepted.status,
  };
}

export function recordAcceptedOutcomeByProcessedFile(
  index: SqliteDocumentIndex,
  processedFileName: string,
  overrides: AcceptedClassificationOverrides,
  acceptanceSource: string
): {
  documentId: number;
  accepted: AcceptedClassification;
  predicted: AcceptedClassification;
  delta: Record<string, boolean>;
} {
  const document = index.getDocumentByProcessedFileName(processedFileName);
  if (!document) {
    throw new Error(`Document not found for processed filename: ${processedFileName}`);
  }

  const predicted = parsePredictedClassification(document.classification_json);
  const accepted = buildAcceptedClassification(predicted, overrides);
  const delta = buildDelta(predicted, accepted);
  const ruleVersion = index.getCurrentRuleVersion();

  index.upsertAcceptedOutcome({
    documentId: document.id,
    fileHash: document.file_hash,
    acceptanceSource,
    acceptedAtIso: new Date().toISOString(),
    modelVersion: learningModelVersion(),
    ruleVersion,
    predictedJson: JSON.stringify(predicted),
    acceptedJson: JSON.stringify(accepted),
    deltaJson: JSON.stringify(delta),
  });

  return {
    documentId: document.id,
    accepted,
    predicted,
    delta,
  };
}
