'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useTransition } from 'react';

import {
  BOARD_CHART_PERIODS,
  type BoardChartPeriod,
} from '@/lib/dabos/board-charts';

import './org-board.css';

type OrgBoardPeriodTogglesProps = {
  year: number;
  calendarWeek: number;
  period: BoardChartPeriod;
};

export function OrgBoardPeriodToggles({
  year,
  calendarWeek,
  period,
}: OrgBoardPeriodTogglesProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const onSelect = useCallback(
    (next: BoardChartPeriod) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('year', String(year));
      params.set('cw', String(calendarWeek));
      params.set('period', next);
      startTransition(() => {
        router.push(`/dabos?${params.toString()}`, { scroll: false });
      });
    },
    [router, searchParams, year, calendarWeek]
  );

  return (
    <div
      className={`dabos-org-board__period-bar${pending ? ' dabos-org-board__period-bar--pending' : ''}`}
      role="toolbar"
      aria-label="Chart time unit"
    >
      {BOARD_CHART_PERIODS.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          className={`dabos-org-board__period-btn${period === id ? ' dabos-org-board__period-btn--active' : ''}`}
          aria-pressed={period === id}
          onClick={() => onSelect(id)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
