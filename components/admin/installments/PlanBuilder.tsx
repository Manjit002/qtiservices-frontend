'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CalendarPlus, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { useToast } from '@/hooks/useToast';
import { installmentsApi } from '@/lib/api/payments';
import { fmtOrderId } from '@/lib/utils/format';
import { seedDates, withSeconds } from '@/lib/utils/installments';
import type { InstallmentPlanType } from '@/types';

interface Props {
  orderId: number;
  /** True when a plan already exists — the call becomes recreate, not create. */
  hasPlan: boolean;
  onDone: () => void;
}

const TYPES: { value: InstallmentPlanType; label: string }[] = [
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'BIWEEKLY', label: 'Bi-weekly' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'CUSTOM', label: 'Custom dates' },
];

const COUNTS = [2, 3, 4, 5, 6];

export function PlanBuilder({ orderId, hasPlan, onDone }: Props) {
  const { showToast } = useToast();
  const [months, setMonths] = useState(2);
  const [type, setType] = useState<InstallmentPlanType>('MONTHLY');
  const [dates, setDates] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  // Seed the pickers so CUSTOM starts from a sensible schedule rather than blanks.
  useEffect(() => {
    if (type === 'CUSTOM') setDates(seedDates(months, 'MONTHLY'));
    else setDates([]);
    setError('');
  }, [type, months]);

  const setDate = (i: number, v: string) =>
    setDates((d) => d.map((x, idx) => (idx === i ? v : x)));

  const validate = useCallback((): string | null => {
    if (type !== 'CUSTOM') return null;
    for (let i = 0; i < months; i += 1) {
      if (!dates[i]) return `Set a date and time for payment ${i + 1}.`;
    }
    // Each date must be strictly after the previous — the source enforces this
    // before submitting, and the backend assumes an ordered schedule.
    for (let i = 1; i < months; i += 1) {
      if (new Date(dates[i] as string) <= new Date(dates[i - 1] as string)) {
        return `Date ${i + 1} must be after date ${i}.`;
      }
    }
    return null;
  }, [type, months, dates]);

  const submit = useCallback(async () => {
    setConfirming(false);
    setBusy(true);
    setError('');
    try {
      /**
       * preferredDates is ALWAYS sent, even as []. The recreate controller
       * calls getPreferredDates().stream() with no null guard, so omitting it
       * throws server-side.
       */
      const body = {
        months,
        type,
        preferredDates: type === 'CUSTOM' ? dates.slice(0, months).map(withSeconds) : [],
      };
      if (hasPlan) await installmentsApi.recreate(orderId, body);
      else await installmentsApi.create(orderId, body);

      showToast(
        `Plan ${hasPlan ? 'recreated' : 'created'} — ${months} × ${type.toLowerCase()} payments.`,
        'success'
      );
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [months, type, dates, hasPlan, orderId, showToast, onDone]);

  const attempt = useCallback(() => {
    const problem = validate();
    if (problem) { setError(problem); return; }
    // Recreate destroys unpaid rows, so it always confirms. Create does not.
    if (hasPlan) setConfirming(true);
    else void submit();
  }, [validate, hasPlan, submit]);

  return (
    <>
      <section className="card">
        <div className="card-head">
          <h2 className="t-h3">{hasPlan ? 'Recreate plan' : 'Create plan'}</h2>
        </div>

        <div style={{ padding: 'var(--s5)' }}>
          {hasPlan && (
            <div className="pv-warn" style={{ marginBottom: 'var(--s4)' }}>
              <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>
                Recreating deletes the <strong>unpaid</strong> installments and rebuilds the
                schedule. Payments that have already settled are untouched.
              </span>
            </div>
          )}

          {error && <div className="alert error" role="alert">{error}</div>}

          <div className="in-edit-grid">
            <div className="fl">
              <label htmlFor="pb-count">Payments</label>
              <select id="pb-count" className="fi" value={months} disabled={busy}
                      onChange={(e) => setMonths(Number(e.target.value))}>
                {COUNTS.map((n) => <option key={n} value={n}>{n} payments</option>)}
              </select>
            </div>
            <div className="fl">
              <label htmlFor="pb-type">Schedule</label>
              <select id="pb-type" className="fi" value={type} disabled={busy}
                      onChange={(e) => setType(e.target.value as InstallmentPlanType)}>
                {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>

          {type === 'CUSTOM' && (
            <div className="in-dates">
              <span className="t-xs text-dim">Each date must be after the one before it.</span>
              {Array.from({ length: months }).map((_, i) => (
                <div className="in-date-row" key={i}>
                  <span className="in-date-n">{i + 1}.</span>
                  <input
                    type="datetime-local"
                    className="fi"
                    value={dates[i] ?? ''}
                    disabled={busy}
                    aria-label={`Due date for payment ${i + 1}`}
                    onChange={(e) => setDate(i, e.target.value)}
                  />
                </div>
              ))}
            </div>
          )}

          <Button variant="primary" loading={busy} onClick={attempt}
                  style={{ width: '100%', marginTop: 'var(--s4)' }}>
            {hasPlan ? <RefreshCw size={14} /> : <CalendarPlus size={14} />}
            {busy ? 'Working…' : hasPlan ? 'Recreate plan' : 'Create plan'}
          </Button>
        </div>
      </section>

      <ConfirmDialog
        isOpen={confirming}
        title="Recreate installment plan"
        message={`Rebuild ${fmtOrderId(orderId)} as ${months} × ${type.toLowerCase()} payments? Unpaid installments will be deleted. Settled payments are not affected.`}
        confirmLabel="Recreate plan"
        danger
        busy={busy}
        onConfirm={submit}
        onCancel={() => setConfirming(false)}
      />
    </>
  );
}
