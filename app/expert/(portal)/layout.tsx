'use client';

import type { ReactNode } from 'react';
import { ToastProvider } from '@/hooks/useToast';
import { ExpertPortalShell } from '@/components/expert/shell/ExpertPortal';
import '@/app/controls.css';

/**
 * Shared layout for every authenticated expert page. `(portal)` adds no URL
 * segment; /expert/login sits outside it and so gets neither shell nor guard.
 */
export default function ExpertPortalLayout({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <ExpertPortalShell>{children}</ExpertPortalShell>
    </ToastProvider>
  );
}
