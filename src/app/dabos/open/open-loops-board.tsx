'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import type { OpenLoopDept, OpenLoopItem, OpenLoopsSnapshot } from '@/lib/dabos/open-loops';
import {
  DEPT_LABELS,
  DEPT_ORDER,
  DEPT_SHORT,
  closedShare,
  itemDept,
  lastWeekForDept,
  resolveGoals,
} from '@/lib/dabos/open-loops';
import type { ConditionLabel } from '@/lib/dabos/types';
import styles from './open-loops.module.css';

/** Wide enough for “Coordination” / “Engineering” in Syne. */
const FACE_WIDTH = 268;
const SNAP_MS = 420;

type HeatFilter = 'all' | 'hot' | 'open' | 'ship';

type Stage = {
  dept: OpenLoopDept;
  label: string;
  short: string;
  items: OpenLoopItem[];
};

function HeatStamp({ heat }: { heat: OpenLoopItem['heat'] }) {
  const label = heat === 'hot' ? 'HOT' : heat === 'ship' ? 'SHIP' : 'OPEN';
  return <span className={`${styles.stamp} ${styles[`stamp_${heat}`]}`}>{label}</span>;
}

function cardWorkingLabel(
  dept: OpenLoopDept,
  items: OpenLoopItem[],
  workingConditions?: Record<string, ConditionLabel | null>
): string {
  const fromBoard = workingConditions?.[dept];
  if (fromBoard) return fromBoard;
  if (items.length === 0) return 'Clear';
  if (items.some((i) => i.heat === 'hot')) return 'Hot';
  if (items.some((i) => i.heat === 'open')) return 'Open';
  return 'Ship';
}

function LoopTicket({ item, index }: { item: OpenLoopItem; index: number }) {
  return (
    <article
      className={`${styles.ticket} ${styles[`rail_${item.heat}`]} ${styles.ticketStage}`}
      style={{ animationDelay: `${Math.min(index, 8) * 55}ms` }}
    >
      <div className={styles.ticketHead}>
        <HeatStamp heat={item.heat} />
        <code className={styles.ticketId}>{item.id}</code>
      </div>
      <p className={styles.ticketWhy}>{item.why}</p>
      {item.resume ? (
        <p className={styles.ticketResume}>
          <span className={styles.resumeLabel}>Say</span> {item.resume}
        </p>
      ) : null}
      {item.canonical ? <p className={styles.ticketPath}>{item.canonical}</p> : null}
    </article>
  );
}

function AimMeter({ data }: { data: OpenLoopsSnapshot }) {
  const goals = resolveGoals(data);
  const closed = data.counts.closed ?? 0;
  const still = data.counts.still_open ?? data.counts.hot + data.counts.open;
  const share = closedShare(data);
  const sharePct = Math.round(share * 100);
  const targetPct = Math.round(goals.closed_share_target * 100);
  const onTarget = share >= goals.closed_share_target;
  const hotOk = data.counts.hot <= goals.hot_max;
  const openOk = data.counts.open <= goals.open_max;

  return (
    <section className={styles.aim} aria-label="Open versus closed aims">
      <div className={styles.aimHead}>
        <h2 className={styles.aimTitle}>Aim</h2>
        <p className={styles.aimLede}>
          Work never ends — keep <strong>closed ≥ {targetPct}%</strong> of the drain pile, hot ≤{' '}
          {goals.hot_max}, open ≤ {goals.open_max}.
        </p>
      </div>

      <div className={styles.ratioBlock}>
        <div className={styles.ratioNums} aria-hidden>
          <span className={styles.ratioClosed}>{closed} closed</span>
          <span className={styles.ratioSlash}>/</span>
          <span className={styles.ratioOpen}>{still} open</span>
        </div>
        <div
          className={styles.ratioTrack}
          role="meter"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={sharePct}
          aria-label={`Closed share ${sharePct} percent; target ${targetPct}`}
        >
          <div
            className={`${styles.ratioFill} ${onTarget ? styles.ratioFillOk : styles.ratioFillLow}`}
            style={{ width: `${Math.min(100, sharePct)}%` }}
          />
          <div className={styles.ratioTarget} style={{ left: `${targetPct}%` }} title={`Target ${targetPct}%`} />
        </div>
        <p className={`${styles.ratioVerdict} ${onTarget ? styles.ok : styles.ratioWarn}`}>
          {sharePct}% closed {onTarget ? '· on aim' : `· need ${targetPct - sharePct} pts`}
        </p>
      </div>

      <ul className={styles.capList}>
        <li className={hotOk ? styles.capOk : styles.capBad}>
          Hot <strong>{data.counts.hot}</strong> / {goals.hot_max}
        </li>
        <li className={openOk ? styles.capOk : styles.capBad}>
          Open <strong>{data.counts.open}</strong> / {goals.open_max}
        </li>
        <li className={styles.capMuted}>Ship queue {data.counts.ship} (not in ratio)</li>
      </ul>
    </section>
  );
}

function faceFromRotation(rotation: number, n: number): number {
  if (n <= 0) return 0;
  const step = 360 / n;
  // Faces sit at i*step; cylinder rotates by `rotation`, so front face solves -i*step ≈ rotation
  const raw = Math.round(-rotation / step);
  return ((raw % n) + n) % n;
}

function snapRotationForFace(face: number, n: number): number {
  if (n <= 0) return 0;
  return -face * (360 / n);
}

function formatLastWeekFace(closed: number, still: number): string {
  if (closed === 0 && still === 0) return '—';
  return `↓${closed} · ${still} open`;
}

function formatLastWeekPanel(closed: number, still: number, since?: string): string {
  const window = since ? `since ${since}` : 'last 7 days';
  if (closed === 0 && still === 0) return `last week (${window}): nothing dated`;
  return `last week (${window}): ↓${closed} closed · ${still} still open`;
}

export function OpenLoopsBoard({
  data,
  workingConditions,
}: {
  data: OpenLoopsSnapshot;
  workingConditions?: Record<string, ConditionLabel | null>;
}) {
  const [heat, setHeat] = useState<HeatFilter>('all');
  const [rotation, setRotation] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [snapping, setSnapping] = useState(false);

  const rotationRef = useRef(0);
  const drag = useRef<{ x: number; rot: number } | null>(null);
  const cylinderEl = useRef<HTMLDivElement | null>(null);

  const all = useMemo(() => [...data.hot, ...data.open, ...data.ship], [data]);

  const filtered = useMemo(() => {
    if (heat === 'all') return all;
    return all.filter((item) => item.heat === heat);
  }, [all, heat]);

  const stages: Stage[] = useMemo(() => {
    return DEPT_ORDER.map((dept) => ({
      dept,
      label: DEPT_LABELS[dept],
      short: DEPT_SHORT[dept],
      items: filtered.filter((i) => itemDept(i) === dept),
    }));
  }, [filtered]);

  const n = stages.length;
  const step = n > 0 ? 360 / n : 0;
  const radius = n > 0 ? FACE_WIDTH / 2 / Math.tan(Math.PI / Math.max(n, 3)) : FACE_WIDTH;

  const safeFace = faceFromRotation(rotation, n);
  const current = stages[safeFace] ?? null;

  const paintCylinder = useCallback(
    (deg: number) => {
      const el = cylinderEl.current;
      if (el) {
        el.style.transform = `translateZ(${-radius}px) rotateY(${deg}deg)`;
      }
    },
    [radius]
  );

  const setRot = useCallback(
    (deg: number, animate = false) => {
      rotationRef.current = deg;
      setSnapping(animate);
      setRotation(deg);
      paintCylinder(deg);
    },
    [paintCylinder]
  );

  const snapToNearest = useCallback(() => {
    if (n < 1) return;
    const face = faceFromRotation(rotationRef.current, n);
    setRot(snapRotationForFace(face, n), true);
  }, [n, setRot]);

  const rollByFaces = useCallback(
    (dir: -1 | 1) => {
      if (n < 2) return;
      const face = (faceFromRotation(rotationRef.current, n) + dir + n) % n;
      setRot(snapRotationForFace(face, n), true);
    },
    [n, setRot]
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        rollByFaces(-1);
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        rollByFaces(1);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [rollByFaces]);

  // When heat filter changes, keep facing a valid face
  useEffect(() => {
    if (n === 0) {
      setRot(0, false);
      return;
    }
    const face = Math.min(faceFromRotation(rotationRef.current, n), n - 1);
    setRot(snapRotationForFace(face, n), true);
  }, [n, heat, setRot]);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (n < 2) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
    setSnapping(false);
    drag.current = { x: e.clientX, rot: rotationRef.current };
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    const dx = e.clientX - drag.current.x;
    // Drag right → roll cylinder that way (positive rotation)
    const next = drag.current.rot + dx * 0.42;
    rotationRef.current = next;
    paintCylinder(next);
    setRotation(next);
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    drag.current = null;
    setDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
    snapToNearest();
  };

  const generated = new Date(data.generated_at).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const drumStyle = {
    ['--ol-face-w']: `${FACE_WIDTH}px`,
    ['--ol-radius']: `${radius}px`,
    ['--ol-snap-ms']: `${SNAP_MS}ms`,
  } as CSSProperties;

  return (
    <div className={styles.root}>
      <header className={styles.hero}>
        <p className={styles.eyebrow}>Founder desk · department cylinder</p>
        <h1 className={styles.title}>Open loops</h1>
        <p className={styles.lede}>
          All 21 departments on the drum. Drag (or ← →) — empty departments stay visible; tickets
          follow the front one.
        </p>

        <AimMeter data={data} />

        <div className={styles.heatRail} aria-label="Filter by heat">
          <button
            type="button"
            className={`${styles.heatCell} ${styles.heatHot} ${heat === 'hot' ? styles.heatActive : ''}`}
            onClick={() => setHeat(heat === 'hot' ? 'all' : 'hot')}
          >
            <span className={styles.heatNum}>{data.counts.hot}</span>
            <span className={styles.heatLabel}>Hot</span>
          </button>
          <button
            type="button"
            className={`${styles.heatCell} ${styles.heatOpen} ${heat === 'open' ? styles.heatActive : ''}`}
            onClick={() => setHeat(heat === 'open' ? 'all' : 'open')}
          >
            <span className={styles.heatNum}>{data.counts.open}</span>
            <span className={styles.heatLabel}>Open</span>
          </button>
          <button
            type="button"
            className={`${styles.heatCell} ${styles.heatShip} ${heat === 'ship' ? styles.heatActive : ''}`}
            onClick={() => setHeat(heat === 'ship' ? 'all' : 'ship')}
          >
            <span className={styles.heatNum}>{data.counts.ship}</span>
            <span className={styles.heatLabel}>Ship</span>
          </button>
          <div className={`${styles.heatCell} ${styles.heatTotal}`}>
            <span className={styles.heatNum}>{data.counts.total}</span>
            <span className={styles.heatLabel}>On wall</span>
          </div>
        </div>

        <div className={styles.metaRow}>
          <span>Snapshot {generated}</span>
          <span className={styles.metaSep}>·</span>
          <span className={styles.keyHint}>drag · ← →</span>
        </div>
      </header>

      {n === 0 ? (
        <p className={styles.empty}>Nothing in the deck for this heat filter.</p>
      ) : (
        <>
          <div
            className={`${styles.scene} ${dragging ? styles.sceneDragging : ''}`}
            style={drumStyle}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            role="group"
            aria-label="Department cylinder — drag to roll"
          >
            <div className={styles.sceneGlow} aria-hidden />
            <div
              ref={cylinderEl}
              className={`${styles.cylinder} ${snapping ? styles.cylinderSnap : ''}`}
              style={{
                transform: `translateZ(${-radius}px) rotateY(${rotation}deg)`,
              }}
            >
              {stages.map((s, i) => {
                const faceRot = i * step;
                const front = i === safeFace;
                return (
                  <button
                    key={s.dept}
                    type="button"
                    className={`${styles.face} ${front ? styles.faceFront : ''} ${
                      s.items.length === 0 ? styles.faceEmpty : ''
                    }`}
                    style={{
                      transform: `rotateY(${faceRot}deg) translateZ(${radius}px)`,
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setRot(snapRotationForFace(i, n), true);
                    }}
                    aria-current={front ? 'true' : undefined}
                    aria-label={`${s.short} ${s.label}, ${cardWorkingLabel(s.dept, s.items, workingConditions)}, ${s.items.length} loops`}
                  >
                    <span className={styles.faceInner}>
                      <span className={styles.faceTop}>
                        <span className={styles.faceDept}>{s.short}</span>
                        <span className={styles.faceLabel}>{s.label}</span>
                        <span className={styles.faceCondition}>
                          {cardWorkingLabel(s.dept, s.items, workingConditions)}
                        </span>
                      </span>
                      <span className={styles.faceBottom}>
                        <span className={styles.faceCount}>{s.items.length}</span>
                        <span
                          className={styles.facePoints}
                          title="Last 7 days from YYMMDD drain ids: closed (archive) · still open"
                        >
                          {(() => {
                            const lw = lastWeekForDept(data, s.dept);
                            return formatLastWeekFace(lw.closed, lw.still_open);
                          })()}
                        </span>
                        <span className={styles.faceHeat} aria-hidden>
                          {s.items.some((x) => x.heat === 'hot') ? (
                            <i className={`${styles.heatDot} ${styles.heatDotHot}`} />
                          ) : null}
                          {s.items.some((x) => x.heat === 'open') ? (
                            <i className={`${styles.heatDot} ${styles.heatDotOpen}`} />
                          ) : null}
                          {s.items.some((x) => x.heat === 'ship') ? (
                            <i className={`${styles.heatDot} ${styles.heatDotShip}`} />
                          ) : null}
                        </span>
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
            <div className={styles.sceneHint} aria-hidden>
              roll ↔
            </div>
          </div>

          {current ? (
            <section key={current.dept} className={styles.frontPanel} aria-live="polite">
              <div className={styles.frontChrome}>
                <p className={styles.stageDept}>{current.short}</p>
                <p className={styles.stagePos}>
                  dept {safeFace + 1} <span aria-hidden>/</span> {n}
                </p>
              </div>
              <h2 className={styles.stageTitle}>{current.label}</h2>
              <p className={styles.stageCondition}>
                {cardWorkingLabel(current.dept, current.items, workingConditions)}
              </p>
              <p className={styles.stageCount}>
                {current.items.length === 0
                  ? 'Clear — nothing open on this hat'
                  : `${current.items.length} loop${current.items.length === 1 ? '' : 's'} on this dept`}
                {' · '}
                {(() => {
                  const lw = lastWeekForDept(data, current.dept);
                  return formatLastWeekPanel(lw.closed, lw.still_open, data.last_week?.since);
                })()}
              </p>
              <div className={styles.stageWall}>
                {current.items.length === 0 ? (
                  <p className={styles.emptyFace}>No open loops for {current.short}.</p>
                ) : (
                  current.items.map((item, i) => (
                    <LoopTicket key={item.id} item={item} index={i} />
                  ))
                )}
              </div>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
