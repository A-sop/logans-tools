import * as path from 'path';

const DEFAULT_DATA_ROOT = 'C:\\DATA';
const DEFAULT_INBOX = path.join(DEFAULT_DATA_ROOT, '00_INBOX');
const DEFAULT_MANIFESTS = path.join(DEFAULT_DATA_ROOT, '10_WORK', '_manifests');
/** Dept1 ongoing housekeeping — not inbox; scripts write here by default. */
const DEFAULT_HOUSEKEEPING = path.join(DEFAULT_DATA_ROOT, '10_WORK', 'dept01-housekeeping');

export const EXCLUDE_PATH_SEGMENTS = ['AF_Kunden', 'CM_Kunden', 'AF_DE_BeratungsOrdner'] as const;

/** No autonomous rename/move into these (read-only intelligence OK). */
export const FROZEN_ADMIN_SEGMENTS = ['!!_TAX-ADMIN', '!!_ZOHO-BOOKS'] as const;

function readEnv(name: string): string | null {
  const value = process.env[name];
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export interface RegistryPaths {
  dataRoot: string;
  inboxRoot: string;
  housekeepingRoot: string;
  manifestsDir: string;
  registryDbPath: string;
  reviewCsvPath: string;
  inventoryCsvPath: string | null;
}

export interface HousekeepingPaths {
  root: string;
  youtubeTranscripts: string;
  youtubeLikes: string;
  takeouts: string;
  exportsTodo: string;
  exportsBookmarks: string;
  primers: string;
  triageLogs: string;
  triageCapture: string;
}

export function getHousekeepingPaths(dataRoot?: string): HousekeepingPaths {
  const root = readEnv('DEPT01_HOUSEKEEPING_ROOT') ?? (dataRoot ? path.join(dataRoot, '10_WORK', 'dept01-housekeeping') : DEFAULT_HOUSEKEEPING);
  return {
    root,
    youtubeTranscripts: path.join(root, 'youtube-transcripts'),
    youtubeLikes: path.join(root, 'youtube-likes'),
    takeouts: path.join(root, 'takeouts'),
    exportsTodo: path.join(root, 'exports', 'todo'),
    exportsBookmarks: path.join(root, 'exports', 'bookmarks'),
    primers: path.join(root, 'primers'),
    triageLogs: path.join(root, 'triage-logs'),
    triageCapture: path.join(root, 'triage-capture'),
  };
}

export function getRegistryPaths(): RegistryPaths {
  const dataRoot = readEnv('DATA_ROOT') ?? DEFAULT_DATA_ROOT;
  const manifestsDir = readEnv('DOC_REGISTRY_MANIFESTS_DIR') ?? DEFAULT_MANIFESTS;
  return {
    dataRoot,
    inboxRoot: readEnv('DOC_REGISTRY_INBOX') ?? DEFAULT_INBOX,
    housekeepingRoot: readEnv('DEPT01_HOUSEKEEPING_ROOT') ?? path.join(dataRoot, '10_WORK', 'dept01-housekeeping'),
    manifestsDir,
    registryDbPath: readEnv('DOC_REGISTRY_DB_PATH') ?? path.join(manifestsDir, 'document-registry.db'),
    reviewCsvPath: readEnv('DOC_REGISTRY_REVIEW_CSV') ?? path.join(manifestsDir, 'document-registry-review.csv'),
    inventoryCsvPath:
      readEnv('DOC_REGISTRY_INVENTORY_CSV') ??
      path.join(manifestsDir, 'data-onedrive-inventory-2026-05.csv'),
  };
}

/**
 * Resolve the source root to register/process over. Precedence:
 *   1. explicit CLI override (`--source=<abs path>`) — Tranche A folders (10_WORK, 20_ADMIN, OneDrive-DVAG)
 *   2. `DOC_REGISTRY_INBOX` env / default `C:\DATA\00_INBOX` (unchanged inbox behavior)
 * Returns the same shape as `getRegistryPaths()` with `inboxRoot` swapped for the
 * override, so the rest of the pipeline (walk, dedupe, propose) is untouched.
 */
export function resolveSourceRoot(paths: RegistryPaths, cliSource?: string | null): RegistryPaths {
  const override = cliSource && cliSource.trim().length > 0 ? cliSource.trim() : null;
  if (!override) return paths;
  return { ...paths, inboxRoot: override };
}

export function pathHasExcludedSegment(fullPath: string): boolean {
  const norm = fullPath.replace(/\//g, '\\');
  for (const seg of EXCLUDE_PATH_SEGMENTS) {
    if (norm.match(new RegExp(`\\\\${seg}(\\\\|$)`, 'i'))) return true;
  }
  return false;
}

export function isFrozenDestination(relativePath: string): boolean {
  const norm = relativePath.replace(/\//g, '\\');
  for (const seg of FROZEN_ADMIN_SEGMENTS) {
    if (norm.match(new RegExp(`(^|\\\\)${seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\\\|$)`, 'i'))) {
      return true;
    }
  }
  return false;
}

export function taxYearFolder(documentDateYYMMDD: string): string {
  const yy = documentDateYYMMDD.slice(0, 2);
  const year = Number.parseInt(yy, 10);
  const fullYear = year >= 70 ? 1900 + year : 2000 + year;
  return `!_TAXES-${fullYear}`;
}
