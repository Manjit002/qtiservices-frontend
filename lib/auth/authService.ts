import type {
  AuthResponse, AuthUser, EmployeeChallenge, EmployeeLoginChallengeResponse,
  EmployeeVerifyOtpRequest, LoginCredentials, UserRole,
} from '@/types';
import { API, ROUTES } from '@/lib/api/endpoints';
import { apiUrl } from '@/lib/config';
import { userIdFromToken } from './jwt';
import { EmployeeAuthError, classifyAuthFailure, type AuthStep } from './authErrors';

/** A hung auth request must not leave the button spinning forever. */
const AUTH_TIMEOUT_MS = 20_000;
const OTP_RE = /^\d{6}$/;

/**
 * POST JSON to one of the two unauthenticated employee auth endpoints.
 *
 * Bare fetch on purpose, not apiFetch. apiFetch attaches whatever bearer token
 * is in storage, and treats any 401/403 as "session expired": it wipes storage
 * and hard-reloads to the login page. Here a 401 means "wrong password" or
 * "wrong code", and a reload would destroy the in-memory 2FA challenge.
 *
 * Nothing in this function logs. On failure the body is read only to choose a
 * message (authErrors) and then dropped — it is not carried on the error.
 */
async function postAuth<T>(path: string, payload: unknown, step: AuthStep): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), AUTH_TIMEOUT_MS);
  try {
    let res: Response;
    try {
      res = await fetch(apiUrl(path), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: ctrl.signal,
      });
    } catch {
      throw new EmployeeAuthError(ctrl.signal.aborted ? 'timeout' : 'network', 0, step);
    }

    let body: unknown = null;
    try {
      const raw = await res.text();
      try { body = raw ? JSON.parse(raw) : null; } catch { body = raw; }
    } catch {
      if (ctrl.signal.aborted) throw new EmployeeAuthError('timeout', res.status, step);
    }

    if (!res.ok) {
      throw new EmployeeAuthError(classifyAuthFailure(step, res.status, body), res.status, step);
    }
    return body as T;
  } finally {
    clearTimeout(timer);
  }
}

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

  /**
   * The dashboard a known employee role lives on — the one mapping both the
   * route guard (useAuth) and the post-sign-in redirect use. null for a role
   * this build doesn't know: those are left to the backend, never bounced.
   */
  homeFor(role: UserRole | null | undefined): string | null {
    if (role === 'EXPERT') return ROUTES.expertDashboard;
    if (role === 'ADMIN' || role === 'SUPER_ADMIN') return ROUTES.adminDashboard;
    return null;
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
   * 2FA step 1 — POST /auth/employee/login. The same endpoint backs both
   * portals and every employee role.
   *
   * Stores NOTHING. A correct password only earns a challenge: the backend
   * emails an OTP and returns a challengeToken, which the caller keeps in
   * memory for step 2. Fails closed — a response without a challengeToken is
   * an error even if it carries an accessToken (e.g. a backend that predates
   * 2FA), because tokens are accepted from verify-otp and nowhere else.
   */
  async login({ email, password }: LoginCredentials): Promise<EmployeeChallenge> {
    const data = await postAuth<EmployeeLoginChallengeResponse | null>(
      API.auth.employeeLogin, { email, password }, 'login'
    );
    const challengeToken = data && typeof data === 'object' ? data.challengeToken : undefined;
    if (typeof challengeToken !== 'string' || !challengeToken.trim()) {
      throw new EmployeeAuthError('bad-response', 200, 'login');
    }
    return { challengeToken };
  },

  /**
   * 2FA step 2 — POST /auth/employee/verify-otp { challengeToken, otp }.
   * The ONLY place an employee session is created. The OTP travels in the
   * JSON body as a string (leading zeros intact), never in a URL.
   */
  async verifyOtp(
    { challengeToken, otp }: EmployeeVerifyOtpRequest,
    email: string
  ): Promise<AuthResponse> {
    if (!challengeToken) throw new EmployeeAuthError('session', 0, 'verify');
    if (!OTP_RE.test(otp)) throw new EmployeeAuthError('invalid-otp', 0, 'verify');

    const payload: EmployeeVerifyOtpRequest = { challengeToken, otp };
    const data = await postAuth<AuthResponse | null>(API.auth.employeeVerifyOtp, payload, 'verify');
    if (!data || typeof data !== 'object' || typeof data.accessToken !== 'string' || !data.accessToken) {
      throw new EmployeeAuthError('bad-response', 200, 'verify');
    }

    // A new sign-in replaces whatever session was in storage. Clear first so a
    // field this response happens to omit can't leave the previous user's
    // value paired with the new token.
    authService.clear();
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
