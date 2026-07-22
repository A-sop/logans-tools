import Link from 'next/link';
import { Suspense } from 'react';

import { BoardCadenceStrip } from '@/components/dabos/dabos-chrome';

import { estoRound1ProgressFromDepartments } from '@/lib/dabos/esto-round1-status';
import type { BoardChartPeriod, BoardChartPoint } from '@/lib/dabos/board-charts';
import {
  BOARD_PAGE_SUBTITLE,
  BOARD_PAGE_TITLE,
  DCO_DIVISION_IDS,
  EXECUTIVE_HREFS,
  EXECUTIVE_LABELS,
  ORG_DIVISION_IDS,
  type BoardDivisionId,
} from '@/lib/dabos/org-board-config';
import type { BoardStatSnapshot } from '@/lib/dabos/condition-display';
import type { WorkingNowEntry } from '@/lib/dabos/server-data';
import type { ConditionLabel } from '@/lib/dabos/types';

import { DivisionColumn, type OrgBoardDepartment } from './division-column';
import { OrgBoardPeriodToggles } from './org-board-period-toggles';
import { ExecutiveBox, OrgBoardWeekSlider } from './org-board-week-slider';
import { WorkingNowStrip } from './working-now-strip';
import './org-board.css';

export type OrgBoardExecutive = {
  condition: ConditionLabel | null;
  last_run?: string | null;
};

export type OrgBoardCadence = {
  open_tasks_total: number;
  divisions_with_work: number;
  departments_working?: number;
  working_now?: WorkingNowEntry[];
};

export type OrgBoardDivision = {
  id: string;
  operational_name: string;
  description: string | null;
  condition: ConditionLabel | null;
  statIndicated?: ConditionLabel | null;
  climbLag?: boolean;
  stat: BoardStatSnapshot | null;
  metric_key: string;
  chart_points: BoardChartPoint[];
  departments: OrgBoardDepartment[];
};

type OrgBoardProps = {
  divisions: OrgBoardDivision[];
  week: { year: number; calendarWeek: number; label: string };
  period: BoardChartPeriod;
  executive: {
    director: OrgBoardExecutive;
    dco: OrgBoardExecutive;
    org: OrgBoardExecutive;
    week_close_at?: string | null;
  };
  cadence?: OrgBoardCadence;
  maxWeek: number;
};

function DivisionsGrid({ byId }: { byId: Map<string, OrgBoardDivision> }) {
  const renderColumn = (id: BoardDivisionId) => {
    const div = byId.get(id);
    if (!div) return null;
    return (
      <DivisionColumn
        key={id}
        divisionId={id}
        operationalName={div.operational_name}
        description={div.description}
        condition={div.condition}
        statIndicated={div.statIndicated}
        climbLag={div.climbLag}
        stat={div.stat}
        metricKey={div.metric_key}
        chartPoints={div.chart_points}
        departments={div.departments}
      />
    );
  };

  return (
    <div className="dabos-org-board__divisions-unified">
      <div className="dabos-org-board__divisions-sync">
        <div className="dabos-org-board__block dabos-org-board__block--dco">
          {DCO_DIVISION_IDS.map((id) => renderColumn(id))}
        </div>
        <div className="dabos-org-board__divisions-gap" aria-hidden />
        <div className="dabos-org-board__block dabos-org-board__block--org">
          {ORG_DIVISION_IDS.map((id) => renderColumn(id))}
        </div>
      </div>
    </div>
  );
}

export function OrgBoard({ divisions, week, period, executive, cadence, maxWeek }: OrgBoardProps) {
  const byId = new Map(divisions.map((d) => [d.id, d]));
  const allDepts = divisions.flatMap((d) => d.departments);
  const esto = estoRound1ProgressFromDepartments(allDepts);

  return (
    <div className="dabos-org-board">
      <div className="dabos-org-board__shell">
        <div className="dabos-org-board__page-header">
          <Link href="/dabos" className="dabos-org-board__page-title">
            {BOARD_PAGE_TITLE}
          </Link>
          <p className="dabos-org-board__page-subtitle">{BOARD_PAGE_SUBTITLE}</p>
        </div>

        <p className="dabos-org-board__esto-legend" aria-label="Establishment and activity legend">
          {esto.done >= esto.total ? (
            <span className="dabos-org-board__esto-legend-item">
              <span className="dabos-org-board__esto-swatch dabos-org-board__esto-swatch--done" />
              ESTO complete ({esto.done}/{esto.total})
            </span>
          ) : (
            <>
              <span className="dabos-org-board__esto-legend-item">
                <span className="dabos-org-board__esto-swatch dabos-org-board__esto-swatch--done" />
                ESTO riff done ({esto.done}/{esto.total})
              </span>
              <span className="dabos-org-board__esto-legend-item">
                <span className="dabos-org-board__esto-swatch dabos-org-board__esto-swatch--next" />
                Next: {esto.next ?? '—'}
              </span>
              <span className="dabos-org-board__esto-legend-item">
                <span className="dabos-org-board__esto-swatch dabos-org-board__esto-swatch--pending" />
                Not started
              </span>
            </>
          )}
          <span className="dabos-org-board__esto-legend-item">Hover: working condition</span>
          <span className="dabos-org-board__esto-legend-item">
            <span className="dabos-org-board__esto-swatch dabos-org-board__esto-swatch--working" />
            Purple = department executing (<code>doing</code>)
          </span>
        </p>

        {cadence ? (
          <BoardCadenceStrip
            openTasksTotal={cadence.open_tasks_total}
            divisionsActive={cadence.divisions_with_work}
            departmentsWorking={cadence.departments_working ?? cadence.working_now?.length ?? 0}
          />
        ) : null}

        <WorkingNowStrip workingNow={cadence?.working_now ?? []} />

        <div className="dabos-org-board__layout-grid">
          <div className="dabos-org-board__tree-spine">
            <ExecutiveBox
              href={EXECUTIVE_HREFS.director}
              label={EXECUTIVE_LABELS.director}
              condition={executive.director.condition}
              lastRun={executive.director.last_run}
              variant="director"
            />
            <div className="dabos-org-board__tree-connectors" aria-hidden>
              <span className="dabos-org-board__tree-stem" />
              <span className="dabos-org-board__tree-bar" />
              <span className="dabos-org-board__tree-drop dabos-org-board__tree-drop--dco" />
              <span className="dabos-org-board__tree-drop dabos-org-board__tree-drop--org" />
            </div>
          </div>

          <div className="dabos-org-board__secretary-slot dabos-org-board__secretary-slot--dco">
            <ExecutiveBox
              href={EXECUTIVE_HREFS.dcoSecretary}
              label={EXECUTIVE_LABELS.dcoSecretary}
              condition={executive.dco.condition}
            />
          </div>
          <div className="dabos-org-board__layout-gap" aria-hidden />
          <div className="dabos-org-board__secretary-slot dabos-org-board__secretary-slot--org">
            <ExecutiveBox
              href={EXECUTIVE_HREFS.orgSecretary}
              label={EXECUTIVE_LABELS.orgSecretary}
              condition={executive.org.condition}
              lastRun={executive.week_close_at}
              lastRunLabel="week close"
            />
          </div>

          <DivisionsGrid byId={byId} />
        </div>

        <Suspense fallback={null}>
          <OrgBoardPeriodToggles
            year={week.year}
            calendarWeek={week.calendarWeek}
            period={period}
          />
        </Suspense>

        <Suspense fallback={null}>
          <OrgBoardWeekSlider
            year={week.year}
            calendarWeek={week.calendarWeek}
            maxWeek={maxWeek}
          />
        </Suspense>
      </div>
    </div>
  );
}
