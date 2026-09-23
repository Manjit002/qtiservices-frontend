/**
 * Single source of truth for the backend origin.
 *
 * The legacy Thymeleaf pages used same-origin relative paths (`/orders/all`).
 * Keeping API_BASE_URL empty reproduces that exactly; setting it to an absolute
 * origin points the same paths at a remote backend. Nothing else in the app
 * should read process.env for URLs.
 */
export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? '').replace(/\/+$/, '');

/**
 * SockJS endpoint for the STOMP chat socket.
 *
 * This should normally be an ABSOLUTE backend URL. Next.js rewrites cannot
 * proxy a WebSocket upgrade, so a relative path only works when the frontend
 * and backend share an origin.
 */
export const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? '/ws/chat';

/** Prefix a backend path with the configured origin. */
export function apiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

/**
 * SockJS cannot take a relative URL when the page origin differs from the API
 * origin, so resolve it against API_BASE_URL (or window.location) at call time.
 */
export function wsUrl(): string {
  if (/^https?:\/\//i.test(WS_URL)) return WS_URL;
  if (API_BASE_URL) return `${API_BASE_URL}${WS_URL}`;
  if (typeof window !== 'undefined') return `${window.location.origin}${WS_URL}`;
  return WS_URL;
}
