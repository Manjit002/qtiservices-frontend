'use client';

import { useCallback, useState } from 'react';
import { UserSearch, SearchX, Users2, Wallet, Receipt, FolderOpen } from 'lucide-react';
import { Skeleton, EmptyState, ErrorState } from '@/components/ui/States';
import { useToast } from '@/hooks/useToast';
import { studentsApi } from '@/lib/api/students';
import { StudentSearch } from './StudentSearch';
import { StudentProfileHeader } from './StudentProfileHeader';
import { StudentSummary } from './StudentSummary';
import { StudentTabs } from './StudentTabs';
import type { OrderDTO, StudentSearchResult } from '@/types';
import './students.css';
import '@/components/admin/order-detail.css';

interface Props {
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
  | { kind: 'error'; message: string };

export function StudentsPanel({ onOpenOrder, onOpenFiles, onOpenChat, onPayLink }: Props) {
  const { showToast } = useToast();
  const [query, setQuery] = useState('');
  const [view, setView] = useState<View>({ kind: 'idle' });
  const [busy, setBusy] = useState(false);

  const search = useCallback(async () => {
    const q = query.trim();
    if (!q) return;
    setView({ kind: 'loading' });
    try {
      const result = await studentsApi.search(q);
      // "No orders" and "no such student" are indistinguishable on this backend,
      // so the copy says exactly that instead of asserting the student is absent.
      setView(result ? { kind: 'found', data: result } : { kind: 'notfound', query: q });
    } catch (e) {
      setView({ kind: 'error', message: (e as Error).message });
    }
  }, [query]);

  const clear = useCallback(() => {
    setQuery('');
    setView({ kind: 'idle' });
  }, []);

  const toggleActive = useCallback(
    async (active: boolean) => {
      if (view.kind !== 'found' || view.data.student.id == null) return;
      setBusy(true);
      try {
        await studentsApi.setActive(view.data.student.id, active);
        setView({
          kind: 'found',
          data: { ...view.data, student: { ...view.data.student, active } },
        });
        showToast(`Account ${active ? 'activated' : 'deactivated'}.`, 'success');
      } catch (e) {
        showToast((e as Error).message, 'error');
      } finally {
        setBusy(false);
      }
    },
    [view, showToast]
  );

  const adjustWallet = useCallback(
    async (amount: number, reason: string) => {
      if (view.kind !== 'found' || view.data.student.id == null) return;
      setBusy(true);
      try {
        const res = await studentsApi.adjustWallet(view.data.student.id, amount, reason);
        // Prefer the server's balance; fall back to computing it locally, which
        // is what the source does when the response carries no balance.
        const next =
          res?.balance ?? res?.walletBalance ?? view.data.student.walletBalance + amount;
        setView({
          kind: 'found',
          data: { ...view.data, student: { ...view.data.student, walletBalance: next } },
        });
        showToast(`Wallet adjusted by ${amount.toFixed(2)}.`, 'success');
      } catch (e) {
        showToast((e as Error).message, 'error');
      } finally {
        setBusy(false);
      }
    },
    [view, showToast]
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
          onChange={setQuery}
          onSearch={search}
          onClear={clear}
          busy={view.kind === 'loading'}
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
            title={`Nothing found for "${view.query}"`}
            hint="No orders matched that student ID or email. This backend finds students through their orders, so a student with no orders yet cannot be looked up here."
          />
        </section>
      )}

      {view.kind === 'error' && (
        <section className="card">
          <ErrorState message={view.message} onRetry={search} />
        </section>
      )}

      {view.kind === 'found' && (
        <>
          <StudentProfileHeader
            student={view.data.student}
            busy={busy}
            onToggleActive={toggleActive}
          />
          <StudentSummary student={view.data.student} stats={view.data.stats} />
          <StudentTabs
            student={view.data.student}
            orders={view.data.orders}
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
