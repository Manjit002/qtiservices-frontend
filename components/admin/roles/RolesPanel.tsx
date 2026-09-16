'use client';

import { useCallback, useMemo, useState } from 'react';
import { Search, X, RotateCw, Users2, ShieldAlert, Info } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Skeleton, SkeletonRows, EmptyState, ErrorState } from '@/components/ui/States';
import { useAsync } from '@/hooks/useAsync';
import { useDebounce } from '@/hooks/useDebounce';
import { expertsApi } from '@/lib/api/experts';
import { RoleAssignment, ROLE_TONE, pretty } from './RoleAssignment';
import { PermissionEditor } from './PermissionEditor';
import { ASSIGNABLE_ROLES, PERMISSION_LABEL, ROLE_SUMMARY } from '@/types/employee';
import type { EmployeeDTO } from '@/types';
import './roles.css';
import '@/components/admin/orders.css';
import '@/components/admin/experts/experts.css';

interface Props {
  isSuperAdmin: boolean;
}

/** The employee DTO carries no availability, so membership in the
 *  available-experts list is the only knowable answer. */
function availClass(isAvailable: boolean): string {
  return isAvailable ? 'available' : 'offline';
}

export function RolesPanel({ isSuperAdmin }: Props) {
  const employees = useAsync((s) => expertsApi.listEmployees(s), []);
  // Availability is absent from the employee DTO — resolve it from the
  // endpoint that actually knows.
  const availableList = useAsync((s) => expertsApi.listAvailable(s), []);
  const roles = useAsync((s) => expertsApi.listRoles(s), []);

  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const search = useDebounce(query, 250);

  /**
   * The employee endpoint returns no permissions — the source hardcodes an
   * empty array and shows "No permissions" for everyone. Joining each
   * employee's role to GET /admin/roles gives the real list, from two real
   * endpoints, without inventing anything.
   */
  const permsByRole = useMemo(() => {
    const m = new Map<string, string[]>();
    (roles.data ?? []).forEach((r) => { if (r.name) m.set(r.name, r.permissions ?? []); });
    return m;
  }, [roles.data]);

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

  const refreshAll = useCallback(() => {
    employees.reload();
    roles.reload();
    availableList.reload();
  }, [employees, roles, availableList]);

  const counts = useMemo(() => {
    const all = employees.data ?? [];
    const c: Record<string, number> = { ALL: all.length };
    all.forEach((e) => {
      const r = String(e.role ?? 'UNKNOWN');
      c[r] = (c[r] ?? 0) + 1;
    });
    return c;
  }, [employees.data]);

  // Frontend gating is UX; the backend authorises every one of these calls.
  if (!isSuperAdmin) {
    return (
      <div className="rise">
        <section className="card">
          <EmptyState
            icon={<ShieldAlert size={18} />}
            title="Super admin only"
            hint="Role and permission management is restricted. Ask a super admin if you need access changed."
          />
        </section>
      </div>
    );
  }

  const permsFor = (e: EmployeeDTO) => permsByRole.get(String(e.role ?? '')) ?? [];

  return (
    <div className="rise">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--s4)', flexWrap: 'wrap', marginBottom: 'var(--s5)' }}>
        <div>
          <h1 className="t-h1">Roles &amp; access</h1>
          <p className="t-sm text-dim" style={{ marginTop: 4 }}>
            Control who can do what across the platform.
          </p>
        </div>
        <Button size="sm" onClick={refreshAll} loading={employees.loading || roles.loading}>
          <RotateCw size={13} /> Refresh
        </Button>
      </div>

      <div className="ra-top">
        <RoleAssignment
          employees={employees.data ?? []}
          loading={employees.loading}
          onUpdated={refreshAll}
        />

        <section className="card">
          <div className="card-head">
            <div>
              <h2 className="t-h3">Role reference</h2>
              <p className="t-xs text-dim" style={{ marginTop: 2 }}>
                What each role does, and the permissions it carries
              </p>
            </div>
          </div>

          {roles.loading && (
            <div style={{ padding: 'var(--s5)', display: 'grid', gap: 'var(--s4)' }}>
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} h={64} />)}
            </div>
          )}

          {!roles.loading && ASSIGNABLE_ROLES.map((r) => {
            const perms = permsByRole.get(r) ?? [];
            return (
              <div className="ra-role" key={r}>
                <div className="ra-role-head">
                  <Badge tone={ROLE_TONE[r] ?? 'neutral'}>{pretty(r)}</Badge>
                  <span className="t-xs text-dim">
                    {counts[r] ?? 0} {counts[r] === 1 ? 'person' : 'people'}
                  </span>
                </div>
                <p className="t-sm text-mid" style={{ marginTop: 6 }}>{ROLE_SUMMARY[r]}</p>
                {perms.length > 0 ? (
                  <div className="ra-perms">
                    {perms.map((p) => (
                      <span className="ra-perm on" key={p}>{PERMISSION_LABEL[p] ?? p}</span>
                    ))}
                  </div>
                ) : (
                  <p className="t-xs text-faint" style={{ marginTop: 6, fontStyle: 'italic' }}>
                    No explicit permissions recorded for this role.
                  </p>
                )}
              </div>
            );
          })}

          {roles.error && <ErrorState message={roles.error} onRetry={roles.reload} />}
        </section>
      </div>

      <PermissionEditor roles={roles.data ?? []} loading={roles.loading} onSaved={refreshAll} />

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
        </div>

        <div style={{ padding: 'var(--s4) var(--s5)', display: 'grid', gap: 'var(--s3)' }}>
          <div className="ord-search" style={{ maxWidth: 'none' }}>
            <Search size={14} />
            <input className="input" value={query} onChange={(e) => setQuery(e.target.value)}
                   placeholder="Search name, email or role…" aria-label="Search employees" />
            {query && (
              <button type="button" className="clear" onClick={() => setQuery('')}
                      aria-label="Clear search">
                <X size={13} />
              </button>
            )}
          </div>
          <div className="seg" role="group" aria-label="Filter by role">
            {['ALL', ...ASSIGNABLE_ROLES].map((r) => (
              <button key={r} type="button" className={roleFilter === r ? 'on' : ''}
                      onClick={() => setRoleFilter(r)} aria-pressed={roleFilter === r}>
                {r === 'ALL' ? 'All' : pretty(r)}{counts[r] != null && ` (${counts[r]})`}
              </button>
            ))}
          </div>
        </div>

        {/* Explains why permissions look identical within a role. */}
        {!roles.loading && !employees.loading && rows.length > 0 && (
          <div className="oe-note" style={{ margin: '0 var(--s5) var(--s4)' }}>
            <Info size={14} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>
              Permissions come from the employee&rsquo;s <strong>role</strong>, so everyone
              with the same role has the same access. Edit them above.
            </span>
          </div>
        )}

        <div className="ra-table-wrap table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Email</th>
                <th scope="col">Role</th>
                <th scope="col">Permissions</th>
                <th scope="col">Availability</th>
                <th scope="col">Account</th>
              </tr>
            </thead>
            <tbody>
              {employees.loading && <SkeletonRows rows={5} cols={6} />}
              {employees.error && (
                <tr><td colSpan={6}><ErrorState message={employees.error} onRetry={refreshAll} /></td></tr>
              )}
              {!employees.loading && !employees.error && rows.length === 0 && (
                <tr><td colSpan={6}>
                  <EmptyState
                    icon={<Users2 size={18} />}
                    title={query || roleFilter !== 'ALL' ? 'No employees match' : 'No employees'}
                    hint={query || roleFilter !== 'ALL'
                      ? 'Try a different search or clear the role filter.'
                      : 'Accounts created in Add expert appear here.'}
                    action={(query || roleFilter !== 'ALL') && (
                      <Button size="sm" onClick={() => { setQuery(''); setRoleFilter('ALL'); }}>
                        Clear filters
                      </Button>
                    )}
                  />
                </td></tr>
              )}
              {rows.map((e) => {
                const free = availableIds.has(e.id);
                const perms = permsFor(e);
                return (
                  <tr key={e.id}>
                    <td style={{ fontWeight: 600 }}>{e.name ?? '—'}</td>
                    <td className="t-sm text-dim">{e.email ?? '—'}</td>
                    <td><Badge tone={ROLE_TONE[String(e.role ?? '')] ?? 'neutral'}>
                      {pretty(String(e.role ?? '—'))}
                    </Badge></td>
                    <td>
                      {perms.length > 0 ? (
                        <div className="ra-emp-perms">
                          {perms.map((p) => (
                            <span className="ra-perm" key={p}>{PERMISSION_LABEL[p] ?? p}</span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-faint t-sm">No explicit permissions</span>
                      )}
                    </td>
                    <td>
                      <span className="t-sm" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span className={`ax-dot ${availClass(free)}`} aria-hidden />
                        {free ? 'available' : 'not available'}
                      </span>
                    </td>
                    <td>
                      <Badge tone={e.active ? 'success' : 'danger'} dot>
                        {e.active ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ── Mobile cards ── */}
        <div className="ra-cards">
          {!employees.loading && rows.map((e) => {
            const free = availableIds.has(e.id);
            const perms = permsFor(e);
            return (
              <article className="ra-card" key={e.id}>
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
                <div className="ra-emp-perms" style={{ marginTop: 'var(--s3)' }}>
                  {perms.length > 0
                    ? perms.map((p) => <span className="ra-perm" key={p}>{PERMISSION_LABEL[p] ?? p}</span>)
                    : <span className="text-faint t-xs">No explicit permissions</span>}
                </div>
                <div style={{ display: 'flex', gap: 'var(--s3)', marginTop: 'var(--s3)', alignItems: 'center' }}>
                  <span className="t-xs" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span className={`ax-dot ${availClass(free)}`} aria-hidden />
                    {free ? 'available' : 'not available'}
                  </span>
                  <Badge tone={e.active ? 'success' : 'danger'} dot>
                    {e.active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
