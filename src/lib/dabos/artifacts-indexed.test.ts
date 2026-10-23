import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { describe, expect, it } from 'vitest';

import { countArtifactsIndexed, countUniqueWikiPages } from '@/lib/dabos/artifacts-indexed';

const SAMPLE = [
  '# DABOS wiki index',
  '| Page | Kind | Summary |',
  '|------|------|---------|',
  '| [Capture](./entities\\capture.md) | entity | a |',
  '| [Capture](./entities/capture.md) | entity | dup, slash style |',
  '| [CAPTURE](./Entities\\Capture.md) | entity | dup, case |',
  '| [Telegram](./sources\\telegram.md) | source | |',
  '| [](./entities\\479.md) | entity | empty label still a page |',
  '- [Schema](./SCHEMA.md) - rules',
  '- [Inbox](./inbox/) - raw',
  '- [Ext](https://example.com/x.md) - external, skipped',
].join('\n');

describe('countUniqueWikiPages', () => {
  it('counts unique pages, not rows', () => {
    expect(countUniqueWikiPages(SAMPLE)).toEqual({ unique: 5, rows: 5 });
  });
});

describe('countArtifactsIndexed', () => {
  it('reads the index file', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'wiki-'));
    const p = path.join(dir, 'index.md');
    writeFileSync(p, SAMPLE);
    expect(countArtifactsIndexed(p)).toMatchObject({ total: 5, sourcesPresent: true });
  });
  it('reports missing source instead of emitting 0', () => {
    expect(countArtifactsIndexed(path.join(tmpdir(), 'nope', 'index.md')).sourcesPresent).toBe(false);
  });
});

describe('artifacts_indexed on a synthetic wiki index fixture', () => {
  // Synthetic only: no DABOS content in this public repo. The live count (232 at
  // DABOS 368cfd9e) is a documented manual recount, not a test.
  it('counts 9 unique pages from 9 table rows + 5 list links', () => {
    const fixture = path.join(__dirname, '__fixtures__', 'wiki-index-synthetic.md');
    expect(countArtifactsIndexed(fixture)).toMatchObject({ total: 9, rows: 9, sourcesPresent: true });
  });
});