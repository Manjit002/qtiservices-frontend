'use client';

import { useMemo } from 'react';
import {
  FileSearch, Send, UserPlus, BadgeCheck, ArrowRight, Inbox, Users2,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/Badge';
import { DeadlineMeter, deadlineState } from '@/components/ui/DeadlineMeter';
import { Skeleton, EmptyState, ErrorState } from '@/components/ui/States';
import { useAsync } from '@/hooks/useAsync';
import { useLiveClock } from '@/hooks/useLiveDeadlines';
import { ordersApi } from '@/lib/api/orders';
import { expertsApi } from '@/lib/api/experts';
import { fmtOrderId, parseServerDate, formatCurrency } from '@/lib/utils/format';
import type { OrderDTO } from '@/types';
import './dashboard.css';

interface Props {
  name: string;
  showRevenue: boolean;
  onOpenOrder: (id: number, subject?: string) => void;
  onNavigate: (key: string) => void;
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

/** Orders that are neither finished nor cancelled still need someone to act. */
const OPEN = (s: string) => !['COMPLETED', 'CANCELLED', 'PAID'].includes(s);

export function DashboardHome({ name, showRevenue, onOpenOrder, onNavigate }: Props) {
  useLiveClock();

  const stats = useAsync((signal) => ordersApi.dashboardStats(signal), []);
  const orders = useAsync((signal) => ordersApi.listAll(0, 100, 'createdAt,desc', signal), []);
  const experts = useAsync((signal) => expertsApi.listAvailable(signal), []);

  const rows = useMemo(() => orders.data?.content ?? [], [orders.data]);

  /**
   * The attention rail: open orders sorted by how close their deadline is.
   * This is the answer to "what needs me right now", so it leads the page —
   * ahead of the KPI strip, which is context rather than a call to act.
   */
  const attention = useMemo(() => {
    return rows
      .filter((o) => OPEN(String(o.status ?? '')))
      .map((o) => ({ o, t: parseServerDate(o.deadline)?.getTime() ?? Number.MAX_SAFE_INTEGER }))
      .sort((a, b) => a.t - b.t)
      .slice(0, 6)
      .map((x) => x.o);
  }, [rows]);

  const overdueCount = useMemo(
    () => attention.filter((o) => deadlineState(o.deadline).overdue).length,
    [attention]
  );

  const d = stats.data;

  // Only metrics the backend actually returns. No deltas, no sparklines — the
  // API provides no historical series, and inventing one would be a lie.
  const kpis = [
    { label: 'Needs review', value: d?.reviewPending, tone: 'var(--warning)', to: 'orders' },
    { label: 'Assigned', value: d?.assignedOrders, tone: 'var(--accent)', to: 'orders' },
    { label: 'Completed', value: d?.completedOrders, tone: 'var(--success)', to: 'orders' },
    { label: 'Experts free', value: d?.availableExperts, tone: 'var(--info)', to: 'experts' },
    ...(showRevenue
      ? [{ label: 'Revenue', value: d?.totalRevenue, tone: 'var(--gold)', money: true, to: 'analytics' }]
      : []),
    { label: 'Payments due', value: d?.pendingPayments, tone: 'var(--danger)', to: 'payverify' },
  ];

  return (
    <div className="rise">
      {/* ── Hero ── */}
      <div className="dash-hero">
        <div>
          <h1 className="t-h1">{greeting()}, {name}.</h1>
          <p className="t-body text-mid" style={{ marginTop: 6 }}>
            {orders.loading
              ? 'Checking what needs your attention\u2026'
              : overdueCount > 0
                ? `${overdueCount} order${overdueCount > 1 ? 's are' : ' is'} past its deadline.`
                : attention.length > 0
                  ? `${attention.length} open order${attention.length > 1 ? 's' : ''} in flight. Nothing overdue.`
                  : 'Nothing is waiting on you right now.'}
          </p>
        </div>
        <div className="dash-actions">
          <Button size="sm" onClick={() => onNavigate('create-order')}><FileSearch size={14} /> New order</Button>
          <Button size="sm" onClick={() => onNavigate('assign')}><Send size={14} /> Assign</Button>
          <Button size="sm" onClick={() => onNavigate('create-expert')}><UserPlus size={14} /> Add expert</Button>
          <Button size="sm" onClick={() => onNavigate('payverify')}><BadgeCheck size={14} /> Verify payment</Button>
        </div>
      </div>

      {/* ── KPI strip: one row of compact tiles, not six large cards ── */}
      <div className="kpi-strip">
        {kpis.map((k) => (
          <button key={k.label} type="button" className="kpi" onClick={() => onNavigate(k.to)}>
            <span className="kpi-flag" style={{ background: k.tone }} aria-hidden />
            <span className="kpi-value">
              {stats.loading
                ? <Skeleton w={46} h={22} />
                : k.money
                  ? formatCurrency(Number(k.value ?? 0)).replace('.00', '')
                  : (k.value ?? 0).toLocaleString()}
            </span>
            <span className="kpi-label">{k.label}</span>
          </button>
        ))}
      </div>
      {stats.error && <ErrorState message={stats.error} onRetry={stats.reload} />}

      <div className="dash-cols">
        {/* ── Attention rail ── */}
        <section className="card">
          <div className="card-head">
            <div>
              <h2 className="t-h3">Needs attention</h2>
              <p className="t-xs text-dim" style={{ marginTop: 2 }}>Open orders, soonest deadline first</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => onNavigate('orders')}>
              All orders <ArrowRight size={13} />
            </Button>
          </div>

          {orders.loading && (
            <div style={{ padding: 'var(--s5)', display: 'grid', gap: 'var(--s5)' }}>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} style={{ display: 'grid', gap: 7 }}>
                  <Skeleton w="42%" h={11} />
                  <Skeleton w="72%" />
                </div>
              ))}
            </div>
          )}
          {orders.error && <ErrorState message={orders.error} onRetry={orders.reload} />}
          {!orders.loading && !orders.error && attention.length === 0 && (
            <EmptyState
              icon={<Inbox size={18} />}
              title="Nothing open"
              hint="Every order has been delivered or cancelled. New requests will appear here."
            />
          )}

          {attention.map((o: OrderDTO) => (
            <button key={o.id} type="button" className="att-row" onClick={() => onOpenOrder(o.id, o.subject ?? '')}>
              <span className="att-main">
                <span className="att-id">{fmtOrderId(o.id)}</span>
                <span className="t-sm truncate" style={{ display: 'block' }}>{o.subject || 'Untitled order'}</span>
              </span>
              <DeadlineMeter deadline={o.deadline} />
              <StatusBadge status={o.status} />
            </button>
          ))}
        </section>

        {/* ── Availability ── */}
        <section className="card">
          <div className="card-head">
            <div>
              <h2 className="t-h3">Available experts</h2>
              <p className="t-xs text-dim" style={{ marginTop: 2 }}>Ready to take work now</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => onNavigate('experts')}>
              Manage <ArrowRight size={13} />
            </Button>
          </div>

          {experts.loading && (
            <div style={{ padding: 'var(--s5)', display: 'grid', gap: 'var(--s4)' }}>
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} h={30} />)}
            </div>
          )}
          {experts.error && <ErrorState message={experts.error} onRetry={experts.reload} />}
          {!experts.loading && !experts.error && (experts.data?.length ?? 0) === 0 && (
            <EmptyState
              icon={<Users2 size={18} />}
              title="No one is free"
              hint="Every expert is busy or offline. New work will need to wait or be reassigned."
              action={<Button size="sm" onClick={() => onNavigate('experts')}>View experts</Button>}
            />
          )}

          {experts.data?.slice(0, 6).map((e) => (
            <div className="att-row" key={e.id} style={{ cursor: 'default' }}>
              <span className="avatar" aria-hidden>
                {(e.name ?? e.email ?? '?').charAt(0).toUpperCase()}
              </span>
              <span className="att-main">
                <span className="t-sm truncate" style={{ fontWeight: 600, display: 'block' }}>
                  {e.name ?? e.email ?? `Employee ${e.id}`}
                </span>
                <span className="t-xs text-dim truncate" style={{ display: 'block' }}>{e.email ?? ''}</span>
              </span>
              <span className="badge badge-success"><span className="dot" /> Available</span>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
