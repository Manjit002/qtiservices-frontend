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

  const mins = Math.max(1, Math.floor(abs / 60_000));
  const label = overdue
    ? hours < 1 ? `${mins}m overdue` : hours < 24 ? `${hours}h overdue` : `${days}d overdue`
    : hours < 1 ? `${mins}m left`
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

/**
 * Statuses where the clock has stopped. A finished order counting "6d overdue"
 * in red reads as an alarm that nobody can act on, so these show the date in a
 * quiet tone instead. SUBMITTED is closed only from the expert's side — their
 * deadline was met — while admins still owe the student a delivery.
 */
export const CLOSED_STATUSES = ['COMPLETED', 'CANCELLED', 'PAID'];
export const EXPERT_CLOSED_STATUSES = ['SUBMITTED', ...CLOSED_STATUSES];

/** "Sep 29" this year, "Sep 29, 2025" otherwise — fits the meter's width. */
function shortDate(v: ServerDateTime): string {
  const d = parseServerDate(v);
  if (!d) return '—';
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString(undefined, sameYear
    ? { month: 'short', day: 'numeric' }
    : { month: 'short', day: 'numeric', year: 'numeric' });
}

export function DeadlineMeter({ deadline, showLabel = true, settled = false }: {
  deadline: ServerDateTime; showLabel?: boolean;
  /** True when the order is finished: show the date, not a countdown. */
  settled?: boolean;
}) {
  const live = deadlineState(deadline);
  const { label, tone, pct } = settled && live.label !== '—'
    ? { label: `Due ${shortDate(deadline)}`, tone: 'var(--text-faint)', pct: 100 }
    : live;
  return (
    <div style={{ minWidth: 84 }}>
      {showLabel && (
        <div className="t-xs" style={{ color: tone, fontWeight: 600, marginBottom: 5 }}>{label}</div>
      )}
      <div className="meter" role="presentation">
        <div className="meter-fill" style={{ width: `${pct}%`, background: settled ? 'var(--line-strong)' : tone }} />
      </div>
    </div>
  );
}
