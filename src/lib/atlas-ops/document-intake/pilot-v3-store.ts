import * as fs from 'fs';
import { getRegistryPaths } from '@/lib/atlas-ops/document-intake/registry-config';

export interface PilotV3FieldEvidence {
  value: string;
  page?: string;
  evidence?: string;
}

export interface PilotV3Extraction {
  path: string;
  originalBasename: string | null;
  currentFilename: string | null;
  registryBasename: string | null;
  method: string;
  chars: number;
  proposal: string | null;
  notes: string[];
  runAt: string | null;
  fields: Record<string, PilotV3FieldEvidence>;
}

const FIELD_KEYS = ['organization', 'person', 'document_date', 'document_number', 'document_type', 'category'] as const;

function resultsJsonlPath(): string {
  return `${getRegistryPaths().manifestsDir}\\pilot-v3-results.jsonl`;
}

function normalizePath(p: string): string {
  return p.replace(/\//g, '\\').toLowerCase();
}

function parseRow(raw: Record<string, unknown>): PilotV3Extraction | null {
  const path = typeof raw.path === 'string' ? raw.path : null;
  if (!path) return null;

  const fieldsRaw = (raw.fields ?? {}) as Record<string, unknown>;
  const fields: Record<string, PilotV3FieldEvidence> = {};

  for (const key of FIELD_KEYS) {
    const value = fieldsRaw[key];
    if (typeof value !== 'string' || !value) continue;
    const page = fieldsRaw[`${key}_page`];
    const evidence = fieldsRaw[`${key}_evidence`];
    fields[key] = {
      value,
      page: typeof page === 'string' || typeof page === 'number' ? String(page) : undefined,
      evidence: typeof evidence === 'string' ? evidence : undefined,
    };
  }

  const notes = Array.isArray(raw.notes) ? raw.notes.filter((n): n is string => typeof n === 'string') : [];

  return {
    path,
    originalBasename: typeof raw.original_basename === 'string' ? raw.original_basename : null,
    currentFilename: typeof raw.current_filename === 'string' ? raw.current_filename : null,
    registryBasename: typeof raw.registry_basename === 'string' ? raw.registry_basename : null,
    method: typeof raw.method === 'string' ? raw.method : 'unknown',
    chars: typeof raw.chars === 'number' ? raw.chars : 0,
    proposal: typeof raw.proposal === 'string' ? raw.proposal : raw.proposal === null ? null : null,
    notes,
    runAt: typeof raw.run_at === 'string' ? raw.run_at : null,
    fields,
  };
}

let cache: Map<string, PilotV3Extraction> | null = null;
let cacheMtime = 0;

function buildIndexFromLines(content: string): Map<string, PilotV3Extraction> {
  const index = new Map<string, PilotV3Extraction>();
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed = parseRow(JSON.parse(trimmed) as Record<string, unknown>);
      if (parsed) {
        index.set(normalizePath(parsed.path), parsed);
      }
    } catch {
      // skip malformed lines
    }
  }
  return index;
}

function readPilotV3Index(): Map<string, PilotV3Extraction> {
  const filePath = resultsJsonlPath();
  let mtime = 0;
  try {
    mtime = fs.statSync(filePath).mtimeMs;
  } catch {
    return new Map();
  }

  if (cache && mtime === cacheMtime) {
    return cache;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const index = buildIndexFromLines(content);
  cache = index;
  cacheMtime = mtime;
  return index;
}

/** Sync index for review queue (server-side). */
export function loadPilotV3IndexSync(): Map<string, PilotV3Extraction> {
  return readPilotV3Index();
}

async function loadIndex(): Promise<Map<string, PilotV3Extraction>> {
  return readPilotV3Index();
}

export async function getPilotV3Extraction(sourcePath: string): Promise<PilotV3Extraction | null> {
  const index = await loadIndex();
  return index.get(normalizePath(sourcePath)) ?? null;
}

export async function getPilotV3Meta(): Promise<{ path: string; count: number; latestRunAt: string | null }> {
  const index = await loadIndex();
  let latestRunAt: string | null = null;
  for (const row of index.values()) {
    if (row.runAt && (!latestRunAt || row.runAt > latestRunAt)) {
      latestRunAt = row.runAt;
    }
  }
  return { path: resultsJsonlPath(), count: index.size, latestRunAt };
}
