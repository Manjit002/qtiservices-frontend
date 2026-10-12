'use client';

import { useExpertPortal } from '@/components/expert/shell/ExpertPortal';
import { ExpertDeadlinesPanel } from '@/components/expert/ExpertDeadlinesPanel';

export default function ExpertDeadlinesPage() {
  const { refreshKey, openDetail } = useExpertPortal();
  return <ExpertDeadlinesPanel key={`dl-${refreshKey}`} onOpenOrder={openDetail} />;
}
