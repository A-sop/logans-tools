import * as path from 'path';
import { getHousekeepingPaths } from '@/lib/atlas-ops/document-intake/registry-config';
import type { UnifiedTaskInboxPaths } from '@/lib/atlas-ops/contact-network/unified-tasks-types';

const DEFAULT_DATA_ROOT = 'C:\\DATA';

function readEnv(name: string): string | null {
  const value = process.env[name];
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function getUnifiedTaskInboxPaths(): UnifiedTaskInboxPaths {
  const dataRoot = readEnv('ATLAS_DATA_ROOT') ?? DEFAULT_DATA_ROOT;
  const hk = getHousekeepingPaths(dataRoot);
  const archiveAttio = path.join(dataRoot, '90_ARCHIVE', '_from-inbox-drain-2026-07-12', 'tasks-attio-offboarded');

  return {
    todoDir: readEnv('ATLAS_TASKS_TODO_DIR') ?? hk.exportsTodo,
    bookmarksDir: readEnv('ATLAS_TASKS_BOOKMARKS_DIR') ?? hk.exportsBookmarks,
    attioDir: readEnv('ATLAS_TASKS_ATTIO_DIR') ?? archiveAttio,
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
