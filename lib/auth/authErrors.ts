/**
 * Employee sign-in failures → fixed, user-facing messages.
 *
 * The backend's failure bodies are not a published contract. Depending on
 * whether an exception handler catches the error, Spring answers with
 * `{ message }`, with its default `{ error, status, path }` (no message), or
 * with plain text — and an unhandled exception on a permitted path can even
 * surface as a bare 401/403 through the /error dispatch. So the body is used
 * ONLY to classify the failure. It is never displayed, never attached to the
 * thrown error and never logged: whatever the server sends — a stack trace
 * included — the employee only ever sees one of the sentences below.
 */

export type AuthStep = 'login' | 'verify';

export type AuthErrorKind =
  | 'credentials'
  | 'invalid-otp'
  | 'otp-expired'
  | 'otp-used'
  | 'attempts'
  | 'session'
  | 'inactive'
  | 'not-found'
  | 'rate-limited'
  | 'timeout'
  | 'network'
  | 'server'
  | 'bad-response';

export const AUTH_MESSAGES: Readonly<Record<AuthErrorKind, string>> = {
  credentials: 'Incorrect email or password. Please try again.',
  'invalid-otp': 'Invalid verification code. Please check the code and try again.',
  'otp-expired': 'This verification code has expired. Please log in again.',
  'otp-used': 'This verification code has already been used. Please log in again.',
  attempts: 'Maximum verification attempts exceeded. Please log in again.',
  session: 'Your login session has expired. Please log in again.',
  inactive: 'Your employee account is inactive. Please contact your administrator.',
  'not-found': 'This employee account could not be found. Please contact your administrator.',
  'rate-limited': 'Too many sign-in attempts. Please wait a moment and try again.',
  timeout: 'The server took too long to respond. Please try again.',
  network: "We couldn't reach the server. Check your connection and try again.",
  server: 'Something went wrong on our side. Please try again in a moment.',
  'bad-response': "Sign-in couldn't be completed. Please try again.",
};

/**
 * Failures after which the challenge is unusable. During OTP verification
 * these send the employee back to the email/password step rather than letting
 * them keep submitting codes against a dead challenge.
 */
const RESTART: ReadonlySet<AuthErrorKind> = new Set<AuthErrorKind>([
  'otp-expired', 'otp-used', 'attempts', 'session', 'inactive', 'not-found', 'bad-response',
]);

export class EmployeeAuthError extends Error {
  readonly kind: AuthErrorKind;
  /** HTTP status, or 0 when no response arrived. */
  readonly status: number;
  /** True when the employee must start again from email + password. */
  readonly restart: boolean;

  constructor(kind: AuthErrorKind, status: number, step: AuthStep) {
    super(AUTH_MESSAGES[kind]);
    this.name = 'EmployeeAuthError';
    this.kind = kind;
    this.status = status;
    this.restart = step === 'verify' && RESTART.has(kind);
  }
}

/**
 * Only the human-readable fields are read. `path` in particular is skipped:
 * it would contain "verify-otp" and match the OTP patterns on every error.
 */
function readableText(body: unknown): string {
  if (typeof body === 'string') return body.slice(0, 600);
  if (body && typeof body === 'object') {
    const b = body as Record<string, unknown>;
    return ['message', 'error', 'detail', 'title']
      .map((k) => (typeof b[k] === 'string' ? (b[k] as string) : ''))
      .join(' ')
      .slice(0, 600);
  }
  return '';
}

const RE = {
  inactive: /\binactive\b|in-active|deactivated|\bdisabled\b|not active|suspended/,
  // "2 attempts remaining" must NOT read as exhausted — it needs a limit word.
  attempts: /too many|\b(max|maximum|exceeded?|limit)\b.*\battempts?\b|\battempts?\b.*\b(exceeded?|limit|max|maximum)\b/,
  used: /already (been )?used|already verified|\bconsumed\b/,
  session: /\bchallenge\b|\bsession\b/,
  expired: /expired/,
  // A bare "Not Found" (Spring's default `error` for any 404) is deliberately
  // not enough — it has to be about an account.
  notFound: /\b(employee|account|user)\b[^.]*\b(not found|does ?n[o']t exist)|\bno (such )?(employee|account|user)\b/,
  wrongCode: /invalid|incorrect|wrong|mismatch|does ?n[o']t match|not match/,
  wrongLogin: /credential|password|invalid|incorrect|wrong/,
};

/**
 * Map a failed auth response to a kind. Recognisable wording wins over the
 * status code (a backend that maps every RuntimeException to 500 still yields
 * "invalid code" rather than "server error"); the status code decides only
 * when the wording says nothing useful.
 */
export function classifyAuthFailure(step: AuthStep, status: number, body: unknown): AuthErrorKind {
  const t = readableText(body).toLowerCase();

  if (RE.inactive.test(t)) return 'inactive';
  if (RE.attempts.test(t)) return step === 'verify' ? 'attempts' : 'rate-limited';

  if (step === 'verify') {
    if (RE.used.test(t)) return 'otp-used';
    if (RE.session.test(t)) return 'session';
    if (RE.expired.test(t)) return 'otp-expired';
    if (RE.notFound.test(t)) return 'not-found';
    if (RE.wrongCode.test(t)) return 'invalid-otp';
  } else {
    // "No such account" and "wrong password" get the same answer at the
    // password step, so the form can't be used to probe which emails exist.
    if (RE.notFound.test(t) || RE.wrongLogin.test(t)) return 'credentials';
  }

  if (status === 429) return step === 'verify' ? 'attempts' : 'rate-limited';
  if (status === 423) return 'inactive';
  if (status >= 500) return 'server';
  if (step === 'login') return 'credentials';
  if (status === 404 || status === 410) return 'session';
  return 'invalid-otp';
}
