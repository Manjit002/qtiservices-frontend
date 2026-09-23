'use client';

import { useMemo } from 'react';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { Spinner } from '@/components/shared/Spinner';
import { StatGrid } from '@/components/shared/StatCard';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { useAsync } from '@/hooks/useAsync';
import { expertApi } from '@/lib/api/expert';
import { deadlineColor, deadlineLabel } from '@/lib/utils/deadline';
import { fmtOrderId } from '@/lib/utils/format';
import type { OrderDTO } from '@/types';

/** Overview: live stats plus an "Up Next" widget of the nearest deadlines. */
export function ExpertDashboardPanel({ onOpenOrder }: { onOpenOrder: (id: number) => void }) {
  const stats = useAsync((signal) => expertApi.stats(signal), []);
  const summary = useAsync((signal) => expertApi.dashboard(signal), []);
  const orders = useAsync((signal) => expertApi.orders(0, 100, signal), []);

  const upNext = useMemo(() => {
    const list = (orders.data?.content ?? []).filter(
      (o) => !['COMPLETED', 'CANCELLED', 'SUBMITTED'].includes(String(o.status ?? '')),
    );
    return [...list]
      .sort((a, b) => {
        const da = new Date(String(a.deadline ?? 0)).getTime();
        const db = new Date(String(b.deadline ?? 0)).getTime();
        return da - db;
      })
      .slice(0, 5);
  }, [orders.data]);

  const statCards = useMemo(() => {
    const s = stats.data ?? {};
    const d = summary.data ?? {};
    return [
      { icon: '📋', tone: 'purple' as const, value: s.assigned ?? d.totalAssigned ?? 0, label: 'Assigned' },
      { icon: '⚡', tone: 'cyan' as const, value: s.inProgress ?? d.inProgress ?? 0, label: 'In Progress' },
      { icon: '📤', tone: 'blue' as const, value: s.submitted ?? 0, label: 'Submitted' },
      { icon: '✅', tone: 'green' as const, value: s.completed ?? d.completed ?? 0, label: 'Completed' },
      { icon: '🔥', tone: 'red' as const, value: s.overdue ?? 0, label: 'Overdue' },
    ];
  }, [stats.data, summary.data]);

  if (stats.error && summary.error) {
    return <ErrorState message={stats.error} onRetry={() => { void stats.reload(); void summary.reload(); }} />;
  }

  return (
    <div>
      {stats.loading && !stats.data ? (
        <div style={{ textAlign: 'center', padding: 40 }}><Spinner size="lg" /></div>
      ) : (
        <StatGrid stats={statCards} />
      )}

      <div className="card">
        <h2 className="card-title">⏭ Up Next</h2>
        {orders.loading ? (
          <div style={{ textAlign: 'center', padding: 24 }}><Spinner /></div>
        ) : orders.error ? (
          <ErrorState message={orders.error} onRetry={orders.reload} />
        ) : upNext.length === 0 ? (
          <EmptyState icon="🎉" title="Nothing pending" subtitle="You're all caught up." />
        ) : (
          <ul style={{ listStyle: 'none' }}>
            {upNext.map((o: OrderDTO) => (
              <li key={o.id} className="up-next-row">
                <button type="button" onClick={() => onOpenOrder(o.id)} className="up-next-btn">
                  <div style={{ minWidth: 0 }}>
                    <div className="td-id">{fmtOrderId(o.id)}</div>
                    <div style={{ fontSize: '.76rem', color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {o.subject || '—'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                    <span style={{ fontSize: '.74rem', fontWeight: 700, color: deadlineColor(o.deadline) }}>
                      {deadlineLabel(o.deadline)}
                    </span>
                    <StatusBadge status={o.status} />
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
