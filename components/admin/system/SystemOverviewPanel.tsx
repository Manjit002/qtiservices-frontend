'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  RotateCw, Boxes, Users, Wallet, Star, ShieldAlert, AlertTriangle, CalendarClock,
  BadgeCheck, Trash2, ArrowRight, Info, Send, GraduationCap, KeyRound, UserPlus,
  CreditCard, FileSearch, Inbox, Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { Skeleton, EmptyState, ErrorState } from '@/components/ui/States';
import { deadlineState } from '@/components/ui/DeadlineMeter';
import { useAsync } from '@/hooks/useAsync';
import { ordersApi } from '@/lib/api/orders';
import { expertsApi } from '@/lib/api/experts';
import { installmentsApi } from '@/lib/api/payments';
import { reviewsApi } from '@/lib/api/reviews';
import { fmtOrderId, formatCurrency, formatDate, enumValue } from '@/lib/utils/format';
import type { InstallmentDTO, OrderDTO } from '@/types';
import './system.css';
import '@/components/admin/orders.css';

interface Props {
  isSuperAdmin: boolean;
  onNavigate: (key: string) => void;
  onOpenOrder: (id: number, subject?: string) => void;
}

/** How many orders we pull for the distribution and recent list. */
const SAMPLE = 200;

function sum(list: InstallmentDTO[]): number {
  return list.reduce((s, i) => s + (typeof i.finalAmount === 'number' ? i.finalAmount : 0), 0);
}

export function SystemOverviewPanel({ isSuperAdmin, onNavigate, onOpenOrder }: Props) {
  const [stamp, setStamp] = useState<Date>(() => new Date());
  const [nonce, setNonce] = useState(0);

  /**
   * Each source loads independently, so one failing endpoint degrades a single
   * card rather than blanking the dashboard.
   */
  const stats = useAsync((s) => ordersApi.dashboardStats(s), [nonce]);
  const orders = useAsync((s) => ordersApi.listAll(0, SAMPLE, 'createdAt,desc', s), [nonce]);
  const staff = useAsync((s) => expertsApi.listEmployees(s), [nonce]);
  const due = useAsync((s) => installmentsApi.due(s), [nonce]);
  const overdue = useAsync((s) => installmentsApi.overdue(s), [nonce]);
  const reviews = useAsync((s) => reviewsApi.pending(s), [nonce]);
  const deleted = useAsync((s) => ordersApi.listDeleted(s), [nonce]);

  const refreshing = stats.loading || orders.loading || staff.loading;

  const refresh = useCallback(() => {
    if (refreshing) return;              // no duplicate refreshes
    setNonce((n) => n + 1);
    setStamp(new Date());
  }, [refreshing]);

  const rows = useMemo(() => orders.data?.content ?? [], [orders.data]);
  /** The real platform-wide count, straight from the page envelope. */
  const totalOrders = orders.data?.totalElements ?? 0;
  const sampled = totalOrders > rows.length;

  /** Distribution over the fetched sample — labelled as such wherever shown. */
  const distribution = useMemo(() => {
    const counts = new Map<string, number>();
    rows.forEach((o) => {
      const s = enumValue(o.status) || 'UNKNOWN';
      counts.set(s, (counts.get(s) ?? 0) + 1);
    });
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
  }, [rows]);

  const maxCount = distribution[0]?.[1] ?? 1;

  const overdueOrders = useMemo(
    () => rows.filter((o) => {
      const s = enumValue(o.status);
      if (['COMPLETED', 'CANCELLED', 'PAID'].includes(s)) return false;
      return deadlineState(o.deadline).overdue;
    }),
    [rows]
  );

  const team = useMemo(() => {
    const all = staff.data ?? [];
    return {
      availableNow: Number(stats.data?.availableExperts ?? 0),
      total: all.length,
      active: all.filter((e) => e.active).length,
      byRole: ['SUPER_ADMIN', 'ADMIN', 'EXPERT'].map((r) => ({
        role: r,
        n: all.filter((e) => String(e.role ?? '') === r).length,
      })),
      /**
       * NOT counted from the employee list — that DTO carries no availability,
       * so this was always zero. `/admin/admin-dashboard` computes
       * getAvailableExperts().size() server-side, which is the real figure.
       */
    };
  }, [staff.data, stats.data]);

  const dueList = due.data ?? [];
  const overdueList = overdue.data ?? [];
  const reviewList = useMemo(() => reviews.data ?? [], [reviews.data]);
  const deletedList = useMemo(() => deleted.data ?? [], [deleted.data]);

  const deletedValue = useMemo(
    () => deletedList.reduce((s, d) => {
      const raw = d.finalPrice ?? d.totalPrice;
      const n = typeof raw === 'number' ? raw : parseFloat(String(raw ?? '')) || 0;
      return s + n;
    }, 0),
    [deletedList]
  );

  const avgPendingRating = useMemo(() => {
    const rated = reviewList.filter((r) => (r.rating ?? 0) > 0);
    if (!rated.length) return null;
    return rated.reduce((s, r) => s + (r.rating ?? 0), 0) / rated.length;
  }, [reviewList]);

  const d = stats.data;

  if (!isSuperAdmin) {
    return (
      <div className="rise">
        <section className="card">
          <EmptyState
            icon={<ShieldAlert size={18} />}
            title="Super admin only"
            hint="The platform overview is restricted. Your dashboard shows the metrics available to your role."
          />
        </section>
      </div>
    );
  }

  // Only figures that come from a real endpoint. No trends — there is no
  // historical series anywhere in this API to compute one from.
  const kpis = [
    { label: 'Total orders', value: orders.loading ? null : totalOrders.toLocaleString(),
      sub: 'all time', tone: 'var(--accent)', icon: <Boxes size={13} />, to: 'orders' },
    { label: 'Needs review', value: stats.loading ? null : String(d?.reviewPending ?? 0),
      sub: 'awaiting triage', tone: 'var(--warning)', icon: <FileSearch size={13} />, to: 'orders' },
    { label: 'In progress', value: stats.loading ? null : String(d?.assignedOrders ?? 0),
      sub: 'assigned to experts', tone: 'var(--info)', icon: <Clock size={13} />, to: 'orders' },
    { label: 'Completed', value: stats.loading ? null : String(d?.completedOrders ?? 0),
      sub: 'delivered', tone: 'var(--success)', icon: <BadgeCheck size={13} />, to: 'orders' },
    { label: 'Revenue', value: stats.loading ? null : formatCurrency(Number(d?.totalRevenue ?? 0)).replace('.00', ''),
      sub: 'recorded to date', tone: 'var(--gold)', icon: <Wallet size={13} />, to: 'payverify' },
    { label: 'Team', value: staff.loading ? null : String(team.total),
      sub: `${team.active} active · ${team.availableNow} free now`, tone: 'var(--accent)',
      icon: <Users size={13} />, to: 'experts' },
  ];

  const attention = [
    { n: overdueList.length, label: 'Overdue installments',
      sub: overdueList.length ? formatCurrency(sum(overdueList)) : 'nothing overdue',
      tone: 'var(--danger)', bg: 'var(--danger-bg)', icon: <AlertTriangle size={15} />,
      to: 'installments', loading: overdue.loading },
    { n: dueList.length, label: 'Installments due today',
      sub: dueList.length ? formatCurrency(sum(dueList)) : 'nothing due',
      tone: 'var(--warning)', bg: 'var(--warning-bg)', icon: <CalendarClock size={15} />,
      to: 'installments', loading: due.loading },
    { n: overdueOrders.length, label: 'Orders past deadline',
      sub: sampled ? `in the ${rows.length} most recent` : 'across all orders',
      tone: 'var(--danger)', bg: 'var(--danger-bg)', icon: <Clock size={15} />,
      to: 'orders', loading: orders.loading },
    { n: d?.pendingPayments ?? 0, label: 'Payments pending',
      sub: 'awaiting settlement or verification',
      tone: 'var(--warning)', bg: 'var(--warning-bg)', icon: <CreditCard size={15} />,
      to: 'payverify', loading: stats.loading },
    { n: reviewList.length, label: 'Reviews awaiting decision',
      sub: avgPendingRating ? `${avgPendingRating.toFixed(1)} average of these` : 'none waiting',
      tone: 'var(--info)', bg: 'var(--info-bg)', icon: <Star size={15} />,
      to: 'reviews', loading: reviews.loading },
  ];

  const quickActions = [
    { key: 'create-order', label: 'Create order', icon: <Boxes size={15} /> },
    { key: 'assign', label: 'Assign orders', icon: <Send size={15} /> },
    { key: 'students', label: 'Students', icon: <GraduationCap size={15} /> },
    { key: 'payverify', label: 'Verify payments', icon: <BadgeCheck size={15} /> },
    { key: 'installments', label: 'Installments', icon: <CreditCard size={15} /> },
    { key: 'reviews', label: 'Reviews', icon: <Star size={15} /> },
    { key: 'roles', label: 'Roles & access', icon: <KeyRound size={15} /> },
    { key: 'create-expert', label: 'Add expert', icon: <UserPlus size={15} /> },
    { key: 'deleted-orders', label: 'Deleted orders', icon: <Trash2 size={15} /> },
  ];

  return (
    <div className="rise">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--s4)', flexWrap: 'wrap', marginBottom: 'var(--s5)' }}>
        <div>
          <h1 className="t-h1">System overview</h1>
          <p className="t-sm text-dim" style={{ marginTop: 4 }}>
            Platform-wide operational and financial picture.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s3)' }}>
          <span className="t-xs text-faint">
            Updated {stamp.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
          </span>
          <Button size="sm" onClick={refresh} loading={refreshing}>
            <RotateCw size={13} /> Refresh
          </Button>
        </div>
      </div>

      {/* ── KPIs ── */}
      <div className="sy-kpis" style={{ marginBottom: 'var(--s5)' }}>
        {kpis.map((k) => (
          <button key={k.label} type="button" className="sy-kpi" onClick={() => onNavigate(k.to)}>
            <span className="sy-kpi-flag" style={{ background: k.tone }} aria-hidden />
            <span className="sy-kpi-head">
              <span style={{ color: k.tone }}>{k.icon}</span> {k.label}
            </span>
            <span className="sy-kpi-val">
              {k.value === null ? <Skeleton w={70} h={26} /> : k.value}
            </span>
            <span className="sy-kpi-sub">{k.sub}</span>
          </button>
        ))}
      </div>
      {stats.error && <ErrorState message={stats.error} onRetry={stats.reload} />}

      <div className="sy-grid">
        <div className="sy-2">
          {/* ── Order distribution ── */}
          <section className="card">
            <div className="card-head">
              <div>
                <h2 className="t-h3">Orders by status</h2>
                <p className="t-xs text-dim" style={{ marginTop: 2 }}>
                  Where work currently sits
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => onNavigate('orders')}>
                All orders <ArrowRight size={13} />
              </Button>
            </div>

            {orders.loading && (
              <div className="sy-dist">
                {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} h={22} />)}
              </div>
            )}
            {orders.error && <ErrorState message={orders.error} onRetry={orders.reload} />}
            {!orders.loading && !orders.error && distribution.length === 0 && (
              <EmptyState icon={<Inbox size={18} />} title="No orders yet" />
            )}

            {distribution.length > 0 && (
              <>
                <div className="sy-dist">
                  {distribution.map(([status, n]) => (
                    <div className="sy-bar-row" key={status}>
                      <StatusBadge status={status} />
                      <div className="sy-bar" role="img"
                           aria-label={`${status.replace(/_/g, ' ').toLowerCase()}: ${n} orders`}>
                        <div className="sy-bar-fill"
                             style={{ width: `${Math.max(3, (n / maxCount) * 100)}%`, background: 'var(--accent)' }} />
                      </div>
                      <span className="sy-bar-n">{n}</span>
                    </div>
                  ))}
                </div>
                {/* Says plainly that this is a sample, not the whole set. */}
                {sampled && (
                  <div className="sy-caveat">
                    <Info size={12} style={{ flexShrink: 0, marginTop: 1 }} />
                    <span>
                      Distribution covers the {rows.length} most recent of {totalOrders.toLocaleString()} orders.
                      The API returns no status aggregate, so this is a sample rather than the full set.
                    </span>
                  </div>
                )}
              </>
            )}
          </section>

          {/* ── Financial ── */}
          <section className="card">
            <div className="card-head">
              <div>
                <h2 className="t-h3">Financial</h2>
                <p className="t-xs text-dim" style={{ marginTop: 2 }}>Money in and money owed</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => onNavigate('payverify')}>
                Payments <ArrowRight size={13} />
              </Button>
            </div>

            <div className="sy-money">
              <div className="sy-money-row">
                <span className="sy-money-lbl">
                  <Wallet size={14} style={{ color: 'var(--gold)' }} /> Revenue recorded
                </span>
                <span className="sy-money-val">
                  {stats.loading ? <Skeleton w={80} h={18} />
                    : formatCurrency(Number(d?.totalRevenue ?? 0))}
                </span>
              </div>
              <div className="sy-money-row">
                <span className="sy-money-lbl">
                  <CalendarClock size={14} style={{ color: 'var(--warning)' }} /> Installments due today
                </span>
                <span className="sy-money-val" style={{ color: dueList.length ? 'var(--warning)' : undefined }}>
                  {due.loading ? <Skeleton w={70} h={18} /> : formatCurrency(sum(dueList))}
                </span>
              </div>
              <div className="sy-money-row">
                <span className="sy-money-lbl">
                  <AlertTriangle size={14} style={{ color: 'var(--danger)' }} /> Installments overdue
                </span>
                <span className="sy-money-val" style={{ color: overdueList.length ? 'var(--danger)' : undefined }}>
                  {overdue.loading ? <Skeleton w={70} h={18} /> : formatCurrency(sum(overdueList))}
                </span>
              </div>
              <div className="sy-money-row">
                <span className="sy-money-lbl">
                  <Trash2 size={14} style={{ color: 'var(--text-dim)' }} /> Value of deleted orders
                </span>
                <span className="sy-money-val text-dim">
                  {deleted.loading ? <Skeleton w={70} h={18} /> : formatCurrency(deletedValue)}
                </span>
              </div>
            </div>

            {(due.error || overdue.error) && (
              <ErrorState message={due.error ?? overdue.error ?? 'Failed'} onRetry={() => { due.reload(); overdue.reload(); }} />
            )}

            <div className="sy-caveat">
              <Info size={12} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>
                Revenue and pending payments come from the platform dashboard endpoint.
                Installment figures are summed from the due and overdue queues.
              </span>
            </div>
          </section>
        </div>

        <div className="sy-2">
          {/* ── Attention ── */}
          <section className="card">
            <div className="card-head">
              <div>
                <h2 className="t-h3">Needs attention</h2>
                <p className="t-xs text-dim" style={{ marginTop: 2 }}>Everything waiting on someone</p>
              </div>
            </div>
            {attention.map((a) => (
              <button key={a.label} type="button" className="sy-att" onClick={() => onNavigate(a.to)}>
                <span className="sy-att-icon" style={{ background: a.bg, color: a.tone }} aria-hidden>
                  {a.icon}
                </span>
                <span className="sy-att-main">
                  <span className="t-sm" style={{ fontWeight: 600, display: 'block' }}>{a.label}</span>
                  <span className="t-xs text-dim">{a.sub}</span>
                </span>
                <span className="sy-att-n" style={{ color: a.n > 0 ? a.tone : 'var(--text-faint)' }}>
                  {a.loading ? <Skeleton w={26} h={20} /> : a.n}
                </span>
                <ArrowRight size={13} style={{ color: 'var(--text-faint)', flexShrink: 0 }} />
              </button>
            ))}
          </section>

          {/* ── Team ── */}
          <section className="card">
            <div className="card-head">
              <div>
                <h2 className="t-h3">Team</h2>
                <p className="t-xs text-dim" style={{ marginTop: 2 }}>Staff accounts and availability</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => onNavigate('experts')}>
                Manage <ArrowRight size={13} />
              </Button>
            </div>

            {staff.loading && (
              <div style={{ padding: 'var(--s5)', display: 'grid', gap: 'var(--s3)' }}>
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} h={28} />)}
              </div>
            )}
            {staff.error && <ErrorState message={staff.error} onRetry={staff.reload} />}

            {!staff.loading && !staff.error && (
              <>
                <div className="sy-money">
                  {team.byRole.map((r) => (
                    <div className="sy-money-row" key={r.role}>
                      <span className="sy-money-lbl">
                        <Badge tone={r.role === 'EXPERT' ? 'accent' : r.role === 'ADMIN' ? 'info' : 'warning'}>
                          {r.role.replace('_', ' ').toLowerCase()}
                        </Badge>
                      </span>
                      <span className="sy-money-val">{r.n}</span>
                    </div>
                  ))}
                  <div className="sy-money-row">
                    <span className="sy-money-lbl">
                      <Users size={14} style={{ color: 'var(--success)' }} /> Available right now
                    </span>
                    <span className="sy-money-val" style={{ color: 'var(--success)' }}>
                      {team.availableNow}
                    </span>
                  </div>
                </div>
                {/* The absence is stated rather than filled with a wrong number. */}
                <div className="sy-caveat">
                  <Info size={12} style={{ flexShrink: 0, marginTop: 1 }} />
                  <span>
                    Student totals are not shown: the backend has no student-list endpoint,
                    so any count here would only reflect students appearing in recent orders.
                    Look one up on the Students page instead.
                  </span>
                </div>
              </>
            )}
          </section>
        </div>

        {/* ── Recent orders ── */}
        <section className="card">
          <div className="card-head">
            <div>
              <h2 className="t-h3">Latest orders</h2>
              <p className="t-xs text-dim" style={{ marginTop: 2 }}>
                Most recent records — the API exposes no activity or audit feed
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => onNavigate('orders')}>
              All orders <ArrowRight size={13} />
            </Button>
          </div>

          {orders.loading && (
            <div style={{ padding: 'var(--s5)', display: 'grid', gap: 'var(--s3)' }}>
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} h={30} />)}
            </div>
          )}
          {!orders.loading && !orders.error && rows.length === 0 && (
            <EmptyState icon={<Inbox size={18} />} title="No orders yet" />
          )}
          {rows.slice(0, 6).map((o: OrderDTO) => (
            <button key={o.id} type="button" className="sy-recent"
                    onClick={() => onOpenOrder(o.id, o.subject ?? '')}>
              <span style={{ minWidth: 0, flex: 1 }}>
                <span className="ord-id">{fmtOrderId(o.id)}</span>
                <span className="t-sm truncate" style={{ display: 'block' }}>
                  {o.subject || 'Untitled order'}
                </span>
              </span>
              <span className="t-xs text-dim" style={{ flexShrink: 0 }}>
                {o.createdAt ? formatDate(o.createdAt) : '—'}
              </span>
              <StatusBadge status={o.status} />
            </button>
          ))}
        </section>

        {/* ── Quick actions ── */}
        <section className="card">
          <div className="card-head"><h2 className="t-h3">Quick actions</h2></div>
          <div className="sy-qa">
            {quickActions.map((a) => (
              <button key={a.key} type="button" className="sy-qa-btn" onClick={() => onNavigate(a.key)}>
                <span style={{ color: 'var(--accent)' }}>{a.icon}</span> {a.label}
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
