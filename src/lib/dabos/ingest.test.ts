import { describe, expect, it } from 'vitest';

import { formatIngestAck, parseIngestText } from '@/lib/dabos/ingest';

describe('parseIngestText', () => {
  it('strips dept tag and task prefix', () => {
    const r = parseIngestText('task: Dept8 GnuCash imbalance clear');
    expect(r.is_work).toBe(true);
    expect(r.is_agent).toBe(true);
    expect(r.department_id).toBe('Dept8');
    expect(r.title).toBe('GnuCash imbalance clear');
  });

  it('treats agent: as queued work', () => {
    const r = parseIngestText('agent: summarize this week’s Dept1 IN');
    expect(r.is_agent).toBe(true);
    expect(r.title).toBe('summarize this week’s Dept1 IN');
  });

  it('defaults capture title from first line', () => {
    const r = parseIngestText('https://example.com\nnote');
    expect(r.is_work).toBe(false);
    expect(r.is_agent).toBe(false);
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

describe('pointer mode', () => {
  it('parseIngestText strips task prefix as before', () => {
    const r = parseIngestText('task: some text that should be stripped');
    expect(r.is_work).toBe(true);
    expect(r.title).toBe('some text that should be stripped');
  });

  it('falls back to Capture when empty', () => {
    const r = parseIngestText('');
    expect(r.title).toBe('Capture');
  });
});

describe('DVAG keyword detection', () => {
  const dvagRegex = /dvag|deutsche\s+verm(ö|oe)gensberatung|verm(ö|oe)gensberat|proviso|allfinanz/i;

  it('detects dvag keyword', () => {
    expect(dvagRegex.test('Check DVAG portal')).toBe(true);
    expect(dvagRegex.test('Deutsche Vermögensberatung contract')).toBe(true);
    expect(dvagRegex.test('Deutsche Vermoegensberatung contract')).toBe(true);
    expect(dvagRegex.test('Vermögensberater meeting')).toBe(true);
    expect(dvagRegex.test('Vermoegensberat notes')).toBe(true);
    expect(dvagRegex.test('Proviso system update')).toBe(true);
    expect(dvagRegex.test('Allfinanz review')).toBe(true);
  });

  it('does not match safe text', () => {
    expect(dvagRegex.test('Check the financial report')).toBe(false);
    expect(dvagRegex.test('Meeting notes for client')).toBe(false);
  });
});
