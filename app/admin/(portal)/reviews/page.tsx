'use client';

import { useAdminPortal } from '@/components/admin/shell/AdminPortal';
import { ReviewsPanel } from '@/components/admin/reviews/ReviewsPanel';

export default function AdminReviewsPage() {
  const { navigate } = useAdminPortal();
  return <ReviewsPanel onAddExternal={() => navigate('add-review')} />;
}
