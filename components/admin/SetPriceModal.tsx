'use client';

import { useCallback, useEffect, useState } from 'react';
import { Modal } from '@/components/shared/Modal';
import { useToast } from '@/hooks/useToast';
import { ordersApi } from '@/lib/api/orders';
import { fmtOrderId, formatCurrency } from '@/lib/utils/format';
import type { OrderDTO } from '@/types';

interface Props {
  order: OrderDTO | null;
  onClose: () => void;
  onSaved: () => void;
}

export function SetPriceModal({ order, onClose, onSaved }: Props) {
  const { showToast } = useToast();
  const [price, setPrice] = useState('');
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);

  // Prefill with the existing price so an edit starts from the current value.
  useEffect(() => {
    setPrice(order?.price != null ? String(order.price) : '');
    setError('');
    setOk('');
  }, [order]);

  const submit = useCallback(async () => {
    setError('');
    setOk('');
    const value = parseFloat(price);
    if (!value || value <= 0) {
      setError('⚠️ Enter a valid price greater than 0.');
      return;
    }
    if (!order) return;

    setBusy(true);
    try {
      await ordersApi.setPrice(order.id, value);
      setOk(`✅ Price ${formatCurrency(value)} set for order ${fmtOrderId(order.id)}!`);
      showToast(`Price set for ${fmtOrderId(order.id)}.`, 'success');
      // Brief pause so the success line is readable before the modal closes,
      // matching the original's 1.4s delay.
      setTimeout(() => {
        onSaved();
        onClose();
      }, 1400);
    } catch (e) {
      setError(`⚠️ ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }, [price, order, showToast, onSaved, onClose]);

  return (
    <Modal
      isOpen={order != null}
      onClose={onClose}
      title={<>💰 Set Price — {fmtOrderId(order?.id ?? null)}</>}
      maxWidth="440px"
      closeOnOverlay={!busy}
      labelledBy="set-price-title"
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={submit} disabled={busy}>
            {busy ? 'Saving…' : '💰 Update Price'}
          </button>
        </>
      }
    >
      {error && <div className="alert error" role="alert">{error}</div>}
      {ok && <div className="alert success" role="status">{ok}</div>}

      <div className="detail-item">
        <span className="detail-lbl">Subject</span>
        <span className="detail-val">{order?.subject ?? '—'}</span>
      </div>
      <div className="detail-item">
        <span className="detail-lbl">Current price</span>
        <span className="detail-val">
          {order?.price != null ? formatCurrency(order.price) : 'Not set'}
        </span>
      </div>

      <div className="fl" style={{ marginTop: 16 }}>
        <label htmlFor="price-input">New Price (USD)</label>
        <input
          id="price-input"
          type="number"
          min="0"
          step="0.01"
          className="fi"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void submit(); }}
          placeholder="0.00"
          disabled={busy}
        />
      </div>
    </Modal>
  );
}
