#!/usr/bin/env npx tsx
import * as fs from 'fs/promises';
import * as path from 'path';
import { getPipelinePaths } from '@/lib/dabos-ops/document-intake/config';
import { SqliteDocumentIndex } from '@/lib/dabos-ops/document-intake/index-sqlite';
import {
  loadPartnerCodeAliasMap,
  partnerCodeAliasDocPath,
} from '@/lib/dabos-ops/document-intake/partner-code-aliases';
import type { CandidateRuleRecord, LearningRuleType } from '@/lib/dabos-ops/document-intake/types';

type SeedKind = 'org' | 'person' | 'action' | 'status' | 'date';

const DEFAULT_SEED_DOC_PATH = path.resolve(
  process.cwd(),
  'src/docs/document-intake/naming-cheatsheet.md'
);

const RULE_TYPE_BY_SEED_KIND: Record<SeedKind, LearningRuleType> = {
  org: 'organization_alias',
  person: 'person_alias',
  action: 'action_synonym',
  status: 'status_synonym',
  date: 'date_correction',
};

function normalizeLine(line: string): string {
  return line
    .trim()
    .replace(/^-\s*/, '')
    .replace(/^-+\s*/, '')
    .replace(/^`|`$/g, '')
    .trim();
}

function parseSeedLine(line: string): { kind: SeedKind; source: string; target: string } | null {
  if (!line.includes('=>')) return null;
  const cleaned = normalizeLine(line);
  if (!cleaned.includes('=>')) return null;

  const [leftRaw, rightRaw] = cleaned.split('=>', 2);
  const left = leftRaw?.trim() ?? '';
  const target = rightRaw?.trim() ?? '';
  if (!left || !target) return null;

  let kind: SeedKind = 'org';
  let source = left;

  if (left.includes('|')) {
    const [prefixRaw, sourceRaw] = left.split('|', 2);
    const prefix = prefixRaw?.trim().toLowerCase() ?? '';
    if (
      prefix === 'org' ||
      prefix === 'person' ||
      prefix === 'action' ||
      prefix === 'status' ||
      prefix === 'date'
    ) {
      kind = prefix;
      source = sourceRaw?.trim() ?? '';
    }
  }

  if (!source) return null;
  return { kind, source, target };
}

function extractSeedLines(content: string): string[] {
  const lines = content.split(/\r?\n/);
  const startHeading = '## Human Alias Seed (Learning Input)';
  let inSection = false;
  const sectionLines: string[] = [];

  for (const line of lines) {
    if (line.trim() === startHeading) {
      inSection = true;
      continue;
    }
    if (inSection && line.startsWith('## ')) break;
    if (!inSection) continue;
    sectionLines.push(line);
  }

  return sectionLines
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- '))
    .filter((line) => line.includes('=>'))
    .filter((line) => !line.includes('<source>') && !line.includes('<target>'));
}

async function importPartnerCodes(): Promise<void> {
  // Partner document codes are a distinct vocabulary (code -> issuer + docType).
  // The registry naming path reads them directly from the vocabulary doc at
  // runtime; here we also register the issuer legal-name -> issuer-token as an
  // organization_alias candidate so issuer names normalise consistently.
  const docPath = partnerCodeAliasDocPath();
  const map = loadPartnerCodeAliasMap(docPath);
  if (map.size === 0) {
    console.log(`No partner codes found in ${docPath}.`);
    console.log('Add lines like: - `LA40 => issuer: GEDL (Full Name) | docType: Doc Type`');
    return;
  }

  const paths = getPipelinePaths();
  const index = new SqliteDocumentIndex(paths.sqliteDbPath);
  try {
    const nowIso = new Date().toISOString();
    let upserted = 0;
    for (const alias of map.values()) {
      if (alias.issuerLegalName && alias.issuerLegalName !== alias.issuer) {
        index.upsertCandidateRule({
          ruleType: 'organization_alias',
          sourceValue: alias.issuerLegalName,
          targetValue: alias.issuer,
          supportCount: 50,
          precisionScore: 0.99,
          status: 'candidate',
          firstSeenAtIso: nowIso,
          lastSeenAtIso: nowIso,
        });
        upserted += 1;
      }
    }
    console.log('Partner-code alias map loaded.');
    console.log(`- source_doc: ${docPath}`);
    console.log(`- codes: ${map.size}`);
    for (const alias of map.values()) {
      console.log(`  Â· ${alias.code} => ${alias.issuer} / ${alias.docType}`);
    }
    console.log(`- issuer_org_aliases_upserted: ${upserted}`);
  } finally {
    index.close();
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.includes('--partner-codes')) {
    await importPartnerCodes();
    return;
  }
  const sourceDocPath = args[0]?.trim() || DEFAULT_SEED_DOC_PATH;
  const content = await fs.readFile(sourceDocPath, 'utf8');
  const lines = extractSeedLines(content);

  const parsed = lines.map(parseSeedLine).filter((line): line is NonNullable<typeof line> => Boolean(line));
  if (parsed.length === 0) {
    console.log('No seed alias lines found. Add lines like: org|Source Name => TARGET');
    return;
  }

  const paths = getPipelinePaths();
  const index = new SqliteDocumentIndex(paths.sqliteDbPath);
  try {
    let upserted = 0;
    const nowIso = new Date().toISOString();

    for (const seed of parsed) {
      const ruleType = RULE_TYPE_BY_SEED_KIND[seed.kind];
      const record: CandidateRuleRecord = {
        ruleType,
        sourceValue: seed.source,
        targetValue: seed.target,
        supportCount: 50,
        precisionScore: 0.99,
        status: 'candidate',
        firstSeenAtIso: nowIso,
        lastSeenAtIso: nowIso,
      };
      index.upsertCandidateRule(record);
      upserted += 1;
    }

    console.log('Seed aliases imported into candidate rules.');
    console.log(`- source_doc: ${sourceDocPath}`);
    console.log(`- parsed_lines: ${parsed.length}`);
    console.log(`- rows_upserted: ${upserted}`);
  } finally {
    index.close();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown error';
  console.error('Failed to import seed aliases:', message);
  process.exit(1);
});
