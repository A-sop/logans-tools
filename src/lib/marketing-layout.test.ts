import { describe, expect, it } from 'vitest';

import { shouldUseMarketingLayout } from '@/lib/marketing-layout';

describe('shouldUseMarketingLayout', () => {
  it('uses marketing layout on dabos subdomain', () => {
    expect(shouldUseMarketingLayout('dabos.logans.tools', '/', false)).toBe(true);
    expect(shouldUseMarketingLayout('dabos.logans.tools:443', '/divisions/Div1', false)).toBe(
      true
    );
  });

  it('uses marketing layout on dabos and expat paths', () => {
    expect(shouldUseMarketingLayout('logans.tools', '/dabos', false)).toBe(true);
    expect(shouldUseMarketingLayout('logans.tools', '/dabos/tasks/1', false)).toBe(true);
    expect(shouldUseMarketingLayout('logans.tools', '/expat', false)).toBe(true);
  });

  it('uses app shell on apex homepage', () => {
    expect(shouldUseMarketingLayout('logans.tools', '/', false)).toBe(false);
  });

  it('honours middleware flag', () => {
    expect(shouldUseMarketingLayout('logans.tools', '/', true)).toBe(true);
  });
});
