import { describe, expect, it } from 'vitest';

import { reportDivisionConditions, TO_REPORT } from '@/lib/dabos/week-close-conditions';

const DIVS = ['Div1', 'Div2', 'Div3', 'Div4', 'Div5', 'Div6', 'Div7'];

describe('reportDivisionConditions (week-close reports, never assigns)', () => {
  it('reports to-report for every division when only computed / seed rows exist', () => {
    const rows = DIVS.map((id) => ({
      entity_id: id,
      working_condition: 'Non-Existence',
      condition_source: 'computed',
    }));
    const out = reportDivisionConditions(DIVS, rows);
    expect(out).toHaveLength(7);
    expect(out.every((r) => r.condition === TO_REPORT && r.source === TO_REPORT)).toBe(true);
    expect(out.some((r) => r.condition === 'Non-Existence')).toBe(false);
  });

  it('reports to-report when a division has no condition row at all', () => {
    expect(reportDivisionConditions(['Div4'], [])).toEqual([
      { entity_id: 'Div4', condition: TO_REPORT, source: TO_REPORT, ruling_date: null, ruling_ref: null },
    ]);
  });

  it('uses the recorded founder ruling / formula condition per division', () => {
    const out = reportDivisionConditions(['Div1', 'Div4', 'Div5'], [
      {
        entity_id: 'Div1',
        working_condition: 'Confusion',
        condition_source: 'founder_ruling',
        ruling_date: '2026-10-21',
        ruling_ref: 'synthetic-ref-1',
      },
      { entity_id: 'Div4', working_condition: 'Danger', condition_source: 'formula' },
      { entity_id: 'Div5', working_condition: 'Normal', condition_source: 'computed' },
    ]);
    expect(out[0]).toMatchObject({ entity_id: 'Div1', condition: 'Confusion', source: 'founder_ruling', ruling_ref: 'synthetic-ref-1' });
    expect(out[1]).toMatchObject({ entity_id: 'Div4', condition: 'Danger', source: 'formula' });
    expect(out[2]).toMatchObject({ entity_id: 'Div5', condition: TO_REPORT, source: TO_REPORT });
  });

  it('a founder_ruling row with an empty condition is still to-report', () => {
    const out = reportDivisionConditions(['Div2'], [
      { entity_id: 'Div2', working_condition: '  ', condition_source: 'founder_ruling' },
    ]);
    expect(out[0]!.condition).toBe(TO_REPORT);
  });
});