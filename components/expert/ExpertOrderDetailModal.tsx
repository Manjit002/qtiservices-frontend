'use client';

import { Modal } from '@/components/shared/Modal';
import { Spinner } from '@/components/shared/Spinner';
import { ErrorState } from '@/components/shared/ErrorState';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { StatusStepper } from '@/components/shared/StatusStepper';
import { useAsync } from '@/hooks/useAsync';
import { expertApi } from '@/lib/api/expert';
import { fmtOrderId, formatDateTime } from '@/lib/utils/format';
import { deadlineColor, deadlineLabel } from '@/lib/utils/deadline';
import type { OrderDTO } from '@/types';

interface Props {
  orderId: number | null;
  onClose: () => void;
  onStartWork: (id: number) => void;
  onSubmitWork: (order: OrderDTO) => void;
  busy: boolean;
}

/**
 * Expert-side order detail.
 *
 * The stepper uses the `expert` flow — an expert only ever sees
 * Assigned → Working → Submitted → Done, not the pricing/review steps that
 * precede assignment.
 */
export function ExpertOrderDetailModal({ orderId, onClose, onStartWork, onSubmitWork, busy }: Props) {
  const detail = useAsync(
    (signal) => (orderId == null ? Promise.resolve(null) : expertApi.orderDetail(orderId, signal)),
    [orderId]
  );

  const d = detail.data;
  const status = String(d?.status ?? '');

  return (
    <Modal
      isOpen={orderId != null}
      onClose={onClose}
      title={<>Order {fmtOrderId(orderId)}</>}
      maxWidth="720px"
      labelledBy="expert-order-detail-title"
      footer={
        d ? (
          <>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Close</button>
            {status === 'ASSIGNED' || status === 'REASSIGNED' ? (
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy}
                onClick={() => onStartWork(d.id)}
              >
                {busy ? 'Starting…' : '▶ Start Work'}
              </button>
            ) : null}
            {status === 'IN_PROGRESS' ? (
              <button type="button" className="btn btn-primary" onClick={() => onSubmitWork(d)}>
                🚀 Submit Work
              </button>
            ) : null}
          </>
        ) : null
      }
    >
      {detail.loading && (
        <div style={{ textAlign: 'center', padding: 40 }}><Spinner /></div>
      )}

      {detail.error && <ErrorState message={detail.error} onRetry={detail.reload} />}

      {d && (
        <>
          <StatusStepper status={d.status} flow="expert" />

          <div className="detail-grid" style={{ marginTop: 22 }}>
            <div className="detail-item">
              <span className="detail-lbl">Subject</span>
              <span className="detail-val">{d.subject ?? '—'}</span>
            </div>
            <div className="detail-item">
              <span className="detail-lbl">Status</span>
              <span className="detail-val"><StatusBadge status={d.status} /></span>
            </div>
            <div className="detail-item">
              <span className="detail-lbl">Your deadline</span>
              <span className="detail-val" style={{ color: deadlineColor(d.expertDeadline ?? d.deadline) }}>
                {formatDateTime(d.expertDeadline ?? d.deadline)} ({deadlineLabel(d.expertDeadline ?? d.deadline)})
              </span>
            </div>
            {d.type ? (
              <div className="detail-item">
                <span className="detail-lbl">Type</span>
                <span className="detail-val">{d.type}</span>
              </div>
            ) : null}
          </div>

          {(d.description || d.instructions) && (
            <div style={{ marginTop: 20 }}>
              <div className="detail-lbl" style={{ marginBottom: 8 }}>Instructions</div>
              <p style={{ fontSize: '.85rem', lineHeight: 1.75, whiteSpace: 'pre-wrap' }}>
                {d.instructions ?? d.description}
              </p>
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
