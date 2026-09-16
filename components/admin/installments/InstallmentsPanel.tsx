'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Search, X, ArrowRight, CalendarClock, AlertTriangle, CheckCircle2,
  Wallet, PartyPopper, CalendarX2,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Skeleton, EmptyState, ErrorState } from '@/components/ui/States';
import { useAsync } from '@/hooks/useAsync';
import { ordersApi } from '@/lib/api/orders';
import { installmentsApi } from '@/lib/api/payments';
import { InstallmentRow } from './InstallmentRow';
import { PlanBuilder } from './PlanBuilder';
import { dueLabel, planTotals } from '@/lib/utils/installments';
import { fmtOrderId, fmtStudentId, formatCurrency } from '@/lib/utils/format';
import type { InstallmentDTO, OrderDTO } from '@/types';
import './installments.css';
import '@/components/admin/payments/payments.css';
import '@/components/admin/students/students.css';
import '@/components/admin/orders.css';

type Queue = 'due' | 'overdue';

export function InstallmentsPanel() {
  const [queue, setQueue] = useState<Queue>('due');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<OrderDTO[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [orderId, setOrderId] = useState<number | null>(null);
  const [orderLabel, setOrderLabel] = useState('');
  const [planKey, setPlanKey] = useState(0);

  /** Both queues load together, exactly as the source does. */
  const due = useAsync((s) => installmentsApi.due(s), []);
  const overdue = useAsync((s) => installmentsApi.overdue(s), []);
  /** Order lookup so a queue row can show its subject and student. */
  const orders = useAsync((s) => ordersApi.listAll(0, 200, 'createdAt,desc', s), []);

  const plan = useAsync<InstallmentDTO[] | null>(
    (s) => (orderId == null ? Promise.resolve(null) : installmentsApi.forOrder(orderId, s)),
    [orderId, planKey]
  );

  const orderMap = useMemo(() => {
    const m = new Map<number, OrderDTO>();
    (orders.data?.content ?? []).forEach((o) => m.set(o.id, o));
    return m;
  }, [orders.data]);

  const dueList = due.data ?? [];
  const overdueList = overdue.data ?? [];
  const active = queue === 'overdue' ? overdueList : dueList;

  const planList = useMemo(() => plan.data ?? [], [plan.data]);
  const totals = useMemo(() => planTotals(planList), [planList]);

  const refreshAll = useCallback(() => {
    setPlanKey((k) => k + 1);
    due.reload();
    overdue.reload();
  }, [due, overdue]);

  const search = useCallback(async () => {
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    setSearchError(null);
    try {
      const page = await ordersApi.listAll(0, 200, 'createdAt,desc');
      const kw = q.toLowerCase().replace(/^od-/, '').replace(/^id-/, '');
      setResults(
        (page.content ?? []).filter((o) =>
          String(o.id).includes(kw) ||
          (o.subject ?? '').toLowerCase().includes(kw) ||
          String(o.studentId ?? '').includes(kw) ||
          (o.studentEmail ?? '').toLowerCase().includes(kw)
        ).slice(0, 8)
      );
    } catch (e) {
      setSearchError((e as Error).message);
    } finally {
      setSearching(false);
    }
  }, [query]);

  const select = useCallback((id: number, label: string) => {
    setOrderId(id);
    setOrderLabel(label);
    setResults(null);
    setQuery('');
  }, []);

  // Queue counts feed the summary; both are backend lists, not guesses.
  const loadingCounts = due.loading || overdue.loading;

  const stats = [
    { label: 'Due today', value: dueList.length, tone: 'var(--warning)', icon: <CalendarClock size={14} /> },
    { label: 'Overdue', value: overdueList.length, tone: 'var(--danger)', icon: <AlertTriangle size={14} /> },
    {
      label: 'Due amount',
      value: formatCurrency(dueList.reduce((s, i) => s + (i.finalAmount ?? 0), 0)),
      tone: 'var(--accent)', icon: <Wallet size={14} />,
    },
    {
      label: 'Overdue amount',
      value: formatCurrency(overdueList.reduce((s, i) => s + (i.finalAmount ?? 0), 0)),
      tone: 'var(--danger)', icon: <Wallet size={14} />,
    },
  ];

  useEffect(() => { if (orderId != null) setPlanKey((k) => k + 1); }, [orderId]);

  return (
    <div className="rise">
      <div style={{ marginBottom: 'var(--s5)' }}>
        <h1 className="t-h1">Installments</h1>
        <p className="t-sm text-dim" style={{ marginTop: 4 }}>
          Work the due and overdue queues, then manage an order&rsquo;s payment plan.
        </p>
      </div>

      {/* ── Overview: only the four figures the backend actually supports ── */}
      <div className="in-stats">
        {stats.map((s) => (
          <div className="stu-stat" key={s.label}>
            <span className="stu-stat-flag" style={{ background: s.tone }} aria-hidden />
            <div className="stu-stat-val">
              {loadingCounts ? <Skeleton w={54} h={22} /> : s.value}
            </div>
            <div className="stu-stat-lbl" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ color: s.tone }}>{s.icon}</span> {s.label}
            </div>
          </div>
        ))}
      </div>

      <div className="in-cols">
        <div>
          {/* ── Queues ── */}
          <section className="card" style={{ marginBottom: 'var(--s5)' }}>
            <div className="card-head">
              <h2 className="t-h3">Collection queue</h2>
              <div className="seg" role="group" aria-label="Queue">
                <button type="button" className={queue === 'due' ? 'on' : ''}
                        onClick={() => setQueue('due')} aria-pressed={queue === 'due'}>
                  Due today ({dueList.length})
                </button>
                <button type="button" className={queue === 'overdue' ? 'on' : ''}
                        onClick={() => setQueue('overdue')} aria-pressed={queue === 'overdue'}>
                  Overdue ({overdueList.length})
                </button>
              </div>
            </div>

            {loadingCounts && (
              <div style={{ padding: 'var(--s5)', display: 'grid', gap: 'var(--s3)' }}>
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} h={44} />)}
              </div>
            )}
            {(due.error || overdue.error) && (
              <ErrorState message={due.error ?? overdue.error ?? 'Failed to load'} onRetry={refreshAll} />
            )}

            {!loadingCounts && !due.error && !overdue.error && active.length === 0 && (
              <EmptyState
                icon={<PartyPopper size={18} />}
                title={queue === 'overdue' ? 'Nothing overdue' : 'Nothing due today'}
                hint="This queue is clear. Installments appear here as their due dates arrive."
              />
            )}

            {active.map((ins) => {
              const o = ins.orderId != null ? orderMap.get(ins.orderId) : undefined;
              const subject = o?.subject || (ins.orderId ? `Order ${fmtOrderId(ins.orderId)}` : 'Order');
              const who = o?.studentEmail || (ins.studentId ? fmtStudentId(ins.studentId) : '—');
              return (
                <div className="in-q" key={ins.id}>
                  <div className="in-q-main">
                    <div className="t-sm truncate" style={{ fontWeight: 600 }}>{subject}</div>
                    <div className="t-xs text-dim truncate">{who} · Due {dueLabel(ins)}</div>
                  </div>
                  <span className="in-amt" style={{ flexShrink: 0 }}>
                    {formatCurrency(ins.finalAmount ?? 0)}
                  </span>
                  {ins.orderId != null && (
                    <button type="button" className="act"
                            onClick={() => select(ins.orderId as number, subject)}>
                      Manage <ArrowRight size={12} />
                    </button>
                  )}
                </div>
              );
            })}
          </section>

          {/* ── Order search ── */}
          <section className="card" style={{ marginBottom: 'var(--s5)' }}>
            <div className="card-head"><h2 className="t-h3">Find an order</h2></div>
            <div style={{ padding: 'var(--s5)' }}>
              <form className="stu-search" onSubmit={(e) => { e.preventDefault(); void search(); }} role="search">
                <div className="stu-search-field">
                  <Search size={15} />
                  <input className="input" value={query} onChange={(e) => setQuery(e.target.value)}
                         placeholder="Order ID, subject, student ID or email…"
                         aria-label="Search orders" autoComplete="off" />
                </div>
                <Button type="submit" variant="primary" size="lg" loading={searching}
                        disabled={!query.trim()}>
                  Search
                </Button>
                {query && (
                  <Button type="button" size="lg" onClick={() => { setQuery(''); setResults(null); }}>
                    <X size={14} /> Clear
                  </Button>
                )}
              </form>
            </div>

            {searchError && <ErrorState message={searchError} onRetry={search} />}
            {results !== null && results.length === 0 && !searching && (
              <EmptyState title={`No orders match "${query}"`}
                          hint="Try the numeric order ID, student ID, or email." />
            )}
            {results?.map((o) => (
              <button key={o.id} type="button" className="pv-hit"
                      onClick={() => select(o.id, o.subject || `Order ${fmtOrderId(o.id)}`)}>
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span className="ord-id">{fmtOrderId(o.id)}</span>
                  <span className="t-sm truncate" style={{ display: 'block' }}>
                    {o.subject || 'Untitled order'}
                  </span>
                </span>
                <span className="pv-hit-go">Select <ArrowRight size={11} style={{ display: 'inline', verticalAlign: -1 }} /></span>
              </button>
            ))}
          </section>

          {/* ── The selected order's plan ── */}
          {orderId == null ? (
            <section className="card">
              <EmptyState
                icon={<CalendarClock size={18} />}
                title="Pick an order to manage its plan"
                hint="Choose one from the queue above, or search for it."
              />
            </section>
          ) : (
            <section className="card">
              <div className="card-head">
                <div style={{ minWidth: 0 }}>
                  <h2 className="t-h3 truncate">
                    {fmtOrderId(orderId)}
                    <span className="text-dim" style={{ fontWeight: 400 }}>
                      {orderLabel ? ` · ${orderLabel}` : ''}
                    </span>
                  </h2>
                  {planList.length > 0 && (
                    <p className="t-xs text-dim" style={{ marginTop: 2 }}>
                      {totals.paidCount} of {planList.length} paid ·{' '}
                      {formatCurrency(totals.paid)} of {formatCurrency(totals.total)}
                    </p>
                  )}
                </div>
                <Button size="sm" variant="ghost" onClick={() => setOrderId(null)}>Close</Button>
              </div>

              {plan.loading && (
                <div style={{ padding: 'var(--s5)', display: 'grid', gap: 'var(--s3)' }}>
                  {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} h={56} />)}
                </div>
              )}
              {plan.error && <ErrorState message={plan.error} onRetry={() => setPlanKey((k) => k + 1)} />}

              {!plan.loading && !plan.error && planList.length === 0 && (
                <EmptyState
                  icon={<CalendarX2 size={18} />}
                  title="No installment plan"
                  hint="This order is set up for payment in full. Create a plan on the right to split it."
                />
              )}

              {planList.length > 0 && (
                <>
                  <div className="pv-sum">
                    <div className="pv-sum-cell">
                      <span className="pv-sum-flag" style={{ background: 'var(--accent)' }} aria-hidden />
                      <div className="pv-sum-lbl">Plan total</div>
                      <div className="pv-sum-val">{formatCurrency(totals.total)}</div>
                    </div>
                    <div className="pv-sum-cell">
                      <span className="pv-sum-flag" style={{ background: 'var(--success)' }} aria-hidden />
                      <div className="pv-sum-lbl">Paid</div>
                      <div className="pv-sum-val" style={{ color: totals.paid > 0 ? 'var(--success)' : undefined }}>
                        {formatCurrency(totals.paid)}
                      </div>
                    </div>
                    <div className="pv-sum-cell">
                      <span className="pv-sum-flag" style={{ background: totals.remaining > 0 ? 'var(--danger)' : 'var(--neutral)' }} aria-hidden />
                      <div className="pv-sum-lbl">Remaining</div>
                      <div className="pv-sum-val" style={{ color: totals.remaining > 0 ? 'var(--danger)' : undefined }}>
                        {formatCurrency(totals.remaining)}
                      </div>
                    </div>
                  </div>

                  {totals.remaining === 0 && (
                    <div style={{ padding: '0 var(--s5) var(--s4)' }}>
                      <div className="alert" style={{ background: 'var(--success-bg)', color: 'var(--success)', display: 'flex', gap: 8, alignItems: 'center' }}>
                        <CheckCircle2 size={14} /> This plan is fully paid.
                      </div>
                    </div>
                  )}

                  {planList.map((ins, i) => (
                    <InstallmentRow key={ins.id} installment={ins} index={i} onChanged={refreshAll} />
                  ))}
                </>
              )}
            </section>
          )}
        </div>

        <div className="in-rail">
          {orderId != null ? (
            <PlanBuilder
              orderId={orderId}
              hasPlan={planList.length > 0}
              onDone={refreshAll}
            />
          ) : (
            <section className="card">
              <EmptyState
                icon={<CalendarClock size={18} />}
                title="Plan builder"
                hint="Select an order to create or recreate its installment schedule."
              />
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
