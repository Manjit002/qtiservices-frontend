'use client';

/**
 * Availability is an expert concept — admins and super admins are never in
 * GET /admin/experts/available, so for them "not available" was technically
 * true and practically misleading. Non-expert roles get a quiet dash instead.
 *
 * Dot AND word, so availability never relies on colour alone.
 */
export function AvailabilityText({
  role, free, loading = false, size = 'sm',
}: { role: unknown; free: boolean; loading?: boolean; size?: 'sm' | 'xs' }) {
  if (String(role ?? '') !== 'EXPERT') {
    return <span className={`t-${size} text-faint`} title="Availability applies to experts only">—</span>;
  }
  return (
    <span className={`t-${size}`} style={{ display: 'flex', alignItems: 'center', gap: size === 'sm' ? 6 : 5 }}>
      <span className={`ax-dot ${free ? 'available' : 'offline'}`} aria-hidden />
      {loading ? '—' : free ? 'available' : 'not available'}
    </span>
  );
}
