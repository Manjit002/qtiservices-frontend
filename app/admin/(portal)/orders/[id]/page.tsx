'use client';

import { useAdminPortal } from '@/components/admin/shell/AdminPortal';
import { useCallback, useState } from 'react';
import { useParams } from 'next/navigation';
import { OrderDetail } from '@/components/admin/OrderDetail';
import { useToast } from '@/hooks/useToast';
import { ordersApi } from '@/lib/api/orders';
import { fmtOrderId } from '@/lib/utils/format';

/**
 * /admin/orders/[id] — its own URL, so an order can be linked, bookmarked,
 * refreshed and returned to with Back, none of which worked when the detail
 * view was a panel on the dashboard route.
 */
export default function AdminOrderDetailPage() {
  const p = useAdminPortal();
  const { showToast } = useToast();
  const params = useParams<{ id: string }>();
  const id = Number(params?.id);
  const [busy, setBusy] = useState(false);

  const runOrderAction = useCallback(
    async (fn: () => Promise<unknown>, message: string) => {
      setBusy(true);
      try {
        await fn();
        showToast(message, 'success');
        p.bumpRefresh();
      } catch (e) {
        showToast((e as Error).message, 'error');
      } finally {
        setBusy(false);
      }
    },
    [showToast, p]
  );

  if (!Number.isInteger(id) || id <= 0) {
    return (
      <div className="card" style={{ padding: 'var(--s6)', textAlign: 'center' }}>
        <h2 className="t-h3" style={{ marginBottom: 'var(--s2)' }}>Order not found</h2>
        <p className="t-sm text-dim" style={{ marginBottom: 'var(--s4)' }}>
          &ldquo;{params?.id}&rdquo; is not a valid order number.
        </p>
        <button type="button" className="btn btn-primary" onClick={() => p.navigate('orders')}>
          Back to orders
        </button>
      </div>
    );
  }

  return (
    <OrderDetail
      key={`detail-${id}-${p.refreshKey}`}
      orderId={id}
      isSuperAdmin={p.isSuperAdmin}
      canEditStudent={p.canEditStudent}
      busy={busy}
      onBack={() => p.navigate('orders')}
      onAssign={p.openAssign}
      onSetPrice={p.openSetPrice}
      onPayLink={p.openPayLink}
      onOpenFiles={p.openFiles}
      onOpenChat={p.openChatFor}
      onEditDeadlines={p.openDeadlines}
      onEditOrder={p.openEditorWith}
      onDelete={p.openDelete}
      onUnassign={(order) =>
        runOrderAction(() => ordersApi.unassign(order.id), `${fmtOrderId(order.id)} unassigned.`)}
      onComplete={(order) =>
        runOrderAction(() => ordersApi.complete(order.id), `${fmtOrderId(order.id)} marked completed.`)}
    />
  );
}
