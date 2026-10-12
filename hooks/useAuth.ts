'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authService } from '@/lib/auth/authService';
import { ROUTES } from '@/lib/api/endpoints';
import type {
  AuthUser, AuthResponse, EmployeeChallenge, EmployeeVerifyOtpRequest, LoginCredentials,
} from '@/types';

type Portal = 'admin' | 'expert';

interface UseAuthResult {
  user: AuthUser | null;
  /** False until the first client-side read completes — avoids a hydration flash. */
  ready: boolean;
  isAuthenticated: boolean;
  isSuperAdmin: boolean;
  /** 2FA step 1. Resolves to a challenge — the employee is NOT signed in yet. */
  login: (credentials: LoginCredentials) => Promise<EmployeeChallenge>;
  /** 2FA step 2. The only call that signs an employee in. */
  verifyOtp: (request: EmployeeVerifyOtpRequest, email: string) => Promise<AuthResponse>;
  logout: () => void;
}

/**
 * Reads auth state on the client and guards the route.
 *
 * localStorage does not exist during SSR, so the check has to run in an effect;
 * `ready` lets callers render a neutral shell for that one frame instead of
 * flashing either the dashboard or the login page incorrectly.
 *
 * This is UX only. The Spring Boot backend remains the authorization authority —
 * an expert who edits localStorage still gets 403s from every admin endpoint.
 */
export function useAuth(portal: Portal = 'admin', guard = true): UseAuthResult {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const current = authService.getUser();
    setUser(current);
    setReady(true);

    if (!guard) return;

    const loginRoute = portal === 'expert' ? ROUTES.expertLogin : ROUTES.adminLogin;

    if (!current) {
      router.replace(loginRoute);
      return;
    }

    const allowed =
      portal === 'expert' ? authService.canAccessExpert() : authService.canAccessAdmin();

    // A role we don't recognise is left alone rather than bounced: the backend
    // will reject anything it shouldn't see, and guessing here risks locking out
    // a legitimate role added on the backend after this build.
    const home = authService.homeFor(current.role);
    if (!allowed && home) router.replace(home);
  }, [portal, guard, router]);

  /**
   * Password step. Deliberately does not touch `user`: nothing is stored until
   * the OTP is verified, and a pending challenge is not a session.
   */
  const login = useCallback(
    (credentials: LoginCredentials) => authService.login(credentials),
    []
  );

  /** OTP step. Persists the session, then syncs the hook so the UI updates at once. */
  const verifyOtp = useCallback(
    async (request: EmployeeVerifyOtpRequest, email: string) => {
      const res = await authService.verifyOtp(request, email);
      setUser(authService.getUser());
      return res;
    },
    []
  );

  const logout = useCallback(() => {
    authService.clear();
    router.replace(portal === 'expert' ? ROUTES.expertLogin : ROUTES.adminLogin);
  }, [portal, router]);

  return {
    user,
    ready,
    isAuthenticated: Boolean(user),
    isSuperAdmin: user?.role === 'SUPER_ADMIN',
    login,
    verifyOtp,
    logout,
  };
}
