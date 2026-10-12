'use client';

import { useAdminPortal } from '@/components/admin/shell/AdminPortal';
import { ExpertsPanel } from '@/components/admin/experts/ExpertsPanel';

export default function AdminExpertsPage() {
  const { refreshKey, navigate } = useAdminPortal();
  return <ExpertsPanel key={`experts-${refreshKey}`} onNavigate={navigate} />;
}
