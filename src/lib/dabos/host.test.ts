import { describe, expect, it } from 'vitest';

import {
  dabosSubdomainPath,
  isDabosAppPath,
  isDabosHost,
  isLogansToolsApexHost,
} from '@/lib/dabos/host';

describe('dabos host helpers', () => {
  it('detects dabos subdomain hosts', () => {
    expect(isDabosHost('dabos.logans.tools')).toBe(true);
    expect(isDabosHost('dabos.logans.tools:443')).toBe(true);
    expect(isDabosHost('logans.tools')).toBe(false);
  });

  it('maps dabos app paths to subdomain paths', () => {
    expect(dabosSubdomainPath('/dabos')).toBe('/');
    expect(dabosSubdomainPath('/dabos/divisions/Div1')).toBe('/divisions/Div1');
  });

  it('recognizes dabos routes and apex host', () => {
    expect(isDabosAppPath('/dabos')).toBe(true);
    expect(isDabosAppPath('/dabos/tasks/abc')).toBe(true);
    expect(isDabosAppPath('/')).toBe(false);
    expect(isLogansToolsApexHost('logans.tools')).toBe(true);
    expect(isLogansToolsApexHost('dabos.logans.tools')).toBe(false);
  });
});
