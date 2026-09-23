'use client';

import { useExpertPortal } from '@/components/expert/shell/ExpertPortal';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { ExpertFilesPanel } from '@/components/expert/ExpertFilesPanel';
import { Spinner } from '@/components/shared/Spinner';

/** /expert/files, or /expert/files?order=2417 with that order preselected. */
function FilesInner() {
  const { refreshKey } = useExpertPortal();
  const raw = useSearchParams()?.get('order') ?? '';
  const initialOrderId = /^\d+$/.test(raw) ? Number(raw) : null;
  return <ExpertFilesPanel key={`files-${refreshKey}-${initialOrderId ?? ''}`} initialOrderId={initialOrderId} />;
}

// useSearchParams needs a Suspense boundary, or the build refuses to prerender the page.
export default function ExpertFilesPage() {
  return (
    <Suspense fallback={<div style={{ display: 'grid', placeItems: 'center', padding: 'var(--s7)' }}><Spinner /></div>}>
      <FilesInner />
    </Suspense>
  );
}
