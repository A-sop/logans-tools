/**
 * Div1 primary: artifacts_indexed — SSOT basis from DABOS artifact-index.md
 * (Dept3 Perception). Count top-level .md only; exclude the index itself and DRAFT LDWPLs.
 */
import { existsSync, readdirSync } from 'fs';
import path from 'path';

const DABOS_REGISTERS = path.join('C:', 'Dev', 'DABOS', 'docs', 'registers');
const DABOS_POLICY = path.join('C:', 'Dev', 'DABOS', 'docs', 'policy');
const DATA_REGISTERS = path.join('C:', 'DATA', '10_WORK', 'dabos-registers');
const OFFER_DRAFTS = path.join(DATA_REGISTERS, 'offer-drafts');

export type ArtifactsIndexedCount = {
  total: number;
  parts: {
    dabosRegisters: number;
    dabosPolicy: number;
    dataRegistersTop: number;
    offerDrafts: number;
  };
  sourcesPresent: boolean;
};

function listMd(dir: string, opts?: { exclude?: (name: string) => boolean }): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.md'))
    .map((e) => e.name)
    .filter((name) => !(opts?.exclude?.(name) ?? false));
}

/** Signed shelf only — skip DRAFT LDWPL-* per GOV-001 / artifact-index. */
function isDraftPolicy(name: string): boolean {
  const upper = name.toUpperCase();
  return upper.includes('DRAFT') || /^LDWPL-260709/i.test(name);
}

export function countArtifactsIndexed(): ArtifactsIndexedCount {
  const dabosRegisters = listMd(DABOS_REGISTERS, {
    exclude: (n) => n.toLowerCase() === 'artifact-index.md',
  }).length;
  const dabosPolicy = listMd(DABOS_POLICY, { exclude: isDraftPolicy }).length;
  const dataRegistersTop = listMd(DATA_REGISTERS).length;
  const offerDrafts = listMd(OFFER_DRAFTS).length;
  const sourcesPresent =
    existsSync(DABOS_REGISTERS) || existsSync(DABOS_POLICY) || existsSync(DATA_REGISTERS);

  return {
    total: dabosRegisters + dabosPolicy + dataRegistersTop + offerDrafts,
    parts: { dabosRegisters, dabosPolicy, dataRegistersTop, offerDrafts },
    sourcesPresent,
  };
}

export const ARTIFACTS_INDEXED_BASIS = {
  ssot: 'DABOS/docs/registers/artifact-index.md',
  dirs: [DABOS_REGISTERS, DABOS_POLICY, DATA_REGISTERS, OFFER_DRAFTS],
};
