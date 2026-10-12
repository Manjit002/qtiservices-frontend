'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Search, X, Download, Copy, FolderOpen, MessagesSquare, DollarSign, Link2,
  Send, RotateCcw, FileSearch, Inbox, ChevronLeft, ChevronRight, Eye, UserMinus,
  CalendarClock, Trash2, PencilLine, Globe,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ActionMenu, type MenuAction } from '@/components/ui/ActionMenu';
import { ExpertName } from '@/components/admin/ExpertName';
import { StatusBadge } from '@/components/ui/Badge';
import { CLOSED_STATUSES, DeadlineMeter } from '@/components/ui/DeadlineMeter';
import { SkeletonRows, EmptyState, ErrorState, Skeleton } from '@/components/ui/States';
import { useAsync } from '@/hooks/useAsync';
import { useDebounce } from '@/hooks/useDebounce';
import { useToast } from '@/hooks/useToast';
import { useLiveClock } from '@/hooks/useLiveDeadlines';
import { ordersApi } from '@/lib/api/orders';
import { fmtOrderId, formatCurrency, parseServerDate } from '@/lib/utils/format';
import { isAssigned, PAYLINK_STATUSES } from '@/lib/utils/statusConfig';
import { ordersToCsv, downloadCsv, csvFilename } from '@/lib/utils/csv';
import { copyText } from '@/lib/utils/download';
import {
  dayEnd, dayStart, describeOrderSearchError, normalizeOrderKeyword,
} from '@/lib/utils/orderSearch';
import type { AdminOrderQuery, OrderDTO } from '@/types';
import './orders.css';

type SortCol = 'id' | 'subject' | 'deadline' | 'status' | 'price' | null;

/** Rows per page. Paging is done by the server (GET /admin/all). */
const PAGE_SIZE = 15;
/** CSV export fetches every matching page, 100 rows at a time, up to this. */
const EXPORT_LIMIT = 2000;

const SORT_LABEL: Record<Exclude<SortCol, null>, string> = {
  id: 'order', subject: 'subject', deadline: 'deadline', status: 'status', price: 'price',
};

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
  const [query, setQuery] = useState('');
  const [country, setCountry] = useState('');
  const [fromDay, setFromDay] = useState('');
  const [toDay, setToDay] = useState('');
  const [sortCol, setSortCol] = useState<SortCol>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  // Kept by id with the row itself, so a selection survives paging and
  // "Export selected" can include rows from pages no longer on screen.
  const [picked, setPicked] = useState<Map<number, OrderDTO>>(new Map());
  const [busyId, setBusyId] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);
  const exportAbort = useRef<AbortController | null>(null);
  useEffect(() => () => exportAbort.current?.abort(), []);

  const search = useDebounce(query, 400);
  const countryTerm = useDebounce(country, 400).trim();
  const keyword = normalizeOrderKeyword(search);

  // A reversed range is not sent: the service would reject it, and quietly
  // swapping the dates would search a range the admin didn't ask for.
  const datesReversed = Boolean(fromDay && toDay && fromDay > toDay);
  const fromDate = !datesReversed && fromDay ? dayStart(fromDay) : null;
  const toDate = !datesReversed && toDay ? dayEnd(toDay) : null;

  const filters = useMemo<Omit<AdminOrderQuery, 'page' | 'size'>>(
    () => ({ status, keyword, country: countryTerm, fromDate, toDate }),
    [status, keyword, countryTerm, fromDate, toDate]
  );
  const filterKey = JSON.stringify(filters);
  const filtering = Boolean(status || keyword || countryTerm || fromDate || toDate);
  // What the admin has typed or picked, applied or not — a reversed date range
  // isn't sent, but it still has to be clearable.
  const anyInput = Boolean(status || query.trim() || country.trim() || fromDay || toDay);
  const errorCtx = useMemo(
    () => ({ hasDates: Boolean(filters.fromDate || filters.toDate), hasStatus: Boolean(filters.status) }),
    [filters]
  );

  /**
   * The page number belongs to one set of filters. Any filter change puts the
   * admin back on the first page during the same render (React's "adjust
   * state while rendering" pattern), so neither the old page number nor one
   * remembered from an earlier, identical set of filters is ever requested.
   */
  const [pageState, setPageState] = useState({ key: filterKey, page: 0 });
  if (pageState.key !== filterKey) setPageState({ key: filterKey, page: 0 });
  const page = pageState.key === filterKey ? pageState.page : 0;
  const setPage = useCallback(
    (p: number) => setPageState({ key: filterKey, page: Math.max(0, p) }),
    [filterKey]
  );

  /**
   * Status, keyword, country, dates and paging all run on the server
   * (GET /admin/all, newest first). Superseded requests are aborted by
   * useAsync, so a slow earlier search can't overwrite a newer one.
   */
  const orders = useAsync(
    (signal) => ordersApi
      .adminSearch({ ...filters, page, size: PAGE_SIZE }, signal)
      .catch((e: unknown) => {
        if ((e as Error)?.name === 'AbortError') throw e;
        throw new Error(describeOrderSearchError(e, errorCtx));
      }),
    [refreshKey, filterKey, page]
  );

  const total = orders.data?.totalElements ?? 0;
  const totalPages = orders.data?.totalPages ?? 0;
  const initialLoad = orders.loading && !orders.data;
  const updating = orders.loading && Boolean(orders.data);

  // If the last row of the last page goes (deleted, or moved out of this
  // status), step back to the new last page instead of showing an empty one.
  useEffect(() => {
    const d = orders.data;
    if (!orders.loading && d && d.content.length === 0 && page > 0 && d.totalPages > 0 && d.totalPages - 1 < page) {
      setPage(d.totalPages - 1);
    }
  }, [orders.data, orders.loading, page, setPage]);

  /** Column sorting reorders the page on screen; the server's order is newest first. */
  const pageItems = useMemo(() => {
    const list = orders.data?.content ?? [];
    if (!sortCol) return list;
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
      let av: number | string; let bv: number | string;
      if (sortCol === 'deadline') {
        av = parseServerDate(a.deadline)?.getTime() ?? 0;
        bv = parseServerDate(b.deadline)?.getTime() ?? 0;
      } else if (sortCol === 'price') { av = a.price ?? -1; bv = b.price ?? -1; }
      else if (sortCol === 'id') { av = a.id ?? 0; bv = b.id ?? 0; }
      else { av = String(a[sortCol] ?? '').toLowerCase(); bv = String(b[sortCol] ?? '').toLowerCase(); }
      return av < bv ? -dir : av > bv ? dir : 0;
    });
  }, [orders.data, sortCol, sortDir]);

  const toggleSort = useCallback((col: SortCol) => {
    setSortCol((prev) => {
      if (prev === col) { setSortDir((d) => (d === 'asc' ? 'desc' : 'asc')); return prev; }
      setSortDir('asc');
      return col;
    });
  }, []);

  const clearFilters = useCallback(() => {
    setQuery(''); setStatus(null); setCountry(''); setFromDay(''); setToDay('');
  }, []);

  const allPicked = pageItems.length > 0 && pageItems.every((o) => picked.has(o.id));

  const exportSelected = useCallback(() => {
    const list = [...picked.values()];
    if (!list.length) { showToast('Nothing to export.', 'warning'); return; }
    downloadCsv(ordersToCsv(list), csvFilename('orders-selected'));
    showToast(`Exported ${list.length} order${list.length > 1 ? 's' : ''}.`, 'success');
  }, [picked, showToast]);

  /** Exports every order matching the current filters, not just this page. */
  const exportAll = useCallback(async () => {
    if (exporting) return;
    const ctrl = new AbortController();
    exportAbort.current = ctrl;
    setExporting(true);
    try {
      const { rows, total: matched } = await ordersApi.adminSearchAll(filters, EXPORT_LIMIT, ctrl.signal);
      if (!rows.length) { showToast('Nothing to export.', 'warning'); return; }
      downloadCsv(ordersToCsv(rows), csvFilename('orders'));
      if (matched > rows.length) {
        showToast(`Exported the newest ${rows.length.toLocaleString()} of ${matched.toLocaleString()} orders.`, 'warning');
      } else {
        showToast(`Exported ${rows.length} order${rows.length > 1 ? 's' : ''}.`, 'success');
      }
    } catch (e) {
      if ((e as Error)?.name !== 'AbortError') showToast(describeOrderSearchError(e, errorCtx), 'error');
    } finally {
      if (exportAbort.current === ctrl) exportAbort.current = null;
      setExporting(false);
    }
  }, [exporting, filters, errorCtx, showToast]);

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
    if (onEditOrder) {
      items.push({
        key: 'edit', label: editLoadingId === o.id ? 'Opening…' : 'Edit order', icon: <PencilLine size={14} />,
        disabled: editLoadingId === o.id, onSelect: () => onEditOrder(o),
      });
    }
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
          // Finished or cancelled work keeps the action but loses the accent:
          // the highlighted button is "what this row is waiting for", and a
          // completed order is not waiting to be assigned.
          <button type="button" className={`act${CLOSED_STATUSES.includes(st) ? '' : ' act-primary'}`} onClick={() => onAssign(o, false)}>
            <Send size={12} /> Assign
          </button>
        )}

        <button type="button" className="act" onClick={() => onOpenDetail(o.id, o.subject ?? '')}>
          <Eye size={12} /> View
        </button>

        {onEditOrder && (
          <button type="button" className="act act-collapsible" disabled={editLoadingId === o.id}
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
          <p className="t-sm text-dim" style={{ marginTop: 4 }} aria-live="polite">
            {initialLoad ? 'Loading\u2026'
              : orders.error ? 'Search unavailable'
              : `${total.toLocaleString()} order${total === 1 ? '' : 's'}${filtering ? (total === 1 ? ' matches' : ' match') : ''}`
                + (sortCol ? ` · this page sorted by ${SORT_LABEL[sortCol]}` : ' · newest first')}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--s2)' }}>
          <Button size="sm" onClick={exportAll} loading={exporting}
                  disabled={exporting || initialLoad || Boolean(orders.error) || total === 0}
                  title={filtering ? 'Export every order matching these filters' : 'Export every order'}>
            {!exporting && <Download size={14} />} {exporting ? 'Exporting' : 'Export CSV'}
          </Button>
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
            enterKeyHint="search"
          />
          {query && (
            <button type="button" className="clear" onClick={() => setQuery('')} aria-label="Clear search">
              <X size={13} />
            </button>
          )}
        </div>

        <div className="ord-country">
          <Globe size={14} />
          <input
            className="input"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            placeholder="Country"
            aria-label="Filter by country"
          />
        </div>

        <div className="ord-dates" role="group" aria-label="Created between">
          <span className="ord-dates-lbl">Created</span>
          <input type="date" className={`input${datesReversed ? ' invalid' : ''}`} value={fromDay}
                 max={toDay || undefined} onChange={(e) => setFromDay(e.target.value)}
                 aria-label="Created from" aria-invalid={datesReversed} />
          <span className="ord-dates-lbl" aria-hidden>to</span>
          <input type="date" className={`input${datesReversed ? ' invalid' : ''}`} value={toDay}
                 min={fromDay || undefined} onChange={(e) => setToDay(e.target.value)}
                 aria-label="Created to" aria-invalid={datesReversed} />
        </div>

        {anyInput && (
          <Button size="sm" variant="ghost" onClick={clearFilters}>Clear filters</Button>
        )}
      </div>
      {datesReversed && (
        <p className="field-error" role="alert" style={{ margin: 'calc(-1 * var(--s2)) 0 var(--s3)' }}>
          The end date is before the start date, so the date filter isn&rsquo;t applied.
        </p>
      )}

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
            const ok = await copyText([...picked.keys()].map(fmtOrderId).join(', '));
            showToast(ok ? 'Order IDs copied.' : 'Copy failed.', ok ? 'success' : 'error');
          }}>
            <Copy size={13} /> Copy IDs
          </Button>
          <Button size="sm" variant="ghost" onClick={exportSelected}>
            <Download size={13} /> Export selected
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setPicked(new Map())}>Clear</Button>
        </div>
      )}

      <div className="card">
        {/* ── Desktop table ── */}
        <div className={`ord-table-wrap table-wrap${updating ? ' is-updating' : ''}`} aria-busy={orders.loading}>
          <table className="data">
            <thead>
              <tr>
                <th style={{ width: 36 }}>
                  <input type="checkbox" className="check" checked={allPicked}
                         onChange={(e) => setPicked((prev) => {
                           const n = new Map(prev);
                           pageItems.forEach((o) => (e.target.checked ? n.set(o.id, o) : n.delete(o.id)));
                           return n;
                         })}
                         aria-label="Select all on this page" />
                </th>
                <th className="sortable" onClick={() => toggleSort('id')} title="Sort this page by order">Order{arrow('id')}</th>
                <th className="sortable" onClick={() => toggleSort('subject')} title="Sort this page by subject">Subject{arrow('subject')}</th>
                <th className="sortable" onClick={() => toggleSort('deadline')} title="Sort this page by deadline">Deadline{arrow('deadline')}</th>
                <th className="sortable" onClick={() => toggleSort('status')} title="Sort this page by status">Status{arrow('status')}</th>
                <th className="sortable" onClick={() => toggleSort('price')} title="Sort this page by price" style={{ textAlign: 'right' }}>Price{arrow('price')}</th>
                <th>Expert</th>
                <th style={{ width: 300, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {initialLoad && <SkeletonRows rows={8} cols={8} />}
              {orders.error && (
                <tr><td colSpan={8}><ErrorState message={orders.error} onRetry={orders.reload} /></td></tr>
              )}
              {!orders.loading && !orders.error && pageItems.length === 0 && (
                <tr><td colSpan={8}>
                  <EmptyState
                    icon={<Inbox size={18} />}
                    title={filtering ? 'No orders match' : 'No orders yet'}
                    hint={filtering
                      ? 'Try a different search term, or clear the filters.'
                      : 'New student requests will appear here.'}
                    action={filtering && (
                      <Button size="sm" onClick={clearFilters}>Clear filters</Button>
                    )}
                  />
                </td></tr>
              )}
              {pageItems.map((o) => (
                <tr key={o.id}>
                  <td onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" className="check" checked={picked.has(o.id)}
                           onChange={(e) => setPicked((prev) => {
                             const n = new Map(prev);
                             if (e.target.checked) n.set(o.id, o); else n.delete(o.id);
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
                  <td><DeadlineMeter deadline={o.deadline} settled={CLOSED_STATUSES.includes(String(o.status ?? ''))} /></td>
                  <td><StatusBadge status={o.status} /></td>
                  <td style={{ textAlign: 'right' }}>
                    {o.price != null
                      ? <span className="ord-price">{formatCurrency(o.price)}</span>
                      : <span className="text-faint">—</span>}
                  </td>
                  <td><ExpertName order={o} /></td>
                  <td>{rowActions(o)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── Mobile cards ── */}
        <div className={`ord-cards${updating ? ' is-updating' : ''}`} style={{ padding: 'var(--s3)' }} aria-busy={orders.loading}>
          {initialLoad && Array.from({ length: 4 }).map((_, i) => (
            <div className="ord-card" key={i}><Skeleton h={64} /></div>
          ))}
          {!initialLoad && pageItems.map((o) => (
            <article className="ord-card" key={o.id}>
              <div className="ord-card-top">
                <button type="button" onClick={() => onOpenDetail(o.id, o.subject ?? '')} style={{ textAlign: 'left', minWidth: 0 }}>
                  <span className="ord-id">{fmtOrderId(o.id)}</span>
                  <span className="t-sm clamp-2" title={o.subject ?? ''}>
                    {o.subject || 'Untitled'}
                  </span>
                </button>
                <StatusBadge status={o.status} />
              </div>
              <div className="ord-card-grid">
                <div>
                  <div className="t-eyebrow" style={{ marginBottom: 5 }}>Deadline</div>
                  <DeadlineMeter deadline={o.deadline} settled={CLOSED_STATUSES.includes(String(o.status ?? ''))} />
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
            <span className="t-xs text-dim">Page {page + 1} of {totalPages} · {total.toLocaleString()} orders</span>
            <div className="pager-nums">
              <button className="pg-n" onClick={() => setPage(page - 1)} disabled={page === 0 || orders.loading} aria-label="Previous page">
                <ChevronLeft size={14} />
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const start = Math.max(0, Math.min(page - 2, totalPages - 5));
                const p = start + i;
                return (
                  <button key={p} className={`pg-n${p === page ? ' on' : ''}`} onClick={() => setPage(p)}
                          disabled={orders.loading && p !== page} aria-current={p === page ? 'page' : undefined}>
                    {p + 1}
                  </button>
                );
              })}
              <button className="pg-n" onClick={() => setPage(page + 1)} disabled={page >= totalPages - 1 || orders.loading} aria-label="Next page">
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
