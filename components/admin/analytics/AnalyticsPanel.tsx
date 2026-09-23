'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  RotateCw, Boxes, Wallet, BadgeCheck, Clock, TrendingUp, Info, Inbox,
  Users, CreditCard, ArrowRight, FileSearch,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/Badge';
import { Skeleton, EmptyState, ErrorState } from '@/components/ui/States';
import { useAsync } from '@/hooks/useAsync';
import { ordersApi } from '@/lib/api/orders';
import { AreaChart, type SeriesPoint } from './charts/AreaChart';
import { DonutChart, type Slice } from './charts/DonutChart';
import { BarList, type BarRow } from './charts/BarList';
import { fmtOrderId, formatCurrency, formatDate, enumValue, parseServerDate } from '@/lib/utils/format';
import type { OrderDTO } from '@/types';
import './analytics.css';
import '@/components/admin/orders.css';

interface Props {
  onNavigate: (key: string) => void;
  onOpenOrder: (id: number, subject?: string) => void;
}

/**
 * The analytics window.
 *
 * There is NO time-series endpoint — /admin/admin-dashboard returns
 * point-in-time totals only. Every trend on this page is derived by bucketing
 * the real `createdAt` and `price` on orders, so the sample size IS the
 * analysable history. 500 is a deliberate trade between coverage and payload.
 */
const SAMPLE = 500;

type Range = 7 | 30 | 90 | 365;
const RANGES: { days: Range; label: string }[] = [
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
  { days: 365, label: '1 year' },
];

const STATUS_COLOR: Record<string, string> = {
  COMPLETED: 'var(--success)', PAID: 'var(--success)',
  IN_PROGRESS: 'var(--accent)', ASSIGNED: 'var(--accent)', REASSIGNED: 'var(--accent)',
  SUBMITTED: 'var(--info)', UNDER_REVIEW: 'var(--info)', PRICE_SET: 'var(--info)',
  AUTO_PRICED: 'var(--info)', REVIEW_PENDING: 'var(--warning)', PRICE_PENDING: 'var(--warning)',
  UNASSIGNED: 'var(--neutral)', CREATED: 'var(--neutral)',
  CANCELLED: 'var(--danger)', FAILED: 'var(--danger)',
};

const PAYMENT_COLOR: Record<string, string> = {
  SUCCESS: 'var(--success)', PAID: 'var(--success)',
  PENDING: 'var(--warning)', PARTIAL: 'var(--warning)', PARTIALLY_PAID: 'var(--warning)',
  FAILED: 'var(--danger)',
};

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

export function AnalyticsPanel({ onNavigate, onOpenOrder }: Props) {
  const [range, setRange] = useState<Range>(30);
  const [nonce, setNonce] = useState(0);

  const stats = useAsync((s) => ordersApi.dashboardStats(s), [nonce]);
  const orders = useAsync((s) => ordersApi.listAll(0, SAMPLE, 'createdAt,desc', s), [nonce]);

  const busy = stats.loading || orders.loading;
  const refresh = useCallback(() => { if (!busy) setNonce((n) => n + 1); }, [busy]);

  const all = useMemo(() => orders.data?.content ?? [], [orders.data]);
  const totalOrders = orders.data?.totalElements ?? 0;

  /** Oldest order actually fetched — the true edge of what can be charted. */
  const oldest = useMemo(() => {
    const times = all
      .map((o) => parseServerDate(o.createdAt)?.getTime())
      .filter((t): t is number => typeof t === 'number');
    return times.length ? new Date(Math.min(...times)) : null;
  }, [all]);

  const rangeStart = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - range);
    return d;
  }, [range]);

  /**
   * True when the chosen range reaches further back than the data we hold, so
   * the chart's early buckets would read as zero when they are simply unknown.
   */
  const rangeExceedsSample = Boolean(oldest && rangeStart < oldest && all.length >= SAMPLE);

  const windowed = useMemo(
    () => all.filter((o) => {
      const t = parseServerDate(o.createdAt);
      return t ? t.getTime() >= rangeStart.getTime() : false;
    }),
    [all, rangeStart]
  );

  /** Daily buckets for short ranges, weekly beyond 30 days, so bars stay legible. */
  const { orderSeries, valueSeries } = useMemo(() => {
    const weekly = range > 30;
    const buckets = new Map<string, { label: string; count: number; value: number; t: number }>();

    const steps = weekly ? Math.ceil(range / 7) : range;
    for (let i = steps - 1; i >= 0; i -= 1) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i * (weekly ? 7 : 1));
      const key = weekly ? `w${Math.floor(d.getTime() / 6.048e8)}` : dayKey(d);
      buckets.set(key, {
        label: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        count: 0, value: 0, t: d.getTime(),
      });
    }

    windowed.forEach((o) => {
      const d = parseServerDate(o.createdAt);
      if (!d) return;
      const key = weekly ? `w${Math.floor(d.getTime() / 6.048e8)}` : dayKey(d);
      const b = buckets.get(key);
      if (!b) return;
      b.count += 1;
      b.value += o.price ?? 0;
    });

    const sorted = [...buckets.values()].sort((a, b) => a.t - b.t);
    return {
      orderSeries: sorted.map<SeriesPoint>((b) => ({ label: b.label, value: b.count })),
      valueSeries: sorted.map<SeriesPoint>((b) => ({ label: b.label, value: b.value })),
    };
  }, [windowed, range]);

  const statusSlices = useMemo<Slice[]>(() => {
    const m = new Map<string, number>();
    windowed.forEach((o) => {
      const s = enumValue(o.status) || 'UNKNOWN';
      m.set(s, (m.get(s) ?? 0) + 1);
    });
    return [...m.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 7)
      .map(([label, value]) => ({
        label: label.replace(/_/g, ' ').toLowerCase(),
        value,
        color: STATUS_COLOR[label] ?? 'var(--neutral)',
      }));
  }, [windowed]);

  const paymentSlices = useMemo<Slice[]>(() => {
    const m = new Map<string, number>();
    windowed.forEach((o) => {
      const s = enumValue(o.paymentStatus);
      if (s) m.set(s, (m.get(s) ?? 0) + 1);
    });
    return [...m.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([label, value]) => ({
        label: label.replace(/_/g, ' ').toLowerCase(),
        value,
        color: PAYMENT_COLOR[label] ?? 'var(--neutral)',
      }));
  }, [windowed]);

  const byType = useMemo<BarRow[]>(() => {
    const m = new Map<string, { n: number; value: number }>();
    windowed.forEach((o) => {
      const t = ((o.assignmentType as string) ?? o.type ?? '').trim() || 'Unspecified';
      const cur = m.get(t) ?? { n: 0, value: 0 };
      cur.n += 1;
      cur.value += o.price ?? 0;
      m.set(t, cur);
    });
    return [...m.entries()]
      .sort((a, b) => b[1].n - a[1].n)
      .slice(0, 8)
      .map(([label, v]) => ({ label, value: v.n, meta: formatCurrency(v.value) }));
  }, [windowed]);

  const byExpert = useMemo<BarRow[]>(() => {
    const m = new Map<string, number>();
    windowed.forEach((o) => {
      const name = (o.assignedEmployeeName as string | undefined)?.trim();
      if (!name) return;
      m.set(name, (m.get(name) ?? 0) + 1);
    });
    return [...m.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([label, value]) => ({ label, value }));
  }, [windowed]);

  /** AOV over priced orders only — including unpriced ones would drag it down. */
  const aov = useMemo(() => {
    const priced = windowed.filter((o) => (o.price ?? 0) > 0);
    if (!priced.length) return null;
    return priced.reduce((s, o) => s + (o.price ?? 0), 0) / priced.length;
  }, [windowed]);

  const windowValue = useMemo(
    () => windowed.reduce((s, o) => s + (o.price ?? 0), 0),
    [windowed]
  );

  const d = stats.data;
  const rangeLabel = RANGES.find((r) => r.days === range)?.label ?? '';

  const kpis = [
    { label: 'Total orders', value: orders.loading ? null : totalOrders.toLocaleString(),
      sub: 'all time', tone: 'var(--accent)', icon: <Boxes size={13} /> },
    { label: 'New orders', value: orders.loading ? null : windowed.length.toLocaleString(),
      sub: `in the last ${rangeLabel}`, tone: 'var(--info)', icon: <TrendingUp size={13} /> },
    { label: 'Completed', value: stats.loading ? null : String(d?.completedOrders ?? 0),
      sub: 'all time', tone: 'var(--success)', icon: <BadgeCheck size={13} /> },
    { label: 'In progress', value: stats.loading ? null : String(d?.assignedOrders ?? 0),
      sub: 'assigned now', tone: 'var(--accent)', icon: <Clock size={13} /> },
    { label: 'Revenue', value: stats.loading ? null : formatCurrency(Number(d?.totalRevenue ?? 0)).replace('.00', ''),
      sub: 'recorded to date', tone: 'var(--gold)', icon: <Wallet size={13} /> },
    { label: 'Pending payments', value: stats.loading ? null : String(d?.pendingPayments ?? 0),
      sub: 'awaiting settlement', tone: 'var(--warning)', icon: <CreditCard size={13} /> },
    { label: 'Avg order value', value: orders.loading ? null : (aov != null ? formatCurrency(aov) : '—'),
      sub: `priced orders, last ${rangeLabel}`, tone: 'var(--info)', icon: <FileSearch size={13} /> },
    { label: 'Needs review', value: stats.loading ? null : String(d?.reviewPending ?? 0),
      sub: 'awaiting triage', tone: 'var(--warning)', icon: <Inbox size={13} /> },
  ];

  const sampleNote = (
    <div className="an-note">
      <Info size={12} style={{ flexShrink: 0, marginTop: 1 }} />
      <span>
        Derived from the {all.length.toLocaleString()} most recent of{' '}
        {totalOrders.toLocaleString()} orders — the API exposes no time-series endpoint,
        so trends are computed from order records on the client.
        {rangeExceedsSample && oldest && (
          <> This range reaches past the oldest record held ({formatDate(oldest.toISOString())}),
          so earlier buckets are incomplete rather than empty.</>
        )}
      </span>
    </div>
  );

  return (
    <div className="rise">
      <div className="an-bar">
        <div>
          <h1 className="t-h1">Analytics</h1>
          <p className="t-sm text-dim" style={{ marginTop: 4 }}>
            Order volume, value and mix over time.
          </p>
        </div>
        <div style={{ flex: 1 }} />
        <div className="seg" role="group" aria-label="Time range">
          {RANGES.map((r) => (
            <button key={r.days} type="button" className={range === r.days ? 'on' : ''}
                    onClick={() => setRange(r.days)} aria-pressed={range === r.days}>
              {r.label}
            </button>
          ))}
        </div>
        <Button size="sm" onClick={refresh} loading={busy}>
          <RotateCw size={13} /> Refresh
        </Button>
      </div>

      {/* ── KPIs ── */}
      <div className="an-kpis">
        {kpis.map((k) => (
          <div className="an-kpi" key={k.label}>
            <span className="an-kpi-flag" style={{ background: k.tone }} aria-hidden />
            <span className="an-kpi-head">
              <span style={{ color: k.tone }}>{k.icon}</span> {k.label}
            </span>
            <div className="an-kpi-val">
              {k.value === null ? <Skeleton w={72} h={26} /> : k.value}
            </div>
            <div className="an-kpi-sub">{k.sub}</div>
          </div>
        ))}
      </div>
      {stats.error && <ErrorState message={stats.error} onRetry={stats.reload} />}

      {orders.error ? (
        <section className="card">
          <ErrorState message={orders.error} onRetry={orders.reload} />
        </section>
      ) : (
        <div className="an-grid">
          {/* ── Order volume ── */}
          <section className="card">
            <div className="card-head">
              <div>
                <h2 className="t-h3">Orders created</h2>
                <p className="t-xs text-dim" style={{ marginTop: 2 }}>
                  {windowed.length} in the last {rangeLabel}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => onNavigate('orders')}>
                Orders <ArrowRight size={13} />
              </Button>
            </div>
            {orders.loading ? (
              <div style={{ padding: 'var(--s5)' }}><Skeleton h={200} /></div>
            ) : windowed.length === 0 ? (
              <EmptyState icon={<Inbox size={18} />} title="No orders in this range"
                          hint="Try a longer time range." />
            ) : (
              <AreaChart
                points={orderSeries}
                color="var(--accent)"
                summary={`Orders created per ${range > 30 ? 'week' : 'day'} over the last ${rangeLabel}, totalling ${windowed.length}.`}
              />
            )}
            {!orders.loading && windowed.length > 0 && sampleNote}
          </section>

          {/* ── Order value ── */}
          <section className="card">
            <div className="card-head">
              <div>
                <h2 className="t-h3">Order value created</h2>
                {/* Named precisely: this is what was BILLED, not what was received. */}
                <p className="t-xs text-dim" style={{ marginTop: 2 }}>
                  {formatCurrency(windowValue)} of orders raised in the last {rangeLabel}
                </p>
              </div>
            </div>
            {orders.loading ? (
              <div style={{ padding: 'var(--s5)' }}><Skeleton h={200} /></div>
            ) : windowed.length === 0 ? (
              <EmptyState icon={<Wallet size={18} />} title="No orders in this range" />
            ) : (
              <AreaChart
                points={valueSeries}
                color="var(--gold)"
                format={(n) => (n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${Math.round(n)}`)}
                summary={`Value of orders created per ${range > 30 ? 'week' : 'day'} over the last ${rangeLabel}, totalling ${formatCurrency(windowValue)}.`}
              />
            )}
            <div className="an-note">
              <Info size={12} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>
                This is the <strong>value of orders raised</strong>, summed from order
                prices by creation date — not payments received. Revenue actually
                collected is the KPI above, which comes from the platform endpoint.
              </span>
            </div>
          </section>

          <div className="an-2">
            {/* ── Status mix ── */}
            <section className="card">
              <div className="card-head">
                <h2 className="t-h3">Status mix</h2>
                <span className="t-xs text-dim">last {rangeLabel}</span>
              </div>
              {orders.loading ? (
                <div style={{ padding: 'var(--s5)' }}><Skeleton h={160} /></div>
              ) : statusSlices.length === 0 ? (
                <EmptyState icon={<Inbox size={18} />} title="No orders in this range" />
              ) : (
                <DonutChart
                  slices={statusSlices}
                  total={windowed.length}
                  centerLabel="orders"
                  summary={`Order status mix: ${statusSlices.map((s) => `${s.label} ${s.value}`).join(', ')}.`}
                />
              )}
            </section>

            {/* ── Payment mix ── */}
            <section className="card">
              <div className="card-head">
                <h2 className="t-h3">Payment status</h2>
                <Button variant="ghost" size="sm" onClick={() => onNavigate('payverify')}>
                  Payments <ArrowRight size={13} />
                </Button>
              </div>
              {orders.loading ? (
                <div style={{ padding: 'var(--s5)' }}><Skeleton h={160} /></div>
              ) : paymentSlices.length === 0 ? (
                <EmptyState icon={<CreditCard size={18} />} title="No payment status recorded"
                            hint="Orders in this range carry no payment status yet." />
              ) : (
                <DonutChart
                  slices={paymentSlices}
                  total={paymentSlices.reduce((s, x) => s + x.value, 0)}
                  centerLabel="with status"
                  summary={`Payment status mix: ${paymentSlices.map((s) => `${s.label} ${s.value}`).join(', ')}.`}
                />
              )}
            </section>
          </div>

          <div className="an-2">
            {/* ── By assignment type ── */}
            <section className="card">
              <div className="card-head">
                <h2 className="t-h3">By assignment type</h2>
                <span className="t-xs text-dim">count · value</span>
              </div>
              {orders.loading ? (
                <div style={{ padding: 'var(--s5)' }}><Skeleton h={150} /></div>
              ) : byType.length === 0 ? (
                <EmptyState icon={<Inbox size={18} />} title="No data in this range" />
              ) : (
                <BarList rows={byType} color="var(--accent)" />
              )}
            </section>

            {/* ── By expert ── */}
            <section className="card">
              <div className="card-head">
                <h2 className="t-h3">Orders by expert</h2>
                <Button variant="ghost" size="sm" onClick={() => onNavigate('experts')}>
                  Experts <ArrowRight size={13} />
                </Button>
              </div>
              {orders.loading ? (
                <div style={{ padding: 'var(--s5)' }}><Skeleton h={150} /></div>
              ) : byExpert.length === 0 ? (
                <EmptyState icon={<Users size={18} />} title="No assigned orders in this range"
                            hint="Orders show here once they have an expert attached." />
              ) : (
                <BarList rows={byExpert} color="var(--info)" />
              )}
            </section>
          </div>

          {/* ── Highest value orders ── */}
          <section className="card">
            <div className="card-head">
              <div>
                <h2 className="t-h3">Highest-value orders</h2>
                <p className="t-xs text-dim" style={{ marginTop: 2 }}>
                  In the last {rangeLabel}
                </p>
              </div>
            </div>
            {orders.loading ? (
              <div style={{ padding: 'var(--s5)', display: 'grid', gap: 'var(--s3)' }}>
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} h={30} />)}
              </div>
            ) : windowed.length === 0 ? (
              <EmptyState icon={<Inbox size={18} />} title="No orders in this range" />
            ) : (
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th scope="col">Order</th>
                      <th scope="col">Subject</th>
                      <th scope="col">Status</th>
                      <th scope="col">Expert</th>
                      <th scope="col" style={{ textAlign: 'right' }}>Value</th>
                      <th scope="col">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...windowed]
                      .sort((a, b) => (b.price ?? 0) - (a.price ?? 0))
                      .slice(0, 8)
                      .map((o: OrderDTO) => (
                        <tr key={o.id}>
                          <td>
                            <button type="button" className="ord-id"
                                    onClick={() => onOpenOrder(o.id, o.subject ?? '')}>
                              {fmtOrderId(o.id)}
                            </button>
                          </td>
                          <td>
                            <div className="truncate" style={{ maxWidth: 210 }} title={o.subject ?? ''}>
                              {o.subject || '—'}
                            </div>
                          </td>
                          <td><StatusBadge status={o.status} /></td>
                          <td className="t-sm text-dim truncate" style={{ maxWidth: 140 }}>
                            {(o.assignedEmployeeName as string | undefined) ?? '—'}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 600 }}>
                            {o.price != null ? formatCurrency(o.price) : '—'}
                          </td>
                          <td className="t-sm text-dim" style={{ whiteSpace: 'nowrap' }}>
                            {o.createdAt ? formatDate(o.createdAt) : '—'}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
