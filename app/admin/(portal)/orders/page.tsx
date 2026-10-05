'use client';

import { useAdminPortal } from '@/components/admin/shell/AdminPortal';
import { OrdersPanel } from '@/components/admin/OrdersPanel';

export default function AdminOrdersPage() {
  const p = useAdminPortal();
  return (
    <OrdersPanel
      refreshKey={p.refreshKey}
      onOpenDetail={p.openOrderDetail}
      onAssign={p.openAssign}
      onOpenChat={p.openChatFor}
      onOpenFiles={p.openFiles}
      onSetPrice={p.openSetPrice}
      onPayLink={p.openPayLink}
      onEditDeadlines={p.openDeadlines}
      onEditOrder={p.openEditor}
      editLoadingId={p.editLoadingId}
      onDelete={p.isSuperAdmin ? p.openDelete : undefined}
      onCreate={() => p.navigate('create-order')}
    />
  );
}
