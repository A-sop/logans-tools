import * as path from 'path';
import type { LocalCrmPaths } from '@/lib/atlas-ops/contact-network/local-crm-types';

const DEFAULT_ROOT = 'C:\\DATA\\10_WORK\\LDW-CRM';

function readEnv(name: string): string | null {
  const value = process.env[name];
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function getLocalCrmPaths(): LocalCrmPaths {
  const root =
    readEnv('LDW_CRM_ROOT') ?? readEnv('ATLAS_CRM_ROOT') ?? DEFAULT_ROOT;
  const dbPath =
    readEnv('LDW_CRM_DB_PATH') ??
    readEnv('ATLAS_CRM_DB_PATH') ??
    path.join(root, 'ldw-local-crm.db');
  const exportsDir =
    readEnv('LDW_CRM_EXPORTS_DIR') ??
    readEnv('ATLAS_CRM_EXPORTS_DIR') ??
    path.join(root, 'exports');

  return {
    root,
    dbPath,
    exportsDir,
  };
}
