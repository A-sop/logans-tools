/**
 * Class I ingest cycle — mouth_kind + cycle_stage on capture (stage 0).
 * SSOT: DABOS docs/reference/dept01-intake/mouths-and-media-ingest-cycle.md
 */
export const YOUTUBE_URL_RE =
  /(?:youtube\.com\/(?:watch\?(?:[^&\s]+&)*v=|shorts\/|live\/)|youtu\.be\/)/i;

export type IngestMouthKind =
  | 'bookmark'
  | 'youtube'
  | 'image'
  | 'voice'
  | 'video'
  | 'file'
  | 'link'
  | 'text';

/** Stage 0 = capture landed in Neon (mouths-and-media-ingest-cycle § stages). */
export const INGEST_CAPTURE_CYCLE_STAGE = 0;

export function deriveIngestMouthKind(input: {
  mouth: string;
  text?: string;
  urls?: string[];
  attachments?: string[];
}): IngestMouthKind {
  if (input.mouth === 'bookmark') return 'bookmark';
  const urls = input.urls ?? [];
  const text = input.text ?? '';
  if (urls.some((u) => YOUTUBE_URL_RE.test(u)) || YOUTUBE_URL_RE.test(text)) {
    return 'youtube';
  }
  const att = (input.attachments ?? []).map((a) => a.toLowerCase());
  if (att.some((a) => /photo|screenshot|\.(jpe?g|png|webp|gif)\b/.test(a))) return 'image';
  if (att.some((a) => /\bvoice\b|\.ogg\b|\.opus\b/.test(a))) return 'voice';
  if (att.some((a) => /\bvideo\b|\.mp4\b|\.webm\b/.test(a))) return 'video';
  if (att.length > 0) return 'file';
  if (urls.length > 0) return 'link';
  return 'text';
}

export function resolveIngestCycleFields(input: {
  mouth: string;
  text?: string;
  urls?: string[];
  attachments?: string[];
  mouth_kind?: string;
  cycle_stage?: number;
}): { mouth_kind: string; cycle_stage: number } {
  const mouth_kind = input.mouth_kind?.trim() || deriveIngestMouthKind(input);
  const cycle_stage =
    input.cycle_stage != null && Number.isFinite(input.cycle_stage)
      ? Math.max(0, Math.min(9, Math.trunc(input.cycle_stage)))
      : INGEST_CAPTURE_CYCLE_STAGE;
  return { mouth_kind, cycle_stage };
}
