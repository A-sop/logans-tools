'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo, useTransition } from 'react';

import {
  boardDateInputValue,
  monthWeekTicks,
  weekContextFromDate,
  weeksInYear,
} from '@/lib/dabos/calendar-week';
import type { ConditionLabel } from '@/lib/dabos/types';

import { ConditionHoverSurface } from './condition-hover-surface';
import './org-board.css';

type OrgBoardWeekSliderProps = {
  year: number;
  calendarWeek: number;
  maxWeek?: number;
};

function pushBoardWeek(
  params: URLSearchParams,
  year: number,
  calendarWeek: number
): void {
  params.set('year', String(year));
  params.set('cw', String(calendarWeek));
}

export function OrgBoardWeekSlider({
  year,
  calendarWeek,
  maxWeek,
}: OrgBoardWeekSliderProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const weekMax = maxWeek ?? weeksInYear(year);
  const ticks = useMemo(() => monthWeekTicks(year, weekMax), [year, weekMax]);
  const listId = `dabos-cw-marks-${year}`;
  const dateValue = useMemo(
    () => boardDateInputValue(year, calendarWeek),
    [year, calendarWeek]
  );

  const navigate = useCallback(
    (nextYear: number, nextWeek: number) => {
      const params = new URLSearchParams(searchParams.toString());
      pushBoardWeek(params, nextYear, nextWeek);
      startTransition(() => {
        router.push(`/dabos?${params.toString()}`, { scroll: false });
      });
    },
    [router, searchParams]
  );

  const onWeekChange = useCallback(
    (nextWeek: number) => {
      navigate(year, nextWeek);
    },
    [navigate, year]
  );

  const onDateChange = useCallback(
    (value: string) => {
      if (!value) return;
      const parsed = new Date(`${value}T12:00:00`);
      if (Number.isNaN(parsed.getTime())) return;
      const ctx = weekContextFromDate(parsed);
      navigate(ctx.year, ctx.calendarWeek);
    },
    [navigate]
  );

  const onToday = useCallback(() => {
    const ctx = weekContextFromDate(new Date());
    navigate(ctx.year, ctx.calendarWeek);
  }, [navigate]);

  return (
    <div
      className={`dabos-org-board__week-slider${pending ? ' dabos-org-board__week-slider--pending' : ''}`}
      aria-busy={pending}
    >
      <div className="dabos-org-board__week-slider-head">
        <label className="dabos-org-board__date-field">
          <span className="sr-only">Board date</span>
          <input
            type="date"
            className="dabos-org-board__date-input"
            value={dateValue}
            aria-label={`Board date, calendar week ${calendarWeek}`}
            onChange={(e) => onDateChange(e.target.value)}
          />
        </label>
        <button
          type="button"
          className="dabos-org-board__today-btn"
          onClick={onToday}
        >
          Today
        </button>
        <span className="dabos-org-board__week-slider-hint">CW {calendarWeek}</span>
      </div>
      <input
        type="range"
        className="dabos-org-board__week-range"
        min={1}
        max={weekMax}
        step={1}
        value={calendarWeek}
        list={listId}
        aria-label={`Calendar week ${calendarWeek} of ${year}`}
        onChange={(e) => onWeekChange(Number(e.target.value))}
      />
      <datalist id={listId}>
        {ticks.map((t) => (
          <option key={`${t.week}-${t.label}`} value={t.week} label={t.label} />
        ))}
      </datalist>
      <div className="dabos-org-board__week-ticks" aria-hidden>
        {ticks.map((t) => (
          <span
            key={`tick-${t.week}`}
            className="dabos-org-board__week-tick"
            style={{ left: `${((t.week - 1) / (weekMax - 1)) * 100}%` }}
          >
            {t.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export type ExecutiveBoxProps = {
  href: string;
  label: string;
  condition: ConditionLabel | null;
  variant?: 'director';
  lastRun?: string | null;
  lastRunLabel?: string;
};

function formatExecutiveRun(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function ExecutiveBox({
  href,
  label,
  condition,
  variant,
  lastRun,
  lastRunLabel = 'last run',
}: ExecutiveBoxProps) {
  return (
    <ConditionHoverSurface
      condition={condition}
      className={[
        'dabos-org-board__box',
        'dabos-org-board__box--link',
        variant === 'director' ? 'dabos-org-board__box--director' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      href={href}
    >
      <span className="dabos-org-board__box-label">{label}</span>
      {lastRun ? (
        <span className="dabos-org-board__box-run">
          {lastRunLabel}: {formatExecutiveRun(lastRun)}
        </span>
      ) : null}
    </ConditionHoverSurface>
  );
}
