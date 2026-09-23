'use client';

import { useCallback, useMemo, useState } from 'react';
import { Eye, EyeOff, UserPlus, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/hooks/useToast';
import { expertsApi } from '@/lib/api/experts';
import { CREATABLE_ROLES, MIN_PASSWORD_LENGTH } from '@/types/employee';
import type { UserRole } from '@/types';

interface Props {
  /** Called with the new account's email so the list can highlight it. */
  onCreated: (email: string) => void;
  /** SUPER_ADMIN is only offered to a super admin. */
  isSuperAdmin: boolean;
}

const ROLE_LABEL: Record<string, string> = {
  EXPERT: 'Expert',
  ADMIN: 'Admin',
  SUPER_ADMIN: 'Super admin',
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface Fields {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  managerId: string;
}

const EMPTY: Fields = { name: '', email: '', password: '', role: 'EXPERT', managerId: '' };

export function CreateExpertForm({ onCreated, isSuperAdmin }: Props) {
  const { showToast } = useToast();
  const [f, setF] = useState<Fields>(EMPTY);
  const [reveal, setReveal] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof Fields, string>>>({});
  const [formError, setFormError] = useState('');
  const [okMessage, setOkMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const set = <K extends keyof Fields>(k: K, v: Fields[K]) => {
    setF((prev) => ({ ...prev, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
    setFormError('');
  };

  /**
   * A super admin can mint another super admin; an ordinary admin cannot. This
   * mirrors the backend rule — it is a UX guard, not the enforcement, which
   * stays server-side.
   */
  const roles = useMemo(
    () => CREATABLE_ROLES.filter((r) => r !== 'SUPER_ADMIN' || isSuperAdmin),
    [isSuperAdmin]
  );

  /** Advisory only. The backend rule is the length minimum, nothing more. */
  const strength = useMemo(() => {
    const p = f.password;
    if (!p) return 0;
    let n = 0;
    if (p.length >= MIN_PASSWORD_LENGTH) n += 1;
    if (p.length >= 12) n += 1;
    if (/[A-Z]/.test(p) && /[a-z]/.test(p)) n += 1;
    if (/\d/.test(p) && /[^A-Za-z0-9]/.test(p)) n += 1;
    return n;
  }, [f.password]);

  const strengthColor = ['var(--line)', 'var(--danger)', 'var(--warning)', 'var(--info)', 'var(--success)'][strength];

  const validate = useCallback((): boolean => {
    const next: Partial<Record<keyof Fields, string>> = {};
    if (!f.name.trim()) next.name = 'Name is required.';
    if (!EMAIL_RE.test(f.email.trim())) next.email = 'Enter a valid email address.';
    if (f.password.length < MIN_PASSWORD_LENGTH) {
      next.password = `At least ${MIN_PASSWORD_LENGTH} characters.`;
    }
    if (f.managerId.trim() && !/^\d+$/.test(f.managerId.trim())) {
      next.managerId = 'Manager ID must be a number.';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }, [f]);

  const submit = useCallback(async () => {
    if (busy) return;                 // duplicate-submit guard
    setOkMessage('');
    if (!validate()) return;

    setBusy(true);
    setFormError('');
    try {
      await expertsApi.create({
        name: f.name.trim(),
        email: f.email.trim(),
        password: f.password,
        role: f.role,
        managerId: f.managerId.trim() || undefined,
      });
      setOkMessage(`${f.name.trim()} created as ${ROLE_LABEL[f.role] ?? f.role}.`);
      showToast('Expert created successfully.', 'success');
      onCreated(f.email.trim());
      // Cleared ONLY on success — a failed request keeps everything typed.
      setF(EMPTY);
      setReveal(false);
    } catch (e) {
      setFormError((e as Error).message);
      showToast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  }, [busy, validate, f, showToast, onCreated]);

  return (
    <section className="card ax-form-card">
      <div className="card-head">
        <div>
          <h2 className="t-h3">Create expert</h2>
          <p className="t-xs text-dim" style={{ marginTop: 2 }}>
            Creates an employee account and emails the credentials
          </p>
        </div>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); void submit(); }} noValidate>
        <div className="ax-fields">
          {formError && (
            <div className="alert error" role="alert">
              <AlertTriangle size={13} style={{ verticalAlign: -2, marginRight: 5 }} />
              {formError}
            </div>
          )}
          {okMessage && (
            <div className="alert success" role="status">
              <CheckCircle2 size={13} style={{ verticalAlign: -2, marginRight: 5 }} />
              {okMessage}
            </div>
          )}

          <div className="fl">
            <label htmlFor="ax-name">Full name<span className="ax-req">*</span></label>
            <input id="ax-name" className="fi" value={f.name} disabled={busy}
                   onChange={(e) => set('name', e.target.value)} placeholder="Jane Okafor"
                   aria-invalid={Boolean(errors.name)}
                   aria-describedby={errors.name ? 'ax-name-err' : undefined} />
            {errors.name && <span className="field-error" id="ax-name-err">{errors.name}</span>}
          </div>

          <div className="fl">
            <label htmlFor="ax-email">Email address<span className="ax-req">*</span></label>
            <input id="ax-email" type="email" className="fi" value={f.email} disabled={busy}
                   autoComplete="off"
                   onChange={(e) => set('email', e.target.value)}
                   placeholder="jane@myonlineclasspro.com"
                   aria-invalid={Boolean(errors.email)}
                   aria-describedby={errors.email ? 'ax-email-err' : undefined} />
            {errors.email && <span className="field-error" id="ax-email-err">{errors.email}</span>}
          </div>

          <div className="fl">
            <label htmlFor="ax-password">Password<span className="ax-req">*</span></label>
            <div className="ax-pw">
              <input
                id="ax-password"
                type={reveal ? 'text' : 'password'}
                className="fi"
                value={f.password}
                disabled={busy}
                autoComplete="new-password"
                onChange={(e) => set('password', e.target.value)}
                placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
                aria-invalid={Boolean(errors.password)}
                aria-describedby={errors.password ? 'ax-pw-err' : 'ax-pw-hint'}
              />
              <button type="button" className="ax-pw-eye" tabIndex={-1}
                      onClick={() => setReveal((v) => !v)}
                      aria-label={reveal ? 'Hide password' : 'Show password'}>
                {reveal ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            <div className="ax-meter" aria-hidden>
              {[1, 2, 3, 4].map((n) => (
                <span key={n} style={{ background: strength >= n ? strengthColor : 'var(--line)' }} />
              ))}
            </div>
            {errors.password
              ? <span className="field-error" id="ax-pw-err">{errors.password}</span>
              : <span className="t-xs text-faint" id="ax-pw-hint">
                  The account holder should change this after first sign-in.
                </span>}
          </div>

          <div className="fl">
            <label htmlFor="ax-role">Role<span className="ax-req">*</span></label>
            <select id="ax-role" className="fi" value={f.role} disabled={busy}
                    onChange={(e) => set('role', e.target.value as UserRole)}>
              {roles.map((r) => <option key={r} value={r}>{ROLE_LABEL[r] ?? r}</option>)}
            </select>
            {!isSuperAdmin && (
              <span className="t-xs text-faint">
                Only a super admin can create another super admin.
              </span>
            )}
          </div>

          <div className="fl">
            <label htmlFor="ax-manager">Manager ID</label>
            <input id="ax-manager" className="fi" value={f.managerId} disabled={busy}
                   inputMode="numeric"
                   onChange={(e) => set('managerId', e.target.value)}
                   placeholder="Optional"
                   aria-invalid={Boolean(errors.managerId)}
                   aria-describedby={errors.managerId ? 'ax-mgr-err' : undefined} />
            {errors.managerId
              ? <span className="field-error" id="ax-mgr-err">{errors.managerId}</span>
              : <span className="t-xs text-faint">
                  The employee ID of their manager. Leave blank if none.
                </span>}
          </div>

          <Button type="submit" variant="primary" size="lg" loading={busy} style={{ width: '100%' }}>
            <UserPlus size={15} /> {busy ? 'Creating account…' : 'Create expert'}
          </Button>

          <div className="oe-note">
            <Info size={14} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>
              The password is set once here and is never shown again — it does not appear
              anywhere in the employee list.
            </span>
          </div>
        </div>
      </form>
    </section>
  );
}
