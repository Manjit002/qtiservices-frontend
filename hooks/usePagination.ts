'use client';

import { useMemo, useState, useCallback } from 'react';

interface UsePaginationResult<T> {
  page: number;
  totalPages: number;
  /** Total item count across all pages (pre-pagination, post-filter). */
  total: number;
  pageItems: T[];
  setPage: (p: number) => void;
  next: () => void;
  prev: () => void;
  reset: () => void;
}

/**
 * Client-side pagination. The admin orders table paginates in the browser
 * because the backend returns a wide page and filtering happens locally —
 * preserving that behaviour keeps the visible row set identical.
 */
export function usePagination<T>(items: T[], pageSize = 15): UsePaginationResult<T> {
  const [page, setPageState] = useState(0);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = page >= totalPages ? 0 : page;

  const pageItems = useMemo(
    () => items.slice(safePage * pageSize, (safePage + 1) * pageSize),
    [items, safePage, pageSize]
  );

  const setPage = useCallback(
    (p: number) => setPageState(Math.max(0, Math.min(p, Math.max(0, totalPages - 1)))),
    [totalPages]
  );

  return {
    page: safePage,
    totalPages,
    total: items.length,
    pageItems,
    setPage,
    next: () => setPage(safePage + 1),
    prev: () => setPage(safePage - 1),
    reset: () => setPageState(0),
  };
}
