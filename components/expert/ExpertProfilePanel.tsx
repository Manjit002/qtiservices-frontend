'use client';

import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/Badge';
import { ErrorState, Skeleton } from '@/components/ui/States';
import { AvailabilityControl } from '@/components/expert/AvailabilityControl';
import { useAsync } from '@/hooks/useAsync';
import { expertApi } from '@/lib/api/expert';

/** Read-only account details plus the availability control (POST /expert/status). */
export function ExpertProfilePanel() {
  const { data: p, loading, error, reload } = useAsync((signal) => expertApi.profile(signal), []);

  const rows: [string, ReactNode][] = p
    ? [
        ['Email', p.email ?? '—'],
        ['Phone', p.phone || <span className="text-faint">Not on file</span>],
        ['Role', p.role ? <Badge tone="accent">{String(p.role).replace(/_/g, ' ').toLowerCase()}</Badge> : '—'],
        ['Account', p.active === false
          ? <Badge tone="danger" dot>Inactive</Badge>
          : <Badge tone="success" dot>Active</Badge>],
        ['Employee ID', p.id != null ? String(p.id) : '—'],
      ]
    : [];

  return (
    <div className="rise">
      <div className="page-head">
        <div>
          <h1 className="t-h1">My profile</h1>
          <p className="t-sm text-dim" style={{ marginTop: 4 }}>
            Your account details, and whether you can take new work.
          </p>
        </div>
      </div>

      {error ? (
        <div className="card"><ErrorState message={error} onRetry={reload} /></div>
      ) : (
        <div className="xp-prof-grid">
          <section className="card">
            <div className="xp-ident">
              <span className="avatar" aria-hidden>{(p?.name ?? p?.email ?? '?').charAt(0).toUpperCase()}</span>
              <div style={{ minWidth: 0 }}>
                {loading && !p ? (
                  <><Skeleton w={160} h={16} /><div style={{ height: 6 }} /><Skeleton w={200} h={12} /></>
                ) : (
                  <>
                    <h2 className="t-h3 truncate">{p?.name ?? 'Unnamed account'}</h2>
                    <div className="t-sm text-dim truncate">{p?.email}</div>
                  </>
                )}
              </div>
            </div>
            {loading && !p ? (
              <div style={{ padding: 'var(--s5)', display: 'grid', gap: 'var(--s4)' }}>
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} h={14} />)}
              </div>
            ) : (
              <dl className="xp-dl">
                {rows.map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            )}
            <p className="t-xs text-faint" style={{ padding: '0 var(--s5) var(--s5)' }}>
              To change your name, email or phone, ask an administrator.
            </p>
          </section>

          <section className="card">
            <div className="card-head">
              <div>
                <h2 className="t-h3">Availability</h2>
                <p className="t-xs text-dim" style={{ marginTop: 2 }}>Admins see this when choosing who to assign new orders to.</p>
              </div>
            </div>
            <div className="card-pad">
              {loading && !p ? <Skeleton h={160} /> : <AvailabilityControl initial={p?.availabilityStatus ?? null} />}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
