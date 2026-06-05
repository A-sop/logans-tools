import type { BoardChartPoint } from '@/lib/dabos/board-charts';

import './org-board.css';

type DivisionSparklineProps = {
  points: BoardChartPoint[];
  metricKey: string;
  divisionLabel: string;
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

function sparklineGeometry(
  points: BoardChartPoint[],
  width: number,
  height: number
): { line: string; area: string } | null {
  if (points.length === 0) return null;

  const padX = 4;
  const padY = 4;
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

export function DivisionSparkline({ points, metricKey, divisionLabel }: DivisionSparklineProps) {
  const width = 120;
  const height = 44;
  const geometry = sparklineGeometry(points, width, height);
  const latest = points[points.length - 1];
  const ariaLabel =
    points.length === 0
      ? `${divisionLabel}: no chart data`
      : `${divisionLabel}: ${metricKey} trend, latest ${formatChartValue(latest!.value)} at ${latest!.label}`;

  return (
    <div className="dabos-org-board__sparkline" role="img" aria-label={ariaLabel}>
      {geometry ? (
        <svg
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          className="dabos-org-board__sparkline-svg"
        >
          <polygon className="dabos-org-board__sparkline-area" points={geometry.area} />
          <polyline className="dabos-org-board__sparkline-line" points={geometry.line} />
        </svg>
      ) : (
        <div className="dabos-org-board__sparkline-empty">No data</div>
      )}
    </div>
  );
}
