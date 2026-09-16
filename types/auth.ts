export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'EXPERT' | (string & {});

/** Response body of POST /auth/employee/login. */
export interface AuthResponse {
  accessToken?: string;
  refreshToken?: string;
  userId?: number | string;
  role?: UserRole;
  message?: string;
}

export interface AuthUser {
  id: number | null;
  email: string;
  role: UserRole;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

/** Decoded JWT payload — `sub` carries the employee id. */
export interface JwtPayload {
  sub?: string;
  exp?: number;
  iat?: number;
  role?: string;
  [key: string]: unknown;
}
