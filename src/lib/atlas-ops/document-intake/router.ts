import { fileTypeFromFile } from 'file-type';
import { lookup as lookupMimeType } from 'mime-types';
import * as path from 'path';
import type { FileRoutingResult } from '@/lib/atlas-ops/document-intake/types';

const IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png']);

function normalizeMime(raw: string | false | undefined): string {
  if (!raw) return 'application/octet-stream';
  return raw.toString().toLowerCase();
}

function detectByMimeType(mimeType: string): 'pdf' | 'image' | 'unsupported' {
  if (mimeType === 'application/pdf') return 'pdf';
  if (IMAGE_MIME_TYPES.has(mimeType)) return 'image';
  return 'unsupported';
}

function detectByExtension(ext: string): 'pdf' | 'image' | 'unsupported' {
  if (ext === '.pdf') return 'pdf';
  if (ext === '.jpg' || ext === '.jpeg' || ext === '.png') return 'image';
  return 'unsupported';
}

export async function detectFileRouting(filePath: string): Promise<FileRoutingResult> {
  const extension = path.extname(filePath).toLowerCase();
  const mimeFromMagic = await fileTypeFromFile(filePath);
  const mimeByMagic = normalizeMime(mimeFromMagic?.mime);
  const mimeByLookup = normalizeMime(lookupMimeType(extension));

  const kindByMagic = detectByMimeType(mimeByMagic);
  const kindByMimeLookup = detectByMimeType(mimeByLookup);
  const kindByExtension = detectByExtension(extension);

  const kind =
    kindByMagic !== 'unsupported'
      ? kindByMagic
      : kindByMimeLookup !== 'unsupported'
        ? kindByMimeLookup
        : kindByExtension;

  return {
    kind,
    mimeType: mimeByMagic !== 'application/octet-stream' ? mimeByMagic : mimeByLookup,
    extension,
    detectedByMagicBytes: kindByMagic !== 'unsupported',
    detectedByMimeLookup: kindByMimeLookup !== 'unsupported',
    detectedByExtension: kindByExtension !== 'unsupported',
    isSupported: kind !== 'unsupported',
  };
}
