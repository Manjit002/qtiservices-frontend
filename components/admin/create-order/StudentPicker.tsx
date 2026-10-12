'use client';

import { useCallback, useEffect, useState } from 'react';
import { Search, X, UserCheck, UserPlus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useDebounce } from '@/hooks/useDebounce';
import { handleUnauthorized } from '@/lib/api/client';
import { classifyQuery, classifySearchError, studentsApi } from '@/lib/api/students';
import { fmtStudentId } from '@/lib/utils/format';
import type { StudentProfileResponse } from '@/types';

/** What the form actually submits — these four fields, not a student id. */
export interface StudentFields {
  studentName: string;
  studentEmail: string;
  phone: string;
  country: string;
}

/** A student found by GET /admin/students/search. */
interface Found {
  id: number | null;
  name: string;
  email: string;
  phone: string;
  country: string;
}

interface Props {
  value: StudentFields;
  onChange: (v: StudentFields) => void;
  /** True once the admin has picked or confirmed a student. */
  selected: boolean;
  onSelectedChange: (v: boolean) => void;
  disabled?: boolean;
}

const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const toFound = (d: StudentProfileResponse, fallbackId: number | null): Found => ({
  id: typeof d.id === 'number' ? d.id : fallbackId,
  name: text(d.name),
  email: text(d.email),
  phone: text(d.phone),
  country: text(d.country),
});

type Lookup =
  | { state: 'idle' }
  | { state: 'hint'; message: string }
  | { state: 'loading' }
  | { state: 'found'; student: Found }
  | { state: 'notfound' }
  | { state: 'error'; message: string };

/**
 * Look a student up by exact ID or email with GET /admin/students/search.
 * Superseded lookups are aborted, so a slow answer for an earlier keystroke
 * can't replace the current one. A 401 signs the admin out, as elsewhere.
 */
function useStudentLookup(raw: string, enabled: boolean): Lookup {
  const [result, setResult] = useState<Lookup>({ state: 'idle' });
  useEffect(() => {
    const q = raw.trim();
    if (!enabled || !q) { setResult({ state: 'idle' }); return; }
    const check = classifyQuery(q);
    if (check.kind === 'empty') { setResult({ state: 'idle' }); return; }
    if (check.kind === 'invalid') {
      setResult({ state: 'hint', message: 'Type a full email address or a student ID (e.g. 263050).' });
      return;
    }
    const ctrl = new AbortController();
    setResult({ state: 'loading' });
    studentsApi.searchProfile(check.keyword, check.kind, ctrl.signal)
      .then((dto) => {
        if (!dto || typeof dto !== 'object') throw new Error('The search returned an unexpected response.');
        setResult({ state: 'found', student: toFound(dto, check.kind === 'id' ? Number(check.keyword) : null) });
      })
      .catch((e: unknown) => {
        if ((e as Error)?.name === 'AbortError') return;
        const f = classifySearchError(e);
        if (f.kind === 'expired') { handleUnauthorized('admin'); return; }
        if (f.kind === 'notfound') setResult({ state: 'notfound' });
        else if (f.kind === 'forbidden') setResult({ state: 'error', message: 'Your account is not permitted to search students.' });
        else setResult({ state: 'error', message: f.message });
      });
    return () => ctrl.abort();
  }, [raw, enabled]);
  return result;
}

/**
 * Student lookup for a new order.
 *
 * Uses the student search endpoint (GET /admin/students/search), which takes
 * an exact student ID or email. Picking a result fills the four fields the
 * create endpoint takes, using the email exactly as it is stored: the backend
 * matches the student with findByEmail, which is case-sensitive, so a
 * differently-cased address would create a second account.
 *
 * No student id is sent, because the endpoint doesn't accept one: it matches
 * on email and creates the account if it is new.
 */
export function StudentPicker({ value, onChange, selected, onSelectedChange, disabled }: Props) {
  const [query, setQuery] = useState('');
  const debounced = useDebounce(query, 400);
  const lookup = useStudentLookup(debounced, !selected);

  // Once a student is chosen, check the email field the order will be created
  // for: an existing account, or a new one the backend will create.
  const debouncedEmail = useDebounce(value.studentEmail, 500);
  const emailCheck = useStudentLookup(
    debouncedEmail.includes('@') ? debouncedEmail : '',
    selected
  );

  const pick = useCallback(
    (f: Found) => {
      onChange({
        studentEmail: f.email || value.studentEmail,
        studentName: f.name || value.studentName,
        phone: f.phone || value.phone,
        country: f.country || value.country,
      });
      onSelectedChange(true);
      setQuery('');
    },
    [onChange, onSelectedChange, value]
  );

  const set = (k: keyof StudentFields, v: string) => onChange({ ...value, [k]: v });

  const typed = value.studentEmail.trim();
  const existing = emailCheck.state === 'found' ? emailCheck.student : null;
  const caseMismatch = Boolean(existing?.email && existing.email !== typed);

  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h2 className="t-h3">Student</h2>
          <p className="t-xs text-dim" style={{ marginTop: 2 }}>
            Find an existing student by ID or email, or enter a new email to create the account
          </p>
        </div>
      </div>

      {!selected && (
        <div style={{ padding: 'var(--s5) var(--s5) 0' }}>
          <div className="ord-search" style={{ maxWidth: 'none' }}>
            <Search size={14} />
            <input
              className="input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Student ID (263050) or email address…"
              aria-label="Search students"
              autoComplete="off"
              disabled={disabled}
            />
            {lookup.state === 'loading' && (
              <Loader2
                size={14}
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', animation: 'spin 1s linear infinite' }}
              />
            )}
          </div>

          {lookup.state === 'error' && (
            <div className="field-error" role="alert" style={{ marginTop: 6 }}>{lookup.message}</div>
          )}
          {lookup.state === 'hint' && (
            <p className="t-xs text-dim" style={{ marginTop: 6 }}>{lookup.message}</p>
          )}

          {lookup.state === 'found' && (
            <div style={{ marginTop: 'var(--s3)', border: '1px solid var(--line)', borderRadius: 'var(--r)' }}>
              <button type="button" className="pv-hit" onClick={() => pick(lookup.student)} disabled={disabled}>
                <span className="avatar" aria-hidden>
                  {(lookup.student.name || lookup.student.email || '?').charAt(0).toUpperCase()}
                </span>
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span className="t-sm truncate" style={{ display: 'block', fontWeight: 600 }}>
                    {lookup.student.name || lookup.student.email || 'Student'}
                  </span>
                  <span className="t-xs text-dim truncate" style={{ display: 'block' }}>
                    {[lookup.student.id ? fmtStudentId(lookup.student.id) : null, lookup.student.email || null]
                      .filter(Boolean).join(' · ')}
                  </span>
                </span>
                <span className="pv-hit-go">Use</span>
              </button>
            </div>
          )}

          {lookup.state === 'notfound' && (
            <p className="t-xs text-dim" style={{ marginTop: 'var(--s3)' }}>
              No student has that ID or email. Enter the details manually and the account will be created.
            </p>
          )}

          <div style={{ marginTop: 'var(--s4)' }}>
            <Button size="sm" variant="ghost" disabled={disabled} onClick={() => {
              // A new email that was just searched is carried over, not retyped.
              const q = classifyQuery(debounced);
              if (lookup.state === 'notfound' && q.kind === 'email' && !value.studentEmail.trim()) {
                onChange({ ...value, studentEmail: q.keyword });
              }
              onSelectedChange(true);
            }}>
              <UserPlus size={13} /> Enter details manually
            </Button>
          </div>
        </div>
      )}

      {selected && (
        <>
          <div className="co-student">
            <span className="avatar avatar-lg" aria-hidden>
              {(value.studentName || value.studentEmail || '?').charAt(0).toUpperCase()}
            </span>
            <span className="co-student-main">
              <span className="t-xs" style={{ color: 'var(--accent-text)', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase' }}>
                <UserCheck size={11} style={{ display: 'inline', verticalAlign: -1, marginRight: 4 }} />
                Creating order for
              </span>
              <span className="t-h3 truncate" style={{ display: 'block', marginTop: 3 }}>
                {value.studentName || 'Name not set'}
              </span>
              <span className="t-sm text-mid truncate" style={{ display: 'block' }}>
                {value.studentEmail || 'No email set'}
              </span>
            </span>
            <Button size="sm" variant="ghost" iconOnly aria-label="Change student"
                    onClick={() => onSelectedChange(false)} disabled={disabled}>
              <X size={14} />
            </Button>
          </div>

          {/* Stated plainly: the backend matches on email and creates the account
              if it is new, so the admin knows which of the two is happening. */}
          {emailCheck.state === 'notfound' && typed && (
            <div className="co-newacct" role="status">
              <UserPlus size={14} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>
                No student has this email, so the backend will create a new student
                account and email them their credentials.
              </span>
            </div>
          )}
          {existing && caseMismatch && (
            <div className="co-newacct" role="status" style={{ flexWrap: 'wrap' }}>
              <UserCheck size={14} style={{ flexShrink: 0, marginTop: 1 }} />
              <span style={{ flex: 1 }}>
                This student&rsquo;s email is saved as <strong>{existing.email}</strong>. The backend
                matches emails exactly, so use that address or a second account will be created.
              </span>
              <Button size="sm" onClick={() => set('studentEmail', existing.email)} disabled={disabled}>
                Use {existing.email}
              </Button>
            </div>
          )}

          <div className="co-grid" style={{ paddingTop: 0 }}>
            <div className="fl">
              <label htmlFor="co-email">Student email<span className="co-req">*</span></label>
              <input id="co-email" type="email" className="fi" value={value.studentEmail}
                     onChange={(e) => set('studentEmail', e.target.value)} disabled={disabled}
                     placeholder="student@example.com" autoComplete="off" />
            </div>
            <div className="fl">
              <label htmlFor="co-name">Student name</label>
              <input id="co-name" className="fi" value={value.studentName}
                     onChange={(e) => set('studentName', e.target.value)} disabled={disabled}
                     placeholder="Full name" />
            </div>
            <div className="fl">
              <label htmlFor="co-phone">Phone</label>
              <input id="co-phone" className="fi" value={value.phone}
                     onChange={(e) => set('phone', e.target.value)} disabled={disabled}
                     placeholder="Optional" />
            </div>
            <div className="fl">
              <label htmlFor="co-country">Country</label>
              <input id="co-country" className="fi" value={value.country}
                     onChange={(e) => set('country', e.target.value)} disabled={disabled}
                     placeholder="Optional" />
            </div>
          </div>
        </>
      )}
    </section>
  );
}
