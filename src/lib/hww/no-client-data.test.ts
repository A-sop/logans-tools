import { describe, expect, it } from 'vitest';
import { assertNoClientData } from './no-client-data';

describe('assertNoClientData', () => {
  it('allows normal HWW summary shape', () => {
    const r = assertNoClientData({
      health: { latest_weight_kg: 120 },
      wealth: { net_worth_eur: 1 },
      wisdom: { weeks: [] },
      source_file: 'renpho/measurements.csv',
    });
    expect(r.ok).toBe(true);
  });

  it('rejects AF_Kunden paths', () => {
    const r = assertNoClientData({ source_file: 'C:\\Dropbox\\AF_Kunden\\x.pdf' });
    expect(r.ok).toBe(false);
  });

  it('rejects client_name keys', () => {
    const r = assertNoClientData({ client_name: 'Someone' });
    expect(r.ok).toBe(false);
  });
});
