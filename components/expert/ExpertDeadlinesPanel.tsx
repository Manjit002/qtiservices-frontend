'use client';

import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { Spinner } from '@/components/shared/Spinner';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { useAsync } from '@/hooks/useAsync';
import { expertApi } from '@/lib/api/expert';
import { deadlineColor, deadlineLabel } from '@/lib/utils/deadline';
import { fmtOrderId, formatDateTime } from '@/lib/utils/format';
import type { OrderDTO } from '@/types';

function DeadlineList({
  title, icon, orders, tone, onOpenOrder,
}: {
  title: string;
  icon: string;
  orders: OrderDTO[];
  tone: string;
  onOpenOrder: (id: number) => void;
}) {
  return (
    <div className="card" style={{ borderLeft: `3px solid ${tone}` }}>
      <h2 className="card-title">{icon} {title} <span style={{ color: 'var(--muted)', fontSize: '.8rem' }}>({orders.length})</span></h2>
      {orders.length === 0 ? (
        <EmptyState icon="✅" title={`No ${title.toLowerCase()}`} />
      ) : (
        <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {orders.map((o) => (
            <li key={o.id}>
              <button type="button" className="dl-row" onClick={() => onOpenOrder(o.id)}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="td-id">{fmtOrderId(o.id)}</div>
                  <div style={{ fontSize: '.78rem', color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {o.subject || '—'}
                  </div>
                  <div style={{ fontSize: '.72rem', color: 'var(--muted)', marginTop: 3 }}>
                    Due {formatDateTime(o.deadline)}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                  <span style={{ fontSize: '.76rem', fontWeight: 800, color: deadlineColor(o.deadline) }}>
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
  );
}

/** Due-today and overdue, from the two dedicated backend endpoints. */
export function ExpertDeadlinesPanel({ onOpenOrder }: { onOpenOrder: (id: number) => void }) {
  const dueToday = useAsync((signal) => expertApi.dueToday(signal), []);
  const overdue = useAsync((signal) => expertApi.overdue(signal), []);

  if (dueToday.loading && overdue.loading) {
    return <div style={{ textAlign: 'center', padding: 60 }}><Spinner size="lg" /></div>;
  }

  return (
    <div style={{ display: 'grid', gap: 20, gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
      {overdue.error ? (
        <ErrorState message={overdue.error} onRetry={overdue.reload} />
      ) : (
        <DeadlineList title="Overdue" icon="🔥" tone="var(--red)" orders={overdue.data ?? []} onOpenOrder={onOpenOrder} />
      )}
      {dueToday.error ? (
        <ErrorState message={dueToday.error} onRetry={dueToday.reload} />
      ) : (
        <DeadlineList title="Due Today" icon="⏰" tone="var(--gold)" orders={dueToday.data ?? []} onOpenOrder={onOpenOrder} />
      )}
    </div>
  );
}
