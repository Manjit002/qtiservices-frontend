import type { InstallmentDTO, ServerDate } from '@/types';
import { isInstallmentPaid } from '@/types/payment';

/** Java LocalDate arrives as `yyyy-MM-dd` or as a [y, M, d] tuple. Both handled. */
export function parseDue(i: InstallmentDTO): Date | null {
  if (i.dueDateTime) {
    const d = new Date(i.dueDateTime);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const raw: ServerDate = i.dueDate ?? null;
  if (!raw) return null;
  if (Array.isArray(raw)) {
    const [y, m, day] = raw;
    if (y === undefined || m === undefined || day === undefined) return null;
    return new Date(y, m - 1, day);
  }
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function dueLabel(i: InstallmentDTO): string {
  const d = parseDue(i);
  if (!d) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export type InstallmentState = 'paid' | 'overdue' | 'due-today' | 'upcoming';

/**
 * Derived purely from the backend's own fields — paid flag/status first, then
 * the due date against today. No status is invented.
 */
export function installmentState(i: InstallmentDTO): InstallmentState {
  if (isInstallmentPaid(i)) return 'paid';
  const d = parseDue(i);
  if (!d) return 'upcoming';
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) return 'due-today';
  return d.getTime() < now.getTime() ? 'overdue' : 'upcoming';
}

/**
 * Plan totals, computed exactly as the source does: sum finalAmount across all
 * rows, and sum it again across the settled ones. The backend returns no plan
 * aggregate, so this is derived — but the derivation matches the old page line
 * for line, so the figures cannot disagree with it.
 */
export function planTotals(list: InstallmentDTO[]) {
  const total = list.reduce((s, i) => s + (i.finalAmount ?? 0), 0);
  const paid = list.filter(isInstallmentPaid).reduce((s, i) => s + (i.finalAmount ?? 0), 0);
  return { total, paid, remaining: total - paid, paidCount: list.filter(isInstallmentPaid).length };
}

/** Default schedule preview for CUSTOM plans — seeds the date pickers. */
export function seedDates(count: number, type: string): string[] {
  const out: string[] = [];
  const step = type === 'WEEKLY' ? 7 : type === 'BIWEEKLY' ? 14 : 30;
  for (let i = 0; i < count; i += 1) {
    const d = new Date();
    d.setDate(d.getDate() + step * (i + 1));
    d.setHours(12, 0, 0, 0);
    const pad = (n: number) => String(n).padStart(2, '0');
    out.push(
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
    );
  }
  return out;
}

/** The backend wants seconds; datetime-local gives 16 chars. */
export const withSeconds = (v: string): string => (v.length === 16 ? `${v}:00` : v);
