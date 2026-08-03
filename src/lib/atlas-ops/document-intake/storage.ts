import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import type { PipelinePaths } from '@/lib/atlas-ops/document-intake/types';

export async function ensurePipelineDirectories(paths: PipelinePaths): Promise<void> {
  await fs.mkdir(paths.inbox, { recursive: true });
  await fs.mkdir(paths.processed, { recursive: true });
  await fs.mkdir(paths.markdown, { recursive: true });
  await fs.mkdir(paths.failed, { recursive: true });
  await fs.mkdir(paths.indexDir, { recursive: true });
}

export async function computeFileSha256(filePath: string): Promise<string> {
  const content = await fs.readFile(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

export async function moveToFailed(sourcePath: string, failedDir: string): Promise<string> {
  await fs.mkdir(failedDir, { recursive: true });
  const fileName = path.basename(sourcePath);
  // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal -- basename-only into configured failedDir
  const failedPath = await createUniqueTargetPath(path.join(failedDir, fileName));
  await fs.rename(sourcePath, failedPath);
  return failedPath;
}

export async function moveToProcessed(sourcePath: string, processedTargetPath: string): Promise<string> {
  const uniqueTargetPath = await createUniqueTargetPath(processedTargetPath);
  await fs.rename(sourcePath, uniqueTargetPath);
  return uniqueTargetPath;
}

export async function writeMarkdown(markdownPath: string, content: string): Promise<string> {
  const targetPath = await createUniqueTargetPath(markdownPath);
  await fs.writeFile(targetPath, content, 'utf8');
  return targetPath;
}

async function createUniqueTargetPath(targetPath: string): Promise<string> {
  const parsed = path.parse(targetPath);
  let candidate = targetPath;
  let suffix = 1;

  for (;;) {
    try {
      await fs.access(candidate);
      suffix += 1;
      // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal -- unique suffix in same parsed.dir
      candidate = path.join(parsed.dir, `${parsed.name}-${suffix}${parsed.ext}`);
    } catch {
      return candidate;
    }
  }
}
