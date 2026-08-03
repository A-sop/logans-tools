import * as fs from 'fs';
import * as path from 'path';
import { getRegistryPaths, pathHasExcludedSegment } from '@/lib/dabos-ops/document-intake/registry-config';

export function resolveAllowedDataFile(requestedPath: string): { absolutePath: string; mimeType: string } | null {
  const paths = getRegistryPaths();
  const dataRoot = path.resolve(paths.dataRoot);

  let resolved: string;
  try {
    // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal -- result is constrained to dataRoot below
    resolved = path.resolve(requestedPath);
  } catch {
    return null;
  }

  if (!resolved.toLowerCase().startsWith(dataRoot.toLowerCase())) {
    return null;
  }

  if (pathHasExcludedSegment(resolved)) {
    return null;
  }

  let realPath: string;
  try {
    realPath = fs.realpathSync(resolved);
  } catch {
    return null;
  }

  if (!realPath.toLowerCase().startsWith(dataRoot.toLowerCase())) {
    return null;
  }

  const stat = fs.statSync(realPath);
  if (!stat.isFile()) {
    return null;
  }

  const ext = path.extname(realPath).toLowerCase();
  const mimeType = mimeFromExtension(ext);
  return { absolutePath: realPath, mimeType };
}

function mimeFromExtension(ext: string): string {
  switch (ext) {
    case '.pdf':
      return 'application/pdf';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.gif':
      return 'image/gif';
    case '.webp':
      return 'image/webp';
    default:
      return 'application/octet-stream';
  }
}

export function previewKindForPath(filePath: string): 'pdf' | 'image' | 'none' {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.pdf') return 'pdf';
  if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) return 'image';
  return 'none';
}
