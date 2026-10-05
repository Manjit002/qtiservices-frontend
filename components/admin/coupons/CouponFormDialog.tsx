'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Info, Ticket } from 'lucide-react';
import { Modal } from '@/components/shared/Modal';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/hooks/useToast';
import { couponsApi } from '@/lib/api/coupons';
import {
  EMPTY_COUPON, buildCouponPayload, couponToFields, validateCoupon,
  type CouponFields,
} from '@/lib/utils/coupon';
import { COUPON_DISCOUNT_TYPES, type Coupon } from '@/types';

interface Props {
  /** null = closed; a coupon = edit; 'new' = create. */
  target: Coupon | 'new' | null;
  onClose: () => void;
  onSaved: () => void;
}

export function CouponFormDialog({ target, onClose, onSaved }: Props) {
  const { showToast } = useToast();
  const editing = target !== null && target !== 'new';
  const coupon = editing ? (target as Coupon) : null;

  const [f, setF] = useState<CouponFields>(EMPTY_COUPON);
  const [errors, setErrors] = useState<Partial<Record<keyof CouponFields, string>>>({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (target === null) return;
    setF(coupon ? couponToFields(coupon) : EMPTY_COUPON);
    setErrors({});
    setFormError('');
  }, [target, coupon]);

  const set = <K extends keyof CouponFields>(k: K, v: CouponFields[K]) => {
    setF((p) => ({ ...p, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
    setFormError('');
  };

  const submit = useCallback(async () => {
    if (busy) return;                                   // duplicate-submit guard
    const next = validateCoupon(f, coupon?.usedCount);
    setErrors(next);
    if (Object.keys(next).length) {
      setFormError('Fix the highlighted fields before saving.');
      return;
    }

    setBusy(true);
    setFormError('');
    try {
      const body = buildCouponPayload(f);
      if (coupon) await couponsApi.update(coupon.id, body);
      else await couponsApi.create(body);
      showToast(`Coupon ${body.code} ${coupon ? 'updated' : 'created'}.`, 'success');
      onSaved();
      onClose();
    } catch (e) {
      // The service throws readable messages — "Coupon code already exists",
      // "Percentage discount cannot exceed 100" — so surface them verbatim
      // rather than replacing them with a generic failure.
      setFormError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [busy, f, coupon, showToast, onSaved, onClose]);

  return (
    <Modal
      isOpen={target !== null}
      onClose={onClose}
      maxWidth="520px"
      closeOnOverlay={!busy}
      labelledBy="coupon-form-title"
      title={
        <span id="coupon-form-title" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <Ticket size={16} /> {coupon ? `Edit ${coupon.code}` : 'New coupon'}
        </span>
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant="primary" onClick={submit} loading={busy}>
            {coupon ? 'Save changes' : 'Create coupon'}
          </Button>
        </>
      }
    >
      {formError && (
        <div className="alert error" role="alert">
          <AlertTriangle size={13} style={{ verticalAlign: -2, marginRight: 5 }} />
          {formError}
        </div>
      )}

      <div className="cp-form" style={{ padding: 0 }}>
        <div className="fl">
          <label htmlFor="cp-code">Coupon code<span className="cp-req">*</span></label>
          <input
            id="cp-code"
            className="fi"
            value={f.code}
            disabled={busy}
            autoComplete="off"
            style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', letterSpacing: '.04em' }}
            /* Uppercased as typed — the service stores it uppercase, so the
               field should not show something different from what is saved. */
            onChange={(e) => set('code', e.target.value.toUpperCase())}
            placeholder="SAVE20"
            aria-invalid={Boolean(errors.code)}
          />
          {errors.code && <span className="field-error">{errors.code}</span>}
        </div>

        <div className="fl">
          <label>Discount type<span className="cp-req">*</span></label>
          <div className="cp-types" role="radiogroup" aria-label="Discount type">
            {COUPON_DISCOUNT_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={f.discountType === t}
                className={`cp-type${f.discountType === t ? ' on' : ''}`}
                disabled={busy}
                onClick={() => set('discountType', t)}
              >
                {t === 'PERCENTAGE' ? 'Percentage (%)' : 'Fixed amount'}
              </button>
            ))}
          </div>
        </div>

        <div className="cp-grid">
          <div className="fl">
            <label htmlFor="cp-value">
              Discount value<span className="cp-req">*</span>
              <span className="text-faint">
                {f.discountType === 'PERCENTAGE' ? ' · max 100' : ' · amount'}
              </span>
            </label>
            <input id="cp-value" type="number" step="0.01" min="0" className="fi"
                   value={f.discountValue} disabled={busy}
                   max={f.discountType === 'PERCENTAGE' ? 100 : undefined}
                   onChange={(e) => set('discountValue', e.target.value)}
                   placeholder={f.discountType === 'PERCENTAGE' ? '20' : '50.00'}
                   aria-invalid={Boolean(errors.discountValue)} />
            {errors.discountValue && <span className="field-error">{errors.discountValue}</span>}
          </div>

          <div className="fl">
            <label htmlFor="cp-limit">Usage limit</label>
            <input id="cp-limit" type="number" min="1" step="1" className="fi"
                   value={f.usageLimit} disabled={busy}
                   onChange={(e) => set('usageLimit', e.target.value)}
                   placeholder="Unlimited"
                   aria-invalid={Boolean(errors.usageLimit)} />
            {errors.usageLimit
              ? <span className="field-error">{errors.usageLimit}</span>
              : <span className="t-xs text-faint">Leave blank for unlimited.</span>}
          </div>
        </div>

        <div className="fl">
          <label htmlFor="cp-expiry">Expiry date &amp; time</label>
          <input id="cp-expiry" type="datetime-local" className="fi"
                 value={f.expiryDate} disabled={busy}
                 onChange={(e) => set('expiryDate', e.target.value)}
                 aria-invalid={Boolean(errors.expiryDate)} />
          {errors.expiryDate
            ? <span className="field-error">{errors.expiryDate}</span>
            : <span className="t-xs text-faint">Leave blank for a coupon that never expires.</span>}
        </div>

        <div className="cp-switch-row">
          <span>
            <span className="t-sm" style={{ fontWeight: 600, display: 'block' }}>Active</span>
            <span className="t-xs text-dim">Inactive coupons are rejected at checkout.</span>
          </span>
          <button type="button" role="switch" aria-checked={f.active} disabled={busy}
                  aria-label="Active" onClick={() => set('active', !f.active)}
                  className={`theme-switch${f.active ? ' on' : ''}`}>
            <span className="theme-knob" />
          </button>
        </div>

        {coupon && (
          <div className="cp-note">
            <Info size={12} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>
              Redeemed <strong>{coupon.usedCount}</strong> time
              {coupon.usedCount === 1 ? '' : 's'}. The usage limit cannot be set below
              that, and the redemption count itself is managed by the backend.
            </span>
          </div>
        )}
      </div>
    </Modal>
  );
}
