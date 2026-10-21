import { IBM_Plex_Mono, Source_Sans_3, Syne } from 'next/font/google';

import { OpenLoopsBoard } from './open-loops-board';
import { getOpenLoopsSnapshot } from '@/lib/dabos/open-loops';
import { getLiveOpenLoops } from '@/lib/dabos/open-loops-live';
import { getDabosSql } from '@/lib/dabos/db';
import type { OpenOrgDivision } from './open-loops-board';
import { dabosConfigured } from '@/lib/dabos/server-data';
import { evaluateBoardConditions } from '@/lib/dabos/queries';
import type { ConditionLabel } from '@/lib/dabos/types';
import { DEPT_ORDER } from '@/lib/dabos/open-loops';

export const metadata = {
  title: 'Open loops — DABOS',
  description: 'Chat backlog + ship board across founder desk lanes',
};

/** Need Neon for live working conditions on the drum. */
export const dynamic = 'force-dynamic';

const display = Syne({
  subsets: ['latin'],
  weight: ['700', '800'],
  variable: '--font-ol-display',
  display: 'swap',
});

const body = Source_Sans_3({
  subsets: ['latin'],
  weight: ['400', '600'],
  variable: '--font-ol-body',
  display: 'swap',
});

const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  variable: '--font-ol-mono',
  display: 'swap',
});

async function loadWorkingConditions(): Promise<Record<string, ConditionLabel | null>> {
  const workingConditions = Object.fromEntries(DEPT_ORDER.map((d) => [d, null])) as Record<
    string,
    ConditionLabel | null
  >;
  if (!dabosConfigured()) return workingConditions;
  try {
    const board = await evaluateBoardConditions();
    for (const dept of DEPT_ORDER) {
      const ev = board.departments.get(dept);
      workingConditions[dept] = ev?.working_condition ?? ev?.condition ?? null;
    }
    return workingConditions;
  } catch {
    return workingConditions;
  }
}

async function loadOrg(): Promise<OpenOrgDivision[]> {
  if (!dabosConfigured()) return [];
  try {
    const sql = getDabosSql();
    const divs = (await sql`SELECT id, operational_name FROM divisions ORDER BY id`) as { id: string; operational_name: string }[];
    const depts = (await sql`SELECT id, division_id, legacy_name, operational_name FROM departments ORDER BY (substring(id from 5))::int`) as { id: string; division_id: string; legacy_name: string; operational_name: string }[];
    return divs.map((d) => ({ ...d, departments: depts.filter((x) => x.division_id === d.id) }));
  } catch {
    return [];
  }
}

export default async function DabosOpenLoopsPage() {
  let data: Awaited<ReturnType<typeof getLiveOpenLoops>>;
  try {
    data = await getLiveOpenLoops();
  } catch {
    data = { ...getOpenLoopsSnapshot(), live: false };
  }
  const [workingConditions, org] = await Promise.all([loadWorkingConditions(), loadOrg()]);

  return (
    <main className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <OpenLoopsBoard data={data} live={data.live} org={org} workingConditions={workingConditions} />
    </main>
  );
}
