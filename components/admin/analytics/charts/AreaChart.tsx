'use client';

import { useId, useMemo, useState } from 'react';

export interface SeriesPoint {
  label: string;
  value: number;
}

interface Props {
  points: SeriesPoint[];
  /** Formats the value in the tooltip and on the y-axis. */
  format?: (n: number) => string;
  color?: string;
  height?: number;
  /** Accessible one-line summary, since a chart is not readable by a screen reader. */
  summary: string;
}

// No left padding inside the SVG: the y-axis labels live in an HTML gutter
// beside it (see .ch-plot), so they stay crisp instead of being stretched by
// preserveAspectRatio="none" along with the plot.
const PAD = { top: 14, right: 10, bottom: 24, left: 0 };

/** 1, 2, 2.5 or 5 × 10ⁿ — the steps people read axis values in. */
function niceStep(raw: number): number {
  if (raw <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(raw));
  const n = raw / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}

/**
 * Axis ceiling and tick count. Tries 3–5 intervals and keeps whichever wastes
 * the least headroom, so 492 gets 0–500 by 100 rather than 0–492 by 123.
 * Counts never get fractional ticks.
 */
function niceAxis(rawMax: number, integer: boolean): { max: number; step: number; count: number } {
  let best = { max: Infinity, step: 1, count: 4 };
  for (const count of [3, 4, 5]) {
    let step = niceStep(rawMax / count);
    if (integer) step = Math.max(1, Math.ceil(step));
    const max = step * count;
    if (max >= rawMax && max < best.max) best = { max, step, count };
  }
  return best;
}
const W = 640;

/**
 * Hand-built SVG area chart — no charting dependency.
 *
 * Drawn in a fixed viewBox and scaled with CSS, so it is responsive without a
 * resize observer and never causes layout jump. The hover layer is a row of
 * transparent rects rather than per-point hit testing, so the whole column is
 * targetable, which matters on touch.
 */
export function AreaChart({ points, format = String, color = 'var(--accent)', height = 220, summary }: Props) {
  const gid = useId().replace(/:/g, '');
  const [hover, setHover] = useState<number | null>(null);

  const H = height;
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const { path, area, coords, ticks } = useMemo(() => {
    const values = points.map((p) => p.value);
    const rawMax = Math.max(...values, 0);
    const axis = niceAxis(rawMax <= 0 ? 1 : rawMax, values.every(Number.isInteger));
    const m = axis.max;
    const stepX = points.length > 1 ? innerW / (points.length - 1) : 0;

    const pts = points.map((p, i) => ({
      x: PAD.left + i * stepX,
      y: PAD.top + innerH - (p.value / m) * innerH,
    }));

    const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const fill = pts.length
      ? `${line} L${(pts[pts.length - 1]?.x ?? 0).toFixed(1)},${PAD.top + innerH} L${(pts[0]?.x ?? 0).toFixed(1)},${PAD.top + innerH} Z`
      : '';

    return {
      path: line,
      area: fill,
      coords: pts,
      ticks: Array.from({ length: axis.count + 1 }, (_, i) => ({
        y: PAD.top + innerH - (i / axis.count) * innerH,
        v: axis.step * i,
      })),
    };
  }, [points, innerW, innerH]);

  if (points.length === 0) return null;

  const active = hover != null ? points[hover] : null;
  const activeXY = hover != null ? coords[hover] : null;

  return (
    <div className="ch-wrap" style={{ height }}>
      <div className="ch-plot">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="ch-svg"
        role="img"
        aria-label={summary}
      >
        <defs>
          <linearGradient id={`g-${gid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {ticks.map((t, i) => (
          <line key={i} x1={PAD.left} y1={t.y} x2={W - PAD.right} y2={t.y}
                stroke="var(--line)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        ))}

        <path d={area} fill={`url(#g-${gid})`} className="ch-area" />
        <path d={path} fill="none" stroke={color} strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round" className="ch-line" />

        {activeXY && (
          <>
            <line x1={activeXY.x} y1={PAD.top} x2={activeXY.x} y2={PAD.top + innerH}
                  stroke={color} strokeWidth="1" strokeDasharray="3 3" opacity="0.5" />
            <circle cx={activeXY.x} cy={activeXY.y} r="4" fill={color}
                    stroke="var(--surface)" strokeWidth="2" />
          </>
        )}

        {points.map((p, i) => {
          const w = innerW / points.length;
          return (
            <rect
              key={i}
              x={PAD.left + i * w - w / 2}
              y={PAD.top}
              width={w}
              height={innerH}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            />
          );
        })}
      </svg>

      {ticks.map((t, i) => (
        <span key={i} className="ch-ytick" style={{ top: `${(t.y / H) * 100}%` }} aria-hidden>
          {format(t.v)}
        </span>
      ))}

      {/* Tooltip lives outside the SVG so it uses real theme tokens and type. */}
      {active && activeXY && (
        <div
          className="ch-tip"
          style={{
            left: `${(activeXY.x / W) * 100}%`,
            top: `${(activeXY.y / H) * 100}%`,
          }}
        >
          <div className="ch-tip-v">{format(active.value)}</div>
          <div className="ch-tip-l">{active.label}</div>
        </div>
      )}
      </div>

      <div className="ch-xaxis">
        {points.map((p, i) => (
          // Thin out labels so they never collide on a narrow viewport.
          <span key={i} className="ch-xtick">
            {points.length <= 8 || i % Math.ceil(points.length / 6) === 0 ? p.label : ''}
          </span>
        ))}
      </div>
    </div>
  );
}
