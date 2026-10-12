'use client';

import { useAdminPortal } from '@/components/admin/shell/AdminPortal';
import { DashboardHome } from '@/components/admin/DashboardHome';

export default function AdminDashboardPage() {
  const { refreshKey, displayName, isSuperAdmin, openOrderDetail, navigate } = useAdminPortal();
  return (
    <DashboardHome
      key={`dash-${refreshKey}`}
      name={displayName}
      showRevenue={isSuperAdmin}
      onOpenOrder={openOrderDetail}
      onNavigate={navigate}
    />
  );
}
