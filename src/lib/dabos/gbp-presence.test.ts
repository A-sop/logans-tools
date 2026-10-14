import { describe, expect, it } from 'vitest';

import { parseGbpReport, rollupGbpMonths } from './gbp-presence';
import { statSourceDescription, statSourceLabel } from './stat-provenance';

const GFP_SEPTEMBER = {
  date: 'Fri, 09 Oct 2026 00:45:19 -0700',
  subject:
    'German Financial Planning - Logan D. Williams, your performance report for September 2026',
  text: 'Your business performance for September 2026: 0 interactions See full report Your performance at a glance 0 calls 0 chat clicks 0 website visits from profile 205 profile views -4% Monthly performance report 0 people viewed',
};

const ADVISOR_SEPTEMBER = {
  date: 'Fri, 09 Oct 2026 01:13:49 -0700',
  subject:
    'Logan D. Williams - Vermögensberater in Köln, your performance report for September 2026',
  text: 'Your business performance for September 2026: 1 interaction See full report Your performance at a glance 0 calls 0 chat clicks 1 website visit from profile 60 profile views -25% Monthly performance report',
};

describe('parseGbpReport', () => {
  it('reads the GFP glance line and ignores the later image caption', () => {
    const report = parseGbpReport(GFP_SEPTEMBER);
    expect(report).toMatchObject({
      listingId: 'gfp',
      period: '2026-09',
      interactions: 0,
      calls: 0,
      chatClicks: 0,
      websiteVisits: 0,
      profileViews: 205,
      viewsDeltaPct: -4,
    });
  });

  it('reads the advisor listing, including a singular interaction and website visit', () => {
    const report = parseGbpReport(ADVISOR_SEPTEMBER);
    expect(report).toMatchObject({
      listingId: 'dvag-advisor',
      period: '2026-09',
      interactions: 1,
      websiteVisits: 1,
      profileViews: 60,
      viewsDeltaPct: -25,
    });
  });
});

describe('rollupGbpMonths', () => {
  it('sums both listings onto one Dept4 month', () => {
    const reports = [parseGbpReport(GFP_SEPTEMBER), parseGbpReport(ADVISOR_SEPTEMBER)].filter(
      (row) => row != null
    );
    const [month] = rollupGbpMonths(reports);
    expect(month.profileViews).toBe(265);
    expect(month.interactions).toBe(1);
    expect(month.listings).toHaveLength(2);
    expect(Date.parse(month.recordedAt)).toBe(Date.parse(ADVISOR_SEPTEMBER.date));
  });
});

describe('gbp presence source label', () => {
  it('names Dept4 on the department stat row', () => {
    expect(statSourceLabel('gbp-presence-2026-09')).toBe(
      'Dept4 Google Business Profile (monthly email)'
    );
    expect(statSourceDescription('gbp-presence-2026-09')).toContain('Dept4');
  });
});
