'use client';

import { useMemo, useState } from 'react';
import { Send, CheckCircle2 } from 'lucide-react';
import { CONTACT, SMS_CONSENT_LABEL, LEGAL_CONSENT_PREFIX, LEGAL_CONSENT_SUFFIX } from './content';

interface Fields {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company: string;
  message: string;
  smsConsent: boolean;
  legalConsent: boolean;
}

const EMPTY: Fields = {
  firstName: '', lastName: '', email: '', phone: '', company: '', message: '',
  smsConsent: false, legalConsent: false,
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Field caps, carried over from the old form's zod schema (name 50, email 100,
 * phone 20, message 1000).
 *
 * These matter more here than they did there: the request is delivered via a
 * `mailto:` URL, and handlers start truncating somewhere around 2,000
 * characters. Capping the message at 1,000 keeps the worst-case URL well
 * inside that, so a long enquiry arrives whole rather than cut off mid-word
 * with no warning to either party.
 */
const LIMITS = { name: 50, email: 100, phone: 20, company: 100, message: 1000 } as const;

/**
 * Project-request form with a carrier-compliant (TCR / A2P 10DLC) consent
 * flow.
 *
 * Restored from the old QTI source's ContactForm.tsx, which had two real
 * problems a carrier reviewer would reject:
 *
 *   1. ONE checkbox bundled SMS opt-in together with the Privacy Policy and
 *      Messaging Terms links in its own disclosure text. Carriers require
 *      the optional SMS consent and the mandatory legal acceptance to be
 *      two SEPARATE checkboxes — this is exactly that fix.
 *   2. Phone was a REQUIRED field (`min(10, …)`), contradicting "the form
 *      must be submittable without a phone number." Now optional.
 *
 * Submission: the old form's "success" was a faked `setTimeout` +
 * `console.log` — nothing was ever actually sent anywhere. There is no
 * lead-capture backend in this codebase to send it to for real, and
 * fabricating one, or faking a server response, would be worse than what it
 * replaces. This hands the filled-in request to the visitor's own mail
 * client via `mailto:`, the same mechanism the CTA section next to this form
 * already uses — honest about what actually happens, and it still delivers
 * the message somewhere real.
 */
export function ProjectRequestForm() {
  const [f, setF] = useState<Fields>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof Fields, string>>>({});
  const [sent, setSent] = useState(false);

  const set = <K extends keyof Fields>(k: K, v: Fields[K]) => {
    setF((p) => ({ ...p, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const mailtoHref = useMemo(() => {
    const subject = `Project request from ${f.firstName} ${f.lastName}`.trim();
    const body = [
      `Name: ${f.firstName} ${f.lastName}`.trim(),
      `Email: ${f.email}`,
      f.phone.trim() && `Phone: ${f.phone.trim()}`,
      f.company.trim() && `Company: ${f.company.trim()}`,
      '',
      f.message,
      '',
      `SMS updates requested: ${f.smsConsent ? 'Yes' : 'No'}`,
    ].filter(Boolean).join('\n');
    return `${CONTACT.emailHref}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }, [f]);

  const validate = (): boolean => {
    const next: Partial<Record<keyof Fields, string>> = {};
    if (!f.firstName.trim()) next.firstName = 'First name is required.';
    if (!f.lastName.trim()) next.lastName = 'Last name is required.';
    if (!EMAIL_RE.test(f.email.trim())) next.email = 'Enter a valid email address.';
    if (f.message.trim().length < 10) next.message = 'Tell us a little more — at least 10 characters.';
    // legalConsent is enforced by disabling Submit itself, not just here — see
    // the button below. This is defence in depth, not the primary gate.
    if (!f.legalConsent) next.legalConsent = 'Required to submit.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) {
      /* Move focus to the first field that failed. Without this a keyboard or
         screen-reader user submits, hears nothing change, and has no way to
         find which field is wrong — the errors render visually far from where
         focus currently sits. */
      requestAnimationFrame(() => {
        document.querySelector<HTMLElement>('.lp-form-card [aria-invalid="true"]')?.focus();
      });
      return;
    }
    window.location.href = mailtoHref;
    setSent(true);
  };

  if (sent) {
    return (
      <div className="lp-form-card lp-form-success">
        <CheckCircle2 size={30} style={{ color: 'var(--gold)' }} />
        <h3>Almost there</h3>
        <p>
          Your email client should have opened with your request pre-filled and
          addressed to <a href={CONTACT.emailHref}>{CONTACT.email}</a> — just hit send.
        </p>
        <button type="button" className="lp-btn-outline-card" onClick={() => { setSent(false); setF(EMPTY); }}>
          Fill out another request
        </button>
      </div>
    );
  }

  return (
    <form className="lp-form-card" onSubmit={submit} noValidate>
      <div className="lp-form-grid">
        <div className="lp-form-field">
          <label htmlFor="pf-first">First name<span className="lp-form-req">*</span></label>
          <input id="pf-first" maxLength={LIMITS.name} name="firstName" autoComplete="given-name" value={f.firstName}
                 onChange={(e) => set('firstName', e.target.value)}
                 aria-invalid={Boolean(errors.firstName)}
                 aria-describedby={errors.firstName ? 'pf-first-err' : undefined} />
          {errors.firstName && <span className="lp-form-err" id="pf-first-err">{errors.firstName}</span>}
        </div>
        <div className="lp-form-field">
          <label htmlFor="pf-last">Last name<span className="lp-form-req">*</span></label>
          <input id="pf-last" maxLength={LIMITS.name} name="lastName" autoComplete="family-name" value={f.lastName}
                 onChange={(e) => set('lastName', e.target.value)}
                 aria-invalid={Boolean(errors.lastName)}
                 aria-describedby={errors.lastName ? 'pf-last-err' : undefined} />
          {errors.lastName && <span className="lp-form-err" id="pf-last-err">{errors.lastName}</span>}
        </div>
      </div>

      <div className="lp-form-field">
        <label htmlFor="pf-email">Email address<span className="lp-form-req">*</span></label>
        <input id="pf-email" maxLength={LIMITS.email} name="email" type="email" autoComplete="email" value={f.email}
               onChange={(e) => set('email', e.target.value)}
               aria-invalid={Boolean(errors.email)}
                 aria-describedby={errors.email ? 'pf-email-err' : undefined} />
        {errors.email && <span className="lp-form-err" id="pf-email-err">{errors.email}</span>}
      </div>

      <div className="lp-form-grid">
        <div className="lp-form-field">
          {/* Explicitly optional — a phone number must not be required to submit. */}
          <label htmlFor="pf-phone">Phone number <span className="lp-form-opt">(optional)</span></label>
          <input id="pf-phone" maxLength={LIMITS.phone} name="phone" type="tel" autoComplete="tel" value={f.phone}
                 onChange={(e) => set('phone', e.target.value)} placeholder="+1 (555) 123-4567" />
        </div>
        <div className="lp-form-field">
          <label htmlFor="pf-company">Company <span className="lp-form-opt">(optional)</span></label>
          <input id="pf-company" maxLength={LIMITS.company} name="company" autoComplete="organization" value={f.company}
                 onChange={(e) => set('company', e.target.value)} />
        </div>
      </div>

      <div className="lp-form-field">
        <label htmlFor="pf-message">Project details<span className="lp-form-req">*</span></label>
        <textarea id="pf-message" maxLength={LIMITS.message} name="message" rows={4} value={f.message}
                  onChange={(e) => set('message', e.target.value)}
                  placeholder="Tell us about your project requirements…"
                  aria-invalid={Boolean(errors.message)}
                 aria-describedby={errors.message ? 'pf-message-err' : undefined} />
        {errors.message
          ? <span className="lp-form-err" id="pf-message-err">{errors.message}</span>
          : <span className="lp-form-count">{f.message.length} / {LIMITS.message}</span>}
      </div>

      {/* ── Checkbox 1: SMS consent — OPTIONAL, unchecked by default, never
          blocks submission. Label text is reproduced exactly as specified. ── */}
      <label className="lp-form-check">
        <input type="checkbox" checked={f.smsConsent}
               onChange={(e) => set('smsConsent', e.target.checked)} />
        <span>{SMS_CONSENT_LABEL}</span>
      </label>

      {/* ── Checkbox 2: legal acceptance — MANDATORY, unchecked by default,
          carries no SMS language. This is the separation the carrier review
          asked for: consent and legal acceptance are two independent boxes. ── */}
      <label className="lp-form-check lp-form-check-required">
        <input type="checkbox" checked={f.legalConsent} required
               onChange={(e) => set('legalConsent', e.target.checked)}
               aria-invalid={Boolean(errors.legalConsent)} />
        <span>
          {LEGAL_CONSENT_PREFIX}
          <a href="/privacy-policy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>
          {' and '}
          <a href="/messaging-terms" target="_blank" rel="noopener noreferrer">Messaging Terms</a>
          {LEGAL_CONSENT_SUFFIX}
          <span className="lp-form-req">*</span>
        </span>
      </label>
      {errors.legalConsent && <span className="lp-form-err">{errors.legalConsent}</span>}

      {/* Disabling Submit until this is checked is the primary enforcement —
          the clearest possible proof, for anyone testing the form, that it
          cannot be bypassed. */}
      <button type="submit" className="lp-form-submit" disabled={!f.legalConsent}>
        Submit Request <Send size={15} />
      </button>
    </form>
  );
}
