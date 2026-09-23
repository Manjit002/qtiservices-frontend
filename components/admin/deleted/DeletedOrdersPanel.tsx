'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  Search, X, RotateCw, Archive, Trash2, Wallet, CircleDollarSign, Eye, ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/Badge';
import { Skeleton, SkeletonRows, EmptyState, ErrorState } from '@/components/ui/States';
import { useAsync } from '@/hooks/useAsync';
import { useDebounce } from '@/hooks/useDebounce';
import { usePagination } from '@/hooks/usePagination';
import { ordersApi } from '@/lib/api/orders';
import { DeletedOrderDrawer, priceOf } from './DeletedOrderDrawer';
import { fmtOrderId, formatCurrency, formatDateTime, enumValue } from '@/lib/utils/format';
import type { DeletedOrderDTO } from '@/types';
import './deleted.css';
import '@/components/admin/orders.css';
import '@/components/admin/students/students.css';

/** Parses the string-or-number money fields the archive returns. */
function num(v: unknown): number {
  if (typeof v === 'number') return v;
  const n = parseFloat(String(v ?? ''));
  return Number.isNaN(n) ? 0 : n;
}

export function DeletedOrdersPanel() {
  const deleted = useAsync((s) => ordersApi.listDeleted(s), []);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<DeletedOrderDTO | null>(null);
  const search = useDebounce(query, 250);

  const all = useMemo(() => deleted.data ?? [], [deleted.data]);

  /**
   * Totals over the WHOLE archive, not the filtered view — a summary that moved
   * when you typed a search would be reporting something different to what its
   * label says. Computed client-side because the endpoint returns a bare array
   * with no aggregate, exactly as the source does it.
   */
  const stats = useMemo(() => ({
    count: all.length,
    value: all.reduce((s, d) => s + num(d.finalPrice ?? d.totalPrice), 0),
    paid: all.reduce((s, d) => s + num(d.paidAmount), 0),
  }), [all]);

  /** Same haystack the source builds — including the OD- prefix. */
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return all;
    return all.filter((d) => {
      const hay = [
        `od-${d.originalOrderId}`,
        d.studentName, d.studentEmail, d.subject,
        d.deletedByAdminName, d.deleteReason,
      ].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [all, search]);

  const { page, totalPages, total, pageItems, setPage } = usePagination(rows, 15);

  const refresh = useCallback(() => deleted.reload(), [deleted]);

  const cards = [
    { label: 'Total deleted', value: String(stats.count), tone: 'var(--danger)', icon: <Trash2 size={14} /> },
    { label: 'Total value', value: formatCurrency(stats.value), tone: 'var(--gold)', icon: <CircleDollarSign size={14} /> },
    { label: 'Was paid', value: formatCurrency(stats.paid), tone: 'var(--success)', icon: <Wallet size={14} /> },
  ];

  const rowFor = (d: DeletedOrderDTO) => {
    const price = priceOf(d);
    const paid = num(d.paidAmount);
    const who = d.deletedByAdminName ?? (d.deletedByAdminId ? `Admin #${d.deletedByAdminId}` : null);
    return { price, paid, who };
  };

  return (
    <div className="rise">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--s4)', flexWrap: 'wrap', marginBottom: 'var(--s5)' }}>
        <div>
          <h1 className="t-h1">Deleted orders</h1>
          <p className="t-sm text-dim" style={{ marginTop: 4 }}>
            A permanent audit trail of orders removed from the system.
          </p>
        </div>
        <Button size="sm" onClick={refresh} loading={deleted.loading}
                aria-label="Refresh deleted orders">
          <RotateCw size={13} /> Refresh
        </Button>
      </div>

      <div className="da-note">
        <ShieldCheck size={15} style={{ flexShrink: 0, marginTop: 1 }} />
        <span>
          These are archived snapshots kept for auditing — not active orders. They cannot
          be edited or restored, and they do not appear anywhere else in the dashboard.
        </span>
      </div>

      <div className="stu-stats" style={{ marginBottom: 'var(--s5)' }}>
        {cards.map((c) => (
          <div className="stu-stat" key={c.label}>
            <span className="stu-stat-flag" style={{ background: c.tone }} aria-hidden />
            <div className="stu-stat-val">
              {deleted.loading ? <Skeleton w={70} h={22} /> : c.value}
            </div>
            <div className="stu-stat-lbl" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ color: c.tone }}>{c.icon}</span> {c.label}
            </div>
          </div>
        ))}
      </div>

      <div className="ord-bar">
        <div className="ord-search">
          <Search size={14} />
          <input
            className="input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search order ID, student, subject, admin or reason…"
            aria-label="Search deleted orders"
          />
          {query && (
            <button type="button" className="clear" onClick={() => setQuery('')}
                    aria-label="Clear search">
              <X size={13} />
            </button>
          )}
        </div>
        {search.trim() && !deleted.loading && (
          <span className="t-xs text-dim">
            {rows.length} of {all.length} match
          </span>
        )}
      </div>

      <div className="card">
        <div className="da-table-wrap table-wrap">
          <table className="data">
            <caption className="visually-hidden">Deleted orders archive</caption>
            <thead>
              <tr>
                <th scope="col">Order</th>
                <th scope="col">Student</th>
                <th scope="col">Subject</th>
                <th scope="col">Status at deletion</th>
                <th scope="col" style={{ textAlign: 'right' }}>Value</th>
                <th scope="col" style={{ textAlign: 'right' }}>Paid</th>
                <th scope="col">Deleted by</th>
                <th scope="col">Deleted at</th>
                <th scope="col" style={{ width: 60 }}>
                  <span className="visually-hidden">Details</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {deleted.loading && <SkeletonRows rows={6} cols={9} />}
              {deleted.error && (
                <tr>
                  <td colSpan={9}>
                    <ErrorState message={deleted.error} onRetry={refresh} />
                  </td>
                </tr>
              )}
              {!deleted.loading && !deleted.error && pageItems.length === 0 && (
                <tr>
                  <td colSpan={9}>
                    <EmptyState
                      icon={<Archive size={18} />}
                      title={all.length ? 'No deleted orders match your search' : 'No deleted orders'}
                      hint={all.length
                        ? 'Try a different order ID, student, admin or reason.'
                        : 'Nothing has been deleted. Orders removed from the system are archived here for auditing.'}
                      action={all.length > 0 && query
                        ? <Button size="sm" onClick={() => setQuery('')}>Clear search</Button>
                        : undefined}
                    />
                  </td>
                </tr>
              )}
              {pageItems.map((d) => {
                const { price, paid, who } = rowFor(d);
                return (
                  <tr key={d.id ?? d.originalOrderId}>
                    <td><span className="da-id">{fmtOrderId(d.originalOrderId)}</span></td>
                    <td>
                      <div className="t-sm truncate" style={{ fontWeight: 600, maxWidth: 170 }}>
                        {d.studentName || '—'}
                      </div>
                      {d.studentEmail && (
                        <div className="da-sub truncate" style={{ maxWidth: 170 }}>{d.studentEmail}</div>
                      )}
                    </td>
                    <td>
                      <div className="t-sm truncate" style={{ maxWidth: 190 }} title={d.subject ?? ''}>
                        {d.subject || '—'}
                      </div>
                      {d.assignmentType && <div className="da-sub">{d.assignmentType}</div>}
                    </td>
                    <td>
                      <StatusBadge status={enumValue(d.orderStatus)} />
                      {d.paymentStatus && (
                        <div className="da-sub">
                          {String(enumValue(d.paymentStatus)).replace(/_/g, ' ').toLowerCase()}
                        </div>
                      )}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {price != null ? formatCurrency(price) : <span className="text-faint">—</span>}
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {paid > 0
                        ? <span style={{ color: 'var(--success)', fontWeight: 600 }}>{formatCurrency(paid)}</span>
                        : <span className="text-faint">—</span>}
                    </td>
                    <td className="t-sm" style={{ whiteSpace: 'nowrap' }}>
                      {who ?? <span className="text-faint">—</span>}
                    </td>
                    <td className="t-sm text-dim" style={{ whiteSpace: 'nowrap' }}>
                      {d.deletedAt ? formatDateTime(d.deletedAt) : '—'}
                    </td>
                    <td>
                      <button type="button" className="act act-icon"
                              onClick={() => setSelected(d)}
                              aria-label={`View details for ${fmtOrderId(d.originalOrderId)}`}>
                        <Eye size={13} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ── Mobile cards ── */}
        <div className="da-cards">
          {deleted.loading && Array.from({ length: 4 }).map((_, i) => (
            <div className="da-card" key={i}><Skeleton h={80} /></div>
          ))}
          {!deleted.loading && pageItems.map((d) => {
            const { price, paid, who } = rowFor(d);
            return (
              <article className="da-card" key={d.id ?? d.originalOrderId}>
                <div className="da-card-top">
                  <div style={{ minWidth: 0 }}>
                    <span className="da-id">{fmtOrderId(d.originalOrderId)}</span>
                    <div className="t-sm truncate" style={{ marginTop: 2 }}>{d.subject || '—'}</div>
                    <div className="da-sub truncate">{d.studentName || '—'}</div>
                  </div>
                  <StatusBadge status={enumValue(d.orderStatus)} />
                </div>
                <div className="da-card-grid">
                  <div>
                    <div className="t-eyebrow">Value</div>
                    <div className="t-sm" style={{ fontWeight: 600 }}>
                      {price != null ? formatCurrency(price) : '—'}
                    </div>
                  </div>
                  <div>
                    <div className="t-eyebrow">Paid</div>
                    <div className="t-sm" style={{ fontWeight: 600, color: paid > 0 ? 'var(--success)' : undefined }}>
                      {paid > 0 ? formatCurrency(paid) : '—'}
                    </div>
                  </div>
                  <div>
                    <div className="t-eyebrow">Deleted by</div>
                    <div className="t-sm truncate">{who ?? '—'}</div>
                  </div>
                  <div>
                    <div className="t-eyebrow">Deleted at</div>
                    <div className="t-sm">{d.deletedAt ? formatDateTime(d.deletedAt) : '—'}</div>
                  </div>
                </div>
                <Button size="sm" style={{ width: '100%', marginTop: 'var(--s3)' }}
                        onClick={() => setSelected(d)}>
                  <Eye size={13} /> View details
                </Button>
              </article>
            );
          })}
        </div>

        {totalPages > 1 && (
          <div className="pager">
            <span className="t-xs text-dim">
              Page {page + 1} of {totalPages} · {total} record{total === 1 ? '' : 's'}
            </span>
            <div className="pager-nums">
              <button className="pg-n" onClick={() => setPage(page - 1)} disabled={page === 0}
                      aria-label="Previous page">‹</button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const start = Math.max(0, Math.min(page - 2, totalPages - 5));
                const p = start + i;
                return (
                  <button key={p} className={`pg-n${p === page ? ' on' : ''}`}
                          onClick={() => setPage(p)}
                          aria-current={p === page ? 'page' : undefined}>
                    {p + 1}
                  </button>
                );
              })}
              <button className="pg-n" onClick={() => setPage(page + 1)}
                      disabled={page >= totalPages - 1} aria-label="Next page">›</button>
            </div>
          </div>
        )}
      </div>

      <DeletedOrderDrawer order={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
