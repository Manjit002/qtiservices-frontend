'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ShieldAlert, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { useToast } from '@/hooks/useToast';
import { paymentsApi } from '@/lib/api/payments';
import { fmtOrderId, formatCurrency } from '@/lib/utils/format';

interface Props {
  /** Pre-filled when an order is selected, but editable — this tool is cross-order. */
  orderId: string;
  onOrderIdChange: (v: string) => void;
  paymentIntentId: string;
  onPaymentIntentChange: (v: string) => void;
  /** Called after a successful attach so the caller can refetch. */
  onVerified: (orderId: number) => void;
  /** Bumped by the parent to move focus here when pre-filling from a payment row. */
  focusToken: number;
}

export function ManualVerification({
  orderId, onOrderIdChange, paymentIntentId, onPaymentIntentChange, onVerified, focusToken,
}: Props) {
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const piRef = useRef<HTMLInputElement>(null);

  // Pre-filling from a payment row should land the caret where the admin will
  // act, not leave them hunting for the form.
  useEffect(() => {
    if (focusToken > 0) {
      piRef.current?.focus();
      piRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [focusToken]);

  const idNum = parseInt(orderId, 10);
  const ready = !Number.isNaN(idNum) && idNum > 0 && paymentIntentId.trim().length > 0;

  const run = useCallback(async () => {
    setConfirming(false);
    setBusy(true);
    setError('');
    try {
      const res = await paymentsApi.manualVerification(idNum, paymentIntentId.trim());
      const amt = res?.amount != null ? formatCurrency(res.amount) : '';
      showToast(
        `Payment ${amt} verified and attached to ${fmtOrderId(idNum)}.`.replace('  ', ' '),
        'success',
        6000
      );
      onPaymentIntentChange('');
      onVerified(idNum);
    } catch (e) {
      // Surface the backend's own message — it distinguishes amount mismatch,
      // already-attached, intent-not-found and balance overflow, and that
      // detail is the whole value of the response.
      const msg = (e as Error).message;
      setError(msg);
      showToast(msg, 'error', 7000);
    } finally {
      setBusy(false);
    }
  }, [idNum, paymentIntentId, showToast, onPaymentIntentChange, onVerified]);

  return (
    <>
      <section className="card">
        <div className="card-head">
          <h2 className="t-h3">Manual verification</h2>
        </div>

        <div style={{ padding: 'var(--s5)' }}>
          <div className="pv-warn">
            <ShieldAlert size={15} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>
              Only use this when the Stripe dashboard confirms the charge succeeded.
              The intent is re-checked against Stripe server-side — amount, remaining
              balance and installment fit are all validated by the backend, and an
              already-attached payment is rejected.
            </span>
          </div>

          {error && <div className="alert error" role="alert">{error}</div>}

          <div className="fl">
            <label htmlFor="mv-order">Order ID</label>
            <input
              id="mv-order"
              type="number"
              className="fi"
              value={orderId}
              onChange={(e) => onOrderIdChange(e.target.value)}
              placeholder="2417"
              disabled={busy}
              inputMode="numeric"
            />
            <span className="t-xs text-faint">
              The numeric ID, without the <code>OD-</code> prefix.
            </span>
          </div>

          <div className="fl">
            <label htmlFor="mv-pi">Stripe payment intent ID</label>
            <input
              id="mv-pi"
              ref={piRef}
              className="fi"
              value={paymentIntentId}
              onChange={(e) => onPaymentIntentChange(e.target.value)}
              placeholder="pi_3Q..."
              disabled={busy}
              autoComplete="off"
              spellCheck={false}
              style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}
            />
          </div>

          <Button
            variant="primary"
            loading={busy}
            disabled={!ready}
            onClick={() => setConfirming(true)}
            style={{ width: '100%' }}
          >
            <ShieldCheck size={14} /> {busy ? 'Verifying with Stripe' : 'Verify & attach payment'}
          </Button>
        </div>
      </section>

      <ConfirmDialog
        isOpen={confirming}
        title="Manual payment verification"
        message={`Verify payment intent ${paymentIntentId.trim()} against Stripe and attach it to ${fmtOrderId(idNum)}? Only do this if the Stripe dashboard confirms the charge succeeded.`}
        confirmLabel="Verify & attach"
        danger
        busy={busy}
        onConfirm={run}
        onCancel={() => setConfirming(false)}
      />
    </>
  );
}
