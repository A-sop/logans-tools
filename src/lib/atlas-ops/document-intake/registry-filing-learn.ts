import * as path from 'path';
import type { ResolvedFiling } from '@/lib/atlas-ops/document-intake/review-filing';
import type { DocumentRegistryIndex, FilingRuleStatus, RegistryFilingRuleRow } from '@/lib/atlas-ops/document-intake/registry-sqlite';

export type FilingRuleKind = 'filename_exact' | 'org_role' | 'tax_anbieter';

export interface FilingMetadata {
  docRole: string;
  namingTrack: string;
  organization: string;
  anbieter: string | null;
}

export interface AppliedFilingRule {
  basename: string;
  relativePath: string;
  fromRule: boolean;
  ruleKind: FilingRuleKind | null;
  ruleLabel: string | null;
  ruleStatus: FilingRuleStatus | null;
}

const UNKNOWN_ORG = new Set(['unknownorg', 'unknown', '']);
const WEAK_ANBIETER = new Set(['unknown', 'ohne-nr', '']);

export function parseFilingMetadata(
  classificationJson: string,
  docRole: string,
  namingTrack: string
): FilingMetadata {
  let organization = 'UnknownOrg';
  let anbieter: string | null = null;

  try {
    const parsed = JSON.parse(classificationJson) as {
      organization?: string;
      enrichment?: { anbieter?: string };
    };
    if (typeof parsed.organization === 'string') {
      organization = parsed.organization;
    }
    if (typeof parsed.enrichment?.anbieter === 'string' && parsed.enrichment.anbieter.trim()) {
      anbieter = parsed.enrichment.anbieter.trim();
    }
  } catch {
    // keep defaults
  }

  return {
    docRole: docRole.trim() || 'unknown',
    namingTrack: namingTrack.trim() || 'intake',
    organization,
    anbieter,
  };
}

function normalizeToken(value: string): string {
  return value.trim().toLowerCase();
}

function isStrongOrganization(organization: string): boolean {
  return !UNKNOWN_ORG.has(normalizeToken(organization));
}

function isStrongAnbieter(anbieter: string | null): boolean {
  if (!anbieter) return false;
  return !WEAK_ANBIETER.has(normalizeToken(anbieter));
}

/** Folder under DATA (no trailing filename) for metadata rules. */
export function folderFromRelativePath(relativePath: string): string {
  const normalized = relativePath.replace(/\//g, '\\').trim();
  const dir = path.dirname(normalized);
  if (!dir || dir === '.') return normalized;
  return dir;
}

export function recordFilingLearning(
  index: DocumentRegistryIndex,
  input: {
    sourcePath: string;
    currentFilename: string;
    approved: string;
    reviewNotes: string;
    resolved: ResolvedFiling;
    metadata: FilingMetadata;
  }
): void {
  if (input.approved !== 'Y') return;
  upsertFilingRulesFromResolution(index, input, 'confirmed');
}

/** Persist draft filing hints when Logan riff-saves notes without Y (learn-on-noted). */
export function recordNotedIntentLearning(
  index: DocumentRegistryIndex,
  input: {
    sourcePath: string;
    currentFilename: string;
    approved: string;
    reviewNotes: string;
    resolved: ResolvedFiling;
    metadata: FilingMetadata;
  }
): void {
  if (input.approved !== 'pending' && input.approved !== '') return;
  if (!input.reviewNotes.trim()) return;
  if (!input.resolved.usedOverride) return;
  upsertFilingRulesFromResolution(index, input, 'draft');
}

function upsertFilingRulesFromResolution(
  index: DocumentRegistryIndex,
  input: {
    sourcePath: string;
    currentFilename: string;
    reviewNotes: string;
    resolved: ResolvedFiling;
    metadata: FilingMetadata;
  },
  ruleStatus: FilingRuleStatus
): void {
  const folder = folderFromRelativePath(input.resolved.relativePath);
  const baseRule = {
    keepFilename: input.resolved.keepFilename ? 1 : 0,
    targetBasename: input.resolved.keepFilename ? '' : input.resolved.basename,
    targetRelativePath: folder,
    exampleSourcePath: input.sourcePath,
    lastNotes: input.reviewNotes,
    ruleStatus,
  };

  index.upsertFilingRule({
    ruleKind: 'filename_exact',
    matchValue: input.currentFilename.toLowerCase(),
    keepFilename: input.resolved.keepFilename ? 1 : 0,
    targetBasename: input.resolved.basename,
    targetRelativePath: input.resolved.relativePath,
    exampleSourcePath: input.sourcePath,
    lastNotes: input.reviewNotes,
    ruleStatus,
  });

  if (isStrongAnbieter(input.metadata.anbieter) && input.metadata.namingTrack === 'tax_beleg') {
    index.upsertFilingRule({
      ...baseRule,
      ruleKind: 'tax_anbieter',
      matchValue: normalizeToken(input.metadata.anbieter!),
    });
  }

  if (isStrongOrganization(input.metadata.organization)) {
    index.upsertFilingRule({
      ...baseRule,
      ruleKind: 'org_role',
      matchValue: `${normalizeToken(input.metadata.docRole)}|${normalizeToken(input.metadata.organization)}`,
    });
  }
}

function applyFilingRule(
  rule: RegistryFilingRuleRow,
  filename: string,
  proposedBasename: string,
  proposedRelativePath: string
): AppliedFilingRule {
  if (rule.rule_kind === 'filename_exact') {
    const basename = rule.keep_filename ? filename : rule.target_basename || proposedBasename;
    const relativePath = rule.target_relative_path || proposedRelativePath;
    return {
      basename,
      relativePath: relativePath.replace(/\//g, '\\'),
      fromRule: true,
      ruleKind: 'filename_exact',
      ruleLabel: ruleLabelForKind('filename_exact', filename, rule.rule_status),
      ruleStatus: rule.rule_status,
    };
  }

  const folder = rule.target_relative_path || folderFromRelativePath(proposedRelativePath);
  const basename = rule.keep_filename ? filename : rule.target_basename || proposedBasename;
  const relativePath = path.join(folder, basename).replace(/\//g, '\\');

  return {
    basename,
    relativePath,
    fromRule: true,
    ruleKind: rule.rule_kind as FilingRuleKind,
    ruleLabel: ruleLabelForKind(rule.rule_kind as FilingRuleKind, rule.match_value, rule.rule_status),
    ruleStatus: rule.rule_status,
  };
}

function ruleLabelForKind(kind: FilingRuleKind, matchValue: string, status: FilingRuleStatus): string {
  const prefix = status === 'draft' ? 'draft · ' : '';
  switch (kind) {
    case 'tax_anbieter':
      return `${prefix}vendor: ${matchValue}`;
    case 'org_role': {
      const [role, org] = matchValue.split('|');
      return `${prefix}${org ?? matchValue} (${role ?? 'role'})`;
    }
    default:
      return `${prefix}${matchValue}`;
  }
}

export function findBestFilingRule(
  index: DocumentRegistryIndex,
  filename: string,
  metadata: FilingMetadata
): RegistryFilingRuleRow | null {
  const exact = index.findFilingRule('filename_exact', filename.toLowerCase());
  if (exact) return exact;

  if (metadata.namingTrack === 'tax_beleg' && isStrongAnbieter(metadata.anbieter)) {
    const byVendor = index.findFilingRule('tax_anbieter', normalizeToken(metadata.anbieter!));
    if (byVendor) return byVendor;
  }

  if (isStrongOrganization(metadata.organization)) {
    const byOrgRole = index.findFilingRule(
      'org_role',
      `${normalizeToken(metadata.docRole)}|${normalizeToken(metadata.organization)}`
    );
    if (byOrgRole) return byOrgRole;
  }

  return null;
}

export function applyLearnedFilingToProposal(
  index: DocumentRegistryIndex,
  sourcePath: string,
  proposedBasename: string,
  proposedRelativePath: string,
  metadata: FilingMetadata
): AppliedFilingRule {
  const filename = path.basename(sourcePath);
  const rule = findBestFilingRule(index, filename, metadata);
  if (!rule) {
    return {
      basename: proposedBasename,
      relativePath: proposedRelativePath,
      fromRule: false,
      ruleKind: null,
      ruleLabel: null,
      ruleStatus: null,
    };
  }

  return applyFilingRule(rule, filename, proposedBasename, proposedRelativePath);
}
