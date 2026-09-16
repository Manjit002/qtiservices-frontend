'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  Search, X, RotateCw, Send, Eye, Inbox, CheckCircle2, Users, AlertTriangle,
  Wallet, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/Badge';
import { DeadlineMeter, deadlineState } from '@/components/ui/DeadlineMeter';
import { Skeleton, SkeletonRows, EmptyState, ErrorState } from '@/components/ui/States';
import { useAsync } from '@/hooks/useAsync';
import { useDebounce } from '@/hooks/useDebounce';
import { usePagination } from '@/hooks/usePagination';
import { useLiveClock } from '@/hooks/useLiveDeadlines';
import { ordersApi } from '@/lib/api/orders';
import { expertsApi } from '@/lib/api/experts';
import { fmtOrderId, fmtStudentId, formatCurrency } from '@/lib/utils/format';
import type { OrderDTO } from '@/types';
import './assign.css';
import '@/components/admin/orders.css';

/**
 * An order counts as unassigned by STATUS — the list DTO carries no
 * assignedEmployeeId, so status is the only reliable signal. This list is
 * copied verbatim from the source; do not "improve" it.
 */
const NOT_ASSIGNED = [
  'CREATED', 'REVIEW_PENDING', 'UNDER_REVIEW', 'PRICE_SET',
  'AUTO_PRICED', 'PRICE_QUOTED', 'PRICE_UPDATED', 'UNASSIGNED',
];

/** The source requests size=100 for this queue. */
const SAMPLE = 100;

interface Props {
  onAssign: (order: OrderDTO) => void;
  onOpenDetail: (id: number, subject?: string) => void;
  refreshKey?: number;
}

export function AssignOrdersPanel({ onAssign, onOpenDetail, refreshKey = 0 }: Props) {
  useLiveClock();

  const orders = useAsync(
    (s) => ordersApi.listAll(0, SAMPLE, 'createdAt,desc', s),
    [refreshKey]
  );
  const experts = useAsync((s) => expertsApi.listAvailable(s), [refreshKey]);

  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [urgentOnly, setUrgentOnly] = useState(false);
  const search = useDebounce(query, 300);

  const all = useMemo(() => orders.data?.content ?? [], [orders.data]);

  const unassigned = useMemo(
    () => all.filter((o) => NOT_ASSIGNED.includes(String(o.status ?? ''))),
    [all]
  );

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase().replace(/^od-/, '');
    return unassigned.filter((o) => {
      if (statusFilter !== 'ALL' && String(o.status ?? '') !== statusFilter) return false;
      if (urgentOnly) {
        const st = deadlineState(o.deadline);
        if (!st.overdue && st.pct < 75) return false;
      }
      if (!q) return true;
      return (
        String(o.id).includes(q) ||
        (o.subject ?? '').toLowerCase().includes(q) ||
        (o.studentEmail ?? '').toLowerCase().includes(q) ||
        String(o.studentId ?? '').includes(q)
      );
    });
  }, [unassigned, search, statusFilter, urgentOnly]);

  const { page, totalPages, total, pageItems, setPage } = usePagination(rows, 12);

  const overdueCount = useMemo(
    () => unassigned.filter((o) => deadlineState(o.deadline).overdue).length,
    [unassigned]
  );

  const queueValue = useMemo(
    () => unassigned.reduce((s, o) => s + (o.price ?? 0), 0),
    [unassigned]
  );

  const statuses = useMemo(() => {
    const present = new Set(unassigned.map((o) => String(o.status ?? '')).filter(Boolean));
    return ['ALL', ...[...present].sort()];
  }, [unassigned]);

  const refresh = useCallback(() => {
    orders.reload();
    experts.reload();
  }, [orders, experts]);

  const filtering = Boolean(query || statusFilter !== 'ALL' || urgentOnly);

  const stats = [
    { label: 'Awaiting assignment', value: unassigned.length, tone: 'var(--warning)',
      icon: <Inbox size={13} />, sub: `of ${all.length} recent orders`, loading: orders.loading },
    { label: 'Past deadline', value: overdueCount, tone: 'var(--danger)',
      icon: <AlertTriangle size={13} />, sub: overdueCount ? 'assign these first' : 'none overdue',
      loading: orders.loading },
    { label: 'Experts available', value: experts.data?.length ?? 0, tone: 'var(--success)',
      icon: <Users size={13} />, sub: 'ready to take work', loading: experts.loading },
    { label: 'Queue value', value: formatCurrency(queueValue), tone: 'var(--gold)',
      icon: <Wallet size={13} />, sub: 'unassigned orders', loading: orders.loading },
  ];

  const actions = (o: OrderDTO) => (
    <div className="acts">
      <button type="button" className="act act-primary" onClick={() => onAssign(o)}>
        <Send size={12} /> Assign
      </button>
      <button type="button" className="act" onClick={() => onOpenDetail(o.id, o.subject ?? '')}>
        <Eye size={12} /> View
      </button>
    </div>
  );

  return (
    <div className="rise">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--s4)', flexWrap: 'wrap', marginBottom: 'var(--s5)' }}>
        <div>
          <h1 className="t-h1">Assign orders</h1>
          <p className="t-sm text-dim" style={{ marginTop: 4 }}>
            Review orders waiting for an expert and hand them to the right person.
          </p>
        </div>
        <Button size="sm" onClick={refresh} loading={orders.loading || experts.loading}>
          <RotateCw size={13} /> Refresh
        </Button>
      </div>

      <div className="as-stats">
        {stats.map((s) => (
          <div className="as-stat" key={s.label}>
            <span className="as-stat-flag" style={{ background: s.tone }} aria-hidden />
            <span className="as-stat-head">
              <span style={{ color: s.tone }}>{s.icon}</span> {s.label}
            </span>
            <div className="as-stat-val">
              {s.loading ? <Skeleton w={56} h={24} /> : s.value}
            </div>
            <div className="as-stat-sub">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Toolbar ── */}
      <div className="ord-bar">
        <div className="ord-search">
          <Search size={14} />
          <input className="input" value={query} onChange={(e) => setQuery(e.target.value)}
                 placeholder="Search order ID, subject or student…"
                 aria-label="Search unassigned orders" />
          {query && (
            <button type="button" className="clear" onClick={() => setQuery('')}
                    aria-label="Clear search">
              <X size={13} />
            </button>
          )}
        </div>

        <select className="input" style={{ width: 165 }} value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)} aria-label="Filter by status">
          {statuses.map((s) => (
            <option key={s} value={s}>
              {s === 'ALL' ? 'All statuses' : s.replace(/_/g, ' ').toLowerCase()}
            </option>
          ))}
        </select>

        <button type="button" className={`act${urgentOnly ? ' act-primary' : ''}`}
                onClick={() => setUrgentOnly((v) => !v)} aria-pressed={urgentOnly}>
          <AlertTriangle size={12} /> Urgent only
        </button>

        {filtering && (
          <Button size="sm" variant="ghost"
                  onClick={() => { setQuery(''); setStatusFilter('ALL'); setUrgentOnly(false); }}>
            Clear filters
          </Button>
        )}
      </div>

      <section className="card">
        <div className="card-head">
          <div>
            <h2 className="t-h3">Unassigned orders</h2>
            <p className="t-xs text-dim" style={{ marginTop: 2 }}>
              {orders.loading ? 'Loading…' : `${total} waiting${filtering ? ' (filtered)' : ''}`}
            </p>
          </div>
        </div>

        <div className="as-table-wrap table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th scope="col">Order</th>
                <th scope="col">Student</th>
                <th scope="col">Type</th>
                <th scope="col">Deadline</th>
                <th scope="col" style={{ textAlign: 'right' }}>Price</th>
                <th scope="col">Status</th>
                <th scope="col" style={{ textAlign: 'right', width: 190 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {orders.loading && <SkeletonRows rows={6} cols={7} />}
              {orders.error && (
                <tr><td colSpan={7}><ErrorState message={orders.error} onRetry={refresh} /></td></tr>
              )}
              {!orders.loading && !orders.error && pageItems.length === 0 && (
                <tr><td colSpan={7}>
                  <EmptyState
                    icon={filtering ? <Search size={18} /> : <CheckCircle2 size={18} />}
                    title={filtering ? 'No orders match' : 'Everything is assigned'}
                    hint={filtering
                      ? 'Try a different search, or clear the filters.'
                      : 'No orders are waiting for an expert. New requests appear here once they are priced or reviewed.'}
                    action={filtering
                      ? <Button size="sm" onClick={() => { setQuery(''); setStatusFilter('ALL'); setUrgentOnly(false); }}>
                          Clear filters
                        </Button>
                      : <Button size="sm" onClick={refresh}><RotateCw size={13} /> Refresh</Button>}
                  />
                </td></tr>
              )}
              {pageItems.map((o, i) => (
                <tr key={o.id} className="as-row-anim" style={{ animationDelay: `${i * 22}ms` }}>
                  <td>
                    <button type="button" className="as-id"
                            onClick={() => onOpenDetail(o.id, o.subject ?? '')}>
                      {fmtOrderId(o.id)}
                    </button>
                    <div className="truncate as-sub" style={{ maxWidth: 210 }} title={o.subject ?? ''}>
                      {o.subject || 'Untitled order'}
                    </div>
                  </td>
                  <td className="t-sm text-dim truncate" style={{ maxWidth: 170 }}>
                    {o.studentEmail || (o.studentId ? fmtStudentId(o.studentId) : '—')}
                  </td>
                  <td className="t-sm">
                    {((o.assignmentType as string) ?? o.type)
                      ? <span className="badge badge-neutral">{(o.assignmentType as string) ?? o.type}</span>
                      : <span className="text-faint">—</span>}
                  </td>
                  <td><DeadlineMeter deadline={o.deadline} /></td>
                  <td style={{ textAlign: 'right', fontWeight: 600, whiteSpace: 'nowrap' }}>
                    {o.price != null ? formatCurrency(o.price) : <span className="text-faint">Not set</span>}
                  </td>
                  <td><StatusBadge status={o.status} /></td>
                  <td>{actions(o)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── Mobile cards ── */}
        <div className="as-cards">
          {orders.loading && Array.from({ length: 4 }).map((_, i) => (
            <div className="as-card" key={i}><Skeleton h={90} /></div>
          ))}
          {!orders.loading && pageItems.map((o, i) => (
            <article className="as-card as-row-anim" key={o.id} style={{ animationDelay: `${i * 22}ms` }}>
              <div className="as-card-top">
                <button type="button" onClick={() => onOpenDetail(o.id, o.subject ?? '')}
                        style={{ textAlign: 'left', minWidth: 0 }}>
                  <span className="as-id">{fmtOrderId(o.id)}</span>
                  <span className="t-sm truncate" style={{ display: 'block', marginTop: 2 }}>
                    {o.subject || 'Untitled order'}
                  </span>
                  <span className="as-sub truncate" style={{ display: 'block' }}>
                    {o.studentEmail || (o.studentId ? fmtStudentId(o.studentId) : '—')}
                  </span>
                </button>
                <StatusBadge status={o.status} />
              </div>
              <div className="as-card-grid">
                <div>
                  <div className="t-eyebrow" style={{ marginBottom: 5 }}>Deadline</div>
                  <DeadlineMeter deadline={o.deadline} />
                </div>
                <div>
                  <div className="t-eyebrow" style={{ marginBottom: 5 }}>Price</div>
                  <div className="t-sm" style={{ fontWeight: 600 }}>
                    {o.price != null ? formatCurrency(o.price) : 'Not set'}
                  </div>
                </div>
              </div>
              <div style={{ marginTop: 'var(--s3)' }}>{actions(o)}</div>
            </article>
          ))}
        </div>

        {totalPages > 1 && (
          <div className="pager">
            <span className="t-xs text-dim">
              Showing {page * 12 + 1}–{Math.min((page + 1) * 12, total)} of {total}
            </span>
            <div className="pager-nums">
              <button className="pg-n" onClick={() => setPage(page - 1)} disabled={page === 0}
                      aria-label="Previous page"><ChevronLeft size={14} /></button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const start = Math.max(0, Math.min(page - 2, totalPages - 5));
                const p = start + i;
                return (
                  <button key={p} className={`pg-n${p === page ? ' on' : ''}`}
                          onClick={() => setPage(p)}
                          aria-current={p === page ? 'page' : undefined}>{p + 1}</button>
                );
              })}
              <button className="pg-n" onClick={() => setPage(page + 1)}
                      disabled={page >= totalPages - 1} aria-label="Next page">
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}

        {!orders.loading && all.length >= SAMPLE && (
          <div className="an-note" style={{ borderTop: '1px solid var(--line)' }}>
            <AlertTriangle size={12} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>
              Showing unassigned orders from the {SAMPLE} most recent. The endpoint has no
              unassigned filter, so older waiting orders may not appear here — search by
              order ID to reach one directly.
            </span>
          </div>
        )}
      </section>
    </div>
  );
}

export { NOT_ASSIGNED, SAMPLE };
