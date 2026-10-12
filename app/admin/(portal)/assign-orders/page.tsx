'use client';

import { useAdminPortal } from '@/components/admin/shell/AdminPortal';
import { AssignOrdersPanel } from '@/components/admin/assign/AssignOrdersPanel';

export default function AdminAssignOrdersPage() {
  const { refreshKey, openAssign, openOrderDetail } = useAdminPortal();
  return (
    <AssignOrdersPanel
      key={`assign-${refreshKey}`}
      refreshKey={refreshKey}
      onAssign={(order) => openAssign(order, false)}
      onOpenDetail={openOrderDetail}
    />
  );
}
