'use client';

import { CalendarClock, CreditCard, ShieldCheck, AlertTriangle, ArrowUpRight, Receipt } from 'lucide-react';
import { Skeleton, EmptyState, ErrorState } from '@/components/ui/States';
import { StatusBadge } from '@/components/ui/Badge';
import { enumValue, formatCurrency, formatDate } from '@/lib/utils/format';
import { isPendingPayment } from '@/types/payment';
import type { PaymentDTO } from '@/types';

interface Props {
  payments: PaymentDTO[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onVerifyManually: (paymentIntentId: string) => void;
}

export function PaymentHistory({ payments, loading, error, onRetry, onVerifyManually }: Props) {
  return (
    <section className="card">
      <div className="card-head">
        <h2 className="t-h3">Payment history</h2>
        {!loading && (
          <span className="t-xs text-dim">
            {payments.length} record{payments.length === 1 ? '' : 's'}
          </span>
        )}
      </div>

      {loading && (
        <div style={{ padding: 'var(--s5)', display: 'grid', gap: 'var(--s3)' }}>
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} h={60} />)}
        </div>
      )}

      {error && <ErrorState message={error} onRetry={onRetry} />}

      {!loading && !error && payments.length === 0 && (
        <EmptyState
          icon={<Receipt size={18} />}
          title="No payments on this order"
          hint="Once a charge is attempted it appears here, whether it succeeded or not."
        />
      )}

      {payments.map((p, i) => {
        const status = enumValue(p.status);
        const pending = isPendingPayment(status);
        const inst = Boolean(p.isInstallment);
        const label = inst
          ? `Installment${p.installmentNumber ? ` #${p.installmentNumber}` : ''}`
          : 'Order payment';

        return (
          <div key={p.id ?? `${p.paymentIntentId}-${i}`} className={`pv-pay${pending ? ' pending' : ''}`}>
            <div className="pv-pay-main">
              <div className="pv-pay-title">
                {inst ? <CalendarClock size={14} /> : <CreditCard size={14} />}
                {label}
              </div>
              <div className="t-xs text-dim" style={{ marginTop: 2 }}>
                {p.createdAt ? formatDate(p.createdAt) : 'No date recorded'}
              </div>

              {p.failureReason && (
                <div className="pv-note" style={{ color: 'var(--danger)' }}>
                  <AlertTriangle size={11} style={{ flexShrink: 0, marginTop: 2 }} />
                  <span>{p.failureReason}</span>
                </div>
              )}
              {p.verifiedBy && (
                <div className="pv-note" style={{ color: 'var(--success)' }}>
                  <ShieldCheck size={11} style={{ flexShrink: 0, marginTop: 2 }} />
                  <span>Verified by {p.verifiedBy}</span>
                </div>
              )}
              {p.paymentIntentId && <div className="pv-pi">{p.paymentIntentId}</div>}
            </div>

            <div className="pv-pay-side">
              <div className="pv-amount">{formatCurrency(p.amount ?? 0)}</div>
              <div style={{ marginTop: 5 }}><StatusBadge status={status} /></div>
              {/* Only offered for a payment that is neither settled nor failed,
                  and only when there is an intent to verify against Stripe. */}
              {pending && p.paymentIntentId && (
                <button
                  type="button"
                  className="act act-danger"
                  style={{ marginTop: 8 }}
                  onClick={() => onVerifyManually(p.paymentIntentId as string)}
                  title="Fill the manual verification form with this payment"
                >
                  <ArrowUpRight size={12} /> Verify manually
                </button>
              )}
            </div>
          </div>
        );
      })}
    </section>
  );
}
