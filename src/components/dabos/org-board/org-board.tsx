import Link from 'next/link';
import { Suspense } from 'react';

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
import type { ConditionLabel } from '@/lib/dabos/types';

import { DivisionColumn, type OrgBoardDepartment } from './division-column';
import { OrgBoardPeriodToggles } from './org-board-period-toggles';
import { ExecutiveBox, OrgBoardWeekSlider } from './org-board-week-slider';
import './org-board.css';

export type OrgBoardExecutive = {
  condition: ConditionLabel | null;
};

export type OrgBoardDivision = {
  id: string;
  operational_name: string;
  description: string | null;
  condition: ConditionLabel | null;
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
  };
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

export function OrgBoard({ divisions, week, period, executive, maxWeek }: OrgBoardProps) {
  const byId = new Map(divisions.map((d) => [d.id, d]));

  return (
    <div className="dabos-org-board">
      <div className="dabos-org-board__shell">
        <div className="dabos-org-board__page-header">
          <Link href="/dabos" className="dabos-org-board__page-title">
            {BOARD_PAGE_TITLE}
          </Link>
          <p className="dabos-org-board__page-subtitle">{BOARD_PAGE_SUBTITLE}</p>
        </div>

        <div className="dabos-org-board__layout-grid">
          <div className="dabos-org-board__tree-spine">
            <ExecutiveBox
              href={EXECUTIVE_HREFS.director}
              label={EXECUTIVE_LABELS.director}
              condition={executive.director.condition}
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
