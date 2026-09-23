'use client';

import { parseServerDate } from '@/lib/utils/format';
import type { ServerDateTime } from '@/types';

/**
 * ═══ SIGNATURE ELEMENT ═══
 *
 * A 2px rail encoding time remaining. It appears on order rows, the deadline
 * centre and KPI tiles, so urgency reads identically everywhere in the product.
 *
 * The fill is proportional to a fixed 7-day horizon rather than to each order's
 * own window: a deadline 6 hours away must look the same whether the order was
 * placed yesterday or last month. Anchoring to per-order duration would make
 * two equally urgent deadlines render differently, which is exactly backwards.
 */
const HORIZON_MS = 7 * 24 * 60 * 60 * 1000;

export function deadlineState(v: ServerDateTime): {
  label: string; tone: string; pct: number; overdue: boolean;
} {
  const d = parseServerDate(v);
  if (!d) return { label: '—', tone: 'var(--text-faint)', pct: 0, overdue: false };

  const diff = d.getTime() - Date.now();
  const overdue = diff < 0;
  const abs = Math.abs(diff);
  const hours = Math.floor(abs / 3_600_000);
  const days = Math.floor(hours / 24);

  const label = overdue
    ? hours < 24 ? `${hours}h overdue` : `${days}d overdue`
    : hours < 1 ? `${Math.max(1, Math.floor(abs / 60_000))}m left`
    : hours < 24 ? `${hours}h left`
    : `${days}d left`;

  const tone = overdue ? 'var(--danger)'
    : hours < 24 ? 'var(--warning)'
    : hours < 72 ? 'var(--info)'
    : 'var(--success)';

  // Overdue pins to full so the rail is unmistakable rather than empty.
  const pct = overdue ? 100 : Math.max(4, Math.round((1 - Math.min(diff, HORIZON_MS) / HORIZON_MS) * 100));

  return { label, tone, pct, overdue };
}

export function DeadlineMeter({ deadline, showLabel = true }: { deadline: ServerDateTime; showLabel?: boolean }) {
  const { label, tone, pct } = deadlineState(deadline);
  return (
    <div style={{ minWidth: 84 }}>
      {showLabel && (
        <div className="t-xs" style={{ color: tone, fontWeight: 600, marginBottom: 5 }}>{label}</div>
      )}
      <div className="meter" role="presentation">
        <div className="meter-fill" style={{ width: `${pct}%`, background: tone }} />
      </div>
    </div>
  );
}
