'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { X, Archive } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/Badge';
import { fmtOrderId, formatCurrency, formatDateTime } from '@/lib/utils/format';
import type { DeletedOrderDTO } from '@/types';

function Field({ label, value }: { label: string; value?: ReactNode }) {
  const empty = value === null || value === undefined || value === '';
  return (
    <div className="da-field">
      <div className="da-field-lbl">{label}</div>
      <div className={`da-field-val${empty ? ' empty' : ''}`}>{empty ? 'Not recorded' : value}</div>
    </div>
  );
}

/** Resolves the frozen price the same way the source does. */
function priceOf(d: DeletedOrderDTO): number | null {
  const raw = d.finalPrice ?? d.totalPrice;
  if (raw === null || raw === undefined || raw === '') return null;
  const n = typeof raw === 'number' ? raw : parseFloat(raw);
  return Number.isNaN(n) ? null : n;
}

interface Props {
  order: DeletedOrderDTO | null;
  onClose: () => void;
}

/**
 * Read-only detail drawer. There is no restore endpoint and no update endpoint
 * for archived records, so this deliberately offers no actions.
 */
export function DeletedOrderDrawer({ order, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const restore = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!order) return;
    restore.current = document.activeElement as HTMLElement | null;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const t = setTimeout(() => ref.current?.focus(), 20);
    return () => {
      clearTimeout(t);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
      restore.current?.focus?.();
    };
  }, [order, onClose]);

  if (!order) return null;

  const paidRaw = order.paidAmount;
  const paid = typeof paidRaw === 'number' ? paidRaw : parseFloat(String(paidRaw ?? '0')) || 0;
  const price = priceOf(order);

  return (
    <>
      <div className="da-drawer-scrim" onClick={onClose} aria-hidden />
      <aside
        className="da-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="da-drawer-title"
        tabIndex={-1}
        ref={ref}
      >
        <div className="card-head" style={{ flexShrink: 0 }}>
          <div style={{ minWidth: 0 }}>
            <h2 className="t-h3" id="da-drawer-title">
              {fmtOrderId(order.originalOrderId)}
            </h2>
            <p className="t-xs text-dim" style={{ marginTop: 2 }}>
              Archived record · read-only
            </p>
          </div>
          <Button variant="ghost" size="sm" iconOnly onClick={onClose} aria-label="Close details">
            <X size={15} />
          </Button>
        </div>

        <div className="da-drawer-body">
          <div className="da-note" style={{ marginBottom: 'var(--s4)' }}>
            <Archive size={15} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>
              This is a snapshot captured when the order was deleted. It cannot be
              edited or restored.
            </span>
          </div>

          <Field label="Subject" value={order.subject} />
          <Field label="Assignment type" value={order.assignmentType} />
          <Field label="Academic level" value={order.academicLevel} />
          <Field label="University" value={order.university} />

          <Field label="Student" value={order.studentName} />
          <Field label="Student email" value={order.studentEmail} />

          <Field
            label="Status at deletion"
            value={order.orderStatus ? <StatusBadge status={order.orderStatus} /> : null}
          />
          <Field
            label="Payment status at deletion"
            value={order.paymentStatus ? <StatusBadge status={order.paymentStatus} /> : null}
          />

          <Field label="Order value" value={price != null ? formatCurrency(price) : null} />
          <Field
            label="Paid before deletion"
            value={paid > 0
              ? <span style={{ color: 'var(--success)', fontWeight: 600 }}>{formatCurrency(paid)}</span>
              : null}
          />

          <Field label="Deadline" value={order.deadline ? formatDateTime(order.deadline) : null} />
          <Field label="Created" value={order.createdAt ? formatDateTime(order.createdAt) : null} />

          <Field
            label="Deleted by"
            value={order.deletedByAdminName
              ?? (order.deletedByAdminId ? `Admin #${order.deletedByAdminId}` : null)}
          />
          <Field label="Deleted at" value={order.deletedAt ? formatDateTime(order.deletedAt) : null} />
          <Field label="Reason" value={order.deleteReason} />
        </div>
      </aside>
    </>
  );
}

export { priceOf };
