'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  Search, X, RotateCw, Users2, UserPlus, Power, PowerOff, Mail, ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { Skeleton, SkeletonRows, EmptyState, ErrorState } from '@/components/ui/States';
import { useAsync } from '@/hooks/useAsync';
import { useDebounce } from '@/hooks/useDebounce';
import { useToast } from '@/hooks/useToast';
import { expertsApi } from '@/lib/api/experts';
import { ordersApi } from '@/lib/api/orders';
import type { EmployeeDTO } from '@/types';
import './experts.css';
import '@/components/admin/orders.css';
import '@/components/admin/students/students.css';

interface Props {
  onNavigate: (key: string) => void;
}

const ROLE_TONE: Record<string, 'accent' | 'info' | 'warning'> = {
  EXPERT: 'accent', ADMIN: 'info', SUPER_ADMIN: 'warning',
};

const AVAILABILITY = ['ALL', 'AVAILABLE', 'UNAVAILABLE'] as const;
type Availability = (typeof AVAILABILITY)[number];

/** Only two states are knowable: on the available list, or not. */
function availClass(isAvailable: boolean): string {
  return isAvailable ? 'available' : 'offline';
}

const pretty = (s: string) => s.replace(/_/g, ' ').toLowerCase();

export function ExpertsPanel({ onNavigate }: Props) {
  const { showToast } = useToast();
  const employees = useAsync((s) => expertsApi.listEmployees(s), []);

  /**
   * Availability is NOT on the employee DTO — the backend builds it with only
   * id, name, email, role and active. Reading `availabilityStatus` off it
   * always yielded undefined, so every row rendered "offline" and every
   * "available" count was zero.
   *
   * `/admin/experts/available` returns exactly the people the server considers
   * available, so membership in that list IS the answer. Two real endpoints,
   * nothing inferred.
   */
  const availableList = useAsync((s) => expertsApi.listAvailable(s), []);

  /**
   * Active-order counts per expert, derived from real order records — the
   * employee endpoint carries no workload figure, so this is a join rather
   * than an invented statistic.
   */
  const workloadSource = useAsync((s) => ordersApi.listAll(0, 200, 'createdAt,desc', s), []);

  const [query, setQuery] = useState('');
  const [availability, setAvailability] = useState<Availability>('ALL');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [pending, setPending] = useState<{ emp: EmployeeDTO; active: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  const search = useDebounce(query, 250);

  const workload = useMemo(() => {
    const rows = workloadSource.data?.content ?? [];
    const m = new Map<string, number>();
    rows.forEach((o) => {
      const name = (o.assignedEmployeeName as string | undefined)?.trim();
      const status = String(o.status ?? '');
      if (!name) return;
      if (['COMPLETED', 'CANCELLED', 'PAID'].includes(status)) return;
      m.set(name, (m.get(name) ?? 0) + 1);
    });
    return m;
  }, [workloadSource.data]);

  const all = useMemo(() => employees.data ?? [], [employees.data]);

  const availableIds = useMemo(
    () => new Set((availableList.data ?? []).map((e) => e.id)),
    [availableList.data]
  );

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return all.filter((e) => {
      const free = availableIds.has(e.id);
      if (availability === 'AVAILABLE' && !free) return false;
      if (availability === 'UNAVAILABLE' && free) return false;
      if (roleFilter !== 'ALL' && String(e.role ?? '') !== roleFilter) return false;
      if (!q) return true;
      return (
        (e.name ?? '').toLowerCase().includes(q) ||
        (e.email ?? '').toLowerCase().includes(q) ||
        String(e.role ?? '').toLowerCase().includes(q)
      );
    });
  }, [all, search, availability, roleFilter, availableIds]);

  const stats = useMemo(() => ({
    total: all.length,
    active: all.filter((e) => e.active).length,
    available: availableIds.size,
    experts: all.filter((e) => String(e.role ?? '') === 'EXPERT').length,
  }), [all, availableIds]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: all.length };
    all.forEach((e) => {
      const r = String(e.role ?? 'UNKNOWN');
      c[r] = (c[r] ?? 0) + 1;
    });
    return c;
  }, [all]);

  const applyStatus = useCallback(async () => {
    if (!pending) return;
    setBusy(true);
    try {
      await expertsApi.setActive(pending.emp.id, pending.active);
      showToast(
        `${pending.emp.name ?? 'Account'} ${pending.active ? 'activated' : 'deactivated'}.`,
        'success'
      );
      setPending(null);
      employees.reload();
      availableList.reload();   // active state feeds availability
    } catch (e) {
      showToast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  }, [pending, employees, availableList, showToast]);

  const filtering = Boolean(query || availability !== 'ALL' || roleFilter !== 'ALL');

  const cards = [
    { label: 'Team members', value: stats.total, tone: 'var(--accent)' },
    { label: 'Experts', value: stats.experts, tone: 'var(--info)' },
    { label: 'Available now', value: stats.available, tone: 'var(--success)' },
    { label: 'Active accounts', value: stats.active, tone: 'var(--gold)' },
  ];

  const loadFor = (e: EmployeeDTO) => workload.get((e.name ?? '').trim()) ?? 0;

  return (
    <div className="rise">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--s4)', flexWrap: 'wrap', marginBottom: 'var(--s5)' }}>
        <div>
          <h1 className="t-h1">Experts</h1>
          <p className="t-sm text-dim" style={{ marginTop: 4 }}>
            Everyone with platform access, their availability and current workload.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--s2)' }}>
          <Button size="sm" onClick={() => { employees.reload(); availableList.reload(); }}
                loading={employees.loading || availableList.loading}>
            <RotateCw size={13} /> Refresh
          </Button>
          <Button size="sm" variant="primary" onClick={() => onNavigate('create-expert')}>
            <UserPlus size={14} /> Add expert
          </Button>
        </div>
      </div>

      <div className="stu-stats" style={{ marginBottom: 'var(--s5)' }}>
        {cards.map((c) => (
          <div className="stu-stat" key={c.label}>
            <span className="stu-stat-flag" style={{ background: c.tone }} aria-hidden />
            <div className="stu-stat-val">
              {employees.loading ? <Skeleton w={40} h={22} /> : c.value}
            </div>
            <div className="stu-stat-lbl">{c.label}</div>
          </div>
        ))}
      </div>

      <div className="ord-bar">
        <div className="ord-search">
          <Search size={14} />
          <input className="input" value={query} onChange={(e) => setQuery(e.target.value)}
                 placeholder="Search name, email or role…" aria-label="Search team" />
          {query && (
            <button type="button" className="clear" onClick={() => setQuery('')}
                    aria-label="Clear search">
              <X size={13} />
            </button>
          )}
        </div>

        <select className="input" style={{ width: 150 }} value={availability}
                onChange={(e) => setAvailability(e.target.value as Availability)}
                aria-label="Filter by availability">
          {AVAILABILITY.map((a) => (
            <option key={a} value={a}>{a === 'ALL' ? 'Any availability' : pretty(a)}</option>
          ))}
        </select>

        {filtering && (
          <Button size="sm" variant="ghost"
                  onClick={() => { setQuery(''); setAvailability('ALL'); setRoleFilter('ALL'); }}>
            Clear filters
          </Button>
        )}
      </div>

      <div className="ord-bar">
        <div className="seg" role="group" aria-label="Filter by role">
          {['ALL', 'EXPERT', 'ADMIN', 'SUPER_ADMIN'].map((r) => (
            <button key={r} type="button" className={roleFilter === r ? 'on' : ''}
                    onClick={() => setRoleFilter(r)} aria-pressed={roleFilter === r}>
              {r === 'ALL' ? 'All' : pretty(r)}{counts[r] != null && ` (${counts[r]})`}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="ax-table-wrap table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Email</th>
                <th scope="col">Role</th>
                <th scope="col">Availability</th>
                <th scope="col" style={{ textAlign: 'right' }}>Active orders</th>
                <th scope="col">Account</th>
                <th scope="col" style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {employees.loading && <SkeletonRows rows={6} cols={7} />}
              {employees.error && (
                <tr><td colSpan={7}><ErrorState message={employees.error} onRetry={employees.reload} /></td></tr>
              )}
              {!employees.loading && !employees.error && rows.length === 0 && (
                <tr><td colSpan={7}>
                  <EmptyState
                    icon={<Users2 size={18} />}
                    title={filtering ? 'No one matches' : 'No team members yet'}
                    hint={filtering
                      ? 'Try a different search, role or availability.'
                      : 'Accounts created in Add expert appear here.'}
                    action={filtering
                      ? <Button size="sm" onClick={() => { setQuery(''); setAvailability('ALL'); setRoleFilter('ALL'); }}>
                          Clear filters
                        </Button>
                      : <Button size="sm" variant="primary" onClick={() => onNavigate('create-expert')}>
                          <UserPlus size={13} /> Add expert
                        </Button>}
                  />
                </td></tr>
              )}
              {rows.map((e) => {
                const free = availableIds.has(e.id);
                const load = loadFor(e);
                return (
                  <tr key={e.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                        <span className="avatar" aria-hidden>
                          {(e.name ?? e.email ?? '?').charAt(0).toUpperCase()}
                        </span>
                        <span style={{ fontWeight: 600 }}>{e.name ?? '—'}</span>
                      </div>
                    </td>
                    <td className="t-sm text-dim truncate" style={{ maxWidth: 200 }}>
                      {e.email ?? '—'}
                    </td>
                    <td><Badge tone={ROLE_TONE[String(e.role ?? '')] ?? 'neutral'}>
                      {pretty(String(e.role ?? '—'))}
                    </Badge></td>
                    <td>
                      {/* Dot AND word — availability never relies on colour alone. */}
                      <span className="t-sm" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span className={`ax-dot ${availClass(free)}`} aria-hidden />
                        {availableList.loading ? '—' : free ? 'available' : 'not available'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {workloadSource.loading
                        ? <Skeleton w={22} h={14} />
                        : load > 0
                          ? <span style={{ fontWeight: 600 }}>{load}</span>
                          : <span className="text-faint">—</span>}
                    </td>
                    <td>
                      <Badge tone={e.active ? 'success' : 'danger'} dot>
                        {e.active ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td>
                      <div className="acts">
                        <a className="act act-icon tip" data-tip="Email" href={`mailto:${e.email ?? ''}`}
                           aria-label={`Email ${e.name ?? 'this person'}`}>
                          <Mail size={13} />
                        </a>
                        {e.active ? (
                          <button type="button" className="act act-danger"
                                  onClick={() => setPending({ emp: e, active: false })}>
                            <PowerOff size={12} /> Deactivate
                          </button>
                        ) : (
                          <button type="button" className="act act-primary"
                                  onClick={() => setPending({ emp: e, active: true })}>
                            <Power size={12} /> Activate
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ── Mobile cards ── */}
        <div className="ax-cards" style={{ padding: 'var(--s3)' }}>
          {!employees.loading && rows.map((e) => {
            const free = availableIds.has(e.id);
            const load = loadFor(e);
            return (
              <article className="ax-emp-card" key={e.id}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className="avatar" aria-hidden>
                    {(e.name ?? e.email ?? '?').charAt(0).toUpperCase()}
                  </span>
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span className="t-sm truncate" style={{ display: 'block', fontWeight: 600 }}>
                      {e.name ?? '—'}
                    </span>
                    <span className="t-xs text-dim truncate" style={{ display: 'block' }}>
                      {e.email ?? '—'}
                    </span>
                  </span>
                  <Badge tone={ROLE_TONE[String(e.role ?? '')] ?? 'neutral'}>
                    {pretty(String(e.role ?? '—'))}
                  </Badge>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s3)', marginTop: 'var(--s3)', flexWrap: 'wrap' }}>
                  <span className="t-xs" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span className={`ax-dot ${availClass(free)}`} aria-hidden />
                    {free ? 'available' : 'not available'}
                  </span>
                  <span className="t-xs text-dim">
                    {load > 0 ? `${load} active order${load > 1 ? 's' : ''}` : 'no active orders'}
                  </span>
                  <span style={{ flex: 1 }} />
                  <Badge tone={e.active ? 'success' : 'danger'} dot>
                    {e.active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>

                <div style={{ marginTop: 'var(--s3)' }}>
                  {e.active ? (
                    <Button size="sm" variant="danger" style={{ width: '100%' }}
                            onClick={() => setPending({ emp: e, active: false })}>
                      <PowerOff size={13} /> Deactivate
                    </Button>
                  ) : (
                    <Button size="sm" variant="primary" style={{ width: '100%' }}
                            onClick={() => setPending({ emp: e, active: true })}>
                      <Power size={13} /> Activate
                    </Button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </div>

      {workloadSource.data && (
        <div className="an-note" style={{ border: '1px solid var(--line)', borderRadius: 'var(--r-md)', marginTop: 'var(--s4)' }}>
          <Users2 size={12} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>
            Active-order counts are joined from the {workloadSource.data.content.length} most
            recent orders — the employee endpoint carries no workload figure.
            <button type="button" className="act" style={{ marginLeft: 8 }}
                    onClick={() => onNavigate('assign')}>
              Assign orders <ArrowRight size={11} />
            </button>
          </span>
        </div>
      )}

      <ConfirmDialog
        isOpen={pending !== null}
        title={pending?.active ? 'Activate account' : 'Deactivate account'}
        message={pending?.active
          ? `${pending?.emp.name ?? 'This person'} will be able to sign in again.`
          : `${pending?.emp.name ?? 'This person'} will lose access immediately. Orders already assigned to them are not changed.`}
        confirmLabel={pending?.active ? 'Activate' : 'Deactivate'}
        danger={!pending?.active}
        busy={busy}
        onConfirm={applyStatus}
        onCancel={() => setPending(null)}
      />
    </div>
  );
}
