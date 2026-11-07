import { describe, expect, it, vi } from 'vitest';

import { ingestCapture } from '@/lib/dabos/ingest';

describe('ingestCapture PENDING P1', () => {
  it('refuses pending without reason/waiting_on', async () => {
    const mockSql = vi.fn() as unknown as ReturnType<typeof vi.fn>;
    mockSql.mockResolvedValueOnce([]); // existing
    await expect(
      ingestCapture(mockSql as never, {
        mouth: 'api',
        external_id: 'p1',
        text: 'task: hang',
        basket: 'pending',
      })
    ).rejects.toThrow(/pending\.reason|waiting_on/);
  });

  it('accepts pending with reason and waiting_on', async () => {
    const mockSql = vi.fn() as unknown as ReturnType<typeof vi.fn>;
    mockSql.mockResolvedValueOnce([]); // existing
    mockSql.mockResolvedValueOnce([{ id: 'Dept1', division_id: 'Div1' }]);
    mockSql.mockResolvedValueOnce([
      {
        id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        basket: 'pending',
        department_id: 'Dept1',
        division_id: 'Div1',
        title: 'hang',
      },
    ]);
    mockSql.mockResolvedValueOnce([]); // role_runs

    const result = await ingestCapture(mockSql as never, {
      mouth: 'api',
      external_id: 'p2',
      text: 'task: hang',
      basket: 'pending',
      pending: { reason: 'waiting', waiting_on: { kind: 'post', post: 'Div4' } },
    });
    expect(result.basket).toBe('pending');
    expect(result.created).toBe(true);
  });
});
