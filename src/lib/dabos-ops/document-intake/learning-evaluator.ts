import type { LearningRuleType, LearningThresholds } from '@/lib/dabos-ops/document-intake/types';
import { SqliteDocumentIndex } from '@/lib/dabos-ops/document-intake/index-sqlite';

interface RuleThreshold {
  minSupportCount: number;
  minPrecisionScore: number;
}

const RULE_RISK_THRESHOLDS: Record<LearningRuleType, RuleThreshold> = {
  organization_alias: { minSupportCount: 3, minPrecisionScore: 0.85 },
  action_synonym: { minSupportCount: 3, minPrecisionScore: 0.85 },
  status_synonym: { minSupportCount: 3, minPrecisionScore: 0.9 },
  date_correction: { minSupportCount: 4, minPrecisionScore: 0.9 },
  person_alias: { minSupportCount: 5, minPrecisionScore: 0.95 },
};

function meetsRuleThreshold(
  ruleType: LearningRuleType,
  supportCount: number,
  precisionScore: number,
  defaults: LearningThresholds
): boolean {
  const perType = RULE_RISK_THRESHOLDS[ruleType];
  const minSupportCount = Math.max(defaults.minSupportCount, perType.minSupportCount);
  const minPrecisionScore = Math.max(defaults.minPrecisionScore, perType.minPrecisionScore);
  return supportCount >= minSupportCount && precisionScore >= minPrecisionScore;
}

export function runThresholdPromotion(
  index: SqliteDocumentIndex,
  thresholds: LearningThresholds,
  autoPromoteEnabled: boolean
): {
  runId: number;
  promotedCount: number;
  rejectedCount: number;
  candidateCount: number;
  promotedRuleVersion: number;
} {
  const candidates = index.listCandidateRules('candidate');
  const runId = index.beginPromotionRun(candidates.length);

  try {
    const promoteIds: number[] = [];
    const rejectIds: number[] = [];

    for (const candidate of candidates) {
      const passes = meetsRuleThreshold(
        candidate.rule_type,
        candidate.support_count,
        candidate.precision_score,
        thresholds
      );
      if (passes) promoteIds.push(candidate.id);
      else if (candidate.support_count >= thresholds.minSupportCount) rejectIds.push(candidate.id);
    }

    let promotedRuleVersion = index.getCurrentRuleVersion();
    if (autoPromoteEnabled && promoteIds.length > 0) {
      promotedRuleVersion += 1;
      index.promoteCandidateRules(promoteIds, promotedRuleVersion);
    }

    if (rejectIds.length > 0) {
      index.markCandidateRulesRejected(rejectIds);
    }

    const metrics = {
      thresholds,
      autoPromoteEnabled,
      promotedIds: promoteIds,
      rejectedIds: rejectIds,
      promotedRuleVersion,
    };

    index.finishPromotionRun(
      runId,
      autoPromoteEnabled ? promoteIds.length : 0,
      'succeeded',
      JSON.stringify(metrics),
      null
    );

    return {
      runId,
      promotedCount: autoPromoteEnabled ? promoteIds.length : 0,
      rejectedCount: rejectIds.length,
      candidateCount: candidates.length,
      promotedRuleVersion,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown promotion error';
    index.finishPromotionRun(runId, 0, 'failed', '{}', message);
    throw error;
  }
}
