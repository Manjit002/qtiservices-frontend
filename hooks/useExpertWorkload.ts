'use client';

import { useMemo } from 'react';
import { useAsync } from '@/hooks/useAsync';
import { ordersApi } from '@/lib/api/orders';
import { EXPERT_UNKNOWN_NOTE, expertName, expertNamesKnown } from '@/lib/utils/orderRows';

/** Statuses that no longer count towards an expert's load. */
const CLOSED = ['COMPLETED', 'CANCELLED', 'PAID'];

/** How many recent orders the count is taken from (two /admin/all requests). */
const SAMPLE = 200;

export interface ExpertWorkload {
  /**
   * Active orders per expert name, from the newest orders. `null` means the
   * order rows don't name their expert, so a count would read as a false
   * "0 active" — callers show nothing rather than zero.
   */
  workload: Map<string, number> | null;
  note: string;
  loading: boolean;
  /** How many orders the counts were taken from. */
  sampled: number;
}

/**
 * Expert workload, counted from real order records — the API has no workload
 * figure. Nothing is fetched until `enabled` is true, so the portal shell only
 * pays for it when the assign dialog actually opens.
 */
export function useExpertWorkload(enabled: boolean, refreshKey = 0): ExpertWorkload {
  const source = useAsync(
    (s) => (enabled ? ordersApi.recent(SAMPLE, s) : Promise.resolve(null)),
    [enabled, refreshKey]
  );

  return useMemo<ExpertWorkload>(() => {
    const rows = source.data?.content ?? [];
    if (!source.data) {
      return { workload: null, note: '', loading: source.loading, sampled: 0 };
    }
    if (!expertNamesKnown(rows)) {
      return { workload: null, note: EXPERT_UNKNOWN_NOTE, loading: false, sampled: rows.length };
    }
    const m = new Map<string, number>();
    rows.forEach((o) => {
      const name = expertName(o);
      if (!name || CLOSED.includes(String(o.status ?? ''))) return;
      m.set(name, (m.get(name) ?? 0) + 1);
    });
    return {
      workload: m,
      note: `Active-order counts are from the ${rows.length} most recent orders — the API exposes no workload figure.`,
      loading: false,
      sampled: rows.length,
    };
  }, [source.data, source.loading]);
}
