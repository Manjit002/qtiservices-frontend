import type { AuthResponse, AuthUser, LoginCredentials, UserRole } from '@/types';
import { API, ROUTES } from '@/lib/api/endpoints';
import { apiUrl } from '@/lib/config';
import { userIdFromToken } from './jwt';

/**
 * The single place in the app that touches auth storage.
 *
 * Storage keys are kept byte-identical to the legacy pages ('token',
 * 'refreshToken', 'userId', 'userRole', 'userEmail') so that a half-migrated
 * deployment — legacy HTML on some routes, Next.js on others — shares one
 * session rather than logging the user out at the boundary.
 */
const KEYS = {
  token: 'token',
  refreshToken: 'refreshToken',
  userId: 'userId',
  role: 'userRole',
  email: 'userEmail',
} as const;

const isBrowser = () => typeof window !== 'undefined';

function read(key: string): string | null {
  if (!isBrowser()) return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* private mode / quota — non-fatal */
  }
}

function drop(key: string): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export const authService = {
  getToken: (): string | null => read(KEYS.token),
  getRefreshToken: (): string | null => read(KEYS.refreshToken),
  getRole: (): UserRole => (read(KEYS.role) ?? '') as UserRole,
  getEmail: (): string => read(KEYS.email) ?? '',

  /**
   * Prefer the JWT's `sub` claim over the stored userId — the legacy admin
   * dashboard derived the admin's own id this way because it is what the
   * backend's WebSocket interceptor uses as the principal name.
   */
  getUserId(): number | null {
    const fromToken = userIdFromToken(read(KEYS.token));
    if (fromToken !== null) return fromToken;
    const stored = read(KEYS.userId);
    if (!stored) return null;
    const n = parseInt(stored, 10);
    return Number.isNaN(n) ? null : n;
  },

  getUser(): AuthUser | null {
    const token = read(KEYS.token);
    if (!token) return null;
    return {
      id: authService.getUserId(),
      email: authService.getEmail(),
      role: authService.getRole(),
    };
  },

  isAuthenticated: (): boolean => Boolean(read(KEYS.token)),

  isSuperAdmin: (): boolean => read(KEYS.role) === 'SUPER_ADMIN',

  /** Admin portal accepts both admin tiers; expert portal accepts EXPERT. */
  canAccessAdmin(): boolean {
    const r = read(KEYS.role);
    return r === 'ADMIN' || r === 'SUPER_ADMIN';
  },

  canAccessExpert(): boolean {
    return read(KEYS.role) === 'EXPERT';
  },

  persist(data: AuthResponse, email: string): void {
    if (data.accessToken) write(KEYS.token, data.accessToken);
    if (data.refreshToken) write(KEYS.refreshToken, data.refreshToken);
    if (data.userId !== undefined && data.userId !== null) {
      write(KEYS.userId, String(data.userId));
    }
    if (data.role) write(KEYS.role, data.role);
    write(KEYS.email, email);
  },

  clear(): void {
    Object.values(KEYS).forEach(drop);
  },

  /**
   * POST /auth/employee/login — the same endpoint backs both portals, exactly
   * as in the original two login pages.
   */
  async login({ email, password }: LoginCredentials): Promise<AuthResponse> {
    const res = await fetch(apiUrl(API.auth.employeeLogin), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { message?: string };
      throw new Error(body.message || 'Invalid credentials.');
    }

    const data = (await res.json()) as AuthResponse;
    authService.persist(data, email);
    return data;
  },

  /** Clear session and send the user to the login page for their portal. */
  logout(portal: 'admin' | 'expert' = 'admin'): void {
    authService.clear();
    if (isBrowser()) {
      window.location.href =
        portal === 'expert' ? ROUTES.expertLogin : ROUTES.adminLogin;
    }
  },
};
