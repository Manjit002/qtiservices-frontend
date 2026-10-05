'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { ArrowRight, CalendarCheck2, CheckCircle2, Eye, Play, Send } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/Badge';
import { DeadlineMeter, deadlineState } from '@/components/ui/DeadlineMeter';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States';
import { useExpertPortal } from '@/components/expert/shell/ExpertPortal';
import { AvailabilityControl } from '@/components/expert/AvailabilityControl';
import { useAsync } from '@/hooks/useAsync';
import { useLiveClock } from '@/hooks/useLiveDeadlines';
import { expertApi } from '@/lib/api/expert';
import { fmtOrderId, formatDateTime, parseServerDate } from '@/lib/utils/format';
import type { OrderDTO } from '@/types';

const DONE = ['COMPLETED', 'CANCELLED', 'SUBMITTED'];

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

/** The one thing to do next for an order, in the expert's flow. */
export function NextAction({ order, compact = false }: { order: OrderDTO; compact?: boolean }) {
  const { startWork, startingId, openSubmit, openDetail } = useExpertPortal();
  const status = String(order.status ?? '');
  if (status === 'ASSIGNED' || status === 'REASSIGNED') {
    return (
      <Button size="sm" variant="primary" onClick={() => void startWork(order.id)} loading={startingId === order.id}>
        {startingId !== order.id && <Play size={13} />} Start{compact ? '' : ' work'}
      </Button>
    );
  }
  if (status === 'IN_PROGRESS') {
    return (
      <Button size="sm" variant="primary" onClick={() => openSubmit(order)}>
        <Send size={13} /> Submit{compact ? '' : ' work'}
      </Button>
    );
  }
  return (
    <Button size="sm" variant="ghost" onClick={() => openDetail(order.id)}>
      <Eye size={13} /> View
    </Button>
  );
}

/**
 * Expert home. It answers "what do I work on next?": the situation in one
 * line, the counts, open work by soonest deadline with its next action, and
 * the availability switch — which experts change daily, so it lives here as
 * well as on the profile.
 */
export function ExpertDashboardPanel({ onOpenOrder }: { onOpenOrder: (id: number) => void }) {
  useLiveClock();
  const { displayName } = useExpertPortal();

  const stats = useAsync((signal) => expertApi.stats(signal), []);
  const summary = useAsync((signal) => expertApi.dashboard(signal), []);
  const orders = useAsync((signal) => expertApi.orders(0, 100, signal), []);
  const profile = useAsync((signal) => expertApi.profile(signal), []);
  const dueToday = useAsync((signal) => expertApi.dueToday(signal), []);

  const open = useMemo(
    () =>
      (orders.data?.content ?? [])
        .filter((o) => !DONE.includes(String(o.status ?? '')))
        .map((o) => ({ o, t: parseServerDate(o.deadline)?.getTime() ?? Number.MAX_SAFE_INTEGER }))
        .sort((a, b) => a.t - b.t)
        .map((x) => x.o),
    [orders.data]
  );

  const overdue = open.filter((o) => deadlineState(o.deadline).overdue).length;
  const dueSoon = open.filter((o) => {
    const t = parseServerDate(o.deadline)?.getTime();
    return t != null && t >= Date.now() && t - Date.now() < 24 * 3_600_000;
  }).length;

  const situation = orders.loading
    ? 'Checking your work…'
    : overdue > 0
      ? overdue === 1 ? '1 order is past your deadline.' : `${overdue} orders are past your deadline.`
      : dueSoon > 0
        ? dueSoon === 1 ? '1 order is due in the next 24 hours.' : `${dueSoon} orders are due in the next 24 hours.`
        : open.length > 0
          ? `${open.length} open order${open.length === 1 ? '' : 's'}. Nothing due in the next 24 hours.`
          : 'Nothing is assigned to you right now.';

  const s = stats.data ?? {};
  const d = summary.data ?? {};
  const tiles = [
    { label: 'Assigned', value: s.assigned ?? d.totalAssigned, tone: 'var(--accent)', href: '/expert/orders' },
    { label: 'In progress', value: s.inProgress ?? d.inProgress, tone: 'var(--info)', href: '/expert/orders?status=IN_PROGRESS' },
    { label: 'Submitted', value: s.submitted, tone: 'var(--warning)', href: '/expert/orders?status=SUBMITTED' },
    { label: 'Completed', value: s.completed ?? d.completed, tone: 'var(--success)', href: '/expert/orders?status=COMPLETED' },
    { label: 'Overdue', value: s.overdue, tone: 'var(--danger)', href: '/expert/deadlines' },
  ];
  const statsLoading = stats.loading && summary.loading;

  return (
    <div className="rise">
      <div className="page-head">
        <div>
          <h1 className="t-h1">{greeting()}, {displayName.split(' ')[0]}.</h1>
          <p className="t-body text-mid" style={{ marginTop: 6 }}>{situation}</p>
        </div>
      </div>

      <div className="stat-strip">
        {tiles.map((t) => (
          <Link key={t.label} href={t.href} className="stat">
            <span className="stat-flag" style={{ background: t.tone }} aria-hidden />
            <span className="stat-value">{statsLoading ? <Skeleton w={36} h={22} /> : (t.value ?? 0).toLocaleString()}</span>
            <span className="stat-label">{t.label}</span>
          </Link>
        ))}
      </div>
      {stats.error && summary.error && (
        <div className="card" style={{ marginBottom: 'var(--s5)' }}>
          <ErrorState message={stats.error} onRetry={() => { void stats.reload(); void summary.reload(); }} />
        </div>
      )}

      <div className="xp-cols">
        <section className="card">
          <div className="card-head">
            <div>
              <h2 className="t-h3">Up next</h2>
              <p className="t-xs text-dim" style={{ marginTop: 2 }}>Your open orders, soonest deadline first</p>
            </div>
            <Link href="/expert/orders" className="btn btn-ghost btn-sm">All orders <ArrowRight size={13} /></Link>
          </div>

          {orders.loading && (
            <div style={{ padding: 'var(--s5)', display: 'grid', gap: 'var(--s5)' }}>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} style={{ display: 'grid', gap: 7 }}><Skeleton w="30%" h={11} /><Skeleton w="70%" /></div>
              ))}
            </div>
          )}
          {orders.error && <ErrorState message={orders.error} onRetry={orders.reload} />}
          {!orders.loading && !orders.error && open.length === 0 && (
            <EmptyState
              icon={<CheckCircle2 size={18} />}
              title="You're all caught up"
              hint="New assignments appear here as soon as an admin assigns them to you."
            />
          )}

          {open.slice(0, 6).map((o) => (
            <div className="xp-row" key={o.id}>
              <button type="button" className="xp-row-main" onClick={() => onOpenOrder(o.id)}>
                <span className="xp-id">{fmtOrderId(o.id)}</span>
                <span className="xp-subject">{o.subject || 'Untitled order'}</span>
              </button>
              <div className="xp-row-meta">
                <div className="meter-col"><DeadlineMeter deadline={o.deadline} /></div>
                <StatusBadge status={o.status} />
                <NextAction order={o} compact />
              </div>
            </div>
          ))}
        </section>

        <div className="xp-side">
          <section className="card">
            <div className="card-head">
              <div>
                <h2 className="t-h3">Your availability</h2>
                <p className="t-xs text-dim" style={{ marginTop: 2 }}>Admins assign new work from the available list</p>
              </div>
            </div>
            <div className="card-pad">
              {profile.loading ? (
                <Skeleton h={38} />
              ) : profile.error ? (
                <ErrorState message={profile.error} onRetry={profile.reload} />
              ) : (
                <AvailabilityControl initial={profile.data?.availabilityStatus ?? null} compact />
              )}
            </div>
          </section>

          <section className="card">
            <div className="card-head">
              <div>
                <h2 className="t-h3">Due today</h2>
                <p className="t-xs text-dim" style={{ marginTop: 2 }}>By your expert deadline</p>
              </div>
              <Link href="/expert/deadlines" className="btn btn-ghost btn-sm">Deadlines <ArrowRight size={13} /></Link>
            </div>
            {dueToday.loading && <div style={{ padding: 'var(--s5)' }}><Skeleton h={30} /></div>}
            {dueToday.error && <ErrorState message={dueToday.error} onRetry={dueToday.reload} />}
            {!dueToday.loading && !dueToday.error && (dueToday.data?.length ?? 0) === 0 && (
              <EmptyState icon={<CalendarCheck2 size={18} />} title="Nothing due today" />
            )}
            {(dueToday.data ?? []).slice(0, 4).map((o) => (
              <div className="xp-row" key={o.id}>
                <button type="button" className="xp-row-main" onClick={() => onOpenOrder(o.id)}>
                  <span className="xp-id">{fmtOrderId(o.id)}</span>
                  <span className="xp-subject">{o.subject || 'Untitled order'}</span>
                  <span className="xp-row-due">Due {formatDateTime(o.deadline)}</span>
                </button>
                <NextAction order={o} compact />
              </div>
            ))}
          </section>
        </div>
      </div>
    </div>
  );
}
