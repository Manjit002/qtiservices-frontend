'use client';

import { useCallback, useMemo, useState } from 'react';
import { Search, RotateCw, Users2, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Skeleton, EmptyState, ErrorState } from '@/components/ui/States';
import { useAsync } from '@/hooks/useAsync';
import { useDebounce } from '@/hooks/useDebounce';
import { expertsApi } from '@/lib/api/experts';
import { CreateExpertForm } from './CreateExpertForm';
import type { EmployeeDTO } from '@/types';
import './experts.css';
import '@/components/admin/orders.css';
import '@/components/admin/order-edit.css';

interface Props {
  isSuperAdmin: boolean;
}

const ROLE_TONE: Record<string, 'accent' | 'info' | 'warning'> = {
  EXPERT: 'accent',
  ADMIN: 'info',
  SUPER_ADMIN: 'warning',
};

/** The employee DTO carries no availability, so membership in the
 *  available-experts list is the only knowable answer. */
function availClass(isAvailable: boolean): string {
  return isAvailable ? 'available' : 'offline';
}

export function AddExpertPanel({ isSuperAdmin }: Props) {
  const employees = useAsync((s) => expertsApi.listEmployees(s), []);
  // Availability is absent from the employee DTO — resolve it from the
  // endpoint that actually knows.
  const availableList = useAsync((s) => expertsApi.listAvailable(s), []);
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  /** Email of the account just created, so its row can be highlighted. */
  const [freshEmail, setFreshEmail] = useState<string | null>(null);
  const search = useDebounce(query, 250);

  /**
   * The list endpoint has no search parameter, so filtering happens in the
   * browser over the already-fetched array — no extra request per keystroke.
   */
  const availableIds = useMemo(
    () => new Set((availableList.data ?? []).map((e) => e.id)),
    [availableList.data]
  );

  const rows = useMemo(() => {
    const all = employees.data ?? [];
    const q = search.trim().toLowerCase();
    return all.filter((e) => {
      if (roleFilter !== 'ALL' && String(e.role ?? '') !== roleFilter) return false;
      if (!q) return true;
      return (
        (e.name ?? '').toLowerCase().includes(q) ||
        (e.email ?? '').toLowerCase().includes(q) ||
        String(e.role ?? '').toLowerCase().includes(q)
      );
    });
  }, [employees.data, search, roleFilter]);

  const roleCounts = useMemo(() => {
    const all = employees.data ?? [];
    const counts: Record<string, number> = { ALL: all.length };
    all.forEach((e) => {
      const r = String(e.role ?? 'UNKNOWN');
      counts[r] = (counts[r] ?? 0) + 1;
    });
    return counts;
  }, [employees.data]);

  const onCreated = useCallback(
    (email: string) => {
      setFreshEmail(email);
      // Clear any filter that would hide the new row, then refetch.
      setQuery('');
      setRoleFilter('ALL');
      employees.reload();
      availableList.reload();
    },
    [employees, availableList]
  );

  const filters = ['ALL', 'EXPERT', 'ADMIN', 'SUPER_ADMIN'];

  return (
    <div className="rise">
      <div style={{ marginBottom: 'var(--s5)' }}>
        <h1 className="t-h1">Add expert</h1>
        <p className="t-sm text-dim" style={{ marginTop: 4 }}>
          Create employee accounts and review everyone with access to the platform.
        </p>
      </div>

      <div className="ax-cols">
        <CreateExpertForm onCreated={onCreated} isSuperAdmin={isSuperAdmin} />

        <section className="card">
          <div className="card-head">
            <div>
              <h2 className="t-h3">All employees</h2>
              <p className="t-xs text-dim" style={{ marginTop: 2 }}>
                {employees.loading
                  ? 'Loading…'
                  : `${rows.length} of ${employees.data?.length ?? 0} shown`}
              </p>
            </div>
            <Button size="sm" onClick={employees.reload} loading={employees.loading}>
              <RotateCw size={13} /> Refresh
            </Button>
          </div>

          <div style={{ padding: 'var(--s4) var(--s5)', display: 'grid', gap: 'var(--s3)' }}>
            <div className="ord-search" style={{ maxWidth: 'none' }}>
              <Search size={14} />
              <input className="input" value={query} onChange={(e) => setQuery(e.target.value)}
                     placeholder="Search by name, email or role…" aria-label="Search employees" />
              {query && (
                <button type="button" className="clear" onClick={() => setQuery('')}
                        aria-label="Clear search">
                  <X size={13} />
                </button>
              )}
            </div>

            <div className="seg" role="group" aria-label="Filter by role">
              {filters.map((r) => (
                <button key={r} type="button" className={roleFilter === r ? 'on' : ''}
                        onClick={() => setRoleFilter(r)} aria-pressed={roleFilter === r}>
                  {r === 'ALL' ? 'All' : r.replace('_', ' ').toLowerCase()}
                  {roleCounts[r] != null && ` (${roleCounts[r]})`}
                </button>
              ))}
            </div>
          </div>

          {employees.loading && (
            <div style={{ padding: '0 var(--s5) var(--s5)', display: 'grid', gap: 'var(--s3)' }}>
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} h={46} />)}
            </div>
          )}

          {employees.error && <ErrorState message={employees.error} onRetry={employees.reload} />}

          {!employees.loading && !employees.error && rows.length === 0 && (
            <EmptyState
              icon={<Users2 size={18} />}
              title={query || roleFilter !== 'ALL' ? 'No employees match' : 'No employees yet'}
              hint={query || roleFilter !== 'ALL'
                ? 'Try a different search term or clear the role filter.'
                : 'Accounts you create appear here immediately.'}
              action={(query || roleFilter !== 'ALL') && (
                <Button size="sm" onClick={() => { setQuery(''); setRoleFilter('ALL'); }}>
                  Clear filters
                </Button>
              )}
            />
          )}

          {rows.map((e: EmployeeDTO) => {
            const free = availableIds.has(e.id);
            const role = String(e.role ?? '—');
            const isFresh = freshEmail != null && e.email === freshEmail;
            return (
              <div className={`ax-emp${isFresh ? ' fresh' : ''}`} key={e.id}>
                <span className="avatar" aria-hidden>
                  {(e.name ?? e.email ?? '?').charAt(0).toUpperCase()}
                </span>

                <div className="ax-emp-main">
                  <div className="t-sm truncate" style={{ fontWeight: 600 }}>
                    {e.name ?? '—'}
                    {isFresh && (
                      <span className="t-xs" style={{ color: 'var(--accent-text)', marginLeft: 6 }}>
                        just added
                      </span>
                    )}
                  </div>
                  <div className="t-xs text-dim truncate">{e.email ?? '—'}</div>
                </div>

                <div className="ax-emp-side">
                  {/* Dot AND text — availability never relies on colour alone. */}
                  <span className="t-xs text-dim" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span className={`ax-dot ${availClass(free)}`} aria-hidden />
                    {free ? 'available' : 'not available'}
                  </span>
                  <Badge tone={ROLE_TONE[role] ?? 'neutral'}>{role.replace('_', ' ').toLowerCase()}</Badge>
                  <Badge tone={e.active ? 'success' : 'danger'} dot>
                    {e.active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </div>
            );
          })}
        </section>
      </div>
    </div>
  );
}
