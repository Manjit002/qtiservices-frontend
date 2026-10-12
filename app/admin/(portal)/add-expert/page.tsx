'use client';

import { useAdminPortal, SuperAdminOnly } from '@/components/admin/shell/AdminPortal';
import { AddExpertPanel } from '@/components/admin/experts/AddExpertPanel';

export default function AdminAddExpertPage() {
  const { isSuperAdmin } = useAdminPortal();
  return (
    <SuperAdminOnly>
      <AddExpertPanel isSuperAdmin={isSuperAdmin} />
    </SuperAdminOnly>
  );
}
