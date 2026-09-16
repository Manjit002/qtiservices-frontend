'use client';

import { useCallback, useEffect, useState } from 'react';
import { ErrorState } from '@/components/shared/ErrorState';
import { Spinner } from '@/components/shared/Spinner';
import { useAsync } from '@/hooks/useAsync';
import { useToast } from '@/hooks/useToast';
import { expertApi } from '@/lib/api/expert';
import type { AvailabilityStatus } from '@/types';

const STATUS_OPTIONS: { key: AvailabilityStatus; label: string; dot: string }[] = [
  { key: 'AVAILABLE', label: 'Available', dot: 'available' },
  { key: 'BUSY', label: 'Busy', dot: 'busy' },
  { key: 'OFFLINE', label: 'Offline', dot: 'offline' },
];

/** Read-only profile plus the availability control (POST /expert/status). */
export function ExpertProfilePanel() {
  const { showToast } = useToast();
  const { data, loading, error, reload } = useAsync((signal) => expertApi.profile(signal), []);
  const [status, setStatus] = useState<AvailabilityStatus>('AVAILABLE');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data?.availabilityStatus) setStatus(data.availabilityStatus);
  }, [data]);

  const handleStatusChange = useCallback(
    async (next: AvailabilityStatus) => {
      const previous = status;
      setStatus(next); // optimistic
      setSaving(true);
      try {
        await expertApi.setStatus(next);
        showToast(`Availability set to ${next}.`, 'success');
      } catch (err) {
        setStatus(previous); // roll back on failure
        showToast((err as Error).message, 'error');
      } finally {
        setSaving(false);
      }
    },
    [status, showToast],
  );

  if (loading && !data) return <div style={{ textAlign: 'center', padding: 60 }}><Spinner size="lg" /></div>;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const p = data;

  return (
    <div style={{ display: 'grid', gap: 20, gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
      <div className="card">
        <h2 className="card-title">👤 My Profile</h2>
        <dl style={{ display: 'grid', gap: 14 }}>
          {[
            ['Name', p?.name ?? '—'],
            ['Email', p?.email ?? '—'],
            ['Role', p?.role ?? '—'],
            ['Phone', p?.phone ?? '—'],
            ['Account', p?.active === false ? 'Inactive' : 'Active'],
          ].map(([label, value]) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 14, borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
              <dt style={{ fontSize: '.72rem', color: 'var(--muted)', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase' }}>
                {label}
              </dt>
              <dd style={{ fontSize: '.85rem', fontWeight: 600, textAlign: 'right', wordBreak: 'break-word' }}>{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="card">
        <h2 className="card-title">🟢 Availability</h2>
        <p style={{ fontSize: '.8rem', color: 'var(--muted)', lineHeight: 1.7, marginBottom: 18 }}>
          Admins see this when choosing who to assign new orders to.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              className={`avail-opt ${status === opt.key ? 'active' : ''}`}
              onClick={() => handleStatusChange(opt.key)}
              disabled={saving}
              aria-pressed={status === opt.key}
            >
              <span className={`avail-dot ${opt.dot}`} aria-hidden />
              <span style={{ flex: 1, textAlign: 'left' }}>{opt.label}</span>
              {status === opt.key && <span aria-hidden>✓</span>}
            </button>
          ))}
        </div>
        {saving && <div style={{ marginTop: 12, textAlign: 'center' }}><Spinner size="sm" /></div>}
      </div>
    </div>
  );
}
