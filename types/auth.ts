export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'EXPERT' | (string & {});

/**
 * Response body of POST /auth/employee/verify-otp (backend AuthResponseDTO) —
 * the only employee auth response that carries tokens.
 */
export interface AuthResponse {
  accessToken?: string;
  refreshToken?: string;
  userId?: number | string;
  role?: UserRole;
  message?: string;
}

/**
 * Response body of POST /auth/employee/login (backend
 * EmployeeLogin2FAResponseDTO). Password accepted, OTP emailed — NOT signed in.
 * There is deliberately no token field here.
 */
export interface EmployeeLoginChallengeResponse {
  requiresTwoFactor?: boolean;
  message?: string;
  challengeToken?: string;
  userId?: number | string;
  role?: UserRole;
}

/** What the sign-in form keeps between the two steps — in memory only. */
export interface EmployeeChallenge {
  /** Opaque, short-lived, single-purpose. Not a JWT and never an auth token. */
  challengeToken: string;
}

/** Request body of POST /auth/employee/verify-otp (backend EmployeeVerifyOtpRequestDTO). */
export interface EmployeeVerifyOtpRequest {
  challengeToken: string;
  otp: string;
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
