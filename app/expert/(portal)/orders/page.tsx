'use client';

import { useExpertPortal } from '@/components/expert/shell/ExpertPortal';
import { ExpertOrdersPanel } from '@/components/expert/ExpertOrdersPanel';

export default function ExpertOrdersPage() {
  const { refreshKey, openDetail, openSubmit, openFilesFor } = useExpertPortal();
  return (
    <ExpertOrdersPanel
      key={`orders-${refreshKey}`}
      onOpenDetail={openDetail}
      onSubmitWork={openSubmit}
      onOpenFiles={openFilesFor}
    />
  );
}
