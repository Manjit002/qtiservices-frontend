import type { ServerDateTime } from '@/types';

/** OD-{id} / ID-{id} — the platform's canonical display codes. Do not change. */
export const fmtOrderId = (id: number | null | undefined): string => (id ? `OD-${id}` : '—');
export const fmtStudentId = (id: number | null | undefined): string => (id ? `ID-${id}` : '—');

/**
 * Java LocalDateTime arrives either as an ISO string or as a
 * [y, M, d, h, m, s] array. Both shapes are handled, matching the legacy
 * `parseServerDeadline`.
 */
export function parseServerDate(v: ServerDateTime): Date | null {
  if (v === null || v === undefined || v === '') return null;
  if (Array.isArray(v)) {
    const [y, mo, d, h = 0, mi = 0, s = 0] = v;
    if (y === undefined || mo === undefined || d === undefined) return null;
    return new Date(y, mo - 1, d, h, mi, s);
  }
  const parsed = new Date(v);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatDate(v: ServerDateTime): string {
  const d = parseServerDate(v);
  if (!d) return '—';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatDateTime(v: ServerDateTime): string {
  const d = parseServerDate(v);
  if (!d) return '—';
  return d.toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

/** ISO string suitable for a data-attribute, or '' when absent. */
export function toIsoString(v: ServerDateTime): string {
  return parseServerDate(v)?.toISOString() ?? '';
}

/** `yyyy-MM-ddTHH:mm` for <input type="datetime-local">. */
export function toLocalInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

/**
 * The backend wants seconds. A datetime-local value is 16 chars
 * ("2026-01-01T12:00"), so append ":00" — identical to the legacy doAssign().
 */
export function withSeconds(datetimeLocal: string): string {
  return datetimeLocal.length === 16 ? `${datetimeLocal}:00` : datetimeLocal;
}

/**
 * Unwrap a field that may be a bare string or a serialised Java enum
 * ({ name: 'ASSIGNED' }). Mirrors `d.status?.name ?? d.status` in the source.
 */
export function enumValue(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'object' && 'name' in (v as Record<string, unknown>)) {
    return String((v as { name?: unknown }).name ?? '');
  }
  return String(v);
}

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function formatMoney(v: number | null | undefined): string {
  if (v === null || v === undefined) return '—';
  return `$${Number(v).toFixed(2)}`;
}

export function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function fileIcon(ext: string | null | undefined): string {
  const e = (ext ?? '').toLowerCase().replace('.', '');
  if (['pdf'].includes(e)) return '📕';
  if (['doc', 'docx'].includes(e)) return '📘';
  if (['xls', 'xlsx', 'csv'].includes(e)) return '📗';
  if (['ppt', 'pptx'].includes(e)) return '📙';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(e)) return '🖼';
  if (['zip', 'rar', '7z'].includes(e)) return '🗜';
  return '📄';
}

export function extensionOf(name: string | null | undefined): string {
  if (!name) return '';
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i + 1).toLowerCase() : '';
}

export function initialOf(email: string): string {
  return email.trim()[0]?.toUpperCase() ?? 'A';
}

export function nameFromEmail(email: string): string {
  return email.split('@')[0] || 'User';
}

// ─── Aliases ─────────────────────────────────────────────────────────────────
// Panels were written against these names; they forward to the single
// implementation above rather than duplicating the logic.
export const fileExtension = extensionOf;
export const formatCurrency = formatMoney;

const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'];

export function isImageFile(nameOrType: string | null | undefined): boolean {
  const v = (nameOrType ?? '').toLowerCase();
  if (v.startsWith('image/')) return true;
  return IMAGE_EXTS.includes(extensionOf(v));
}
