import type { JwtPayload } from '@/types';

/**
 * Decode a JWT payload client-side.
 *
 * This mirrors the legacy `decodeJwtPayload()` exactly and for the same reason:
 * the payload is just base64url-encoded JSON and is the only place the logged-in
 * employee's own id is available. `sub` is the employee id — the backend's
 * WebSocketAuthInterceptor derives it identically via principal.getName().
 *
 * This is NOT verification. The signature is only ever checked server-side.
 */
export function decodeJwtPayload(jwt: string): JwtPayload | null {
  try {
    const part = jwt.split('.')[1];
    if (!part) return null;
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join('')
    );
    return JSON.parse(json) as JwtPayload;
  } catch {
    return null;
  }
}

/** Employee id from the token's `sub` claim, or null. */
export function userIdFromToken(jwt: string | null): number | null {
  if (!jwt) return null;
  const sub = decodeJwtPayload(jwt)?.sub;
  if (!sub) return null;
  const n = parseInt(sub, 10);
  return Number.isNaN(n) ? null : n;
}

/** True when the token carries an `exp` that has already passed. */
export function isTokenExpired(jwt: string | null): boolean {
  if (!jwt) return true;
  const exp = decodeJwtPayload(jwt)?.exp;
  if (typeof exp !== 'number') return false; // no exp claim — let the backend decide
  return Date.now() >= exp * 1000;
}
