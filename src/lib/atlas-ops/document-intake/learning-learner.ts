import { SqliteDocumentIndex } from '@/lib/atlas-ops/document-intake/index-sqlite';
import type { AcceptedClassification, CandidateRuleRecord, LearningRuleType } from '@/lib/atlas-ops/document-intake/types';

type AcceptedRow = {
  predicted: AcceptedClassification;
  accepted: AcceptedClassification;
  acceptedAtIso: string;
};

interface RuleAggregate {
  supportCount: number;
  firstSeenAtIso: string;
  lastSeenAtIso: string;
}

function parseClassification(payload: string): AcceptedClassification | null {
  try {
    const parsed = JSON.parse(payload) as Partial<AcceptedClassification>;
    if (
      typeof parsed.documentDateYYMMDD !== 'string' ||
      typeof parsed.organization !== 'string' ||
      typeof parsed.action !== 'string' ||
      typeof parsed.person !== 'string' ||
      typeof parsed.status !== 'string'
    ) {
      return null;
    }
    return {
      documentDateYYMMDD: parsed.documentDateYYMMDD,
      organization: parsed.organization,
      action: parsed.action,
      person: parsed.person,
      status: parsed.status,
    };
  } catch {
    return null;
  }
}

function pushAggregate(
  map: Map<string, RuleAggregate>,
  key: string,
  acceptedAtIso: string
): void {
  const existing = map.get(key);
  if (!existing) {
    map.set(key, {
      supportCount: 1,
      firstSeenAtIso: acceptedAtIso,
      lastSeenAtIso: acceptedAtIso,
    });
    return;
  }

  existing.supportCount += 1;
  if (acceptedAtIso < existing.firstSeenAtIso) existing.firstSeenAtIso = acceptedAtIso;
  if (acceptedAtIso > existing.lastSeenAtIso) existing.lastSeenAtIso = acceptedAtIso;
}

function ruleKey(ruleType: LearningRuleType, sourceValue: string, targetValue: string): string {
  return `${ruleType}|||${sourceValue}|||${targetValue}`;
}

function sourceKey(ruleType: LearningRuleType, sourceValue: string): string {
  return `${ruleType}|||${sourceValue}`;
}

function decodeRuleKey(key: string): { ruleType: LearningRuleType; sourceValue: string; targetValue: string } {
  const [ruleTypeRaw, sourceValue, targetValue] = key.split('|||');
  return {
    ruleType: ruleTypeRaw as LearningRuleType,
    sourceValue,
    targetValue,
  };
}

function collectRows(index: SqliteDocumentIndex): AcceptedRow[] {
  const rows = index.listAcceptedOutcomeRows();
  const result: AcceptedRow[] = [];
  for (const row of rows) {
    const predicted = parseClassification(row.predicted_json);
    const accepted = parseClassification(row.accepted_json);
    if (!predicted || !accepted) continue;
    result.push({ predicted, accepted, acceptedAtIso: row.accepted_at });
  }
  return result;
}

export function generateCandidateRulesFromAcceptedOutcomes(index: SqliteDocumentIndex): {
  candidateCount: number;
  updatedCount: number;
} {
  const rows = collectRows(index);
  const aggregates = new Map<string, RuleAggregate>();
  const sourceTotals = new Map<string, number>();

  for (const row of rows) {
    const pairs: Array<{
      ruleType: LearningRuleType;
      predictedValue: string;
      acceptedValue: string;
    }> = [
      {
        ruleType: 'organization_alias',
        predictedValue: row.predicted.organization,
        acceptedValue: row.accepted.organization,
      },
      {
        ruleType: 'person_alias',
        predictedValue: row.predicted.person,
        acceptedValue: row.accepted.person,
      },
      {
        ruleType: 'action_synonym',
        predictedValue: row.predicted.action,
        acceptedValue: row.accepted.action,
      },
      {
        ruleType: 'status_synonym',
        predictedValue: row.predicted.status,
        acceptedValue: row.accepted.status,
      },
      {
        ruleType: 'date_correction',
        predictedValue: row.predicted.documentDateYYMMDD,
        acceptedValue: row.accepted.documentDateYYMMDD,
      },
    ];

    for (const pair of pairs) {
      const source = pair.predictedValue.trim();
      const target = pair.acceptedValue.trim();
      if (!source || !target) continue;

      const sourceBucket = sourceKey(pair.ruleType, source);
      sourceTotals.set(sourceBucket, (sourceTotals.get(sourceBucket) ?? 0) + 1);

      if (source === target) continue;

      const key = ruleKey(pair.ruleType, source, target);
      pushAggregate(aggregates, key, row.acceptedAtIso);
    }
  }

  let updatedCount = 0;
  for (const [key, aggregate] of aggregates) {
    const { ruleType, sourceValue, targetValue } = decodeRuleKey(key);
    const totalForSource = sourceTotals.get(sourceKey(ruleType, sourceValue)) ?? 1;
    const precisionScore = aggregate.supportCount / totalForSource;

    const candidate: CandidateRuleRecord = {
      ruleType,
      sourceValue,
      targetValue,
      supportCount: aggregate.supportCount,
      precisionScore,
      status: 'candidate',
      firstSeenAtIso: aggregate.firstSeenAtIso,
      lastSeenAtIso: aggregate.lastSeenAtIso,
    };
    index.upsertCandidateRule(candidate);
    updatedCount += 1;
  }

  return {
    candidateCount: aggregates.size,
    updatedCount,
  };
}
