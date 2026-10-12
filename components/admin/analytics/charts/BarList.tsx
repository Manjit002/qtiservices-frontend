'use client';

export interface BarRow {
  label: string;
  value: number;
  /** Optional secondary figure, e.g. total value alongside a count. */
  meta?: string;
}

/** Horizontal ranked bars — better than a pie for many uneven categories. */
export function BarList({
  rows, color = 'var(--accent)', format = (n: number) => String(n),
}: { rows: BarRow[]; color?: string; format?: (n: number) => string }) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <div className="bl">
      {rows.map((r) => (
        <div className="bl-row" key={r.label}>
          <span className="bl-label truncate" title={r.label}>{r.label}</span>
          <span className="bl-track">
            <span
              className="bl-fill"
              style={{ width: `${Math.max(2, (r.value / max) * 100)}%`, background: color }}
              role="img"
              aria-label={`${r.label}: ${format(r.value)}`}
            />
          </span>
          <span className="bl-val">{format(r.value)}</span>
          {r.meta && <span className="bl-meta">{r.meta}</span>}
        </div>
      ))}
    </div>
  );
}
