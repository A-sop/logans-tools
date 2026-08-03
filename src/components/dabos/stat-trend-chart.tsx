import type { BoardChartPoint } from '@/lib/dabos/board-charts';

type StatTrendChartProps = {
  points: BoardChartPoint[];
  metricKey: string;
  label: string;
  /** SVG viewBox height; default 72 for drilldowns */
  height?: number;
};

function formatChartValue(value: number): string {
  if (Math.abs(value) >= 1000) {
    return value.toLocaleString('en-DE', { maximumFractionDigits: 0 });
  }
  if (Math.abs(value) < 10 && value % 1 !== 0) {
    return value.toFixed(2);
  }
  return String(Math.round(value * 100) / 100);
}

function geometry(
  points: BoardChartPoint[],
  width: number,
  height: number
): { line: string; area: string } | null {
  if (points.length === 0) return null;

  const padX = 6;
  const padY = 8;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;

  const coords = points.map((p, i) => {
    const x = padX + (i / Math.max(points.length - 1, 1)) * innerW;
    const y = padY + innerH - ((p.value - min) / span) * innerH;
    return { x, y };
  });

  const lineCoords =
    points.length === 1
      ? [
          { x: padX, y: coords[0]!.y },
          { x: width - padX, y: coords[0]!.y },
        ]
      : coords;
  const line = lineCoords.map((c) => `${c.x},${c.y}`).join(' ');
  const area = `${coords.map((c) => `${c.x},${c.y}`).join(' ')} ${coords[coords.length - 1]!.x},${height - padY} ${coords[0]!.x},${height - padY}`;

  return { line, area };
}

/** Drilldown / dept trend chart (GER-26) — self-contained, no org-board CSS. */
export function StatTrendChart({
  points,
  metricKey,
  label,
  height = 72,
}: StatTrendChartProps) {
  const width = 320;
  const g = geometry(points, width, height);
  const latest = points[points.length - 1];
  const ariaLabel =
    points.length === 0
      ? `${label}: missing chart data`
      : `${label}: ${metricKey} trend, latest ${formatChartValue(latest!.value)} at ${latest!.label}`;

  return (
    <div
      className="w-full max-w-md rounded-lg border border-border bg-muted/20 p-3"
      role="img"
      aria-label={ariaLabel}
    >
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">
          {metricKey} · {points.length} pt{points.length === 1 ? '' : 's'}
        </p>
        {latest ? (
          <p className="text-sm font-semibold tabular-nums">
            {formatChartValue(latest.value)}
            <span className="ml-1 text-xs font-normal text-muted-foreground">{latest.label}</span>
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">Missing</p>
        )}
      </div>
      {g ? (
        <svg
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          className="h-[72px] w-full"
        >
          <polygon points={g.area} className="fill-primary/10" />
          <polyline
            points={g.line}
            fill="none"
            className="stroke-primary"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </svg>
      ) : (
        <div className="flex h-[72px] items-center justify-center text-xs text-muted-foreground">
          Missing · no weekly points yet
        </div>
      )}
    </div>
  );
}

/** Build chart points from raw Neon stats rows (dept dashboard). */
export function chartPointsFromStats(
  stats: Array<{ metric_key: string; value: string | number; recorded_at: string }>,
  metricKey: string
): BoardChartPoint[] {
  const sorted = [...stats]
    .filter((s) => s.metric_key === metricKey)
    .sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime());

  return sorted.map((s, i) => {
    const d = new Date(s.recorded_at);
    return {
      label: Number.isNaN(d.getTime()) ? `p${i + 1}` : d.toISOString().slice(0, 10),
      value: Number(s.value),
      week: i + 1,
    };
  });
}
