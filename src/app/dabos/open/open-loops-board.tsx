'use client';

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
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

function PrayerDrum({
  faces,
  paused,
}: {
  faces: { key: string; node: ReactNode }[];
  paused: boolean;
}) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const cylRef = useRef<HTMLDivElement | null>(null);
  const faceRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [width, setWidth] = useState(800);
  const st = useRef({ angle: 0, vel: 0, dragging: false, lastX: 0, lastT: 0, moved: 0, idleAt: 0 });
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const n = faces.length;
  const step = 360 / n;
  const faceW = width < 520 ? Math.max(128, Math.min(160, width * 0.4)) : 210;
  const radius = Math.round((faceW / 2 / Math.tan(Math.PI / n)) * 1.04);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    let raf = 0;
    let prev = performance.now();
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const tick = (t: number) => {
      const dt = Math.min(64, t - prev) / 16.67;
      prev = t;
      const s = st.current;
      if (!s.dragging) {
        if (Math.abs(s.vel) > 0.02) {
          s.angle += s.vel * dt;
          s.vel *= Math.pow(0.95, dt);
          s.idleAt = t;
        } else {
          s.vel = 0;
          if (!pausedRef.current && !reduce && t - s.idleAt > 2500) s.angle -= 0.06 * dt;
        }
      }
      if (pausedRef.current) s.idleAt = t;
      if (cylRef.current) cylRef.current.style.transform = `translateZ(${-radius}px) rotateY(${s.angle}deg)`;
      faceRefs.current.forEach((f, i) => {
        if (!f) return;
        const a = ((i * step + s.angle) * Math.PI) / 180;
        const c = Math.cos(a);
        f.style.opacity = String(Math.max(0, 0.25 + 0.75 * c));
        f.style.pointerEvents = c > 0.35 ? 'auto' : 'none';
        f.style.zIndex = String(Math.round(c * 100) + 100);
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [radius, step]);

  const degPerPx = 360 / (2 * Math.PI * radius);
  const onDown = (e: ReactPointerEvent) => {
    const s = st.current;
    s.dragging = true;
    s.lastX = e.clientX;
    s.lastT = performance.now();
    s.vel = 0;
    s.moved = 0;
  };
  const onMove = (e: ReactPointerEvent) => {
    const s = st.current;
    if (!s.dragging) return;
    const dx = e.clientX - s.lastX;
    const now = performance.now();
    s.moved += Math.abs(dx);
    if (s.moved > 6 && !(e.currentTarget as Element).hasPointerCapture(e.pointerId)) {
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
    }
    s.angle += dx * degPerPx;
    const dtf = Math.max(1, now - s.lastT) / 16.67;
    s.vel = 0.7 * s.vel + 0.3 * ((dx * degPerPx) / dtf);
    s.lastX = e.clientX;
    s.lastT = now;
    s.idleAt = now;
  };
  const onUp = () => {
    const s = st.current;
    if (performance.now() - s.lastT > 80) s.vel = 0;
    s.dragging = false;
  };
  const spinTo = (dir: number) => {
    st.current.vel = 0;
    st.current.angle = Math.round(st.current.angle / step) * step + dir * step;
    st.current.idleAt = performance.now();
  };

  return (
    <div className={styles.drumStage} ref={stageRef}>
      <div
        className={styles.drumView}
        style={{ height: 'var(--drum-h)' }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onClickCapture={(e) => {
          if (st.current.moved > 6) {
            e.stopPropagation();
            e.preventDefault();
            st.current.moved = 0;
          }
        }}
      >
        <div className={styles.drumCyl} ref={cylRef}>
          <div className={`${styles.drumRim} ${styles.drumRimTop}`} style={{ width: radius * 2, height: radius * 2, marginLeft: -radius, marginTop: -radius, transform: `rotateX(90deg)` }} />
          <div className={`${styles.drumRim} ${styles.drumRimBot}`} style={{ width: radius * 2, height: radius * 2, marginLeft: -radius, marginTop: -radius, transform: `rotateX(90deg)` }} />
          {faces.map((f, i) => (
            <div
              key={f.key}
              ref={(el) => {
                faceRefs.current[i] = el;
              }}
              className={styles.drumFace}
              style={{ width: faceW, marginLeft: -faceW / 2, transform: `rotateY(${-i * step}deg) translateZ(${radius}px)` }}
            >
              {f.node}
            </div>
          ))}
        </div>
      </div>
      <div className={styles.drumNav}>
        <button type="button" onClick={() => spinTo(1)} aria-label="Previous division">‹</button>
        <span>Swipe to turn</span>
        <button type="button" onClick={() => spinTo(-1)} aria-label="Next division">›</button>
      </div>
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
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleClose = (id: string) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpenId((v) => (v === id ? null : v)), 250);
  };

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
  const drumOrder: BoardDivisionId[] = [...DCO_DIVISION_IDS, ...ORG_DIVISION_IDS];
  let openDept: OpenOrgDept | undefined;
  for (const d of org) for (const x of d.departments) if (x.id === openId) openDept = x;

  const renderDivision = (id: BoardDivisionId) => {
    const div = divById.get(id);
    if (!div) return null;
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
                if (window.matchMedia('(hover: hover)').matches) {
                  if (closeTimer.current) clearTimeout(closeTimer.current);
                  setOpenId(dept.id);
                }
                e.stopPropagation();
              }}
              onMouseLeave={() => {
                if (window.matchMedia('(hover: hover)').matches) scheduleClose(dept.id);
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

      <div className={styles.drumWrap}>
        <div className={styles.boardDrum}>
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
          <PrayerDrum
            paused={openId !== null}
            faces={drumOrder.map((id) => ({ key: id, node: renderDivision(id) }))}
          />
          {openDept ? (
            <div
              className={styles.drumPop}
              onMouseEnter={() => closeTimer.current && clearTimeout(closeTimer.current)}
              onMouseLeave={() => window.matchMedia('(hover: hover)').matches && scheduleClose(openDept!.id)}
            >
              <TaskPopover
                title={`${deptNumberLabel(openDept.id, { short: true })} \u00b7 ${deptRoleLabel(openDept)}`}
                items={byDept.get(openDept.id) ?? []}
                alignRight={false}
                onClose={() => setOpenId(null)}
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
