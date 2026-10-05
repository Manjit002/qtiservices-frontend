'use client';

import { useCallback, useEffect, useState, type KeyboardEvent } from 'react';
import { Check } from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import { expertApi } from '@/lib/api/expert';
import type { AvailabilityStatus } from '@/types';

/**
 * What each status means, in terms the expert can act on. The assign screen
 * lists experts from GET /admin/experts/available (availability = AVAILABLE),
 * so "appear in the list admins assign from" is literally what changes.
 */
export const AVAILABILITY: { key: AvailabilityStatus; label: string; hint: string; color: string }[] = [
  { key: 'AVAILABLE', label: 'Available', hint: 'You appear in the list admins assign new orders from.', color: 'var(--success)' },
  { key: 'BUSY', label: 'Busy', hint: 'Hidden from that list while you finish current work.', color: 'var(--warning)' },
  { key: 'OFFLINE', label: 'Offline', hint: 'Hidden from that list while you are away.', color: 'var(--text-faint)' },
];

interface Props {
  /** Current status from GET /expert/profile; null while it loads. */
  initial: AvailabilityStatus | null | undefined;
  compact?: boolean;
  onChanged?: (next: AvailabilityStatus) => void;
}

/**
 * Availability switch (POST /expert/status). A radio group: one choice, arrow
 * keys move between options, and the change is optimistic with a rollback if
 * the request fails — the control never claims a state the server rejected.
 */
export function AvailabilityControl({ initial, compact = false, onChanged }: Props) {
  const { showToast } = useToast();
  const [status, setStatus] = useState<AvailabilityStatus | null>(initial ?? null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (initial) setStatus(initial); }, [initial]);

  const choose = useCallback(async (next: AvailabilityStatus) => {
    if (saving || next === status) return;
    const previous = status;
    setStatus(next);
    setSaving(true);
    try {
      await expertApi.setStatus(next);
      const label = AVAILABILITY.find((a) => a.key === next)?.label ?? next;
      showToast(`You're now ${label.toLowerCase()}.`, 'success');
      onChanged?.(next);
    } catch (err) {
      setStatus(previous);
      showToast((err as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  }, [saving, status, showToast, onChanged]);

  const onKeyDown = (e: KeyboardEvent, i: number) => {
    const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const next = AVAILABILITY[(i + d + AVAILABILITY.length) % AVAILABILITY.length];
    void choose(next.key);
    const group = (e.currentTarget as HTMLElement).parentElement;
    (group?.children[(i + d + AVAILABILITY.length) % AVAILABILITY.length] as HTMLElement | undefined)?.focus();
  };

  const selectedIndex = Math.max(0, AVAILABILITY.findIndex((a) => a.key === status));

  const current = AVAILABILITY.find((a) => a.key === status);

  return (
    <>
    <div className={`xp-avail${compact ? ' compact' : ''}`} role="radiogroup" aria-label="Your availability" aria-busy={saving}>
      {AVAILABILITY.map((a, i) => {
        const on = a.key === status;
        return (
          <button
            key={a.key}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={i === selectedIndex ? 0 : -1}
            className="xp-avail-opt"
            onClick={() => void choose(a.key)}
            onKeyDown={(e) => onKeyDown(e, i)}
            disabled={saving && !on}
          >
            <span className="xp-avail-dot" style={{ background: a.color }} aria-hidden />
            <span style={{ minWidth: 0 }}>
              <span className="xp-avail-title">{a.label}</span>
              <span className="xp-avail-hint">{a.hint}</span>
            </span>
            {on && <Check size={15} className="xp-avail-check" aria-hidden />}
          </button>
        );
      })}
    </div>
    {/* The compact segments drop the per-option hints, so say what the
        current choice means underneath — the one that matters right now. */}
    {compact && (
      <p className="xp-avail-note" aria-live="polite">
        {current ? current.hint : 'Choose a status so admins know whether to assign you work.'}
      </p>
    )}
    </>
  );
}
