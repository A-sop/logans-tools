import { describe, expect, it } from 'vitest';

import { formatIngestAck, parseIngestText } from '@/lib/dabos/ingest';

describe('parseIngestText', () => {
  it('strips dept tag and task prefix', () => {
    const r = parseIngestText('task: Dept8 GnuCash imbalance clear');
    expect(r.is_work).toBe(true);
    expect(r.department_id).toBe('Dept8');
    expect(r.title).toBe('GnuCash imbalance clear');
  });

  it('defaults capture title from first line', () => {
    const r = parseIngestText('https://example.com\nnote');
    expect(r.is_work).toBe(false);
    expect(r.department_id).toBeNull();
    expect(r.title).toBe('https://example.com');
  });
});

describe('formatIngestAck', () => {
  it('matches Saved · task shape', () => {
    expect(
      formatIngestAck({ short_id: 'abcd1234', summary: 'text, 1 link', created: true })
    ).toBe('Saved · task abcd1234 · text, 1 link');
  });
});
