import { describe, expect, it } from 'vitest';

import { deriveIngestMouthKind, resolveIngestCycleFields } from '@/lib/dabos/ingest-cycle-meta';

describe('deriveIngestMouthKind', () => {
  it('detects youtube in urls', () => {
    expect(
      deriveIngestMouthKind({
        mouth: 'telegram',
        urls: ['https://www.youtube.com/watch?v=abc123'],
      })
    ).toBe('youtube');
  });

  it('classifies bookmark wire', () => {
    expect(
      deriveIngestMouthKind({
        mouth: 'bookmark',
        urls: ['https://example.com'],
      })
    ).toBe('bookmark');
  });

  it('classifies photo attachment', () => {
    expect(
      deriveIngestMouthKind({
        mouth: 'telegram',
        attachments: ['photo.jpg'],
      })
    ).toBe('image');
  });

  it('defaults plain text', () => {
    expect(deriveIngestMouthKind({ mouth: 'telegram', text: 'hello' })).toBe('text');
  });
});

describe('resolveIngestCycleFields', () => {
  it('defaults cycle_stage to 0', () => {
    expect(resolveIngestCycleFields({ mouth: 'telegram', text: 'hi' })).toEqual({
      mouth_kind: 'text',
      cycle_stage: 0,
    });
  });

  it('honors overrides', () => {
    expect(
      resolveIngestCycleFields({
        mouth: 'telegram',
        mouth_kind: 'link',
        cycle_stage: 2,
      })
    ).toEqual({ mouth_kind: 'link', cycle_stage: 2 });
  });
});
