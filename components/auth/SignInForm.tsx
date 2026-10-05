'use client';

import { useCallback, useEffect, useRef, useState, type ClipboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
  Eye, EyeOff, AlertTriangle, CheckCircle2, ShieldCheck, Lock, ArrowLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';
import { authService } from '@/lib/auth/authService';
import { AUTH_MESSAGES, EmployeeAuthError } from '@/lib/auth/authErrors';

interface SignInFormProps {
  portal: 'admin' | 'expert';
  heading: string;
  sub: string;
  emailPlaceholder: string;
  cta: string;
  redirectTo: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OTP_LENGTH = 6;
const onlyDigits = (v: string) => v.replace(/\D/g, '').slice(0, OTP_LENGTH);

/**
 * Only messages we wrote ever reach the screen. An EmployeeAuthError already
 * carries one of the fixed sentences; anything else (a bug, an unexpected
 * throw) gets a generic line rather than its raw text.
 */
const messageOf = (e: unknown) =>
  e instanceof EmployeeAuthError ? e.message : AUTH_MESSAGES['bad-response'];

type Step = 'credentials' | 'otp';

/**
 * The pending 2FA challenge. It lives in this component's state and nowhere
 * else — not in storage, not in the URL, not in the auth hook — so it is
 * discarded when the employee goes back, refreshes or leaves the page, and it
 * can never be mistaken for a session: guards only look at the stored
 * accessToken, which does not exist until the OTP is verified.
 */
interface PendingChallenge {
  challengeToken: string;
  /** The address the code was sent for — stored with the session on success. */
  email: string;
}

/**
 * Employee sign-in, used by both portals and every employee role:
 *
 *   email + password → POST /auth/employee/login     → challenge (no tokens)
 *   6-digit code     → POST /auth/employee/verify-otp → tokens → role's dashboard
 *
 * Both steps happen in place: no reload and no URL change between them.
 */
export function SignInForm({
  portal, heading, sub, emailPlaceholder, cta, redirectTo,
}: SignInFormProps) {
  const router = useRouter();
  // guard=false — this IS the login page; running the guard here would bounce
  // an unauthenticated expert to the admin login.
  const { login, verifyOtp, user, ready } = useAuth(portal, false);

  /**
   * Someone who is already signed in has no reason to see this form — and the
   * main way they arrive is by pressing Back from inside the portal. Send them
   * on to the portal, with replace() so this page leaves the history stack
   * rather than becoming a wall Back keeps hitting.
   *
   * Decided once, on arrival. A fresh sign-in below also sets `user`, and must
   * not trigger a second navigation racing the confirmation message.
   */
  const arrivalChecked = useRef(false);
  useEffect(() => {
    if (!ready || arrivalChecked.current) return;
    arrivalChecked.current = true;
    if (!user) return;
    const allowed = portal === 'expert' ? authService.canAccessExpert() : authService.canAccessAdmin();
    if (allowed) router.replace(redirectTo);
  }, [ready, user, portal, redirectTo, router]);

  const [step, setStep] = useState<Step>('credentials');
  const [pending, setPending] = useState<PendingChallenge | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [reveal, setReveal] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; otp?: string }>({});
  const [formError, setFormError] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  // A ref, not state: two Enter presses in the same tick both still read
  // busy === false, and would send two requests.
  const inFlight = useRef(false);
  const otpRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const returningToLogin = useRef(false);

  // Focus follows the step: the code field when it appears, the password
  // field (email is kept) when the employee is sent back.
  useEffect(() => {
    if (step === 'otp') {
      otpRef.current?.focus();
    } else if (returningToLogin.current) {
      returningToLogin.current = false;
      passwordRef.current?.focus();
    }
  }, [step]);

  /** Drop the challenge and everything typed against it; return to step 1. */
  const backToLogin = useCallback((message = '') => {
    setPending(null);
    setOtp('');
    setErrors({});
    setFormError(message);
    returningToLogin.current = true;
    setStep('credentials');
  }, []);

  /**
   * Leaving the page normally destroys this state. The exception is the
   * back/forward cache, which freezes the page and can restore it — challenge
   * and all — when the employee comes back with Back. Treat that return as a
   * fresh visit. (Not pagehide/visibilitychange: switching to the mail app or
   * another tab to read the code must NOT throw the challenge away.)
   */
  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => {
      if (!e.persisted) return;
      setPending(null);
      setOtp('');
      setErrors({});
      setFormError('');
      setStep('credentials');
    };
    window.addEventListener('pageshow', onShow);
    return () => window.removeEventListener('pageshow', onShow);
  }, []);

  const submitCredentials = useCallback(async () => {
    if (inFlight.current) return;
    setFormError('');
    const next: typeof errors = {};
    if (!EMAIL_RE.test(email.trim())) next.email = 'Enter a valid email address.';
    if (!password) next.password = 'Enter your password.';
    setErrors(next);
    if (Object.keys(next).length) return;

    inFlight.current = true;
    setBusy(true);
    const address = email.trim();
    try {
      const { challengeToken } = await login({ email: address, password });
      // The password has done its job — don't hold it in memory through step 2.
      setPassword('');
      setReveal(false);
      setOtp('');
      setErrors({});
      setPending({ challengeToken, email: address });
      setStep('otp');
    } catch (e) {
      setFormError(messageOf(e));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }, [email, password, login]);

  const submitOtp = useCallback(async () => {
    // No challenge, no request: after Back to Login there is nothing to verify.
    if (inFlight.current || !pending) return;
    setFormError('');
    if (otp.length !== OTP_LENGTH) {
      setErrors({ otp: 'Enter the 6-digit code from your email.' });
      otpRef.current?.focus();
      return;
    }
    setErrors({});

    inFlight.current = true;
    setBusy(true);
    try {
      const res = await verifyOtp({ challengeToken: pending.challengeToken, otp }, pending.email);
      setPending(null); // spent
      setOtp('');
      setDone(true);
      // Existing role routing: the role's own dashboard; a role this build
      // doesn't know lands on this portal's dashboard, where the guard leaves
      // it to the backend. replace(), not push — see arrivalChecked above.
      const home = authService.homeFor(res.role) ?? redirectTo;
      setTimeout(() => router.replace(home), 600);
      // Stay busy: the controls remain disabled until the route changes.
    } catch (e) {
      inFlight.current = false;
      setBusy(false);
      if (e instanceof EmployeeAuthError && e.restart) {
        backToLogin(e.message);
        return;
      }
      setFormError(messageOf(e));
      // Keep the code visible but selected, so retyping replaces it.
      otpRef.current?.select();
    }
  }, [pending, otp, verifyOtp, redirectTo, router, backToLogin]);

  /**
   * Paste is handled by hand. The field's maxLength would otherwise cut
   * "483 921" or "Code: 483-921" to six characters BEFORE the digits are
   * extracted, leaving five digits.
   */
  const onOtpPaste = useCallback((e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const digits = e.clipboardData.getData('text').replace(/\D/g, '');
    if (!digits) return;
    const el = e.currentTarget;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    setOtp(
      digits.length >= OTP_LENGTH
        ? digits.slice(0, OTP_LENGTH)
        : onlyDigits(el.value.slice(0, start) + digits + el.value.slice(end))
    );
    setErrors((prev) => (prev.otp ? { ...prev, otp: undefined } : prev));
  }, []);

  const alerts = (
    <>
      {formError && (
        <div className="auth-alert err" role="alert">
          <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>{formError}</span>
        </div>
      )}
      {done && (
        <div className="auth-alert ok" role="status">
          <CheckCircle2 size={15} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>Signed in. Taking you to your dashboard&hellip;</span>
        </div>
      )}
    </>
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void (step === 'otp' ? submitOtp() : submitCredentials());
      }}
      noValidate
      aria-busy={busy}
      style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s4)' }}
    >
      {step === 'otp' ? (
        <>
          <div>
            <h2 className="t-h2">Verify Your Identity</h2>
            <p className="t-sm text-dim" id="otp-help" style={{ marginTop: 4 }}>
              We&apos;ve sent a 6-digit verification code to your registered email address.
            </p>
            {pending && (
              <p className="t-xs text-faint" style={{ marginTop: 6, overflowWrap: 'anywhere' }}>
                Signing in as <span className="text-mid">{pending.email}</span>
              </p>
            )}
          </div>

          {alerts}

          <div className="field">
            <label htmlFor="otp">Verification code</label>
            <input
              ref={otpRef}
              id="otp"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="one-time-code"
              enterKeyHint="done"
              maxLength={OTP_LENGTH}
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
              className={`input otp-input${errors.otp ? ' invalid' : ''}`}
              placeholder="••••••"
              value={otp}
              onChange={(e) => {
                setOtp(onlyDigits(e.target.value));
                if (errors.otp) setErrors((prev) => ({ ...prev, otp: undefined }));
              }}
              onPaste={onOtpPaste}
              // readOnly rather than disabled: a disabled field drops focus,
              // and the employee should still be in it if the code is wrong.
              readOnly={busy}
              aria-invalid={Boolean(errors.otp)}
              aria-describedby={errors.otp ? 'otp-help otp-err' : 'otp-help'}
            />
            {errors.otp && <span className="field-error" id="otp-err">{errors.otp}</span>}
          </div>

          <Button type="submit" variant="primary" size="lg" loading={busy} style={{ width: '100%' }}>
            {busy ? 'Verifying...' : 'Verify & Continue'}
          </Button>

          <Button
            type="button"
            variant="ghost"
            onClick={() => backToLogin()}
            disabled={busy}
            style={{ alignSelf: 'center' }}
          >
            <ArrowLeft size={14} aria-hidden /> Back to Login
          </Button>

          <p className="t-xs text-faint" style={{ textAlign: 'center' }}>
            Didn&apos;t get the code? Check your spam folder, or go back and log in again to receive a new one.
          </p>
        </>
      ) : (
        <>
          <div>
            <h2 className="t-h2">{heading}</h2>
            <p className="t-sm text-dim" style={{ marginTop: 4 }}>{sub}</p>
          </div>

          {alerts}

          <div className="field">
            <label htmlFor="email">Email</label>
            <input suppressHydrationWarning
              id="email"
              type="email"
              autoComplete="email"
              className={`input${errors.email ? ' invalid' : ''}`}
              placeholder={emailPlaceholder}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={busy}
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? 'email-err' : undefined}
            />
            {errors.email && <span className="field-error" id="email-err">{errors.email}</span>}
          </div>

          <div className="field">
            <label htmlFor="password">Password</label>
            <div style={{ position: 'relative' }}>
              <input suppressHydrationWarning
                ref={passwordRef}
                id="password"
                type={reveal ? 'text' : 'password'}
                autoComplete="current-password"
                className={`input${errors.password ? ' invalid' : ''}`}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={busy}
                style={{ paddingRight: 38 }}
                aria-invalid={Boolean(errors.password)}
                aria-describedby={errors.password ? 'pw-err' : undefined}
              />
              <button suppressHydrationWarning
                type="button"
                className="pw-toggle"
                onClick={() => setReveal((v) => !v)}
                aria-label={reveal ? 'Hide password' : 'Show password'}
                tabIndex={-1}
              >
                {reveal ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {errors.password && <span className="field-error" id="pw-err">{errors.password}</span>}
          </div>

          <Button suppressHydrationWarning type="submit" variant="primary" size="lg" loading={busy} style={{ width: '100%' }}>
            {busy ? 'Logging in...' : cta}
          </Button>
        </>
      )}

      <div className="auth-foot">
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Lock size={12} /> Encrypted</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><ShieldCheck size={12} /> Role-based access</span>
      </div>
    </form>
  );
}
