'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { ExpertOrdersPanel, EXPERT_FILTERS } from '@/components/expert/ExpertOrdersPanel';
import { useExpertPortal } from '@/components/expert/shell/ExpertPortal';
import { Spinner } from '@/components/shared/Spinner';

const VALID = new Set<string>(EXPERT_FILTERS.map((f) => f.key).filter((k): k is NonNullable<typeof k> => k !== null));

function OrdersInner() {
  const { refreshKey, openDetail, openSubmit, openFilesFor } = useExpertPortal();
  const raw = useSearchParams()?.get('status') ?? '';
  const initialFilter = VALID.has(raw) ? raw : null;
  return (
    <ExpertOrdersPanel
      key={`orders-${refreshKey}`}
      onOpenDetail={openDetail}
      onSubmitWork={openSubmit}
      onOpenFiles={openFilesFor}
      initialFilter={initialFilter}
    />
  );
}

// useSearchParams needs a Suspense boundary, or the build refuses to prerender the page.
export default function ExpertOrdersPage() {
  return (
    <Suspense fallback={<div style={{ display: 'grid', placeItems: 'center', padding: 'var(--s8)' }}><Spinner /></div>}>
      <OrdersInner />
    </Suspense>
  );
}
