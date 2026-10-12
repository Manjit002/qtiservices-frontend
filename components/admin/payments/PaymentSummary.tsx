'use client';

import { StatusBadge } from '@/components/ui/Badge';
import { enumValue, fmtOrderId, formatCurrency } from '@/lib/utils/format';
import type { OrderDetailDTO } from '@/types';

export function PaymentSummary({ order }: { order: OrderDetailDTO }) {
  // Same resolution order the order detail uses — the backend has three price
  // fields and finalPrice wins when present.
  const total = order.finalPrice ?? order.totalPrice ?? order.autoPrice ?? order.price ?? null;
  const paid = order.paidAmount ?? 0;
  const due = order.remainingAmount ?? (total != null ? Math.max(0, total - paid) : null);

  return (
    <section className="card" style={{ marginBottom: 'var(--s5)' }}>
      <div className="card-head">
        <div style={{ minWidth: 0 }}>
          <h2 className="t-h3">
            {fmtOrderId(order.id)}
            <span className="text-dim" style={{ fontWeight: 400 }}>
              {order.subject ? ` · ${order.subject}` : ''}
            </span>
          </h2>
          <p className="t-xs text-dim truncate" style={{ marginTop: 2 }}>
            {order.studentName ?? 'Unknown student'}
            {order.studentEmail ? ` · ${order.studentEmail}` : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <StatusBadge status={enumValue(order.status)} />
          {order.paymentStatus ? <StatusBadge status={enumValue(order.paymentStatus)} /> : null}
        </div>
      </div>

      <div className="pv-sum">
        <div className="pv-sum-cell">
          <span className="pv-sum-flag" style={{ background: 'var(--accent)' }} aria-hidden />
          <div className="pv-sum-lbl">Order total</div>
          <div className="pv-sum-val">{total != null ? formatCurrency(total) : '—'}</div>
        </div>
        <div className="pv-sum-cell">
          <span className="pv-sum-flag" style={{ background: 'var(--success)' }} aria-hidden />
          <div className="pv-sum-lbl">Paid</div>
          <div className="pv-sum-val" style={{ color: paid > 0 ? 'var(--success)' : undefined }}>
            {formatCurrency(paid)}
          </div>
        </div>
        <div className="pv-sum-cell">
          <span className="pv-sum-flag" style={{ background: (due ?? 0) > 0 ? 'var(--danger)' : 'var(--neutral)' }} aria-hidden />
          <div className="pv-sum-lbl">Remaining</div>
          <div className="pv-sum-val" style={{ color: (due ?? 0) > 0 ? 'var(--danger)' : undefined }}>
            {due != null ? formatCurrency(due) : '—'}
          </div>
        </div>
      </div>
    </section>
  );
}
