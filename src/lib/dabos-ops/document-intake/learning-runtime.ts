import type { ClassificationResult } from '@/lib/dabos-ops/document-intake/types';
import { SqliteDocumentIndex } from '@/lib/dabos-ops/document-intake/index-sqlite';

function cleanValue(value: string): string {
  return value.trim();
}

export function applyLearnedRulesToClassification(
  index: SqliteDocumentIndex,
  classification: ClassificationResult,
  versionOverride: number | null
): { classification: ClassificationResult; appliedRules: string[]; ruleVersion: number } {
  const activeRules = index.getActivePromotedRules(versionOverride);
  if (activeRules.length === 0) {
    return {
      classification,
      appliedRules: [],
      ruleVersion: versionOverride ?? index.getCurrentRuleVersion(),
    };
  }

  const byTypeAndSource = new Map<string, string>();
  for (const rule of activeRules) {
    const key = `${rule.rule_type}|||${cleanValue(rule.source_value)}`;
    if (!byTypeAndSource.has(key)) {
      byTypeAndSource.set(key, cleanValue(rule.target_value));
    }
  }

  const appliedRules: string[] = [];
  let organization = classification.organization;
  let person = classification.person;
  let action = classification.action;
  let status = classification.status;
  let documentDateYYMMDD = classification.documentDateYYMMDD;

  const orgTarget = byTypeAndSource.get(`organization_alias|||${cleanValue(organization)}`);
  if (orgTarget) {
    organization = orgTarget;
    appliedRules.push('organization_alias');
  }

  const personTarget = byTypeAndSource.get(`person_alias|||${cleanValue(person)}`);
  if (personTarget) {
    person = personTarget;
    appliedRules.push('person_alias');
  }

  const actionTarget = byTypeAndSource.get(`action_synonym|||${cleanValue(action)}`);
  if (actionTarget) {
    action = actionTarget;
    appliedRules.push('action_synonym');
  }

  const statusTarget = byTypeAndSource.get(`status_synonym|||${cleanValue(status)}`);
  if (statusTarget) {
    status = statusTarget;
    appliedRules.push('status_synonym');
  }

  const dateTarget = byTypeAndSource.get(`date_correction|||${cleanValue(documentDateYYMMDD)}`);
  if (dateTarget) {
    documentDateYYMMDD = dateTarget;
    appliedRules.push('date_correction');
  }

  const latestVersion = activeRules.reduce((max, rule) => Math.max(max, rule.version), 0);

  return {
    classification: {
      ...classification,
      organization,
      person,
      action,
      status,
      documentDateYYMMDD,
      warnings:
        appliedRules.length > 0
          ? [...classification.warnings, `Applied learned rules: ${appliedRules.join(', ')}`]
          : classification.warnings,
    },
    appliedRules,
    ruleVersion: versionOverride ?? latestVersion,
  };
}
