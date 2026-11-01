import path from 'path';
import { describe, expect, it } from 'vitest';

import { resolveDiv1WikiRepoRoot } from '@/lib/dabos/division-weekly-stats';

describe('resolveDiv1WikiRepoRoot (Div1 wiki source root; RR-010 step 0)', () => {
  it('prefers DABOS_WIKI_REPO_ROOT', () => {
    expect(resolveDiv1WikiRepoRoot({ DABOS_WIKI_REPO_ROOT: '/home/x/Dev/DABOS-weekclose', DABOS_REPO_ROOT: '/mnt/mirror/Dev/DABOS' })).toBe(
      '/home/x/Dev/DABOS-weekclose'
    );
  });

  it('falls back to DABOS_REPO_ROOT when DABOS_WIKI_REPO_ROOT is unset or blank', () => {
    expect(resolveDiv1WikiRepoRoot({ DABOS_REPO_ROOT: '/mnt/mirror/Dev/DABOS' })).toBe('/mnt/mirror/Dev/DABOS');
    expect(resolveDiv1WikiRepoRoot({ DABOS_WIKI_REPO_ROOT: '   ', DABOS_REPO_ROOT: '/mnt/mirror/Dev/DABOS' })).toBe('/mnt/mirror/Dev/DABOS');
  });

  it('trims values', () => {
    expect(resolveDiv1WikiRepoRoot({ DABOS_WIKI_REPO_ROOT: '  /srv/dabos  ' })).toBe('/srv/dabos');
  });

  it('keeps the office default when neither is set', () => {
    expect(resolveDiv1WikiRepoRoot({})).toBe(path.join('C:', 'Dev', 'DABOS'));
  });
});
