import { describe, expect, it } from 'vitest';

import {
  buildRollbackCsv,
  isRebasketTouchRow,
  needsNormalisation,
} from '@/lib/dabos/comm-center/rollback-export';

describe('rollback CSV', () => {
  it('hashes deterministically', () => {
    const rows = [
      {
        id: '11111111-1111-1111-1111-111111111111',
        basket: 'in',
        status: 'reassess',
        assigned_agent: null,
        division_id: 'Div1',
        department_id: 'Dept1',
        ingest_meta: {},
      },
    ];
    const a = buildRollbackCsv(rows);
    const b = buildRollbackCsv(rows);
    expect(a.sha256).toBe(b.sha256);
    expect(a.count).toBe(1);
    expect(a.csv).toContain('reassess');
  });

  it('flags div4 for normalisation', () => {
    expect(
      needsNormalisation({
        assigned_agent: null,
        division_id: 'div4',
        department_id: 'Dept12',
      })
    ).toBe(true);
  });

  it('flags in+reassess for rebasket', () => {
    expect(isRebasketTouchRow({ basket: 'in', status: 'reassess' })).toBe(true);
    expect(isRebasketTouchRow({ basket: 'in', status: 'doing' })).toBe(false);
  });
});
