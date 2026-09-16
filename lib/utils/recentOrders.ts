/**
 * Recently-viewed orders, kept in localStorage.
 *
 * Storage key is unchanged from the legacy dashboard so an admin's existing
 * list survives the migration.
 */
const KEY = 'mocp_admin_recent_orders';
const LIMIT = 8;

export interface RecentOrder {
  id: number;
  subject: string;
  ts: number;
}

export function getRecentOrders(): RecentOrder[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as RecentOrder[]) : [];
  } catch {
    return [];
  }
}

export function trackRecentOrder(id: number, subject: string): RecentOrder[] {
  if (typeof window === 'undefined') return [];
  const list = getRecentOrders().filter((r) => r.id !== id);
  list.unshift({ id, subject: subject || '', ts: Date.now() });
  const next = list.slice(0, LIMIT);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* quota — non-fatal */
  }
  return next;
}

const PIN_KEY = 'mocp_admin_pinned_chats';

export function getPinnedChats(): number[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(PIN_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as number[]) : [];
  } catch {
    return [];
  }
}

export function togglePinnedChat(orderId: number): number[] {
  const pins = getPinnedChats();
  const next = pins.includes(orderId)
    ? pins.filter((p) => p !== orderId)
    : [...pins, orderId];
  try {
    window.localStorage.setItem(PIN_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}
