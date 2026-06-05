import Link from 'next/link';

import {
  DIVISION_BAND_TITLE,
  deptBridgeLabel,
  deptNumberLabel,
  deptRoleLabel,
  divisionSecretaryLabel,
  type BoardDivisionId,
} from '@/lib/dabos/org-board-config';
import type { BoardChartPoint } from '@/lib/dabos/board-charts';
import type { BoardStatSnapshot } from '@/lib/dabos/condition-display';
import type { ConditionLabel } from '@/lib/dabos/types';

import { DivisionSparkline } from './division-sparkline';
import { ConditionHoverSurface } from './condition-hover-surface';
import './org-board.css';

export type OrgBoardDepartment = {
  id: string;
  legacy_name: string;
  operational_name: string;
  policy_text: string | null;
  condition: ConditionLabel | null;
  stat: BoardStatSnapshot | null;
};

type DivisionColumnProps = {
  divisionId: BoardDivisionId;
  operationalName: string;
  description: string | null;
  condition: ConditionLabel | null;
  stat: BoardStatSnapshot | null;
  metricKey?: string;
  chartPoints?: BoardChartPoint[];
  departments: OrgBoardDepartment[];
  single?: boolean;
  edgeClass?: string;
};

function deptColumnTitle(dept: OrgBoardDepartment, short = false): string {
  if (short) {
    return deptRoleLabel(dept);
  }
  return `${deptNumberLabel(dept.id)} — ${deptRoleLabel(dept)}`;
}

function DepartmentBridgeCell({
  divisionId,
  dept,
  linked,
}: {
  divisionId: BoardDivisionId;
  dept: OrgBoardDepartment;
  linked: boolean;
}) {
  return (
    <ConditionHoverSurface
      condition={dept.condition}
      stat={dept.stat}
      className="dabos-org-board__dept-cell"
      href={linked ? `/dabos/divisions/${divisionId}/dept/${dept.id}` : undefined}
    >
      <span className="dabos-org-board__dept-bridge">{deptBridgeLabel(dept)}</span>
    </ConditionHoverSurface>
  );
}

function DepartmentNumCell({
  divisionId,
  dept,
  linked,
  shortLabel,
}: {
  divisionId: BoardDivisionId;
  dept: OrgBoardDepartment;
  linked: boolean;
  shortLabel: boolean;
}) {
  return (
    <ConditionHoverSurface
      condition={dept.condition}
      stat={dept.stat}
      className="dabos-org-board__dept-cell"
      href={linked ? `/dabos/divisions/${divisionId}/dept/${dept.id}` : undefined}
    >
      <span className="dabos-org-board__dept-num">
        {deptNumberLabel(dept.id, { short: shortLabel })}
      </span>
    </ConditionHoverSurface>
  );
}

function DepartmentTitleCell({
  divisionId,
  dept,
  linked,
  shortLabel,
}: {
  divisionId: BoardDivisionId;
  dept: OrgBoardDepartment;
  linked: boolean;
  shortLabel: boolean;
}) {
  const className = 'dabos-org-board__dept-cell dabos-org-board__dept-cell--title';
  const title = (
    <span className="dabos-org-board__dept-title">{deptColumnTitle(dept, shortLabel)}</span>
  );

  if (linked) {
    return (
      <Link href={`/dabos/divisions/${divisionId}/dept/${dept.id}`} className={className}>
        {title}
      </Link>
    );
  }

  return <div className={className}>{title}</div>;
}

function DepartmentBody({
  divisionId,
  dept,
  linked,
}: {
  divisionId: BoardDivisionId;
  dept: OrgBoardDepartment;
  linked: boolean;
}) {
  const policy = dept.policy_text?.trim();
  const title = deptColumnTitle(dept, false);

  return (
    <ConditionHoverSurface
      condition={dept.condition}
      stat={dept.stat}
      className={`dabos-org-board__dept-block${linked ? ' dabos-org-board__dept-block--link' : ''}`}
      href={linked ? `/dabos/divisions/${divisionId}/dept/${dept.id}` : undefined}
    >
      <div className="dabos-org-board__dept-block-title">{title}</div>
      {policy ? <p>{policy}</p> : null}
    </ConditionHoverSurface>
  );
}

export function DivisionColumn({
  divisionId,
  operationalName,
  description,
  condition,
  stat,
  metricKey = 'tasks_completed',
  chartPoints = [],
  departments,
  single = false,
  edgeClass,
}: DivisionColumnProps) {
  const bandTitle = DIVISION_BAND_TITLE[divisionId];
  const purpose = description?.trim();
  const linked = !single;

  const head = (
    <div className="dabos-org-board__column-head">
      <div className="dabos-org-board__secretary-label">
        {divisionSecretaryLabel(operationalName)}
      </div>
      <div className="dabos-org-board__division-title">{bandTitle}</div>
      <div className="dabos-org-board__division-subtitle">
        {divisionBandSubtitle(operationalName)}
      </div>
    </div>
  );

  const purposeBlock = purpose ? (
    linked ? (
      <Link
        href={`/dabos/divisions/${divisionId}`}
        className="dabos-org-board__purpose dabos-org-board__purpose--link"
      >
        {purpose}
      </Link>
    ) : (
      <p className="dabos-org-board__purpose">{purpose}</p>
    )
  ) : null;

  const bodyContent = single ? (
    <>
      {purposeBlock}
      {departments.map((dept) => (
        <DepartmentBody
          key={dept.id}
          divisionId={divisionId}
          dept={dept}
          linked={linked}
        />
      ))}
    </>
  ) : null;

  const purposeRow = !single ? (
    <div className="dabos-org-board__purpose-row">
      {purposeBlock ?? (
        <p className="dabos-org-board__purpose dabos-org-board__purpose--placeholder" aria-hidden="true">
          &nbsp;
        </p>
      )}
    </div>
  ) : null;

  const chartRow = !single ? (
    <div className="dabos-org-board__chart-row">
      <DivisionSparkline
        points={chartPoints}
        metricKey={metricKey}
        divisionLabel={bandTitle}
      />
    </div>
  ) : null;

  const bridgeRow = (
    <div className="dabos-org-board__dept-bridge-row">
      {departments.map((dept) => (
        <DepartmentBridgeCell
          key={dept.id}
          divisionId={divisionId}
          dept={dept}
          linked={linked}
        />
      ))}
    </div>
  );

  const numRow = (
    <div className="dabos-org-board__dept-num-row">
      {departments.map((dept) => (
        <DepartmentNumCell
          key={dept.id}
          divisionId={divisionId}
          dept={dept}
          linked={linked}
          shortLabel={!single}
        />
      ))}
    </div>
  );

  const titleRow = (
    <div className="dabos-org-board__dept-title-row">
      {departments.map((dept) => (
        <DepartmentTitleCell
          key={dept.id}
          divisionId={divisionId}
          dept={dept}
          linked={linked}
          shortLabel={!single}
        />
      ))}
    </div>
  );

  if (single) {
    return (
      <article className="dabos-org-board__column dabos-org-board__column--single">
        <ConditionHoverSurface condition={condition} stat={stat}>
          {head}
        </ConditionHoverSurface>
        {bridgeRow}
        {numRow}
        <div className="dabos-org-board__body">{bodyContent}</div>
      </article>
    );
  }

  return (
    <article className={['dabos-org-board__column', edgeClass].filter(Boolean).join(' ')}>
      <ConditionHoverSurface
        condition={condition}
        stat={stat}
        className="dabos-org-board__column-head-link block text-inherit no-underline"
        href={`/dabos/divisions/${divisionId}`}
      >
        {head}
      </ConditionHoverSurface>

      {numRow}
      {titleRow}
      {purposeRow}
      {chartRow}
    </article>
  );
}

function divisionBandSubtitle(operationalName: string): string {
  return operationalName.toUpperCase();
}
