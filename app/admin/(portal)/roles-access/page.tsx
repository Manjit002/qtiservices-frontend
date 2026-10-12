'use client';

import { useAdminPortal, SuperAdminOnly } from '@/components/admin/shell/AdminPortal';
import { RolesPanel } from '@/components/admin/roles/RolesPanel';

export default function AdminRolesAccessPage() {
  const { isSuperAdmin } = useAdminPortal();
  return (
    <SuperAdminOnly>
      <RolesPanel isSuperAdmin={isSuperAdmin} />
    </SuperAdminOnly>
  );
}
