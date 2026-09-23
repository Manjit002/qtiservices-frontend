'use client';

import { useAdminPortal } from '@/components/admin/shell/AdminPortal';
import { CouponsPanel } from '@/components/admin/coupons/CouponsPanel';

export default function AdminCouponsPage() {
  const { refreshKey } = useAdminPortal();
  return <CouponsPanel key={`coupons-${refreshKey}`} />;
}
