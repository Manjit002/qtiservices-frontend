'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Search, X, Download, Copy, FolderOpen, MessagesSquare, DollarSign, Link2,
  Send, RotateCcw, FileSearch, Inbox, ChevronLeft, ChevronRight, Eye, UserMinus,
  CalendarClock, Trash2, PencilLine,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ActionMenu, type MenuAction } from '@/components/ui/ActionMenu';
import { StatusBadge } from '@/components/ui/Badge';
import { DeadlineMeter } from '@/components/ui/DeadlineMeter';
import { SkeletonRows, EmptyState, ErrorState, Skeleton } from '@/components/ui/States';
import { useAsync } from '@/hooks/useAsync';
import { useDebounce } from '@/hooks/useDebounce';
import { usePagination } from '@/hooks/usePagination';
import { useToast } from '@/hooks/useToast';
import { useLiveClock } from '@/hooks/useLiveDeadlines';
import { ordersApi } from '@/lib/api/orders';
import { fmtOrderId, formatCurrency, parseServerDate } from '@/lib/utils/format';
import { isAssigned, PAYLINK_STATUSES } from '@/lib/utils/statusConfig';
import { ordersToCsv, downloadCsv, csvFilename } from '@/lib/utils/csv';
import { copyText } from '@/lib/utils/download';
import type { OrderDTO } from '@/types';
import './orders.css';

type SearchField = 'all' | 'orderid' | 'subject' | 'stuid' | 'email';
type SortCol = 'id' | 'subject' | 'deadline' | 'status' | 'price' | null;

const STATUS_FILTERS: { label: string; value: string | null }[] = [
  { label: 'All', value: null },
  { label: 'Needs review', value: 'REVIEW_PENDING' },
  { label: 'In review', value: 'UNDER_REVIEW' },
  { label: 'Priced', value: 'PRICE_SET' },
  { label: 'Assigned', value: 'ASSIGNED' },
  { label: 'In progress', value: 'IN_PROGRESS' },
  { label: 'Submitted', value: 'SUBMITTED' },
  { label: 'Completed', value: 'COMPLETED' },
  { label: 'Cancelled', value: 'CANCELLED' },
];

const FIELDS: { label: string; value: SearchField }[] = [
  { label: 'All fields', value: 'all' },
  { label: 'Order ID', value: 'orderid' },
  { label: 'Subject', value: 'subject' },
  { label: 'Student ID', value: 'stuid' },
  { label: 'Email', value: 'email' },
];

interface Props {
  onOpenDetail: (id: number, subject?: string) => void;
  onAssign: (order: OrderDTO, reassign: boolean) => void;
  onOpenChat: (order: OrderDTO) => void;
  onOpenFiles?: (order: OrderDTO) => void;
  onSetPrice?: (order: OrderDTO) => void;
  onPayLink?: (order: OrderDTO) => void;
  onEditDeadlines?: (order: OrderDTO) => void;
  onEditOrder?: (order: OrderDTO) => void;
  /** Row whose detail is being fetched before the editor opens. */
  editLoadingId?: number | null;
  onDelete?: (order: OrderDTO) => void;
  onCreate?: () => void;
  refreshKey?: number;
}

export function OrdersPanel({
  onOpenDetail, onAssign, onOpenChat, onOpenFiles, onSetPrice, onPayLink,
  onEditDeadlines, onEditOrder, editLoadingId = null, onDelete, onCreate, refreshKey = 0,
}: Props) {
  const { showToast } = useToast();
  useLiveClock();

  const [status, setStatus] = useState<string | null>(null);
  const [field, setField] = useState<SearchField>('all');
  const [query, setQuery] = useState('');
  const [sortCol, setSortCol] = useState<SortCol>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [busyId, setBusyId] = useState<number | null>(null);

  const search = useDebounce(query, 400);

  /**
   * A wide page is fetched once and filtered in the browser — the backend has
   * no server-side status filter, and switching to server paging would silently
   * change which rows an admin sees.
   */
  const orders = useAsync(
    (signal) => ordersApi.listAll(0, 200, 'createdAt,desc', signal),
    [refreshKey]
  );

  const rows = useMemo(() => {
    let list = orders.data?.content ?? [];

    if (status) list = list.filter((o) => String(o.status ?? '') === status);

    const kw = search.trim().toLowerCase();
    if (kw) {
      // "OD-2417" and "2417" must both match.
      const bare = kw.replace(/^od-/, '').replace(/^id-/, '');
      list = list.filter((o) => {
        const byId = String(o.id ?? '').includes(bare);
        const bySubject = (o.subject ?? '').toLowerCase().includes(kw);
        const byStudent = String(o.studentId ?? '').includes(bare);
        const byEmail = (o.studentEmail ?? '').toLowerCase().includes(kw);
        switch (field) {
          case 'orderid': return byId;
          case 'subject': return bySubject;
          case 'stuid': return byStudent;
          case 'email': return byEmail;
          default: return byId || bySubject || byStudent || byEmail;
        }
      });
    }

    if (sortCol) {
      const dir = sortDir === 'asc' ? 1 : -1;
      list = [...list].sort((a, b) => {
        let av: number | string; let bv: number | string;
        if (sortCol === 'deadline') {
          av = parseServerDate(a.deadline)?.getTime() ?? 0;
          bv = parseServerDate(b.deadline)?.getTime() ?? 0;
        } else if (sortCol === 'price') { av = a.price ?? -1; bv = b.price ?? -1; }
        else if (sortCol === 'id') { av = a.id ?? 0; bv = b.id ?? 0; }
        else { av = String(a[sortCol] ?? '').toLowerCase(); bv = String(b[sortCol] ?? '').toLowerCase(); }
        return av < bv ? -dir : av > bv ? dir : 0;
      });
    }
    return list;
  }, [orders.data, status, search, field, sortCol, sortDir]);

  const { page, totalPages, total, pageItems, setPage, reset } = usePagination(rows, 15);
  useEffect(() => reset(), [status, search, field, sortCol, sortDir, reset]);

  const toggleSort = useCallback((col: SortCol) => {
    setSortCol((prev) => {
      if (prev === col) { setSortDir((d) => (d === 'asc' ? 'desc' : 'asc')); return prev; }
      setSortDir('asc');
      return col;
    });
  }, []);

  const allPicked = pageItems.length > 0 && pageItems.every((o) => picked.has(o.id));

  const exportCsv = useCallback((onlyPicked: boolean) => {
    const list = onlyPicked ? rows.filter((o) => picked.has(o.id)) : rows;
    if (!list.length) { showToast('Nothing to export.', 'warning'); return; }
    downloadCsv(ordersToCsv(list), csvFilename(onlyPicked ? 'orders-selected' : 'orders'));
    showToast(`Exported ${list.length} order${list.length > 1 ? 's' : ''}.`, 'success');
  }, [rows, picked, showToast]);

  const act = useCallback(async (id: number, fn: () => Promise<unknown>, msg: string) => {
    setBusyId(id);
    try { await fn(); showToast(msg, 'success'); orders.reload(); }
    catch (e) { showToast((e as Error).message, 'error'); }
    finally { setBusyId(null); }
  }, [orders, showToast]);

  const arrow = (col: SortCol) =>
    sortCol === col ? (sortDir === 'asc' ? ' ↑' : ' ↓') : '';

  /**
   * Action hierarchy, always visible:
   *   primary  — the one thing this row's state is asking for (assign / review)
   *   labelled — View, always present, because it is the most common action
   *   icons    — workflow + content actions, each with tooltip and aria-label
   *   danger   — separated by a rule so delete is never adjacent to a safe action
   */
  const overflowFor = (o: OrderDTO): MenuAction[] => {
    const st = String(o.status ?? '');
    const items: MenuAction[] = [];
    if (isAssigned(st)) {
      items.push({
        key: 'unassign', label: 'Unassign expert', icon: <UserMinus size={14} />,
        disabled: busyId === o.id,
        onSelect: () => act(o.id, () => ordersApi.unassign(o.id), `${fmtOrderId(o.id)} unassigned.`),
      });
    }
    if (onSetPrice) items.push({ key: 'price', label: 'Set price', icon: <DollarSign size={14} />, onSelect: () => onSetPrice(o) });
    if (onPayLink && PAYLINK_STATUSES.includes(st) && o.paymentStatus !== 'SUCCESS') {
      items.push({ key: 'paylink', label: 'Payment link', icon: <Link2 size={14} />, onSelect: () => onPayLink(o) });
    }
    if (onEditDeadlines) items.push({ key: 'deadlines', label: 'Edit deadlines', icon: <CalendarClock size={14} />, onSelect: () => onEditDeadlines(o) });
    if (onOpenFiles) items.push({ key: 'files', label: 'Files', icon: <FolderOpen size={14} />, onSelect: () => onOpenFiles(o) });
    items.push({ key: 'chat', label: 'Open chat', icon: <MessagesSquare size={14} />, onSelect: () => onOpenChat(o) });
    if (onDelete) items.push({ key: 'delete', label: 'Delete order', icon: <Trash2 size={14} />, danger: true, onSelect: () => onDelete(o) });
    return items;
  };

  const rowActions = (o: OrderDTO) => {
    const st = String(o.status ?? '');
    const assigned = isAssigned(st);
    const needsReview = st === 'REVIEW_PENDING';
    const canPayLink = PAYLINK_STATUSES.includes(st) && o.paymentStatus !== 'SUCCESS';

    return (
      <div className="acts">
        {needsReview ? (
          <button type="button" className="act act-primary" disabled={busyId === o.id}
                  onClick={() => act(o.id, () => ordersApi.startReview(o.id), `${fmtOrderId(o.id)} moved to review.`)}>
            <FileSearch size={12} /> Review
          </button>
        ) : assigned ? (
          <button type="button" className="act" onClick={() => onAssign(o, true)}>
            <RotateCcw size={12} /> Reassign
          </button>
        ) : (
          <button type="button" className="act act-primary" onClick={() => onAssign(o, false)}>
            <Send size={12} /> Assign
          </button>
        )}

        <button type="button" className="act" onClick={() => onOpenDetail(o.id, o.subject ?? '')}>
          <Eye size={12} /> View
        </button>

        {onEditOrder && (
          <button type="button" className="act" disabled={editLoadingId === o.id}
                  onClick={() => onEditOrder(o)}>
            <PencilLine size={12} /> {editLoadingId === o.id ? 'Opening…' : 'Edit'}
          </button>
        )}

        {assigned && (
          <button type="button" className="act act-icon act-collapsible tip" data-tip="Unassign expert"
                  aria-label={`Unassign expert from ${fmtOrderId(o.id)}`} disabled={busyId === o.id}
                  onClick={() => act(o.id, () => ordersApi.unassign(o.id), `${fmtOrderId(o.id)} unassigned.`)}>
            <UserMinus size={13} />
          </button>
        )}

        {onSetPrice && (
          <button type="button" className="act act-icon act-collapsible tip" data-tip="Set price"
                  aria-label={`Set price for ${fmtOrderId(o.id)}`} onClick={() => onSetPrice(o)}>
            <DollarSign size={13} />
          </button>
        )}

        {onPayLink && canPayLink && (
          <button type="button" className="act act-icon act-collapsible tip" data-tip="Payment link"
                  aria-label={`Create payment link for ${fmtOrderId(o.id)}`} onClick={() => onPayLink(o)}>
            <Link2 size={13} />
          </button>
        )}

        {onEditDeadlines && (
          <button type="button" className="act act-icon act-collapsible tip" data-tip="Edit deadlines"
                  aria-label={`Edit deadlines for ${fmtOrderId(o.id)}`} onClick={() => onEditDeadlines(o)}>
            <CalendarClock size={13} />
          </button>
        )}

        {onOpenFiles && (
          <button type="button" className="act act-icon act-collapsible tip" data-tip="Files"
                  aria-label={`Open files for ${fmtOrderId(o.id)}`} onClick={() => onOpenFiles(o)}>
            <FolderOpen size={13} />
          </button>
        )}

        <button type="button" className="act act-icon act-collapsible tip" data-tip="Open chat"
                aria-label={`Open chat for ${fmtOrderId(o.id)}`} onClick={() => onOpenChat(o)}>
          <MessagesSquare size={13} />
        </button>

        {onDelete && (
          <>
            <span className="acts-sep" aria-hidden />
            <button type="button" className="act act-icon act-collapsible act-danger tip" data-tip="Delete order"
                    aria-label={`Delete ${fmtOrderId(o.id)}`} onClick={() => onDelete(o)}>
              <Trash2 size={13} />
            </button>
          </>
        )}

        {/* Same actions, labelled, for viewports where the icon row collapses. */}
        <ActionMenu label={`More actions for ${fmtOrderId(o.id)}`} actions={overflowFor(o)} />
      </div>
    );
  };

  return (
    <div className="rise">
      <div className="ord-head">
        <div>
          <h1 className="t-h1">Orders</h1>
          <p className="t-sm text-dim" style={{ marginTop: 4 }}>
            {orders.loading ? 'Loading\u2026' : `${total} order${total === 1 ? '' : 's'}${status ? ' in this status' : ''}`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--s2)' }}>
          <Button size="sm" onClick={() => exportCsv(false)}><Download size={14} /> Export CSV</Button>
          {onCreate && <Button size="sm" variant="primary" onClick={onCreate}>New order</Button>}
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div className="ord-bar">
        <div className="ord-search">
          <Search size={14} />
          <input
            className="input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search orders…"
            aria-label="Search orders"
          />
          {query && (
            <button type="button" className="clear" onClick={() => setQuery('')} aria-label="Clear search">
              <X size={13} />
            </button>
          )}
        </div>

        <select className="input" style={{ width: 130 }} value={field}
                onChange={(e) => setField(e.target.value as SearchField)} aria-label="Search field">
          {FIELDS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
      </div>

      <div className="ord-bar">
        <div className="seg" role="group" aria-label="Filter by status">
          {STATUS_FILTERS.map((f) => (
            <button key={f.label} type="button" className={status === f.value ? 'on' : ''}
                    onClick={() => setStatus(f.value)} aria-pressed={status === f.value}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {picked.size > 0 && (
        <div className="bulk" role="region" aria-label="Bulk actions">
          <strong>{picked.size}</strong> selected
          <div style={{ flex: 1 }} />
          <Button size="sm" variant="ghost" onClick={async () => {
            const ok = await copyText([...picked].map(fmtOrderId).join(', '));
            showToast(ok ? 'Order IDs copied.' : 'Copy failed.', ok ? 'success' : 'error');
          }}>
            <Copy size={13} /> Copy IDs
          </Button>
          <Button size="sm" variant="ghost" onClick={() => exportCsv(true)}>
            <Download size={13} /> Export selected
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setPicked(new Set())}>Clear</Button>
        </div>
      )}

      <div className="card">
        {/* ── Desktop table ── */}
        <div className="ord-table-wrap table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th style={{ width: 36 }}>
                  <input type="checkbox" className="check" checked={allPicked}
                         onChange={(e) => setPicked((prev) => {
                           const n = new Set(prev);
                           pageItems.forEach((o) => (e.target.checked ? n.add(o.id) : n.delete(o.id)));
                           return n;
                         })}
                         aria-label="Select all on this page" />
                </th>
                <th className="sortable" onClick={() => toggleSort('id')}>Order{arrow('id')}</th>
                <th className="sortable" onClick={() => toggleSort('subject')}>Subject{arrow('subject')}</th>
                <th className="sortable" onClick={() => toggleSort('deadline')}>Deadline{arrow('deadline')}</th>
                <th className="sortable" onClick={() => toggleSort('status')}>Status{arrow('status')}</th>
                <th className="sortable" onClick={() => toggleSort('price')} style={{ textAlign: 'right' }}>Price{arrow('price')}</th>
                <th>Expert</th>
                <th style={{ width: 300, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.loading && <SkeletonRows rows={8} cols={8} />}
              {orders.error && (
                <tr><td colSpan={8}><ErrorState message={orders.error} onRetry={orders.reload} /></td></tr>
              )}
              {!orders.loading && !orders.error && pageItems.length === 0 && (
                <tr><td colSpan={8}>
                  <EmptyState
                    icon={<Inbox size={18} />}
                    title={query || status ? 'No orders match' : 'No orders yet'}
                    hint={query || status
                      ? 'Try a different search term or clear the status filter.'
                      : 'New student requests will appear here.'}
                    action={(query || status) && (
                      <Button size="sm" onClick={() => { setQuery(''); setStatus(null); }}>Clear filters</Button>
                    )}
                  />
                </td></tr>
              )}
              {pageItems.map((o) => (
                <tr key={o.id}>
                  <td onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" className="check" checked={picked.has(o.id)}
                           onChange={(e) => setPicked((prev) => {
                             const n = new Set(prev);
                             if (e.target.checked) n.add(o.id); else n.delete(o.id);
                             return n;
                           })}
                           aria-label={`Select ${fmtOrderId(o.id)}`} />
                  </td>
                  <td>
                    <button type="button" className="ord-id" onClick={() => onOpenDetail(o.id, o.subject ?? '')}>
                      {fmtOrderId(o.id)}
                    </button>
                  </td>
                  <td>
                    <div className="truncate ord-subject" title={o.subject ?? ''}>
                      {o.subject || <span className="text-faint">Untitled</span>}
                    </div>
                  </td>
                  <td><DeadlineMeter deadline={o.deadline} /></td>
                  <td><StatusBadge status={o.status} /></td>
                  <td style={{ textAlign: 'right' }}>
                    {o.price != null
                      ? <span className="ord-price">{formatCurrency(o.price)}</span>
                      : <span className="text-faint">—</span>}
                  </td>
                  <td>
                    {(o.assignedEmployeeName as string | undefined)
                      ? <span className="t-sm truncate" style={{ maxWidth: 130, display: 'block' }}>
                          {o.assignedEmployeeName as string}
                        </span>
                      : <span className="text-faint t-sm">Unassigned</span>}
                  </td>
                  <td>{rowActions(o)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── Mobile cards ── */}
        <div className="ord-cards" style={{ padding: 'var(--s3)' }}>
          {orders.loading && Array.from({ length: 4 }).map((_, i) => (
            <div className="ord-card" key={i}><Skeleton h={64} /></div>
          ))}
          {!orders.loading && pageItems.map((o) => (
            <article className="ord-card" key={o.id}>
              <div className="ord-card-top">
                <button type="button" onClick={() => onOpenDetail(o.id, o.subject ?? '')} style={{ textAlign: 'left', minWidth: 0 }}>
                  <span className="ord-id">{fmtOrderId(o.id)}</span>
                  <span className="t-sm truncate" style={{ display: 'block', marginTop: 2 }}>
                    {o.subject || 'Untitled'}
                  </span>
                </button>
                <StatusBadge status={o.status} />
              </div>
              <div className="ord-card-grid">
                <div>
                  <div className="t-eyebrow" style={{ marginBottom: 5 }}>Deadline</div>
                  <DeadlineMeter deadline={o.deadline} />
                </div>
                <div>
                  <div className="t-eyebrow" style={{ marginBottom: 5 }}>Price</div>
                  <div className="ord-price">
                    {o.price != null ? formatCurrency(o.price) : <span className="text-faint">Not set</span>}
                  </div>
                </div>
              </div>
              <div className="ord-card-actions">{rowActions(o)}</div>
            </article>
          ))}
        </div>

        {totalPages > 1 && (
          <div className="pager">
            <span className="t-xs text-dim">Page {page + 1} of {totalPages} · {total} orders</span>
            <div className="pager-nums">
              <button className="pg-n" onClick={() => setPage(page - 1)} disabled={page === 0} aria-label="Previous page">
                <ChevronLeft size={14} />
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const start = Math.max(0, Math.min(page - 2, totalPages - 5));
                const p = start + i;
                return (
                  <button key={p} className={`pg-n${p === page ? ' on' : ''}`} onClick={() => setPage(p)}
                          aria-current={p === page ? 'page' : undefined}>
                    {p + 1}
                  </button>
                );
              })}
              <button className="pg-n" onClick={() => setPage(page + 1)} disabled={page >= totalPages - 1} aria-label="Next page">
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
