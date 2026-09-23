'use client';

import { useCallback, useEffect, useState } from 'react';
import { Modal } from '@/components/shared/Modal';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/hooks/useToast';
import { ordersApi } from '@/lib/api/orders';
import { fmtOrderId } from '@/lib/utils/format';
import type { OrderDTO } from '@/types';

interface Props {
  order: OrderDTO | null;
  adminId: number | null;
  onClose: () => void;
  onDeleted: () => void;
}

/**
 * Soft delete. The backend requires an adminId and a reason, and the record
 * remains recoverable from Deleted orders — the copy says so, because "delete"
 * that is reversible should not read as permanent.
 */
export function DeleteOrderModal({ order, adminId, onClose, onDeleted }: Props) {
  const { showToast } = useToast();
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { setReason(''); setError(''); }, [order]);

  const submit = useCallback(async () => {
    if (!order) return;
    if (!reason.trim()) { setError('Give a reason — it is stored with the record.'); return; }
    if (adminId == null) { setError('Could not identify your account. Sign in again.'); return; }

    setBusy(true);
    setError('');
    try {
      await ordersApi.softDelete(order.id, adminId, reason.trim());
      showToast(`${fmtOrderId(order.id)} moved to Deleted orders.`, 'success');
      onDeleted();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [order, reason, adminId, showToast, onDeleted, onClose]);

  return (
    <Modal
      isOpen={order != null}
      onClose={onClose}
      title={<>Delete {fmtOrderId(order?.id ?? null)}</>}
      maxWidth="440px"
      closeOnOverlay={false}
      labelledBy="delete-order-title"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Keep order</Button>
          <Button variant="danger" onClick={submit} loading={busy}>Delete order</Button>
        </>
      }
    >
      {error && <div className="alert error" role="alert">{error}</div>}
      <p className="t-sm" style={{ marginBottom: 'var(--s4)' }}>
        This moves <strong>{order?.subject || fmtOrderId(order?.id ?? null)}</strong> to
        Deleted orders. It stops appearing in the orders list and can be restored from there.
      </p>
      <div className="fl">
        <label htmlFor="del-reason">Reason</label>
        <textarea id="del-reason" className="fi" rows={3} style={{ height: 'auto', padding: '8px 12px' }}
                  value={reason} onChange={(e) => setReason(e.target.value)}
                  placeholder="Why is this order being removed?" disabled={busy} />
      </div>
    </Modal>
  );
}
