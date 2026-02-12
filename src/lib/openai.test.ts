import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { testOpenAIConnection } from './openai';

const mockFetch = vi.fn();

describe('testOpenAIConnection', () => {
  const originalEnv = process.env.OPENAI_API_KEY;

  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [{ message: { content: 'Connected. Executive Concierge is ready.' } }],
        }),
    } as Response);
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    process.env.OPENAI_API_KEY = originalEnv;
    vi.unstubAllGlobals();
  });

  it('returns error when OPENAI_API_KEY is not set', async () => {
    delete process.env.OPENAI_API_KEY;
    const result = await testOpenAIConnection();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('OPENAI_API_KEY');
    }
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns success with text when API responds OK', async () => {
    process.env.OPENAI_API_KEY = 'sk-test';
    const result = await testOpenAIConnection();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.text).toContain('Connected');
    }
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.openai.com/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer sk-test',
        }),
      })
    );
  });

  it('returns error when API responds with non-OK status', async () => {
    process.env.OPENAI_API_KEY = 'sk-test';
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: () => Promise.resolve('Invalid API key'),
    } as Response);

    const result = await testOpenAIConnection();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('401');
    }
  });

  it('returns error when fetch throws', async () => {
    process.env.OPENAI_API_KEY = 'sk-test';
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const result = await testOpenAIConnection();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('Network error');
    }
  });
});
