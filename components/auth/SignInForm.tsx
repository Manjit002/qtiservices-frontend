'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, AlertTriangle, CheckCircle2, ShieldCheck, Lock } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';

interface SignInFormProps {
  portal: 'admin' | 'expert';
  heading: string;
  sub: string;
  emailPlaceholder: string;
  cta: string;
  redirectTo: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function SignInForm({
  portal, heading, sub, emailPlaceholder, cta, redirectTo,
}: SignInFormProps) {
  const router = useRouter();
  // guard=false — this IS the login page; running the guard here would bounce
  // an unauthenticated expert to the admin login.
  const { login } = useAuth(portal, false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [reveal, setReveal] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = useCallback(async () => {
    setFormError('');
    const next: typeof errors = {};
    if (!EMAIL_RE.test(email.trim())) next.email = 'Enter a valid email address.';
    if (!password) next.password = 'Enter your password.';
    setErrors(next);
    if (Object.keys(next).length) return;

    setBusy(true);
    try {
      await login({ email: email.trim(), password });
      setDone(true);
      // Brief hold so the confirmation is legible before the route changes.
      setTimeout(() => router.push(redirectTo), 600);
    } catch (e) {
      setFormError((e as Error).message);
      setBusy(false);
    }
  }, [email, password, login, router, redirectTo]);

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); void submit(); }}
      noValidate
      style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s4)' }}
    >
      <div>
        <h2 className="t-h2">{heading}</h2>
        <p className="t-sm text-dim" style={{ marginTop: 4 }}>{sub}</p>
      </div>

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

      <div className="field">
        <label htmlFor="email">Email</label>
        <input
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
          <input
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
          <button
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

      <Button type="submit" variant="primary" size="lg" loading={busy} style={{ width: '100%' }}>
        {busy ? 'Signing in' : cta}
      </Button>

      <div className="auth-foot">
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Lock size={12} /> Encrypted</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><ShieldCheck size={12} /> Role-based access</span>
      </div>
    </form>
  );
}
