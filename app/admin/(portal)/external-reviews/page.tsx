'use client';

import { useAdminPortal } from '@/components/admin/shell/AdminPortal';
import { ExternalReviewPanel } from '@/components/admin/reviews/ExternalReviewPanel';

export default function AdminExternalReviewsPage() {
  const { navigate } = useAdminPortal();
  return <ExternalReviewPanel onDone={() => navigate('reviews')} />;
}
