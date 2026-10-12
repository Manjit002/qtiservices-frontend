'use client';

import { useAdminPortal, SuperAdminOnly } from '@/components/admin/shell/AdminPortal';
import { SystemOverviewPanel } from '@/components/admin/system/SystemOverviewPanel';

export default function AdminSystemOverviewPage() {
  const { refreshKey, isSuperAdmin, navigate, openOrderDetail } = useAdminPortal();
  return (
    <SuperAdminOnly>
      <SystemOverviewPanel
        key={`sys-${refreshKey}`}
        isSuperAdmin={isSuperAdmin}
        onNavigate={navigate}
        onOpenOrder={openOrderDetail}
      />
    </SuperAdminOnly>
  );
}
