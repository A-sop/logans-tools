/**
 * Google Business Profile monthly performance → Dept4 presence stats.
 *
 * Credit: Dept4 (Promotion). The 2026-08-09 KEEP ruling names Dept4 as the hat
 * on businessprofile-noreply@google.com and Dept6 as the secondary line.
 * Dept6 is recorded in provenance. It does not own the number.
 */
import type { DabosSql } from '@/lib/dabos/dabos-connection';
import { emitStat } from '@/lib/dabos/stats-emit';

export const GBP_DIVISION_ID = 'Div2';
export const GBP_CREDIT_DEPARTMENT_ID = 'Dept4';
export const GBP_SECONDARY_HAT = 'Dept6';
export const GBP_RECORDED_BY = 'dept04-gbp-presence';

const MONTHS: Record<string, number> = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
};

export type GbpListingId = 'gfp' | 'dvag-advisor';

export type GbpRawMessage = {
  date: string;
  subject: string;
  text: string;
};

export type GbpListingReport = {
  listingId: GbpListingId;
  listingName: string;
  period: string;
  year: number;
  month: number;
  interactions: number;
  calls: number;
  chatClicks: number;
  websiteVisits: number;
  profileViews: number;
  viewsDeltaPct: number | null;
  emailDate: string;
};

export type GbpMonthRollup = {
  period: string;
  year: number;
  month: number;
  profileViews: number;
  interactions: number;
  recordedAt: string;
  listings: GbpListingReport[];
};

function listingFromSubject(subject: string): { id: GbpListingId; name: string } | null {
  const name = subject.split(/,\s*your performance report/i)[0]?.trim();
  if (!name) return null;
  if (/german financial planning/i.test(subject)) return { id: 'gfp', name };
  if (/verm[oö]gensberater/i.test(subject)) return { id: 'dvag-advisor', name };
  return null;
}

function periodFromSubject(subject: string): { year: number; month: number; period: string } | null {
  const match = subject.match(/performance report for\s+([A-Za-z]+)\s+(\d{4})/i);
  if (!match) return null;
  const month = MONTHS[match[1].toLowerCase()];
  const year = Number(match[2]);
  if (!month || !year) return null;
  return { year, month, period: `${year}-${String(month).padStart(2, '0')}` };
}

function firstInt(text: string, pattern: RegExp): number | null {
  const match = text.match(pattern);
  if (!match) return null;
  return Number(match[1]);
}

function glanceText(text: string): string {
  return text.split(/monthly performance report/i)[0] ?? text;
}

export function parseGbpReport(message: GbpRawMessage): GbpListingReport | null {
  const listing = listingFromSubject(message.subject);
  const period = periodFromSubject(message.subject);
  if (!listing || !period) return null;

  const glance = glanceText(message.text);
  const interactions = firstInt(glance, /:\s*(\d+)\s+interactions?\b/i);
  const calls = firstInt(glance, /(\d+)\s+calls?\b/i);
  const chatClicks = firstInt(glance, /(\d+)\s+chat clicks?\b/i);
  const websiteVisits = firstInt(glance, /(\d+)\s+website visits?\s+from profile/i);
  const profileViews = firstInt(glance, /(\d+)\s+profile views\b/i);
  const delta = glance.match(/profile views\s+([+-]?\d+)%/i);

  if (
    interactions == null ||
    calls == null ||
    chatClicks == null ||
    websiteVisits == null ||
    profileViews == null
  ) {
    return null;
  }

  return {
    listingId: listing.id,
    listingName: listing.name,
    period: period.period,
    year: period.year,
    month: period.month,
    interactions,
    calls,
    chatClicks,
    websiteVisits,
    profileViews,
    viewsDeltaPct: delta ? Number(delta[1]) : null,
    emailDate: message.date,
  };
}

function laterIso(a: string, b: string): string {
  const aMs = Date.parse(a);
  const bMs = Date.parse(b);
  if (Number.isNaN(aMs)) return b;
  if (Number.isNaN(bMs)) return a;
  return aMs >= bMs ? a : b;
}

export function rollupGbpMonths(reports: GbpListingReport[]): GbpMonthRollup[] {
  const byPeriod = new Map<string, GbpListingReport[]>();
  for (const report of reports) {
    const rows = byPeriod.get(report.period) ?? [];
    rows.push(report);
    byPeriod.set(report.period, rows);
  }

  return [...byPeriod.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, listings]) => {
      const unique = new Map<GbpListingId, GbpListingReport>();
      for (const listing of listings) unique.set(listing.listingId, listing);
      const rows = [...unique.values()];
      return {
        period,
        year: rows[0].year,
        month: rows[0].month,
        profileViews: rows.reduce((sum, row) => sum + row.profileViews, 0),
        interactions: rows.reduce((sum, row) => sum + row.interactions, 0),
        recordedAt: rows.reduce((latest, row) => laterIso(latest, row.emailDate), rows[0].emailDate),
        listings: rows,
      };
    });
}

function basisFor(month: GbpMonthRollup): Record<string, unknown> {
  return {
    credit: GBP_CREDIT_DEPARTMENT_ID,
    secondary_hat: GBP_SECONDARY_HAT,
    lane: 'kpi-presence',
    source: 'gmail:businessprofile-noreply@google.com',
    note: 'Profile views are the presence stat. An interaction is a call, booking, website click, or directions request. Both listings are summed; the split is in listings.',
    period: month.period,
    listings: month.listings.map((listing) => ({
      id: listing.listingId,
      name: listing.listingName,
      profile_views: listing.profileViews,
      views_delta_pct: listing.viewsDeltaPct,
      interactions: listing.interactions,
      calls: listing.calls,
      chat_clicks: listing.chatClicks,
      website_visits: listing.websiteVisits,
      email_date: listing.emailDate,
    })),
  };
}

export async function postGbpPresenceStats(
  dabosSql: DabosSql,
  reports: GbpListingReport[]
): Promise<{ inserted: string[]; months: GbpMonthRollup[] }> {
  const months = rollupGbpMonths(reports);
  const inserted: string[] = [];

  for (const month of months) {
    const workspaceId = `gbp-presence-${month.period}`;
    const basis = basisFor(month);
    const rows = [
      { metricKey: 'gbp_profile_views', value: month.profileViews },
      { metricKey: 'gbp_interactions', value: month.interactions },
    ];
    for (const row of rows) {
      const result = await emitStat(dabosSql, {
        workspaceId,
        divisionId: GBP_DIVISION_ID,
        departmentId: GBP_CREDIT_DEPARTMENT_ID,
        metricKey: row.metricKey,
        value: row.value,
        recordedAt: month.recordedAt,
        basis,
        recordedBy: GBP_RECORDED_BY,
        mode: 'insert_if_absent',
      });
      if (result.inserted) inserted.push(`${workspaceId}:${row.metricKey}`);
    }
  }

  return { inserted, months };
}
