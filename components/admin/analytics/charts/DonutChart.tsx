'use client';

export interface Slice {
  label: string;
  value: number;
  color: string;
}

interface Props {
  slices: Slice[];
  total: number;
  centerLabel: string;
  summary: string;
}

const R = 60;
const STROKE = 20;
const C = 2 * Math.PI * R;

/**
 * Donut built from stroked circle arcs — each slice is one circle with a
 * dasharray offset, which animates cleanly and needs no path maths.
 */
export function DonutChart({ slices, total, centerLabel, summary }: Props) {
  let offset = 0;

  return (
    <div className="dn-wrap">
      <div className="dn-chart">
        <svg viewBox="0 0 160 160" role="img" aria-label={summary}>
          <circle cx="80" cy="80" r={R} fill="none" stroke="var(--raised)" strokeWidth={STROKE} />
          {slices.map((s) => {
            const frac = total > 0 ? s.value / total : 0;
            const dash = frac * C;
            const el = (
              <circle
                key={s.label}
                cx="80" cy="80" r={R}
                fill="none"
                stroke={s.color}
                strokeWidth={STROKE}
                strokeDasharray={`${dash} ${C - dash}`}
                strokeDashoffset={-offset}
                transform="rotate(-90 80 80)"
                className="dn-slice"
              >
                <title>{`${s.label}: ${s.value} (${Math.round(frac * 100)}%)`}</title>
              </circle>
            );
            offset += dash;
            return el;
          })}
        </svg>
        <div className="dn-center">
          <div className="dn-total">{total.toLocaleString()}</div>
          <div className="dn-label">{centerLabel}</div>
        </div>
      </div>

      <ul className="dn-legend">
        {slices.map((s) => (
          <li key={s.label}>
            <span className="dn-dot" style={{ background: s.color }} aria-hidden />
            <span className="dn-name truncate">{s.label}</span>
            <span className="dn-val">{s.value}</span>
            <span className="dn-pct">
              {total > 0 ? `${Math.round((s.value / total) * 100)}%` : '0%'}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
