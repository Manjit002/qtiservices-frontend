'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { UserSearch, SearchX, Users2, Wallet, Receipt, FolderOpen } from 'lucide-react';
import { Skeleton, EmptyState, ErrorState } from '@/components/ui/States';
import { useToast } from '@/hooks/useToast';
import { studentsApi, classifyQuery, classifySearchError, computeStats } from '@/lib/api/students';
import { handleUnauthorized } from '@/lib/api/client';
import { StudentSearch } from './StudentSearch';
import { StudentProfileHeader } from './StudentProfileHeader';
import { EditStudentProfileDialog } from './EditStudentProfileDialog';
import { StudentSummary } from './StudentSummary';
import { StudentTabs } from './StudentTabs';
import type { OrderDTO, StudentSearchResult } from '@/types';
import './students.css';
import '@/components/admin/order-detail.css';

interface Props {
  /** ADMIN or SUPER_ADMIN — the roles PUT /admin/students/{id}/profile accepts. */
  canEditStudent?: boolean;
  onOpenOrder: (id: number, subject?: string) => void;
  onOpenFiles: (order: OrderDTO) => void;
  onOpenChat: (order: OrderDTO) => void;
  onPayLink: (order: OrderDTO) => void;
}

type View =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'found'; data: StudentSearchResult }
  | { kind: 'notfound'; query: string }
  | { kind: 'forbidden' }
  | { kind: 'error'; message: string };

export function StudentsPanel({ canEditStudent = false, onOpenOrder, onOpenFiles, onOpenChat, onPayLink }: Props) {
  const { showToast } = useToast();
  const [query, setQuery] = useState('');
  const [view, setView] = useState<View>({ kind: 'idle' });
  const [busy, setBusy] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  /** Why the last submit was refused before any request was made. */
  const [validation, setValidation] = useState<string | null>(null);

  /** One search at a time; a double Enter or click sends one request. */
  const inFlight = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  /** Numbers each search; results from an older one are never shown. */
  const searchSeq = useRef(0);
  useEffect(() => () => abortRef.current?.abort(), []);

  const search = useCallback(async () => {
    if (inFlight.current) return;
    const check = classifyQuery(query);
    if (check.kind === 'empty') { setValidation('Enter a student ID or email address.'); return; }
    if (check.kind === 'invalid') { setValidation(check.message); return; }

    setValidation(null);
    inFlight.current = true;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const seq = ++searchSeq.current;
    // The previous student disappears at once — never shown as this result.
    setEditingProfile(false);
    setView({ kind: 'loading' });
    try {
      const result = await studentsApi.search(query, ctrl.signal);
      if (seq !== searchSeq.current) return;
      setView({ kind: 'found', data: result });
    } catch (e) {
      if ((e as Error).name === 'AbortError' || seq !== searchSeq.current) return;
      const failure = classifySearchError(e);
      if (failure.kind === 'expired') { handleUnauthorized('admin'); return; }
      if (failure.kind === 'notfound') setView({ kind: 'notfound', query: query.trim() });
      else if (failure.kind === 'forbidden') setView({ kind: 'forbidden' });
      else if (failure.kind === 'invalid') { setValidation(failure.message); setView({ kind: 'idle' }); }
      else setView({ kind: 'error', message: failure.message });
    } finally {
      inFlight.current = false;
    }
  }, [query]);

  const clear = useCallback(() => {
    abortRef.current?.abort();
    searchSeq.current += 1;
    inFlight.current = false;
    setQuery('');
    setValidation(null);
    setView({ kind: 'idle' });
  }, []);

  /** Updates the loaded student only if it is still the one on screen. */
  const patchStudent = useCallback((id: number, patch: (d: StudentSearchResult) => StudentSearchResult) => {
    setView((v) => (v.kind === 'found' && v.data.student.id === id ? { kind: 'found', data: patch(v.data) } : v));
  }, []);

  /** Orders failed to load with the profile: fetch them again, nothing else. */
  const retryOrders = useCallback(async () => {
    if (view.kind !== 'found' || view.data.student.id == null) return;
    const { student } = view.data;
    const id = student.id as number;
    const seq = searchSeq.current;
    try {
      const { orders, note } = await studentsApi.ordersFor(student);
      if (seq !== searchSeq.current) return;
      patchStudent(id, (d) => ({ ...d, orders, stats: computeStats(orders), ordersError: null, ordersNote: note }));
    } catch (e) {
      if (seq !== searchSeq.current) return;
      patchStudent(id, (d) => ({ ...d, ordersError: (e as Error).message || 'Orders could not be loaded.' }));
    }
  }, [view, patchStudent]);

  const toggleActive = useCallback(
    async (active: boolean) => {
      if (view.kind !== 'found' || view.data.student.id == null) return;
      const id = view.data.student.id;
      setBusy(true);
      try {
        await studentsApi.setActive(id, active);
        patchStudent(id, (d) => ({ ...d, student: { ...d.student, active } }));
        showToast(`Account ${active ? 'activated' : 'deactivated'}.`, 'success');
      } catch (e) {
        showToast((e as Error).message, 'error');
      } finally {
        setBusy(false);
      }
    },
    [view, showToast, patchStudent]
  );

  const adjustWallet = useCallback(
    async (amount: number, reason: string) => {
      if (view.kind !== 'found' || view.data.student.id == null) return;
      const id = view.data.student.id;
      const before = view.data.student.walletBalance;
      setBusy(true);
      try {
        const res = await studentsApi.adjustWallet(id, amount, reason);
        // Prefer the server's balance; fall back to computing it locally, which
        // is what the source does when the response carries no balance.
        const next = res?.balance ?? res?.walletBalance ?? before + amount;
        patchStudent(id, (d) => ({ ...d, student: { ...d.student, walletBalance: next } }));
        showToast(`Wallet adjusted by ${amount.toFixed(2)}.`, 'success');
      } catch (e) {
        showToast((e as Error).message, 'error');
      } finally {
        setBusy(false);
      }
    },
    [view, showToast, patchStudent]
  );

  return (
    <div className="rise">
      <div style={{ marginBottom: 'var(--s5)' }}>
        <h1 className="t-h1">Students</h1>
        <p className="t-sm text-dim" style={{ marginTop: 4 }}>
          Search by student ID or email to see their full history.
        </p>
      </div>

      <section className="card card-pad" style={{ marginBottom: 'var(--s5)' }}>
        <StudentSearch
          value={query}
          onChange={(v) => { setQuery(v); setValidation(null); }}
          onSearch={() => void search()}
          onClear={clear}
          busy={view.kind === 'loading'}
          validation={validation}
        />
      </section>

      {view.kind === 'idle' && (
        <section className="card">
          <EmptyState
            icon={<UserSearch size={18} />}
            title="Search for a student"
            hint="Enter a student ID or email address to see their profile, orders, payments, files and wallet in one place."
          />
          <div className="stu-fields" style={{ paddingTop: 0 }}>
            {[
              { icon: <Users2 size={15} />, t: 'Profile', d: 'Contact details and account status' },
              { icon: <Receipt size={15} />, t: 'Orders & payments', d: 'Full history with totals' },
              { icon: <FolderOpen size={15} />, t: 'Files', d: 'Everything uploaded per order' },
              { icon: <Wallet size={15} />, t: 'Wallet', d: 'Balance and adjustments' },
            ].map((x) => (
              <div key={x.t} style={{ display: 'flex', gap: 'var(--s3)', alignItems: 'flex-start' }}>
                <span style={{ color: 'var(--accent)', marginTop: 2 }}>{x.icon}</span>
                <span>
                  <span className="t-sm" style={{ fontWeight: 600, display: 'block' }}>{x.t}</span>
                  <span className="t-xs text-dim">{x.d}</span>
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {view.kind === 'loading' && (
        <>
          <div className="card" style={{ marginBottom: 'var(--s5)', padding: 'var(--s5)' }}>
            <div style={{ display: 'flex', gap: 'var(--s4)', alignItems: 'center' }}>
              <Skeleton w={56} h={56} r={12} />
              <div style={{ flex: 1, display: 'grid', gap: 8 }}>
                <Skeleton w="34%" h={18} /><Skeleton w="48%" />
              </div>
            </div>
          </div>
          <div className="stu-stats" style={{ marginBottom: 'var(--s5)' }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div className="stu-stat" key={i}><Skeleton h={44} /></div>
            ))}
          </div>
          <div className="card" style={{ padding: 'var(--s5)' }}><Skeleton h={180} /></div>
        </>
      )}

      {view.kind === 'notfound' && (
        <section className="card">
          <EmptyState
            icon={<SearchX size={18} />}
            title="Student not found"
            hint={`No student matches "${view.query}". Please check the Student ID or email address.`}
          />
        </section>
      )}

      {view.kind === 'forbidden' && (
        <section className="card">
          <ErrorState message="Your account is not permitted to search students. Student search is limited to admins and super admins." />
        </section>
      )}

      {view.kind === 'error' && (
        <section className="card">
          <ErrorState message={view.message} onRetry={() => void search()} />
        </section>
      )}

      {view.kind === 'found' && (
        <>
          <StudentProfileHeader
            student={view.data.student}
            busy={busy}
            onToggleActive={toggleActive}
            onEdit={canEditStudent ? () => setEditingProfile(true) : undefined}
          />
          {canEditStudent && view.data.student.id != null && (
            <EditStudentProfileDialog
              open={editingProfile}
              studentId={view.data.student.id}
              current={view.data.student}
              onClose={() => setEditingProfile(false)}
              onSaved={(saved) =>
                /* Same pattern as toggleActive: patch the loaded student in place
                   from the server's response — only if it is still on screen.
                   Header and summary both read from view.data.student, so name,
                   email and phone update together. */
                setView((v) =>
                  v.kind === 'found' && v.data.student.id === view.data.student.id
                    ? {
                        kind: 'found',
                        data: {
                          ...v.data,
                          student: {
                            ...v.data.student,
                            name: saved.name,
                            email: saved.email,
                            phone: saved.phone || null,
                          },
                        },
                      }
                    : v
                )
              }
            />
          )}
          <StudentSummary student={view.data.student} stats={view.data.stats}
                          ordersUnavailable={Boolean(view.data.ordersError)} />
          <StudentTabs
            student={view.data.student}
            orders={view.data.orders}
            ordersError={view.data.ordersError ?? null}
            ordersNote={view.data.ordersNote ?? null}
            onRetryOrders={() => void retryOrders()}
            busy={busy}
            onOpenOrder={onOpenOrder}
            onOpenFiles={onOpenFiles}
            onOpenChat={onOpenChat}
            onPayLink={onPayLink}
            onAdjustWallet={adjustWallet}
          />
        </>
      )}
    </div>
  );
}
