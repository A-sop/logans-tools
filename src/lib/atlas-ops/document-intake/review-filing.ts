import * as path from 'path';

export interface FilingOverrideInput {
  keepFilename?: boolean;
  basenameOverride?: string;
  relativePathOverride?: string;
}

export interface ParsedReviewNotes extends FilingOverrideInput {
  inferredArchive: boolean;
  inferredDelete: boolean;
  inferredVentures: boolean;
}

export interface ResolvedFiling {
  basename: string;
  relativePath: string;
  keepFilename: boolean;
  usedOverride: boolean;
}

const KEEP_NAME_PATTERNS =
  /\b(don'?t change|do not change|keep name|name is correct|keep filename|keep current name|leave name)\b/i;
const ARCHIVE_PATTERN = /\barchive\b/i;
const ARCHIVE_NEGATIVE_PATTERN = /\b(not in archive|no archive|delete archive|won'?t archive)\b/i;
const DELETE_PATTERN = /^\s*delete\s*[.!]?\s*$/i;
const VENTURES_PATTERN = /\b(ventures?|bridge\s*life)\b/i;

export function parseReviewNotes(notes: string, currentFilename: string): ParsedReviewNotes {
  const trimmed = notes.trim();
  let keepFilename = KEEP_NAME_PATTERNS.test(trimmed);
  let inferredArchive = ARCHIVE_PATTERN.test(trimmed) && !ARCHIVE_NEGATIVE_PATTERN.test(trimmed);

  const nameMatch = trimmed.match(/\b(?:name|rename|save as|basename)\s*:\s*([^\n\r]+)/i);
  let basenameOverride = nameMatch?.[1]?.trim() ?? '';

  const pathMatch = trimmed.match(/\b(?:path|folder|file to|move to)\s*:\s*([^\n\r]+)/i);
  let relativePathOverride = pathMatch?.[1]?.trim() ?? '';

  if (basenameOverride && !path.extname(basenameOverride)) {
    basenameOverride += path.extname(currentFilename) || '';
  }

  if (inferredArchive && !relativePathOverride) {
    relativePathOverride = path.join('90_ARCHIVE', currentFilename);
    keepFilename = true;
  }

  if (relativePathOverride) {
    relativePathOverride = normalizeRelativePath(relativePathOverride, currentFilename, basenameOverride, keepFilename);
  }

  if (basenameOverride) {
    keepFilename = false;
  }

  return {
    keepFilename,
    basenameOverride: basenameOverride || undefined,
    relativePathOverride: relativePathOverride || undefined,
    inferredArchive,
    inferredDelete: DELETE_PATTERN.test(trimmed),
    inferredVentures: VENTURES_PATTERN.test(trimmed),
  };
}

export function normalizeRelativePath(
  rawPath: string,
  currentFilename: string,
  basenameOverride: string | undefined,
  keepFilename: boolean
): string {
  let normalized = rawPath.replace(/\//g, '\\').trim();
  const hasExtension = Boolean(path.extname(normalized));

  if (!hasExtension || normalized.endsWith('\\')) {
    const basename = basenameOverride || (keepFilename ? currentFilename : path.basename(normalized) || currentFilename);
    normalized = path.join(normalized.replace(/\\+$/, ''), basename);
  }

  return normalized.replace(/\//g, '\\');
}

export function mergeFilingOverrides(
  notes: string,
  sourcePath: string,
  proposedBasename: string,
  proposedRelativePath: string,
  explicit: FilingOverrideInput = {}
): {
  keepFilename: boolean;
  basenameOverride: string;
  relativePathOverride: string;
} {
  const currentFilename = path.basename(sourcePath);
  const parsed = parseReviewNotes(notes, currentFilename);

  // Empty UI fields must not clobber Wispr/notes parsing (?? treats "" and false as set).
  const keepFilename = explicit.keepFilename === true || parsed.keepFilename;
  const basenameOverride = (explicit.basenameOverride?.trim() || parsed.basenameOverride || '').trim();
  let relativePathOverride = (explicit.relativePathOverride?.trim() || parsed.relativePathOverride || '').trim();

  if (relativePathOverride) {
    relativePathOverride = normalizeRelativePath(
      relativePathOverride,
      currentFilename,
      basenameOverride || undefined,
      keepFilename
    );
  }

  return {
    keepFilename,
    basenameOverride,
    relativePathOverride,
  };
}

export function resolveEffectiveFiling(input: {
  sourcePath: string;
  proposedBasename: string;
  proposedRelativePath: string;
  keepFilename: boolean;
  basenameOverride: string;
  relativePathOverride: string;
}): ResolvedFiling {
  const currentBasename = path.basename(input.sourcePath);
  let basename = input.proposedBasename;
  let relativePath = input.proposedRelativePath.replace(/\//g, '\\');
  let usedOverride = false;

  if (input.keepFilename) {
    basename = currentBasename;
    usedOverride = basename !== input.proposedBasename;
  } else if (input.basenameOverride) {
    basename = input.basenameOverride;
    usedOverride = true;
  }

  if (input.relativePathOverride) {
    relativePath = input.relativePathOverride;
    usedOverride = true;
  } else if (input.keepFilename || input.basenameOverride) {
    const bucket = path.dirname(relativePath);
    relativePath = path.join(bucket, basename).replace(/\//g, '\\');
    usedOverride = true;
  }

  return {
    basename,
    relativePath,
    keepFilename: input.keepFilename,
    usedOverride,
  };
}
