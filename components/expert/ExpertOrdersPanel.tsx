'use client';

import { useCallback, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ClipboardList, RotateCw, Search, SearchX, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorState, SkeletonRows } from '@/components/ui/States';
import { Pagination } from '@/components/shared/Pagination';
import { useAsync } from '@/hooks/useAsync';
import { useDebounce } from '@/hooks/useDebounce';
import { useLiveClock } from '@/hooks/useLiveDeadlines';
import { usePagination } from '@/hooks/usePagination';
import { useToast } from '@/hooks/useToast';
import { expertApi } from '@/lib/api/expert';
import { fmtOrderId, parseServerDate } from '@/lib/utils/format';
import { ExpertOrdersTable, type SortCol } from './ExpertOrdersTable';
import type { OrderDTO } from '@/types';

export const EXPERT_FILTERS = [
  { key: null, label: 'All' },
  { key: 'ASSIGNED', label: 'Assigned' },
  { key: 'IN_PROGRESS', label: 'In progress' },
  { key: 'SUBMITTED', label: 'Submitted' },
  { key: 'COMPLETED', label: 'Completed' },
] as const;

interface ExpertOrdersPanelProps {
  onOpenDetail: (id: number) => void;
  onSubmitWork: (order: OrderDTO) => void;
  onOpenFiles: (id: number) => void;
  /** From ?status= — lets the dashboard tiles link straight to a filtered list. */
  initialFilter?: string | null;
}

export function ExpertOrdersPanel({ onOpenDetail, onSubmitWork, onOpenFiles, initialFilter = null }: ExpertOrdersPanelProps) {
  useLiveClock();
  const { showToast } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const [filter, setFilterState] = useState<string | null>(initialFilter);
  const [search, setSearch] = useState('');
  // null = the default order: open work first by soonest deadline, then
  // finished work, most recent first. A header click switches to that column.
  const [sortCol, setSortCol] = useState<SortCol>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [busyOrderId, setBusyOrderId] = useState<number | null>(null);

  const debouncedSearch = useDebounce(search, 300);
  const { data, loading, error, reload } = useAsync((signal) => expertApi.orders(0, 200, signal), []);
  const allOrders = useMemo(() => data?.content ?? [], [data]);

  /** Filter → search → sort, all client-side, matching the legacy behaviour. */
  const processed = useMemo(() => {
    let list = allOrders;
    if (filter) list = list.filter((o) => String(o.status ?? '') === filter);
    const kw = debouncedSearch.trim().toLowerCase().replace(/^od-/, '');
    if (kw) list = list.filter((o) => (o.subject ?? '').toLowerCase().includes(kw) || String(o.id ?? '').includes(kw));
    if (!sortCol) {
      const t = (o: OrderDTO) => parseServerDate(o.deadline)?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const done = (o: OrderDTO) => ['SUBMITTED', 'COMPLETED', 'CANCELLED'].includes(String(o.status ?? ''));
      list = [...list].sort((a, b) =>
        done(a) !== done(b) ? (done(a) ? 1 : -1) : done(a) ? t(b) - t(a) : t(a) - t(b));
    } else {
      const dir = sortDir === 'asc' ? 1 : -1;
      list = [...list].sort((a, b) => {
        const av = sortCol === 'deadline' ? parseServerDate(a.deadline)?.getTime() ?? Number.MAX_SAFE_INTEGER
          : sortCol === 'id' ? a.id ?? 0 : String(a[sortCol] ?? '').toLowerCase();
        const bv = sortCol === 'deadline' ? parseServerDate(b.deadline)?.getTime() ?? Number.MAX_SAFE_INTEGER
          : sortCol === 'id' ? b.id ?? 0 : String(b[sortCol] ?? '').toLowerCase();
        return av < bv ? -dir : av > bv ? dir : 0;
      });
    }
    return list;
  }, [allOrders, filter, debouncedSearch, sortCol, sortDir]);

  const { page, totalPages, total, pageItems, setPage, reset } = usePagination(processed, 15);

  const counts = useMemo(() => {
    const map: Record<string, number> = { ALL: allOrders.length };
    allOrders.forEach((o) => { const s = String(o.status ?? ''); map[s] = (map[s] ?? 0) + 1; });
    return map;
  }, [allOrders]);

  /** Keep the filter in the URL so refresh and Back return to the same view. */
  const setFilter = useCallback((next: string | null) => {
    setFilterState(next);
    reset();
    router.replace(next ? `${pathname}?status=${next}` : pathname, { scroll: false });
  }, [reset, router, pathname]);

  const handleSort = useCallback((col: Exclude<SortCol, null>) => {
    if (sortCol === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortCol(col); setSortDir('asc'); }
    reset();
  }, [sortCol, reset]);

  const handleStartWork = useCallback(async (id: number) => {
    setBusyOrderId(id);
    try {
      await expertApi.startWork(id);
      showToast(`Started work on ${fmtOrderId(id)}.`, 'success');
      await reload();
    } catch (err) {
      showToast((err as Error).message, 'error');
    } finally {
      setBusyOrderId(null);
    }
  }, [reload, showToast]);

  const filtered = Boolean(filter || debouncedSearch.trim());

  return (
    <div className="rise">
      <div className="page-head">
        <div>
          <h1 className="t-h1">My orders</h1>
          <p className="t-sm text-dim" style={{ marginTop: 4 }}>
            Everything assigned to you. Deadlines shown are your expert deadlines.
          </p>
        </div>
        <div className="page-head-actions">
          <Button size="sm" onClick={reload} loading={loading}>{!loading && <RotateCw size={13} />} Refresh</Button>
        </div>
      </div>

      <div className="xp-toolbar">
        <div className="ord-search">
          <Search size={14} aria-hidden />
          <label htmlFor="expert-order-search" className="visually-hidden">Search your orders</label>
          <input
            id="expert-order-search"
            className="input"
            placeholder="Search by order ID or subject"
            value={search}
            onChange={(e) => { setSearch(e.target.value); reset(); }}
          />
          {search && (
            <button type="button" className="clear" onClick={() => { setSearch(''); reset(); }} aria-label="Clear search">
              <X size={13} />
            </button>
          )}
        </div>
        <div className="seg" role="group" aria-label="Filter by status">
          {EXPERT_FILTERS.map((f) => (
            <button
              key={f.label}
              type="button"
              className={filter === f.key ? 'on' : ''}
              aria-pressed={filter === f.key}
              onClick={() => setFilter(f.key)}
            >
              {f.label} <span className="text-faint">{f.key ? (counts[f.key] ?? 0) : counts.ALL}</span>
            </button>
          ))}
        </div>
      </div>

      <section className="card" style={{ overflow: 'hidden' }}>
        {loading && !data ? (
          <div className="table-wrap">
            <table className="xp-table"><tbody><SkeletonRows rows={6} cols={5} /></tbody></table>
          </div>
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : pageItems.length === 0 ? (
          filtered ? (
            <EmptyState
              icon={<SearchX size={18} />}
              title="No orders match"
              hint="Try another status or search term."
              action={<Button size="sm" onClick={() => { setSearch(''); setFilter(null); }}>Clear filters</Button>}
            />
          ) : (
            <EmptyState
              icon={<ClipboardList size={18} />}
              title="No orders yet"
              hint="Orders appear here as soon as an admin assigns one to you."
            />
          )
        ) : (
          <>
            <ExpertOrdersTable
              orders={pageItems}
              sortCol={sortCol}
              sortDir={sortDir}
              onSort={handleSort}
              onOpenDetail={onOpenDetail}
              onStartWork={handleStartWork}
              onSubmitWork={onSubmitWork}
              onOpenFiles={onOpenFiles}
              busyOrderId={busyOrderId}
            />
            <Pagination
              page={page}
              totalPages={totalPages}
              total={total}
              label={total === 1 ? 'order' : 'orders'}
              suffix={filter ?? undefined}
              onPageChange={setPage}
            />
          </>
        )}
      </section>
    </div>
  );
}
