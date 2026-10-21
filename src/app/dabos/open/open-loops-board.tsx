'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { OpenLoopItem, OpenLoopsSnapshot } from '@/lib/dabos/open-loops';
import { closedShare, itemDept, resolveGoals } from '@/lib/dabos/open-loops';
import {
  DCO_DIVISION_IDS,
  DIVISION_BAND_TITLE,
  EXECUTIVE_LABELS,
  ORG_DIVISION_IDS,
  deptNumberLabel,
  deptRoleLabel,
  type BoardDivisionId,
} from '@/lib/dabos/org-board-config';
import type { ConditionLabel } from '@/lib/dabos/types';
import styles from './open-loops.module.css';

export type OpenOrgDept = { id: string; legacy_name: string; operational_name: string };
export type OpenOrgDivision = { id: string; operational_name: string; departments: OpenOrgDept[] };

type HeatFilter = 'all' | 'hot' | 'open' | 'ship';

function ageLabel(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 864e5);
  if (days < 1) return 'today';
  if (days < 60) return `${days}d`;
  return `${Math.round(days / 30)}mo`;
}

function AimRow({
  data,
  heat,
  setHeat,
  live,
}: {
  data: OpenLoopsSnapshot;
  heat: HeatFilter;
  setHeat: (_h: HeatFilter) => void;
  live: boolean;
}) {
  const goals = resolveGoals(data);
  const closed = data.counts.closed ?? 0;
  const still = data.counts.still_open ?? data.counts.hot + data.counts.open;
  const sharePct = Math.round(closedShare(data) * 100);
  const targetPct = Math.round(goals.closed_share_target * 100);
  const onTarget = sharePct >= targetPct;
  const generated = new Date(data.generated_at).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  const tile = (key: Exclude<HeatFilter, 'all'>, n: number, label: string) => (
    <button
      type="button"
      className={`${styles.tile} ${styles[`tile_${key}`]} ${heat === key ? styles.tileActive : ''}`}
      onClick={() => setHeat(heat === key ? 'all' : key)}
      aria-pressed={heat === key}
    >
      <span className={styles.tileNum}>{n}</span>
      <span className={styles.tileLabel}>{label}</span>
    </button>
  );
  return (
    <section className={styles.aimRow} aria-label="Aim and counts">
      <div className={styles.aimBlock}>
        <div className={styles.aimLine}>
          <strong>Aim</strong>
          <span>
            {closed} closed / {still} open · {sharePct}% closed (target {targetPct}%)
          </span>
        </div>
        <div className={styles.aimTrack} role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={sharePct}>
          <div
            className={`${styles.aimFill} ${onTarget ? styles.aimOk : styles.aimLow}`}
            style={{ width: `${Math.min(100, sharePct)}%` }}
          />
          <div className={styles.aimTarget} style={{ left: `${targetPct}%` }} />
        </div>
        <div className={styles.aimMeta}>{live ? `Live from tasks · ${generated}` : `Snapshot ${generated}`}</div>
      </div>
      <div className={styles.tiles}>
        {tile('hot', data.counts.hot, 'Hot')}
        {tile('open', data.counts.open, 'Open')}
        {tile('ship', data.counts.ship, 'Ship')}
        <div className={`${styles.tile} ${styles.tile_total}`}>
          <span className={styles.tileNum}>{data.counts.total}</span>
          <span className={styles.tileLabel}>On wall</span>
        </div>
      </div>
    </section>
  );
}

function TaskPopover({
  title,
  items,
  alignRight,
  onClose,
}: {
  title: string;
  items: OpenLoopItem[];
  alignRight: boolean;
  onClose: () => void;
}) {
  return (
    <div
      className={`${styles.popover} ${alignRight ? styles.popRight : ''}`}
      role="dialog"
      aria-label={`${title} open tasks`}
      onClick={(e) => e.stopPropagation()}
    >
      <div className={styles.popHead}>
        <span className={styles.popTitle}>{title}</span>
        <span className={styles.popCount}>{items.length}</span>
        <button type="button" className={styles.popClose} onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>
      {items.length === 0 ? (
        <p className={styles.popEmpty}>Nothing open.</p>
      ) : (
        <ul className={styles.popList}>
          {items.map((item) => (
            <li key={item.id} className={styles.popItem}>
              <span className={`${styles.popDot} ${styles[`popDot_${item.heat}`]}`} aria-hidden />
              <span className={styles.popText}>{item.why}</span>
              <span className={styles.popMeta}>
                {item.status ?? item.heat}
                {item.priority != null ? ` · P${item.priority}` : ''}
                {item.created_at ? ` · ${ageLabel(item.created_at)}` : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function OpenLoopsBoard({
  data,
  live = false,
  org,
  workingConditions,
}: {
  data: OpenLoopsSnapshot;
  live?: boolean;
  org: OpenOrgDivision[];
  workingConditions?: Record<string, ConditionLabel | null>;
}) {
  const [heat, setHeat] = useState<HeatFilter>('all');
  const [openId, setOpenId] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const byDept = useMemo(() => {
    const all = [...data.hot, ...data.open, ...data.ship];
    const filtered = heat === 'all' ? all : all.filter((i) => i.heat === heat);
    const m = new Map<string, OpenLoopItem[]>();
    for (const i of filtered) {
      const d = itemDept(i);
      m.set(d, [...(m.get(d) ?? []), i]);
    }
    return m;
  }, [data, heat]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpenId(null);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpenId(null);
    }
    document.addEventListener('click', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const divById = new Map(org.map((d) => [d.id, d]));
  const countFor = (ids: readonly string[]) =>
    ids.reduce(
      (a, id) => a + (divById.get(id)?.departments ?? []).reduce((b, d) => b + (byDept.get(d.id)?.length ?? 0), 0),
      0
    );
  const total = [...byDept.values()].reduce((a, b) => a + b.length, 0);
  const allOrder: string[] = [...DCO_DIVISION_IDS, ...ORG_DIVISION_IDS];

  const renderDivision = (id: BoardDivisionId) => {
    const div = divById.get(id);
    if (!div) return null;
    const colIndex = allOrder.indexOf(id);
    const divCount = div.departments.reduce((a, d) => a + (byDept.get(d.id)?.length ?? 0), 0);
    return (
      <div key={id} className={styles.divCol}>
        <div className={styles.divHead}>
          <span className={styles.divBand}>{DIVISION_BAND_TITLE[id]}</span>
          <span className={styles.divName}>{div.operational_name}</span>
          <span className={styles.divCount}>{divCount}</span>
        </div>
        {div.departments.map((dept) => {
          const items = byDept.get(dept.id) ?? [];
          const hot = items.some((i) => i.heat === 'hot');
          const isOpen = openId === dept.id;
          const cond = workingConditions?.[dept.id] ?? null;
          const role = deptRoleLabel(dept);
          return (
            <div
              key={dept.id}
              className={styles.deptWrap}
              onMouseEnter={(e) => {
                if (window.matchMedia('(hover: hover)').matches) setOpenId(dept.id);
                e.stopPropagation();
              }}
              onMouseLeave={() => {
                if (window.matchMedia('(hover: hover)').matches) setOpenId((v) => (v === dept.id ? null : v));
              }}
            >
              <button
                type="button"
                className={`${styles.deptCard} ${items.length === 0 ? styles.deptEmpty : ''} ${isOpen ? styles.deptActive : ''}`}
                aria-expanded={isOpen}
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenId(isOpen ? null : dept.id);
                }}
              >
                <span className={styles.deptNum}>{deptNumberLabel(dept.id, { short: true })}</span>
                <span className={styles.deptName}>{role}</span>
                <span className={styles.deptFoot}>
                  <span className={styles.deptCond}>{cond ?? '—'}</span>
                  <span className={styles.deptCount}>
                    {hot ? <i className={styles.hotDot} aria-label="has hot tasks" /> : null}
                    {items.length}
                  </span>
                </span>
              </button>
              {isOpen ? (
                <TaskPopover
                  title={`${deptNumberLabel(dept.id, { short: true })} · ${role}`}
                  items={items}
                  alignRight={colIndex >= 4}
                  onClose={() => setOpenId(null)}
                />
              ) : null}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className={styles.root} ref={rootRef}>
      <header className={styles.header}>
        <h1 className={styles.title}>Open loops</h1>
        <AimRow data={data} heat={heat} setHeat={setHeat} live={live} />
      </header>

      <div className={styles.boardScroll}>
        <div className={styles.board}>
          <div className={styles.execRow}>
            <div className={`${styles.execBox} ${styles.execEd}`}>
              <span>{EXECUTIVE_LABELS.director}</span>
              <strong>{total}</strong>
            </div>
          </div>
          <div className={styles.secRow}>
            <div className={styles.execBox}>
              <span>{EXECUTIVE_LABELS.dcoSecretary}</span>
              <strong>{countFor(DCO_DIVISION_IDS)}</strong>
            </div>
            <div className={styles.execBox}>
              <span>{EXECUTIVE_LABELS.orgSecretary}</span>
              <strong>{countFor(ORG_DIVISION_IDS)}</strong>
            </div>
          </div>
          <div className={styles.divRow}>
            <div className={styles.divBlock}>{DCO_DIVISION_IDS.map((id) => renderDivision(id))}</div>
            <div className={`${styles.divBlock} ${styles.divBlockOrg}`}>
              {ORG_DIVISION_IDS.map((id) => renderDivision(id))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
