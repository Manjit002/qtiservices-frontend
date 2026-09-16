'use client';

import { useCallback, useMemo, useState } from 'react';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { Pagination } from '@/components/shared/Pagination';
import { Spinner } from '@/components/shared/Spinner';
import { useAsync } from '@/hooks/useAsync';
import { useDebounce } from '@/hooks/useDebounce';
import { usePagination } from '@/hooks/usePagination';
import { useToast } from '@/hooks/useToast';
import { expertApi } from '@/lib/api/expert';
import { parseServerDate } from '@/lib/utils/format';
import { ExpertOrdersTable, type SortCol } from './ExpertOrdersTable';
import type { OrderDTO } from '@/types';

const FILTERS = [
  { key: null, label: 'All' },
  { key: 'ASSIGNED', label: 'Assigned' },
  { key: 'IN_PROGRESS', label: 'In Progress' },
  { key: 'SUBMITTED', label: 'Submitted' },
  { key: 'COMPLETED', label: 'Completed' },
] as const;

interface ExpertOrdersPanelProps {
  onOpenDetail: (id: number) => void;
  onSubmitWork: (order: OrderDTO) => void;
  onOpenFiles: (id: number) => void;
}

export function ExpertOrdersPanel({ onOpenDetail, onSubmitWork, onOpenFiles }: ExpertOrdersPanelProps) {
  const { showToast } = useToast();
  const [filter, setFilter] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sortCol, setSortCol] = useState<SortCol>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [busyOrderId, setBusyOrderId] = useState<number | null>(null);

  const debouncedSearch = useDebounce(search, 400);
  const { data, loading, error, reload } = useAsync((signal) => expertApi.orders(0, 200, signal), []);

  const allOrders = useMemo(() => data?.content ?? [], [data]);

  /** Filter → search → sort, all client-side, matching the legacy behaviour. */
  const processed = useMemo(() => {
    let list = allOrders;

    if (filter) list = list.filter((o) => String(o.status ?? '') === filter);

    const kw = debouncedSearch.trim().toLowerCase();
    if (kw) {
      list = list.filter(
        (o) => (o.subject ?? '').toLowerCase().includes(kw) || String(o.id ?? '').includes(kw),
      );
    }

    if (sortCol) {
      const dir = sortDir === 'asc' ? 1 : -1;
      list = [...list].sort((a, b) => {
        let av: string | number;
        let bv: string | number;
        if (sortCol === 'deadline') {
          av = parseServerDate(a.deadline)?.getTime() ?? 0;
          bv = parseServerDate(b.deadline)?.getTime() ?? 0;
        } else if (sortCol === 'id') {
          av = a.id ?? 0;
          bv = b.id ?? 0;
        } else {
          av = String(a[sortCol] ?? '').toLowerCase();
          bv = String(b[sortCol] ?? '').toLowerCase();
        }
        if (av < bv) return -1 * dir;
        if (av > bv) return 1 * dir;
        return 0;
      });
    }
    return list;
  }, [allOrders, filter, debouncedSearch, sortCol, sortDir]);

  const { page, totalPages, total, pageItems, setPage, reset } = usePagination(processed, 15);

  const counts = useMemo(() => {
    const map: Record<string, number> = { ALL: allOrders.length };
    allOrders.forEach((o) => {
      const s = String(o.status ?? '');
      map[s] = (map[s] ?? 0) + 1;
    });
    return map;
  }, [allOrders]);

  const handleSort = useCallback((col: Exclude<SortCol, null>) => {
    setSortDir((prevDir) => {
      let nextDir: 'asc' | 'desc' = 'asc';
      setSortCol((prevCol) => {
        nextDir = prevCol === col ? (prevDir === 'asc' ? 'desc' : 'asc') : 'asc';
        return col;
      });
      return nextDir;
    });
    reset();
  }, [reset]);

  const handleStartWork = useCallback(
    async (id: number) => {
      setBusyOrderId(id);
      try {
        await expertApi.startWork(id);
        showToast(`Started work on OD-${id}.`, 'success');
        await reload();
      } catch (err) {
        showToast((err as Error).message, 'error');
      } finally {
        setBusyOrderId(null);
      }
    },
    [reload, showToast],
  );

  return (
    <div>
      <div className="filter-row">
        {FILTERS.map((f) => (
          <button
            key={f.label}
            type="button"
            className={`filter-btn ${filter === f.key ? 'active' : ''}`}
            onClick={() => {
              setFilter(f.key);
              reset();
            }}
          >
            {f.label} ({f.key ? (counts[f.key] ?? 0) : counts.ALL})
          </button>
        ))}
      </div>

      <div style={{ marginBottom: 14 }}>
        <label htmlFor="expert-order-search" className="sr-only">Search your orders</label>
        <input
          id="expert-order-search"
          className="fi"
          placeholder="🔍 Search by order ID or subject…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            reset();
          }}
        />
      </div>

      {loading && !data ? (
        <div style={{ textAlign: 'center', padding: 60 }}><Spinner size="lg" /></div>
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : pageItems.length === 0 ? (
        <div className="card"><EmptyState icon="📦" title="No orders found" subtitle="Try a different filter or search term." /></div>
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
            label="orders"
            suffix={filter ?? undefined}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
}
