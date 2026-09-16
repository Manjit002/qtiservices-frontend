import type { ServerDateTime } from '@/types';
import { parseServerDate } from './format';

/**
 * Human-friendly countdown, e.g. "in 3h", "2d left", "overdue 5h".
 * Mirrors the legacy `fmtDeadlineLive`.
 */
export function formatDeadlineLive(v: ServerDateTime): string {
  const d = parseServerDate(v);
  if (!d) return '—';
  const diff = d.getTime() - Date.now();
  const abs = Math.abs(diff);
  const hrs = Math.floor(abs / 3600000);
  const days = Math.floor(hrs / 24);

  if (diff < 0) {
    if (hrs < 24) return `overdue ${hrs}h`;
    return `overdue ${days}d`;
  }
  if (hrs < 1) return `in ${Math.max(1, Math.floor(abs / 60000))}m`;
  if (hrs < 24) return `in ${hrs}h`;
  return `${days}d left`;
}

/** Colour token for a deadline: red overdue, gold <24h, cyan <72h, muted beyond. */
export function deadlineColor(v: ServerDateTime): string {
  const d = parseServerDate(v);
  if (!d) return 'var(--muted)';
  const diff = d.getTime() - Date.now();
  if (diff < 0) return 'var(--red)';
  const hrs = diff / 3600000;
  if (hrs < 24) return 'var(--gold)';
  if (hrs < 72) return 'var(--cyan)';
  return 'var(--muted)';
}

/** Row highlight class used by the orders table. */
export function urgencyRowClass(v: ServerDateTime): string {
  const d = parseServerDate(v);
  if (!d) return '';
  const diff = d.getTime() - Date.now();
  if (diff < 0) return 'row-overdue';
  if (diff / 3600000 < 24) return 'row-urgent';
  return '';
}

export const isOverdue = (v: ServerDateTime): boolean => {
  const d = parseServerDate(v);
  return d ? d.getTime() < Date.now() : false;
};

/** Alias — same implementation, name used by the dashboard panels. */
export const deadlineLabel = formatDeadlineLive;
