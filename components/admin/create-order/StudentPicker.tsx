'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, X, UserCheck, UserPlus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useDebounce } from '@/hooks/useDebounce';
import { ordersApi } from '@/lib/api/orders';
import { fmtStudentId } from '@/lib/utils/format';
import type { OrderDTO } from '@/types';

/** What the form actually submits — these four fields, not a student id. */
export interface StudentFields {
  studentName: string;
  studentEmail: string;
  phone: string;
  country: string;
}

interface Candidate {
  studentId: number | null;
  email: string;
  name: string;
  orderCount: number;
}

interface Props {
  value: StudentFields;
  onChange: (v: StudentFields) => void;
  /** True once the admin has picked or confirmed a student. */
  selected: boolean;
  onSelectedChange: (v: boolean) => void;
  disabled?: boolean;
}

/**
 * Student lookup.
 *
 * There is no student endpoint on this backend — students are only discoverable
 * through their orders, which is the same mechanism the Students page uses. So
 * this searches orders and de-duplicates by email to produce a candidate list.
 *
 * Selecting a candidate PRE-FILLS the four fields the create endpoint actually
 * takes. It does not send a student id, because the endpoint does not accept
 * one: the backend matches on email, and creates the account if it is new.
 */
export function StudentPicker({ value, onChange, selected, onSelectedChange, disabled }: Props) {
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<OrderDTO[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounced = useDebounce(query, 400);

  useEffect(() => {
    const q = debounced.trim();
    if (q.length < 2) { setRows(null); return; }
    let live = true;
    setLoading(true);
    setError(null);
    ordersApi
      .listAll(0, 200, 'createdAt,desc')
      .then((page) => { if (live) setRows(page.content ?? []); })
      .catch((e: Error) => { if (live) setError(e.message); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [debounced]);

  /** Collapse orders into one entry per student email. */
  const candidates = useMemo<Candidate[]>(() => {
    if (!rows) return [];
    const q = debounced.trim().toLowerCase().replace(/^id-0*/, '');
    const byEmail = new Map<string, Candidate>();
    rows.forEach((o) => {
      const email = (o.studentEmail ?? '').toLowerCase();
      if (!email) return;
      const matches =
        email.includes(q) ||
        String(o.studentId ?? '').includes(q) ||
        (o.subject ?? '').toLowerCase().includes(q);
      if (!matches) return;
      const found = byEmail.get(email);
      if (found) found.orderCount += 1;
      else byEmail.set(email, {
        studentId: o.studentId ?? null,
        email: o.studentEmail ?? '',
        name: '',
        orderCount: 1,
      });
    });
    return [...byEmail.values()].slice(0, 6);
  }, [rows, debounced]);

  const pick = useCallback(
    (c: Candidate) => {
      onChange({ ...value, studentEmail: c.email });
      onSelectedChange(true);
      setQuery('');
      setRows(null);
    },
    [onChange, onSelectedChange, value]
  );

  const set = (k: keyof StudentFields, v: string) => onChange({ ...value, [k]: v });

  const emailKnown = useMemo(() => {
    if (!rows || !value.studentEmail.trim()) return null;
    const e = value.studentEmail.trim().toLowerCase();
    return rows.some((o) => (o.studentEmail ?? '').toLowerCase() === e);
  }, [rows, value.studentEmail]);

  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h2 className="t-h3">Student</h2>
          <p className="t-xs text-dim" style={{ marginTop: 2 }}>
            Search an existing student, or enter a new email to create the account
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
              placeholder="Search by email, student ID or a past order subject…"
              aria-label="Search students"
              autoComplete="off"
              disabled={disabled}
            />
            {loading && (
              <Loader2
                size={14}
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', animation: 'spin 1s linear infinite' }}
              />
            )}
          </div>

          {error && <div className="field-error" style={{ marginTop: 6 }}>{error}</div>}

          {candidates.length > 0 && (
            <div style={{ marginTop: 'var(--s3)', border: '1px solid var(--line)', borderRadius: 'var(--r)' }}>
              {candidates.map((c) => (
                <button key={c.email} type="button" className="pv-hit" onClick={() => pick(c)}>
                  <span className="avatar" aria-hidden>{c.email.charAt(0).toUpperCase()}</span>
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span className="t-sm truncate" style={{ display: 'block', fontWeight: 600 }}>
                      {c.email}
                    </span>
                    <span className="t-xs text-dim">
                      {c.studentId ? fmtStudentId(c.studentId) : 'No ID on record'} · {c.orderCount} order{c.orderCount > 1 ? 's' : ''}
                    </span>
                  </span>
                  <span className="pv-hit-go">Use</span>
                </button>
              ))}
            </div>
          )}

          {debounced.trim().length >= 2 && !loading && candidates.length === 0 && !error && (
            <p className="t-xs text-dim" style={{ marginTop: 'var(--s3)' }}>
              No existing student matches. Fill the details below and the account will be created.
            </p>
          )}

          <div style={{ marginTop: 'var(--s4)' }}>
            <Button size="sm" variant="ghost" onClick={() => onSelectedChange(true)} disabled={disabled}>
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
          {emailKnown === false && value.studentEmail.trim() && (
            <div className="co-newacct">
              <UserPlus size={14} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>
                No existing order uses this email, so the backend will create a new student
                account and email them their credentials.
              </span>
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
