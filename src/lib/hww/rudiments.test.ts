import { describe, expect, it } from 'vitest';
import { parseRudimentsMarkdown, rudimentsSummaryFromDays } from './rudiments';

const SAMPLE = `
## Daily check

| Date | Slept enough | Eaten properly | Moved | Workspace usable | No untriaged upset/worry | Ruds in? (all yes) |
|------|--------------|----------------|-------|------------------|--------------------------|--------------------|
| 2026-11-10 | y | y | y | y | y | y |
| 2026-11-09 | y | y | n | y | y | n |
| | | | | | | |
`;

describe('parseRudimentsMarkdown', () => {
  it('parses dated rows and skips empty dates', () => {
    const days = parseRudimentsMarkdown(SAMPLE);
    expect(days).toHaveLength(2);
    expect(days[0]?.date).toBe('2026-11-10');
    expect(days[0]?.ruds_in).toBe(true);
    expect(days[1]?.ruds_in).toBe(false);
  });

  it('summarizes 7d in/out without ruin text', () => {
    const s = rudimentsSummaryFromDays(parseRudimentsMarkdown(SAMPLE), new Date('2026-11-10T12:00:00Z'));
    expect(s.today_status).toBe('in');
    expect(s.ruds_in_days_7d).toBe(1);
    expect(s.ruds_out_days_7d).toBe(1);
  });
});
