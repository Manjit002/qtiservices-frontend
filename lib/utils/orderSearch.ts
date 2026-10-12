import { ApiError } from '@/lib/api/client';
import type { PageResponse } from '@/types';

/**
 * Helpers for GET /admin/all. The rules mirror
 * OrderService.getAllOrdersAdvancedDTO, so a request the service would reject
 * is never sent.
 */

/** The service throws IllegalArgumentException outside 1–100. */
export const ADMIN_SEARCH_MAX_SIZE = 100;

export function clampPageSize(n: number): number {
  const v = Math.trunc(Number(n));
  if (!Number.isFinite(v) || v < 1) return 1;
  return Math.min(v, ADMIN_SEARCH_MAX_SIZE);
}

/** The service throws IllegalArgumentException for a negative page. */
export function clampPage(n: number): number {
  const v = Math.trunc(Number(n));
  return Number.isFinite(v) && v > 0 ? v : 0;
}

/**
 * The Orders page shows IDs as `OD-2417`, so an admin will paste that form.
 * The server compares the keyword as typed, so the prefix is removed: `OD-2417`,
 * `od 2417`, `OD-02417` and `#2417` become `2417`. Anything else is only
 * trimmed, as the service does.
 */
export function normalizeOrderKeyword(raw: string): string {
  const t = raw.trim();
  const m = /^(?:od[-\s]?#?|#)0*(\d+)$/i.exec(t);
  return m ? m[1] : t;
}

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** `<input type="date">` value → start of that day, as LocalDateTime text. */
export function dayStart(day: string): string | null {
  return DAY.test(day) ? `${day}T00:00:00` : null;
}

/** `<input type="date">` value → last second of that day. */
export function dayEnd(day: string): string | null {
  return DAY.test(day) ? `${day}T23:59:59` : null;
}

/**
 * Spring Data serialises a Page in one of two shapes:
 *   PageImpl (default):   { content, totalElements, totalPages, number, size, … }
 *   VIA_DTO (Data 3.3+):  { content, page: { size, number, totalElements, totalPages } }
 * Both are read, so a serialisation setting on the server can't empty the table.
 */
export function normalizePage<T>(raw: unknown, requested: { page: number; size: number }): PageResponse<T> {
  if (!raw || typeof raw !== 'object' || !Array.isArray((raw as { content?: unknown }).content)) {
    throw new Error('The order search returned an unexpected response.');
  }
  const r = raw as Record<string, unknown>;
  const meta = (r.page && typeof r.page === 'object' ? r.page : r) as Record<string, unknown>;
  const content = r.content as T[];
  const num = (v: unknown, fallback: number) =>
    typeof v === 'number' && Number.isFinite(v) ? v : fallback;

  const size = num(meta.size, requested.size) || requested.size;
  const totalElements = num(meta.totalElements, content.length);
  const totalPages = num(meta.totalPages, Math.ceil(totalElements / size));
  const number = num(meta.number, requested.page);
  return {
    content,
    totalElements,
    totalPages,
    number,
    size,
    first: number === 0,
    last: number >= totalPages - 1,
    empty: content.length === 0,
  };
}

/**
 * Turns a failed search into a sentence an admin can act on. A message from
 * the server is shown as is; Spring's default error body has none, so the
 * status code decides.
 */
export function describeOrderSearchError(
  e: unknown,
  ctx: { hasDates: boolean; hasStatus: boolean }
): string {
  const status = e instanceof ApiError ? e.status : 0;
  const msg = (e as Error)?.message ?? '';
  if (msg && !/^Request failed \(\d+\)$/.test(msg)) return msg;
  if (status === 400 && ctx.hasDates) {
    return 'The server couldn’t read the date filter. Clear the dates and try again.';
  }
  if (status === 400) return 'The server rejected this search. Clear the filters and try again.';
  if (status >= 500 && ctx.hasStatus) {
    return 'The order search failed on the server. It may not accept this status — try All, or try again.';
  }
  if (status >= 500) return 'The order search failed on the server. Try again in a moment.';
  return msg || 'The order search failed. Check your connection and try again.';
}
