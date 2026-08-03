import * as fs from 'fs';
import * as path from 'path';
import { getRegistryPaths, pathHasExcludedSegment } from '@/lib/atlas-ops/document-intake/registry-config';

export interface PathCompleteResult {
  suggestions: string[];
  /** Extra characters to append on Tab when completing from the end of the input. */
  tabSuffix: string | null;
}

const DEFAULT_LIMIT = 25;

/** Directory completions for DATA paths (relative or absolute). */
export function completeDataPath(input: string, limit = DEFAULT_LIMIT): PathCompleteResult {
  const { dataRoot } = getRegistryPaths();
  const normalizedRoot = path.resolve(dataRoot);
  const trimmed = input.replace(/\//g, '\\').trimEnd();

  if (trimmed.length === 0) {
    return listChildren(normalizedRoot, '', limit);
  }

  const driveOnly = trimmed.match(/^([a-zA-Z])$/);
  if (driveOnly) {
    const letter = driveOnly[1].toUpperCase();
    const suggestion = `${letter}:\\`;
    return { suggestions: [suggestion], tabSuffix: suggestion.slice(trimmed.length) };
  }

  const driveColon = trimmed.match(/^([a-zA-Z]):$/);
  if (driveColon) {
    const suggestion = `${driveColon[1].toUpperCase()}:\\`;
    return { suggestions: [suggestion], tabSuffix: suggestion.slice(trimmed.length) };
  }

  const absoluteMode = /^[a-zA-Z]:/.test(trimmed);

  if (absoluteMode) {
    const towardData = completePrefixTowardDataRoot(trimmed, normalizedRoot);
    if (towardData) {
      return towardData;
    }

    const resolved = resolveExistingParent(trimmed, normalizedRoot);
    if (!resolved) {
      return { suggestions: [], tabSuffix: null };
    }

    if (!isWithinDataRoot(resolved.parentAbsolute, normalizedRoot)) {
      return { suggestions: [], tabSuffix: null };
    }

    return listChildren(
      resolved.parentAbsolute,
      resolved.partial,
      limit,
      trimmed.slice(0, trimmed.length - resolved.partial.length)
    );
  }

  const resolved = resolveExistingParent(trimmed, normalizedRoot);
  if (!resolved) {
    return { suggestions: [], tabSuffix: null };
  }

  const parentAbsolute = path.isAbsolute(resolved.parentAbsolute)
    ? resolved.parentAbsolute
    : path.join(normalizedRoot, resolved.parentAbsolute);

  if (!isWithinDataRoot(parentAbsolute, normalizedRoot)) {
    return { suggestions: [], tabSuffix: null };
  }

  const displayPrefix = trimmed.endsWith('\\')
    ? trimmed
    : trimmed.slice(0, Math.max(0, trimmed.length - resolved.partial.length));

  return listChildren(parentAbsolute, resolved.partial, limit, displayPrefix);
}

function completePrefixTowardDataRoot(input: string, dataRoot: string): PathCompleteResult | null {
  const normInput = input.replace(/\//g, '\\');
  const normData = dataRoot.replace(/\//g, '\\');

  if (normData.toLowerCase().startsWith(normInput.toLowerCase()) && normInput.length < normData.length) {
    const completed = normData.endsWith('\\') ? normData : `${normData}\\`;
    return {
      suggestions: [completed],
      tabSuffix: completed.slice(normInput.length),
    };
  }

  if (!isWithinDataRoot(path.resolve(normInput), dataRoot) && !normData.toLowerCase().startsWith(normInput.toLowerCase())) {
    const driveRoot = normInput.match(/^([a-zA-Z]:\\?)$/);
    if (driveRoot) {
      const root = `${driveRoot[1].toUpperCase()}:\\`;
      if (!fs.existsSync(root)) {
        return { suggestions: [], tabSuffix: null };
      }
      try {
        const entries = fs.readdirSync(root, { withFileTypes: true });
        const dirs = entries
          .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
          .map((entry) => `${root}${entry.name}\\`)
          .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
        return withTabSuffix(normInput, dirs.slice(0, DEFAULT_LIMIT));
      } catch {
        return { suggestions: [], tabSuffix: null };
      }
    }
  }

  return null;
}

function resolveExistingParent(
  input: string,
  dataRoot: string
): { parentAbsolute: string; partial: string } | null {
  const endsWithSep = input.endsWith('\\');
  let dirPart = endsWithSep ? input : path.dirname(input);
  let partial = endsWithSep ? '' : path.basename(input);

  const absoluteMode = /^[a-zA-Z]:/.test(input);

  for (let attempt = 0; attempt < 32; attempt += 1) {
    // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal -- local DATA autocomplete; callers enforce isWithinDataRoot
    const candidate = absoluteMode ? path.resolve(dirPart) : path.join(dataRoot, dirPart);

    if (fs.existsSync(candidate)) {
      try {
        const stat = fs.statSync(candidate);
        if (stat.isDirectory()) {
          return { parentAbsolute: candidate, partial };
        }
      } catch {
        return null;
      }
    }

    if (dirPart === '.' || dirPart === '' || dirPart === '\\' || /^[a-zA-Z]:\\?$/.test(dirPart)) {
      break;
    }

    const parentName = path.basename(dirPart);
    dirPart = path.dirname(dirPart);
    partial = partial ? `${parentName}\\${partial}` : parentName;
  }

  return null;
}

function listChildren(
  parentAbsolute: string,
  partial: string,
  limit: number,
  displayPrefix = ''
): PathCompleteResult {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(parentAbsolute, { withFileTypes: true });
  } catch {
    return { suggestions: [], tabSuffix: null };
  }

  const partialLower = partial.toLowerCase();
  const suggestions: string[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue;

    // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal -- children of already-resolved parentAbsolute under DATA
    const childAbsolute = path.join(parentAbsolute, entry.name);
    if (pathHasExcludedSegment(childAbsolute)) continue;
    if (!entry.name.toLowerCase().startsWith(partialLower)) continue;

    const suggestion = `${displayPrefix}${entry.name}\\`.replace(/\\+/g, '\\');
    suggestions.push(suggestion);
    if (suggestions.length >= limit) break;
  }

  suggestions.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  const inputForSuffix = displayPrefix + partial;
  return withTabSuffix(inputForSuffix, suggestions);
}

function isWithinDataRoot(absolutePath: string, dataRoot: string): boolean {
  // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal -- containment check only
  const resolved = path.resolve(absolutePath);
  // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal -- containment check only
  const root = path.resolve(dataRoot);
  return resolved.toLowerCase() === root.toLowerCase() || resolved.toLowerCase().startsWith(`${root.toLowerCase()}\\`);
}

function withTabSuffix(input: string, suggestions: string[]): PathCompleteResult {
  if (suggestions.length === 0) {
    return { suggestions, tabSuffix: null };
  }

  const extending = suggestions.filter((s) => s.toLowerCase().startsWith(input.toLowerCase()));
  if (extending.length === 1) {
    return { suggestions, tabSuffix: extending[0].slice(input.length) };
  }

  if (extending.length > 1) {
    const remainders = extending.map((s) => s.slice(input.length));
    const common = longestCommonPrefix(remainders);
    if (common.length > 0) {
      return { suggestions, tabSuffix: common };
    }
  }

  return { suggestions, tabSuffix: null };
}

function longestCommonPrefix(strings: string[]): string {
  if (strings.length === 0) return '';
  const first = strings[0];
  let end = first.length;
  for (const s of strings.slice(1)) {
    let i = 0;
    while (i < end && i < s.length && first[i].toLowerCase() === s[i].toLowerCase()) {
      i += 1;
    }
    end = i;
    if (end === 0) return '';
  }
  return first.slice(0, end);
}
