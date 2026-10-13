import { describe, expect, it, vi } from 'vitest';

import { DVAG_KEYWORD_REGEX, formatIngestAck, ingestCapture, parseIngestText } from '@/lib/dabos/ingest';

describe('parseIngestText', () => {
  it('strips dept tag and task prefix', () => {
    const r = parseIngestText('task: Dept8 GnuCash imbalance clear');
    expect(r.is_work).toBe(true);
    expect(r.is_agent).toBe(true);
    expect(r.department_id).toBe('Dept8');
    expect(r.title).toBe('GnuCash imbalance clear');
  });

  it('treats agent: as queued work', () => {
    const r = parseIngestText("agent: summarize this week's Dept1 IN");
    expect(r.is_agent).toBe(true);
    expect(r.title).toBe("summarize this week's Dept1 IN");
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
  it('detects dvag keyword', () => {
    expect(DVAG_KEYWORD_REGEX.test('Check DVAG portal')).toBe(true);
    expect(DVAG_KEYWORD_REGEX.test('Deutsche Vermögensberatung contract')).toBe(true);
    expect(DVAG_KEYWORD_REGEX.test('Deutsche Vermoegensberatung contract')).toBe(true);
    expect(DVAG_KEYWORD_REGEX.test('Vermögensberater meeting')).toBe(true);
    expect(DVAG_KEYWORD_REGEX.test('Vermoegensberat notes')).toBe(true);
    expect(DVAG_KEYWORD_REGEX.test('Proviso system update')).toBe(true);
    expect(DVAG_KEYWORD_REGEX.test('Allfinanz review')).toBe(true);
  });

  it('does not match safe text', () => {
    expect(DVAG_KEYWORD_REGEX.test('Check the financial report')).toBe(false);
    expect(DVAG_KEYWORD_REGEX.test('Meeting notes for client')).toBe(false);
  });

  it('does not match false positives with word boundaries', () => {
    expect(DVAG_KEYWORD_REGEX.test('provisorisch')).toBe(false);
    expect(DVAG_KEYWORD_REGEX.test('Provisorium')).toBe(false);
    expect(DVAG_KEYWORD_REGEX.test('improvisor')).toBe(false);
    expect(DVAG_KEYWORD_REGEX.test('improvisory')).toBe(false);
  });
});

describe('ingestCapture with mocked DB', () => {
  it('pointer mode creates task with no body or URLs in description', async () => {
    const mockSql = vi.fn() as any;
    
    // Mock existing check (no duplicate)
    mockSql.mockResolvedValueOnce([]);
    
    // Mock department lookup
    mockSql.mockResolvedValueOnce([{ id: 'Dept1', division_id: 'Div1' }]);
    
    // Mock INSERT returning new task
    mockSql.mockResolvedValueOnce([
      {
        id: 'abcd1234-5678',
        basket: 'in',
        department_id: 'Dept1',
        division_id: 'Div1',
        title: 'Test Capture',
      },
    ]);
    
    // Mock role_runs insert (optional, can fail)
    mockSql.mockResolvedValueOnce([]);

    const result = await ingestCapture(mockSql, {
      mouth: 'telegram',
      external_id: 'tg-12345',
      text: 'This body text should not appear in description',
      urls: ['https://example.com'],
      title: 'Test Capture',
      sha256: 'a'.repeat(64),
      store_path: 'docs/wiki/inbox/2026-10-13-test.md',
    });

    expect(result.created).toBe(true);
    expect(result.short_id).toBe('abcd1234');

    // Check the INSERT call (third call: 0=existing check, 1=dept lookup, 2=insert, 3=role_runs)
    expect(mockSql).toHaveBeenCalledTimes(4);
    const insertCall = mockSql.mock.calls[2];
    
    // Tagged template: first arg is strings array, rest are values
    // The values are: workspace_id, division_id, department_id, title, description, type, status, priority, assigned_to, assigned_agent, basket, ingest_source, external_id, ingest_meta
    const title = insertCall[4];
    const description = insertCall[5];
    const metaJson = insertCall[14];
    
    expect(title).toBe('Test Capture');
    expect(description).toContain('Pointer: docs/wiki/inbox/2026-10-13-test.md');
    expect(description).toContain('sha256: ' + 'a'.repeat(64));
    expect(description).toContain('IN: telegram · tg-12345');
    expect(description).not.toContain('This body text');
    expect(description).not.toContain('https://example.com');
    
    const meta = JSON.parse(metaJson);
    expect(meta.pointer).toBe(true);
    expect(meta.sha256).toBe('a'.repeat(64));
    expect(meta.store_path).toBe('docs/wiki/inbox/2026-10-13-test.md');
    expect(meta.urls).toBeUndefined();
    expect(meta.attachments).toBeUndefined();
  });

  it('legacy mode includes body and URLs in description', async () => {
    const mockSql = vi.fn() as any;
    
    // Mock existing check (no duplicate)
    mockSql.mockResolvedValueOnce([]);
    
    // Mock department lookup
    mockSql.mockResolvedValueOnce([{ id: 'Dept1', division_id: 'Div1' }]);
    
    // Mock INSERT
    mockSql.mockResolvedValueOnce([
      {
        id: 'xyz-456',
        basket: 'in',
        department_id: 'Dept1',
        division_id: 'Div1',
        title: 'Legacy capture',
      },
    ]);
    
    // Mock role_runs
    mockSql.mockResolvedValueOnce([]);

    const result = await ingestCapture(mockSql, {
      mouth: 'slack',
      external_id: 'slack-999',
      text: 'Some body text',
      urls: ['https://example.com'],
    });

    expect(result.created).toBe(true);

    // Check INSERT call
    const insertCall = mockSql.mock.calls[2];
    const description = insertCall[5];
    const metaJson = insertCall[14];
    
    expect(description).toContain('Some body text');
    expect(description).toContain('URLs:');
    expect(description).toContain('https://example.com');
    
    const meta = JSON.parse(metaJson);
    expect(meta.pointer).toBeUndefined();
    expect(meta.urls).toEqual(['https://example.com']);
  });

  it('returns existing task on duplicate external_id (idempotency)', async () => {
    const mockSql = vi.fn() as any;
    
    // Mock existing task found
    mockSql.mockResolvedValueOnce([
      {
        id: 'existing-id-789',
        basket: 'pending',
        department_id: 'Dept2',
        division_id: 'Div1',
        title: 'Existing Task',
      },
    ]);

    const result = await ingestCapture(mockSql, {
      mouth: 'telegram',
      external_id: 'tg-duplicate',
      text: 'New text that should be ignored',
    });

    expect(result.created).toBe(false);
    expect(result.task_id).toBe('existing-id-789');
    expect(result.short_id).toBe('existing');
    expect(result.basket).toBe('pending');
    expect(result.title).toBe('Existing Task');

    // Only the SELECT should have been called
    expect(mockSql).toHaveBeenCalledTimes(1);
  });

  it('normalizes uppercase sha256 to lowercase', async () => {
    const mockSql = vi.fn() as any;
    
    mockSql.mockResolvedValueOnce([]); // existing check
    mockSql.mockResolvedValueOnce([{ id: 'Dept1', division_id: 'Div1' }]);
    mockSql.mockResolvedValueOnce([
      {
        id: 'test-id',
        basket: 'in',
        department_id: 'Dept1',
        division_id: 'Div1',
        title: 'Test',
      },
    ]);
    mockSql.mockResolvedValueOnce([]);

    await ingestCapture(mockSql, {
      mouth: 'telegram',
      external_id: 'tg-upper',
      text: 'test',
      title: 'Test',
      sha256: 'ABCDEF' + '0'.repeat(58), // Uppercase passed to ingestCapture
      store_path: 'test.md',
    });

    const insertCall = mockSql.mock.calls[2];
    const metaJson = insertCall[14];
    const meta = JSON.parse(metaJson);
    
    // Should be lowercase in meta
    expect(meta.sha256).toBe('abcdef' + '0'.repeat(58));
  });
});
