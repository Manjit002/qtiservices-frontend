'use client';

import { useExpertPortal } from '@/components/expert/shell/ExpertPortal';
import { ExpertDashboardPanel } from '@/components/expert/ExpertDashboardPanel';

export default function ExpertDashboardPage() {
  const { refreshKey, openDetail } = useExpertPortal();
  return <ExpertDashboardPanel key={`dash-${refreshKey}`} onOpenOrder={openDetail} />;
}
