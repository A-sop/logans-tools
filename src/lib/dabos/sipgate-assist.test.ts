import { describe, expect, it } from 'vitest';

import {
  cleanSipgateWatermark,
  normalizeSipgateAssistPayload,
  payloadHasTranscript,
  sipgateIpAllowed,
  stripTranscriptFields,
} from '@/lib/dabos/sipgate-assist';

const labsSample = {
  callHeadline: 'Address mismatch',
  call: {
    id: 'call_redacted',
    caller: '+491751234567',
    callee: '+4922133952222',
    startTime: 1718202000000,
    duration: 300,
    direction: 'outbound',
  },
  channel: { id: 'ch1', name: 'GEDVers - PK' },
  transcriptions: [{ speaker: 'caller', text: 'secret names' }],
  summary: 'Partner confirmed a new post address.\n[Erstellt mit sipgate AI](https://www.sipgate.de/ai)',
  actionItems: [{ id: 'a1', text: 'Write OS' }],
};

describe('sipgate assist sanitize', () => {
  it('strips transcriptions and watermarks by default', () => {
    const result = normalizeSipgateAssistPayload(labsSample, false);
    if ('error' in result) throw new Error(result.error);
    expect(result.hasTranscript).toBe(true);
    expect(result.payload.transcriptions).toBeUndefined();
    expect(result.summary).toBe('Partner confirmed a new post address.');
    expect(result.remoteNumber).toBe('+4922133952222');
    expect(result.durationSeconds).toBe(300);
    expect(result.actionItems).toEqual([{ text: 'Write OS' }]);
  });

  it('keeps transcripts when opted in', () => {
    const result = normalizeSipgateAssistPayload(labsSample, true);
    if ('error' in result) throw new Error(result.error);
    expect(result.payload.transcriptions).toEqual(labsSample.transcriptions);
  });

  it('reads CI assist.summary.content', () => {
    const result = normalizeSipgateAssistPayload(
      {
        call: { id: 'pbx-1', from: '49211', to: '49212', direction: 'IN', duration: 82666 },
        assist: {
          transcription: { content: 'full text' },
          summary: { content: 'Short note' },
          actionItems: [{ content: 'Email options' }],
        },
      },
      false
    );
    if ('error' in result) throw new Error(result.error);
    expect(result.summary).toBe('Short note');
    expect(result.durationSeconds).toBe(83);
    expect(result.actionItems[0]?.text).toBe('Email options');
    expect(asRecord(result.payload.assist)?.transcription).toBeUndefined();
  });
});

describe('helpers', () => {
  it('detects nested transcript keys', () => {
    expect(payloadHasTranscript({ assist: { transcription: { content: 'x' } } })).toBe(true);
    expect(stripTranscriptFields({ assist: { transcription: { content: 'x' }, summary: 's' } })).toEqual({
      assist: { summary: 's' },
    });
    expect(cleanSipgateWatermark('[Erstellt mit sipgate AI]')).toBeNull();
  });

  it('allows sipgate IP in production', () => {
    expect(sipgateIpAllowed('217.116.118.254', 'production')).toBe(true);
    expect(sipgateIpAllowed('1.2.3.4', 'production')).toBe(false);
    expect(sipgateIpAllowed('1.2.3.4', 'development')).toBe(true);
  });
});

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}
