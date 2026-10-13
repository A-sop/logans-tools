import { describe, expect, it, vi, beforeEach } from 'vitest';
import { POST } from './route';

// Mock the dependencies
vi.mock('@/lib/dabos/tier0-auth', () => ({
  authorizeTier0: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/lib/dabos/api-utils', () => ({
  requireDabosDb: vi.fn().mockReturnValue(true),
  dabosDbUnavailable: vi.fn(),
  jsonError: (msg: string, status = 400) => 
    new Response(JSON.stringify({ ok: false, error: msg }), { 
      status,
      headers: { 'Content-Type': 'application/json' }
    }),
}));

vi.mock('@/lib/dabos/db', () => ({
  getDabosSql: vi.fn(() => mockSql),
}));

const mockSql = vi.fn() as any;

vi.mock('@/lib/dabos/ingest', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/dabos/ingest')>();
  return {
    ...actual,
    ingestCapture: vi.fn().mockImplementation(async (_sql, input) => {
      // Mock implementation
      return {
        created: true,
        task_id: 'mock-task-id',
        short_id: 'mock123',
        basket: 'in' as const,
        department_id: 'Dept1',
        division_id: 'Div1',
        title: input.title || 'Capture',
        ack: 'Saved · task mock123 · text',
      };
    }),
  };
});

describe('POST /api/dabos/ingest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 422 when DVAG keyword is in text', async () => {
    const request = new Request('http://localhost/api/dabos/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mouth: 'telegram',
        external_id: 'tg-dvag-test',
        text: 'Check the DVAG portal for updates',
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(422);
    
    const data = await response.json();
    expect(data.error).toContain('DVAG keyword detected');
  });

  it('returns 422 when DVAG keyword is in URL', async () => {
    const request = new Request('http://localhost/api/dabos/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mouth: 'telegram',
        external_id: 'tg-url-test',
        text: 'Check this link',
        urls: ['https://proviso.example.com/dashboard'],
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(422);
    
    const data = await response.json();
    expect(data.error).toContain('DVAG keyword detected');
  });

  it('does not reject false positives', async () => {
    const request = new Request('http://localhost/api/dabos/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mouth: 'telegram',
        external_id: 'tg-safe',
        text: 'This is provisorisch and needs improvement',
      }),
    });

    const response = await POST(request);
    expect(response.status).not.toBe(422);
    expect(response.status).toBe(201);
  });

  it('returns 400 when only sha256 is provided', async () => {
    const request = new Request('http://localhost/api/dabos/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mouth: 'telegram',
        external_id: 'tg-partial',
        text: 'test',
        sha256: 'a'.repeat(64),
        // store_path missing
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
    
    const data = await response.json();
    expect(data.error).toContain('sha256 and store_path must be provided together');
  });

  it('returns 400 when only store_path is provided', async () => {
    const request = new Request('http://localhost/api/dabos/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mouth: 'telegram',
        external_id: 'tg-partial-2',
        text: 'test',
        store_path: 'docs/test.md',
        // sha256 missing
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
    
    const data = await response.json();
    expect(data.error).toContain('sha256 and store_path must be provided together');
  });

  it('accepts uppercase sha256 and normalizes it', async () => {
    const request = new Request('http://localhost/api/dabos/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mouth: 'telegram',
        external_id: 'tg-upper',
        text: 'test',
        title: 'Test',
        sha256: 'ABCDEF' + '0'.repeat(58),
        store_path: 'docs/test.md',
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(201);
    
    const data = await response.json();
    expect(data.ok).toBe(true);
  });

  it('accepts valid pointer payload', async () => {
    const request = new Request('http://localhost/api/dabos/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mouth: 'telegram',
        external_id: 'tg-pointer',
        text: 'Some text',
        title: 'Pointer Test',
        sha256: 'a'.repeat(64),
        store_path: 'docs/wiki/inbox/test.md',
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(201);
    
    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.created).toBe(true);
  });

  it('accepts valid legacy payload', async () => {
    const request = new Request('http://localhost/api/dabos/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mouth: 'slack',
        external_id: 'slack-123',
        text: 'Legacy capture',
        urls: ['https://example.com'],
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(201);
    
    const data = await response.json();
    expect(data.ok).toBe(true);
  });

  it('returns 422 when DVAG keyword is in title', async () => {
    const request = new Request('http://localhost/api/dabos/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mouth: 'telegram',
        external_id: 'tg-title-test',
        text: 'Some safe text',
        title: 'Meeting with DVAG representatives',
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(422);
    
    const data = await response.json();
    expect(data.error).toContain('DVAG keyword detected');
  });

  it('returns 422 when DVAG keyword is in store_path (pointer mode)', async () => {
    const request = new Request('http://localhost/api/dabos/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mouth: 'telegram',
        external_id: 'tg-storepath-test',
        text: 'Some text',
        title: 'Safe title',
        sha256: 'a'.repeat(64),
        store_path: 'docs/clients/proviso-contract-2026.md',
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(422);
    
    const data = await response.json();
    expect(data.error).toContain('DVAG keyword detected');
  });

  it('returns 422 when DVAG keyword is in wiki_bundle', async () => {
    const request = new Request('http://localhost/api/dabos/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mouth: 'telegram',
        external_id: 'tg-wiki-test',
        text: 'Some text',
        wiki_bundle: 'allfinanz-docs.zip',
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(422);
    
    const data = await response.json();
    expect(data.error).toContain('DVAG keyword detected');
  });

  it('returns 422 when DVAG keyword is in attachments', async () => {
    const request = new Request('http://localhost/api/dabos/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mouth: 'telegram',
        external_id: 'tg-attachment-test',
        text: 'Some text',
        attachments: ['meeting-notes.pdf', 'dvag-contract.pdf', 'report.xlsx'],
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(422);
    
    const data = await response.json();
    expect(data.error).toContain('DVAG keyword detected');
  });

  it('returns 422 when DVAG keyword matches Vermögensberater in title', async () => {
    const request = new Request('http://localhost/api/dabos/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mouth: 'telegram',
        external_id: 'tg-vermoegen-test',
        text: 'Safe text',
        title: 'Call with Vermögensberater Schmidt',
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(422);
    
    const data = await response.json();
    expect(data.error).toContain('DVAG keyword detected');
  });

  it('returns 422 when DVAG keyword is Deutsche Vermögensberatung in wiki_bundle', async () => {
    const request = new Request('http://localhost/api/dabos/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mouth: 'telegram',
        external_id: 'tg-deutsche-test',
        text: 'Safe text',
        wiki_bundle: 'Deutsche Vermögensberatung-files.zip',
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(422);
    
    const data = await response.json();
    expect(data.error).toContain('DVAG keyword detected');
  });
});
