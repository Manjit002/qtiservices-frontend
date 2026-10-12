'use client';

import { FolderOpen, Play, Send } from 'lucide-react';
import { Modal } from '@/components/shared/Modal';
import { StatusStepper } from '@/components/shared/StatusStepper';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/Badge';
import { DeadlineMeter, EXPERT_CLOSED_STATUSES } from '@/components/ui/DeadlineMeter';
import { ErrorState, Skeleton } from '@/components/ui/States';
import { useAsync } from '@/hooks/useAsync';
import { expertApi } from '@/lib/api/expert';
import { fmtOrderId, formatDateTime } from '@/lib/utils/format';
import type { OrderDTO } from '@/types';

interface Props {
  orderId: number | null;
  onClose: () => void;
  onStartWork: (id: number) => void;
  onSubmitWork: (order: OrderDTO) => void;
  onOpenFiles?: (id: number) => void;
  busy: boolean;
}

/**
 * Expert-side order detail.
 *
 * The stepper uses the `expert` flow — an expert only ever sees
 * Assigned → Working → Submitted → Done, not the pricing/review steps that
 * precede assignment.
 */
export function ExpertOrderDetailModal({ orderId, onClose, onStartWork, onSubmitWork, onOpenFiles, busy }: Props) {
  const detail = useAsync(
    (signal) => (orderId == null ? Promise.resolve(null) : expertApi.orderDetail(orderId, signal)),
    [orderId]
  );

  const d = detail.data;
  const status = String(d?.status ?? '');
  const due = d?.expertDeadline ?? d?.deadline;
  const brief = d?.instructions ?? d?.description;

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
            <Button variant="ghost" onClick={onClose}>Close</Button>
            {onOpenFiles && (
              <Button onClick={() => onOpenFiles(d.id)}><FolderOpen size={14} /> Files</Button>
            )}
            {(status === 'ASSIGNED' || status === 'REASSIGNED') && (
              <Button variant="primary" loading={busy} onClick={() => onStartWork(d.id)}>
                {!busy && <Play size={14} />} {busy ? 'Starting…' : 'Start work'}
              </Button>
            )}
            {status === 'IN_PROGRESS' && (
              <Button variant="primary" onClick={() => onSubmitWork(d)}><Send size={14} /> Submit work</Button>
            )}
          </>
        ) : null
      }
    >
      {detail.loading && (
        <div style={{ display: 'grid', gap: 'var(--s4)' }}>
          <Skeleton h={48} /><Skeleton w="60%" /><Skeleton h={90} />
        </div>
      )}

      {detail.error && <ErrorState message={detail.error} onRetry={detail.reload} />}

      {d && (
        <>
          {d.subject && <p className="xp-detail-sub">{d.subject}</p>}

          <div style={{ margin: 'var(--s4) 0' }}>
            <StatusStepper status={d.status} flow="expert" />
          </div>

          <div className="detail-grid">
            <div className="detail-item">
              <span className="detail-lbl">Status</span>
              <span className="detail-val"><StatusBadge status={d.status} /></span>
            </div>
            <div className="detail-item">
              <span className="detail-lbl">Type</span>
              <span className="detail-val">{d.type || '—'}</span>
            </div>
            <div className="detail-item" style={{ alignItems: 'flex-start' }}>
              <span className="detail-lbl">Your deadline</span>
              <span className="detail-val">
                {formatDateTime(due)}
                {!EXPERT_CLOSED_STATUSES.includes(status) && (
                  <span style={{ display: 'block', marginTop: 6, marginLeft: 'auto', width: 120 }}><DeadlineMeter deadline={due} /></span>
                )}
              </span>
            </div>
            {d.studentName ? (
              <div className="detail-item">
                <span className="detail-lbl">Student</span>
                <span className="detail-val">{d.studentName}</span>
              </div>
            ) : null}
          </div>

          <h3 className="t-sm" style={{ fontWeight: 600, marginTop: 'var(--s5)' }}>Instructions</h3>
          {brief ? (
            <div className="xp-instructions">{brief}</div>
          ) : (
            <p className="t-sm text-dim" style={{ marginTop: 6 }}>No written instructions. Check the order&apos;s files for a brief.</p>
          )}
        </>
      )}
    </Modal>
  );
}
