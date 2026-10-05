'use client';

import { useAdminPortal } from '@/components/admin/shell/AdminPortal';
import { AnalyticsPanel } from '@/components/admin/analytics/AnalyticsPanel';

export default function AdminAnalyticsPage() {
  const { refreshKey, navigate, openOrderDetail } = useAdminPortal();
  return (
    <AnalyticsPanel key={`analytics-${refreshKey}`} onNavigate={navigate} onOpenOrder={openOrderDetail} />
  );
}
