'use client';

import { useCallback, useEffect, useState } from 'react';
import { Save, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/States';
import { useToast } from '@/hooks/useToast';
import { expertsApi } from '@/lib/api/experts';
import { ALL_PERMISSIONS, PERMISSION_LABEL, ASSIGNABLE_ROLES } from '@/types/employee';
import { pretty } from './RoleAssignment';
import type { RoleDTO } from '@/types';

interface Props {
  roles: RoleDTO[];
  loading: boolean;
  onSaved: () => void;
}

/**
 * Permissions belong to a ROLE, not to an employee.
 *
 * Two paths, both from the source: if the role already exists it is updated
 * with PUT /admin/roles/{id}/permissions (body is a bare array); if it has
 * never been seeded, POST /admin/roles creates it with its permissions.
 */
export function PermissionEditor({ roles, loading, onSaved }: Props) {
  const { showToast } = useToast();
  const [roleName, setRoleName] = useState('');
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const role = roles.find((r) => r.name === roleName) ?? null;

  useEffect(() => {
    setChecked(new Set(role?.permissions ?? []));
  }, [role]);

  const toggle = (p: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p); else next.add(p);
      return next;
    });

  const save = useCallback(async () => {
    if (!roleName) return;
    setBusy(true);
    const list = [...checked];
    try {
      if (role?.id != null) await expertsApi.setRolePermissions(role.id, list);
      else await expertsApi.createRole(roleName, list);
      showToast(`Permissions saved for ${pretty(roleName)}.`, 'success');
      onSaved();
    } catch (e) {
      showToast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  }, [roleName, checked, role, showToast, onSaved]);

  return (
    <section className="card" style={{ marginBottom: 'var(--s5)' }}>
      <div className="card-head">
        <div>
          <h2 className="t-h3">Role permissions</h2>
          <p className="t-xs text-dim" style={{ marginTop: 2 }}>
            Permissions attach to a role — every employee with that role inherits them
          </p>
        </div>
      </div>

      <div style={{ padding: 'var(--s5) var(--s5) 0' }}>
        <div className="fl">
          <label htmlFor="pe-role">Role</label>
          <select id="pe-role" className="fi" value={roleName} disabled={busy || loading}
                  onChange={(e) => setRoleName(e.target.value)}>
            <option value="">{loading ? 'Loading roles…' : '— Select a role —'}</option>
            {ASSIGNABLE_ROLES.map((r) => (
              <option key={r} value={r}>
                {pretty(r)}
                {!roles.some((x) => x.name === r) ? ' (not yet configured)' : ''}
              </option>
            ))}
          </select>
          {roleName && !role && (
            <span className="t-xs text-faint">
              This role has no record yet — saving will create it.
            </span>
          )}
        </div>
      </div>

      {loading && (
        <div className="ra-perm-grid">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} h={36} />)}
        </div>
      )}

      {!loading && roleName && (
        <>
          <div className="ra-perm-grid">
            {ALL_PERMISSIONS.map((p) => {
              const on = checked.has(p);
              return (
                <label key={p} className={`ra-perm-box${on ? ' on' : ''}`}>
                  <input type="checkbox" checked={on} disabled={busy}
                         onChange={() => toggle(p)} />
                  {PERMISSION_LABEL[p] ?? p}
                </label>
              );
            })}
          </div>
          <div style={{ padding: '0 var(--s5) var(--s5)', display: 'flex', gap: 'var(--s3)', alignItems: 'center' }}>
            <span className="t-xs text-dim">
              {checked.size} of {ALL_PERMISSIONS.length} selected
            </span>
            <span style={{ flex: 1 }} />
            <Button variant="primary" size="sm" loading={busy} onClick={save}>
              <Save size={13} /> Save permissions
            </Button>
          </div>
        </>
      )}

      {!loading && !roleName && (
        <div style={{ padding: 'var(--s6) var(--s5)', textAlign: 'center' }}>
          <KeyRound size={20} style={{ color: 'var(--text-faint)', margin: '0 auto var(--s2)' }} />
          <p className="t-sm text-dim">Choose a role to view and edit its permissions.</p>
        </div>
      )}
    </section>
  );
}
