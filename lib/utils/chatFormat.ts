import type { ChatMessageType } from '@/types';

/** Attachment types the composer accepts — copied from CHAT_ALLOWED_TYPES. */
export const CHAT_ALLOWED_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

/** Mirrors the source's chatMediaType() exactly — DOCUMENT, not FILE. */
export function chatMediaType(contentType: string | null | undefined): ChatMessageType {
  if (!contentType) return 'TEXT';
  if (contentType.startsWith('image/')) return 'IMAGE';
  if (contentType.startsWith('video/')) return 'VIDEO';
  return 'DOCUMENT';
}

export function chatFileIcon(
  contentType: string | null | undefined,
  fileName: string | null | undefined
): string {
  const ct = contentType ?? '';
  if (ct.startsWith('image/')) return '🖼';
  if (ct.includes('pdf')) return '📕';
  if (ct.includes('word')) return '📘';
  if (ct.includes('sheet') || ct.includes('excel')) return '📗';
  const ext = (fileName ?? '').split('.').pop()?.toLowerCase() ?? '';
  if (['zip', 'rar'].includes(ext)) return '🗜';
  return '📄';
}

export function chatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

/** Today / Yesterday / date — used for the day separators in the thread. */
export function chatDateLabel(ms: number): string {
  const d = new Date(ms);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (sameDay(d, today)) return 'Today';
  if (sameDay(d, yesterday)) return 'Yesterday';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function ccTimeAgo(ms: number | null): string {
  if (!ms) return '';
  const diff = Date.now() - ms;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}
