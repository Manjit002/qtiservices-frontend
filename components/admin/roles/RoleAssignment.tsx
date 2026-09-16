'use client';

import { useCallback, useMemo, useState } from 'react';
import { ShieldCheck, ArrowRight, UserCog } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { useToast } from '@/hooks/useToast';
import { expertsApi } from '@/lib/api/experts';
import { ASSIGNABLE_ROLES } from '@/types/employee';
import type { EmployeeDTO } from '@/types';

interface Props {
  employees: EmployeeDTO[];
  loading: boolean;
  onUpdated: () => void;
}

const ROLE_TONE: Record<string, 'accent' | 'info' | 'warning'> = {
  EXPERT: 'accent', ADMIN: 'info', SUPER_ADMIN: 'warning',
};

const pretty = (r: string) => r.replace(/_/g, ' ').toLowerCase();

export function RoleAssignment({ employees, loading, onUpdated }: Props) {
  const { showToast } = useToast();
  const [empId, setEmpId] = useState('');
  const [newRole, setNewRole] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const selected = useMemo(
    () => employees.find((e) => String(e.id) === empId) ?? null,
    [employees, empId]
  );

  const currentRole = String(selected?.role ?? '');
  /** No change means no request — the source fires one regardless. */
  const unchanged = Boolean(newRole) && newRole === currentRole;
  const ready = Boolean(selected && newRole && !unchanged);

  const submit = useCallback(async () => {
    if (!selected || !newRole) return;
    setConfirming(false);
    setBusy(true);
    try {
      // POST /admin/employee/{id}/role?roleName= — query param, not a body.
      await expertsApi.setRole(selected.id, newRole);
      showToast(
        `${selected.name ?? selected.email ?? 'Employee'} is now ${pretty(newRole)}.`,
        'success'
      );
      setEmpId('');
      setNewRole('');
      onUpdated();
    } catch (e) {
      showToast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  }, [selected, newRole, showToast, onUpdated]);

  return (
    <>
      <section className="card">
        <div className="card-head">
          <div>
            <h2 className="t-h3">Assign role</h2>
            <p className="t-xs text-dim" style={{ marginTop: 2 }}>
              Change what an employee can do on the platform
            </p>
          </div>
        </div>

        <div className="ra-fields">
          <div className="fl">
            <label htmlFor="ra-emp">Employee</label>
            <select id="ra-emp" className="fi" value={empId} disabled={busy || loading}
                    onChange={(e) => { setEmpId(e.target.value); setNewRole(''); }}>
              <option value="">{loading ? 'Loading employees…' : '— Select employee —'}</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name || e.email || `Employee ${e.id}`} — {pretty(String(e.role ?? '—'))}
                </option>
              ))}
            </select>
          </div>

          {selected && (
            <>
              <div className="ra-picked">
                <span className="avatar" aria-hidden>
                  {(selected.name ?? selected.email ?? '?').charAt(0).toUpperCase()}
                </span>
                <span style={{ minWidth: 0 }}>
                  <span className="t-sm truncate" style={{ display: 'block', fontWeight: 600 }}>
                    {selected.name ?? '—'}
                  </span>
                  <span className="t-xs text-dim truncate" style={{ display: 'block' }}>
                    {selected.email ?? '—'}
                  </span>
                </span>
              </div>

              <div className="fl">
                <label htmlFor="ra-role">New role</label>
                <select id="ra-role" className="fi" value={newRole} disabled={busy}
                        onChange={(e) => setNewRole(e.target.value)}>
                  <option value="">— Select role —</option>
                  {ASSIGNABLE_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {pretty(r)}{r === currentRole ? ' (current)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {newRole && (
                <div className="ra-change">
                  <div className="ra-change-cell">
                    <div className="ra-change-lbl">Current</div>
                    <Badge tone={ROLE_TONE[currentRole] ?? 'neutral'}>
                      {pretty(currentRole) || '—'}
                    </Badge>
                  </div>
                  <ArrowRight size={16} className="ra-arrow" aria-hidden />
                  <div className="ra-change-cell">
                    <div className="ra-change-lbl">New</div>
                    <Badge tone={unchanged ? 'neutral' : ROLE_TONE[newRole] ?? 'neutral'}>
                      {pretty(newRole)}
                    </Badge>
                  </div>
                </div>
              )}

              {unchanged && (
                <p className="t-xs text-dim" role="status">
                  That is already their role — nothing to update.
                </p>
              )}
            </>
          )}

          <Button variant="primary" loading={busy} disabled={!ready}
                  onClick={() => setConfirming(true)} style={{ width: '100%' }}>
            <UserCog size={14} /> {busy ? 'Updating role…' : 'Update role'}
          </Button>

          {!selected && (
            <p className="t-xs text-faint" style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
              <ShieldCheck size={13} style={{ flexShrink: 0, marginTop: 1 }} />
              Role changes take effect immediately and are enforced by the backend on
              every request.
            </p>
          )}
        </div>
      </section>

      <ConfirmDialog
        isOpen={confirming}
        title="Change role"
        message={`You are changing ${selected?.name ?? selected?.email ?? 'this employee'}'s role from ${pretty(currentRole) || 'none'} to ${pretty(newRole)}. Continue?`}
        confirmLabel="Change role"
        danger={newRole === 'SUPER_ADMIN'}
        busy={busy}
        onConfirm={submit}
        onCancel={() => setConfirming(false)}
      />
    </>
  );
}

export { ROLE_TONE, pretty };
