import Link from 'next/link';

import {
  DIVISION_BAND_TITLE,
  deptBridgeLabel,
  deptNumberLabel,
  deptRoleLabel,
  divisionSecretaryLabel,
  type BoardDivisionId,
} from '@/lib/dabos/org-board-config';
import { dabosDeptHref } from '@/lib/dabos/dabos-paths';
import type { BoardChartPoint } from '@/lib/dabos/board-charts';
import type { BoardStatSnapshot } from '@/lib/dabos/condition-display';
import type { DeptEstablishment } from '@/lib/dabos/establishment';
import {
  estoRound1ProgressFromDepartments,
  estoRound1StatusClass,
  estoRound1StatusLabel,
  resolveEstoRound1Status,
} from '@/lib/dabos/esto-round1-status';
import type { ConditionLabel } from '@/lib/dabos/types';

import { DivisionSparkline } from './division-sparkline';
import { ConditionHoverSurface } from './condition-hover-surface';
import { EstablishmentStrip } from './establishment-strip';
import './org-board.css';

export type OrgBoardDepartment = {
  id: string;
  legacy_name: string;
  operational_name: string;
  policy_text: string | null;
  condition: ConditionLabel | null;
  statIndicated?: ConditionLabel | null;
  climbLag?: boolean;
  stat: BoardStatSnapshot | null;
  open_task_count?: number;
  doing_count?: number;
  activity?: 'active' | 'idle' | 'investigating';
  establishment?: DeptEstablishment | null;
};

type DivisionColumnProps = {
  divisionId: BoardDivisionId;
  operationalName: string;
  description: string | null;
  condition: ConditionLabel | null;
  statIndicated?: ConditionLabel | null;
  climbLag?: boolean;
  stat: BoardStatSnapshot | null;
  metricKey?: string;
  chartPoints?: BoardChartPoint[];
  departments: OrgBoardDepartment[];
  single?: boolean;
  edgeClass?: string;
};

function deptEstoSurfaceClass(dept: OrgBoardDepartment, base: string): string {
  const status = resolveEstoRound1Status(dept.id, dept.establishment?.esto_round1_status);
  return [base, estoRound1StatusClass(status)].filter(Boolean).join(' ');
}

function deptEstoTitle(dept: OrgBoardDepartment): string {
  return estoRound1StatusLabel(
    resolveEstoRound1Status(dept.id, dept.establishment?.esto_round1_status)
  );
}

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
      statIndicated={dept.statIndicated}
      climbLag={dept.climbLag}
      className={deptEstoSurfaceClass(dept, 'dabos-org-board__dept-cell')}
      href={linked ? dabosDeptHref(dept.id) : undefined}
      title={deptEstoTitle(dept)}
    >
      <span className="dabos-org-board__dept-bridge">{deptBridgeLabel(dept)}</span>
    </ConditionHoverSurface>
  );
}

function deptConditionHover(dept: OrgBoardDepartment) {
  return {
    statIndicated: dept.statIndicated,
    climbLag: dept.climbLag,
  };
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
  const activity = dept.activity ?? 'idle';
  const doing = dept.doing_count ?? 0;
  const dotClass =
    activity === 'investigating'
      ? 'dabos-org-board__dept-dot--investigating'
      : activity === 'active'
        ? 'dabos-org-board__dept-dot--active'
        : 'dabos-org-board__dept-dot--idle';
  const statusHint =
    doing > 0
      ? ` · ${doing} working now`
      : (dept.open_task_count ?? 0) > 0
        ? ` · ${dept.open_task_count} open`
        : '';

  return (
    <ConditionHoverSurface
      condition={dept.condition}
      stat={dept.stat}
      {...deptConditionHover(dept)}
      className={deptEstoSurfaceClass(dept, 'dabos-org-board__dept-cell')}
      href={linked ? dabosDeptHref(dept.id) : undefined}
      title={`${deptEstoTitle(dept)}${statusHint}`}
    >
      <span className="dabos-org-board__dept-num">
        <span className={`dabos-org-board__dept-dot ${dotClass}`} aria-hidden />
        {deptNumberLabel(dept.id, { short: shortLabel })}
        {(dept.open_task_count ?? 0) > 0 ? (
          <span className="dabos-org-board__dept-task-count">{dept.open_task_count}</span>
        ) : null}
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
  const className = deptEstoSurfaceClass(
    dept,
    'dabos-org-board__dept-cell dabos-org-board__dept-cell--title'
  );
  const estoTitle = deptEstoTitle(dept);
  const title = (
    <span className="dabos-org-board__dept-title">{deptColumnTitle(dept, shortLabel)}</span>
  );

  if (linked) {
    return (
      <Link href={dabosDeptHref(dept.id)} className={className} title={estoTitle}>
        {title}
      </Link>
    );
  }

  return (
    <div className={className} title={estoTitle}>
      {title}
    </div>
  );
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
      {...deptConditionHover(dept)}
      className={`dabos-org-board__dept-block${linked ? ' dabos-org-board__dept-block--link' : ''}`}
      href={linked ? dabosDeptHref(dept.id) : undefined}
    >
      <div className="dabos-org-board__dept-block-title">{title}</div>
      {policy ? <p>{policy}</p> : null}
      <EstablishmentStrip establishment={dept.establishment} />
    </ConditionHoverSurface>
  );
}

export function DivisionColumn({
  divisionId,
  operationalName,
  description,
  condition,
  statIndicated,
  climbLag,
  stat,
  metricKey = 'tasks_completed',
  chartPoints = [],
  departments,
  single = false,
  edgeClass,
}: DivisionColumnProps) {
  const divisionHover = { statIndicated, climbLag };
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

  const establishmentRow = !single ? (
    <div className="dabos-org-board__estab-row">
      {departments.map((dept) => (
        <div
          key={dept.id}
          className={deptEstoSurfaceClass(
            dept,
            'dabos-org-board__dept-cell dabos-org-board__dept-cell--estab'
          )}
          title={deptEstoTitle(dept)}
        >
          <EstablishmentStrip establishment={dept.establishment} />
        </div>
      ))}
    </div>
  ) : null;

  if (single) {
    return (
      <article className="dabos-org-board__column dabos-org-board__column--single">
        <ConditionHoverSurface condition={condition} stat={stat} {...divisionHover}>
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
        {...divisionHover}
        className="dabos-org-board__column-head-link block text-inherit no-underline"
        href={`/dabos/divisions/${divisionId}`}
      >
        {head}
      </ConditionHoverSurface>

      {numRow}
      {titleRow}
      {establishmentRow}
      {purposeRow}
      {chartRow}
    </article>
  );
}

function divisionBandSubtitle(operationalName: string): string {
  return operationalName.toUpperCase();
}
