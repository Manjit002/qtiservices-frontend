'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authService } from '@/lib/auth/authService';
import { ROUTES } from '@/lib/api/endpoints';
import type { AuthUser, AuthResponse, LoginCredentials } from '@/types';

type Portal = 'admin' | 'expert';

interface UseAuthResult {
  user: AuthUser | null;
  /** False until the first client-side read completes — avoids a hydration flash. */
  ready: boolean;
  isAuthenticated: boolean;
  isSuperAdmin: boolean;
  login: (credentials: LoginCredentials) => Promise<AuthResponse>;
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
    if (!allowed && ['ADMIN', 'SUPER_ADMIN', 'EXPERT'].includes(current.role)) {
      router.replace(
        current.role === 'EXPERT' ? ROUTES.expertDashboard : ROUTES.adminDashboard
      );
    }
  }, [portal, guard, router]);

  /** Authenticates and syncs the hook's own state so the UI updates immediately. */
  const login = useCallback(async (credentials: LoginCredentials) => {
    const res = await authService.login(credentials);
    setUser(authService.getUser());
    return res;
  }, []);

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
    logout,
  };
}
