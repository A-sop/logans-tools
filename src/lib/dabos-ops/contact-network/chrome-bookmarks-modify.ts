import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const BACKUP_DIR = 'C:\\DATA\\10_WORK\\dept01-housekeeping\\exports\\bookmarks\\chrome-backups';

export function defaultChromeBookmarksPath(): string {
  return join(
    process.env.LOCALAPPDATA || '',
    'Google',
    'Chrome',
    'User Data',
    'Default',
    'Bookmarks'
  );
}

export function resolveChromeBookmarksPath(): string {
  const fromEnv =
    process.env.DABOS_CHROME_BOOKMARKS_PATH?.trim() ||
    process.env.ATLAS_CHROME_BOOKMARKS_PATH?.trim();
  return fromEnv && fromEnv.length > 0 ? fromEnv : defaultChromeBookmarksPath();
}

function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url.trim());
    parsed.hash = '';
    let normalized = parsed.toString().toLowerCase();
    if (normalized.endsWith('/')) normalized = normalized.slice(0, -1);
    return normalized;
  } catch {
    return url.trim().toLowerCase().replace(/\/$/, '');
  }
}

type RemovedBookmark = {
  id: string;
  title: string;
  url: string;
};

function walkRemove(
  node: Record<string, unknown>,
  targetNorm: string,
  removed: RemovedBookmark[]
): void {
  if (!node || typeof node !== 'object') return;

  const children = node.children;
  if (!Array.isArray(children)) return;

  const kept: unknown[] = [];
  for (const child of children) {
    if (!child || typeof child !== 'object') {
      kept.push(child);
      continue;
    }
    const row = child as Record<string, unknown>;
    if (row.type === 'url' && typeof row.url === 'string') {
      if (normalizeUrl(row.url) === targetNorm) {
        removed.push({
          id: String(row.id ?? ''),
          title: String(row.name ?? row.url),
          url: row.url,
        });
        continue;
      }
    }
    walkRemove(row, targetNorm, removed);
    kept.push(child);
  }
  node.children = kept;
}

function walkRemoveSet(
  node: Record<string, unknown>,
  targetNorms: Set<string>,
  removed: RemovedBookmark[]
): void {
  if (!node || typeof node !== 'object') return;

  const children = node.children;
  if (!Array.isArray(children)) return;

  const kept: unknown[] = [];
  for (const child of children) {
    if (!child || typeof child !== 'object') {
      kept.push(child);
      continue;
    }
    const row = child as Record<string, unknown>;
    if (row.type === 'url' && typeof row.url === 'string') {
      if (targetNorms.has(normalizeUrl(row.url))) {
        removed.push({
          id: String(row.id ?? ''),
          title: String(row.name ?? row.url),
          url: row.url,
        });
        continue;
      }
    }
    walkRemoveSet(row, targetNorms, removed);
    kept.push(child);
  }
  node.children = kept;
}

export function deleteChromeBookmarksByUrls(
  urls: string[],
  bookmarksPath = resolveChromeBookmarksPath()
): {
  removed: RemovedBookmark[];
  backupPath: string | null;
  notFoundNorm: string[];
} {
  if (!existsSync(bookmarksPath)) {
    throw new Error(`Chrome Bookmarks file not found: ${bookmarksPath}. Close Chrome and try again.`);
  }

  const targetNorms = new Set(urls.map(normalizeUrl).filter(Boolean));
  const raw = JSON.parse(readFileSync(bookmarksPath, 'utf8')) as Record<string, unknown>;
  const removed: RemovedBookmark[] = [];

  const roots = raw.roots as Record<string, unknown> | undefined;
  if (roots) {
    for (const root of Object.values(roots)) {
      if (root && typeof root === 'object') {
        walkRemoveSet(root as Record<string, unknown>, targetNorms, removed);
      }
    }
  }

  const removedNorms = new Set(removed.map((r) => normalizeUrl(r.url)));
  const notFoundNorm = [...targetNorms].filter((n) => !removedNorms.has(n));

  if (removed.length === 0) {
    return { removed, backupPath: null, notFoundNorm: [...targetNorms] };
  }

  mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = join(BACKUP_DIR, `Bookmarks-before-bulk-delete_${stamp}`);
  copyFileSync(bookmarksPath, backupPath);
  delete raw.checksum;
  writeFileSync(bookmarksPath, JSON.stringify(raw), 'utf8');

  return { removed, backupPath, notFoundNorm };
}

export function deleteChromeBookmarkByUrl(
  url: string,
  bookmarksPath = resolveChromeBookmarksPath()
): { removed: RemovedBookmark[]; backupPath: string | null } {
  if (!existsSync(bookmarksPath)) {
    throw new Error(`Chrome Bookmarks file not found: ${bookmarksPath}. Close Chrome and try again.`);
  }

  const targetNorm = normalizeUrl(url);
  const raw = JSON.parse(readFileSync(bookmarksPath, 'utf8')) as Record<string, unknown>;
  const removed: RemovedBookmark[] = [];

  const roots = raw.roots as Record<string, unknown> | undefined;
  if (roots) {
    for (const root of Object.values(roots)) {
      if (root && typeof root === 'object') {
        walkRemove(root as Record<string, unknown>, targetNorm, removed);
      }
    }
  }

  if (removed.length === 0) {
    return { removed, backupPath: null };
  }

  mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = join(BACKUP_DIR, `Bookmarks-before-delete_${stamp}`);
  copyFileSync(bookmarksPath, backupPath);
  delete raw.checksum;
  writeFileSync(bookmarksPath, JSON.stringify(raw), 'utf8');

  return { removed, backupPath };
}
