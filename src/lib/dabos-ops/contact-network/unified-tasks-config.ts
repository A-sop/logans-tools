import * as path from 'path';
import { getHousekeepingPaths } from '@/lib/dabos-ops/document-intake/registry-config';
import type { UnifiedTaskInboxPaths } from '@/lib/dabos-ops/contact-network/unified-tasks-types';

const DEFAULT_DATA_ROOT = 'C:\\DATA';

function readEnv(name: string): string | null {
  const value = process.env[name];
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function getUnifiedTaskInboxPaths(): UnifiedTaskInboxPaths {
  // Prefer DABOS_*; ATLAS_* kept as fallback for older .env.local copies.
  const dataRoot =
    readEnv('DABOS_DATA_ROOT') ?? readEnv('ATLAS_DATA_ROOT') ?? readEnv('DATA_ROOT') ?? DEFAULT_DATA_ROOT;
  const hk = getHousekeepingPaths(dataRoot);
  const archiveAttio = path.join(dataRoot, '90_ARCHIVE', '_from-inbox-drain-2026-07-12', 'tasks-attio-offboarded');

  return {
    todoDir: readEnv('DABOS_TASKS_TODO_DIR') ?? readEnv('ATLAS_TASKS_TODO_DIR') ?? hk.exportsTodo,
    bookmarksDir:
      readEnv('DABOS_TASKS_BOOKMARKS_DIR') ?? readEnv('ATLAS_TASKS_BOOKMARKS_DIR') ?? hk.exportsBookmarks,
    attioDir: readEnv('DABOS_TASKS_ATTIO_DIR') ?? readEnv('ATLAS_TASKS_ATTIO_DIR') ?? archiveAttio,
  };
}

export function todoExportJsonPath(): string {
  return path.join(getUnifiedTaskInboxPaths().todoDir, 'tasks-export.json');
}

export function bookmarksExportJsonPath(): string {
  return path.join(getUnifiedTaskInboxPaths().bookmarksDir, 'bookmarks-export.json');
}

export function attioExportJsonPath(): string {
  return path.join(getUnifiedTaskInboxPaths().attioDir, 'tasks-export.json');
}
