import { describe, expect, it } from 'vitest';

import {
  estoRound1ProgressFromDepartments,
  getEstoRound1StatusFallback,
  resolveEstoRound1Status,
} from '@/lib/dabos/esto-round1-status';

describe('esto-round1-status', () => {
  it('uses Neon value when present', () => {
    expect(resolveEstoRound1Status('Dept21', 'done')).toBe('done');
  });

  it('falls back when Neon missing', () => {
    expect(resolveEstoRound1Status('Dept14', undefined)).toBe('done');
    expect(getEstoRound1StatusFallback('Dept15')).toBe('next');
    expect(getEstoRound1StatusFallback('Dept21')).toBe('pending');
  });

  it('summarizes from department rows', () => {
    const depts = Array.from({ length: 21 }, (_, i) => {
      const id = `Dept${i + 1}`;
      let esto_round1_status: 'done' | 'next' | 'pending' = 'pending';
      if (i < 14) esto_round1_status = 'done';
      if (i === 14) esto_round1_status = 'next';
      return { id, establishment: { esto_round1_status } };
    });
    const s = estoRound1ProgressFromDepartments(depts);
    expect(s.done).toBe(14);
    expect(s.total).toBe(21);
    expect(s.next).toBe('Dept15');
  });
});
