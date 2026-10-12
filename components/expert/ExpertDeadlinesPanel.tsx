'use client';

import { AlarmClock, CalendarCheck2, CheckCircle2, RotateCw, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/Badge';
import { DeadlineMeter } from '@/components/ui/DeadlineMeter';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States';
import { NextAction } from '@/components/expert/ExpertDashboardPanel';
import { useAsync } from '@/hooks/useAsync';
import { useLiveClock } from '@/hooks/useLiveDeadlines';
import { expertApi } from '@/lib/api/expert';
import { fmtOrderId, formatDateTime } from '@/lib/utils/format';
import type { OrderDTO } from '@/types';

interface ListProps {
  title: string;
  hint: string;
  icon: ReactNode;
  flag: string;
  state: { data: OrderDTO[] | null; loading: boolean; error: string | null; reload: () => void };
  empty: { icon: ReactNode; title: string; hint: string };
  onOpenOrder: (id: number) => void;
}

function DeadlineList({ title, hint, icon, flag, state, empty, onOpenOrder }: ListProps) {
  const rows = state.data ?? [];
  return (
    <section className="card xp-dl-card" style={{ ['--flag' as string]: flag }}>
      <div className="card-head">
        <div>
          <h2 className="t-h3" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: flag, display: 'inline-flex' }} aria-hidden>{icon}</span>
            {title}
            {!state.loading && !state.error && <span className="xp-count">{rows.length}</span>}
          </h2>
          <p className="t-xs text-dim" style={{ marginTop: 2 }}>{hint}</p>
        </div>
      </div>

      {state.loading && (
        <div style={{ padding: 'var(--s5)', display: 'grid', gap: 'var(--s4)' }}>
          <Skeleton h={34} /><Skeleton h={34} />
        </div>
      )}
      {state.error && <ErrorState message={state.error} onRetry={state.reload} />}
      {!state.loading && !state.error && rows.length === 0 && <EmptyState {...empty} />}

      {rows.map((o) => (
        <div className="xp-row" key={o.id}>
          <button type="button" className="xp-row-main" onClick={() => onOpenOrder(o.id)}>
            <span className="xp-id">{fmtOrderId(o.id)}</span>
            <span className="xp-subject">{o.subject || 'Untitled order'}</span>
            <span className="xp-row-due">Due {formatDateTime(o.deadline)}</span>
          </button>
          <div className="xp-row-meta">
            <div className="meter-col"><DeadlineMeter deadline={o.deadline} /></div>
            <StatusBadge status={o.status} />
            <NextAction order={o} compact />
          </div>
        </div>
      ))}
    </section>
  );
}

/** Overdue and due-today, from the two dedicated backend endpoints. */
export function ExpertDeadlinesPanel({ onOpenOrder }: { onOpenOrder: (id: number) => void }) {
  useLiveClock();
  const dueToday = useAsync((signal) => expertApi.dueToday(signal), []);
  const overdue = useAsync((signal) => expertApi.overdue(signal), []);
  const loading = dueToday.loading || overdue.loading;

  return (
    <div className="rise">
      <div className="page-head">
        <div>
          <h1 className="t-h1">Deadlines</h1>
          <p className="t-sm text-dim" style={{ marginTop: 4 }}>
            Work past your deadline, and work due today. Times are your expert deadlines.
          </p>
        </div>
        <div className="page-head-actions">
          <Button size="sm" loading={loading} onClick={() => { void dueToday.reload(); void overdue.reload(); }}>
            {!loading && <RotateCw size={13} />} Refresh
          </Button>
        </div>
      </div>

      <div className="xp-dl-grid">
        <DeadlineList
          title="Overdue"
          hint="Past your deadline and not yet submitted"
          icon={<TriangleAlert size={16} />}
          flag="var(--danger)"
          state={overdue}
          empty={{ icon: <CheckCircle2 size={18} />, title: 'Nothing overdue', hint: 'Every open order is still within its deadline.' }}
          onOpenOrder={onOpenOrder}
        />
        <DeadlineList
          title="Due today"
          hint="Deadline falls today"
          icon={<AlarmClock size={16} />}
          flag="var(--warning)"
          state={dueToday}
          empty={{ icon: <CalendarCheck2 size={18} />, title: 'Nothing due today', hint: 'Check My orders for what is coming up next.' }}
          onOpenOrder={onOpenOrder}
        />
      </div>
    </div>
  );
}
