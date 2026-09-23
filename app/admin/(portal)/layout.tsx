'use client';

import type { ReactNode } from 'react';
import { ToastProvider } from '@/hooks/useToast';
import { AdminPortalShell } from '@/components/admin/shell/AdminPortal';
import '@/styles/migration-additions.css';

/**
 * Shared layout for every authenticated admin page.
 *
 * `(portal)` is a route group: it adds no URL segment, so this folder's
 * dashboard/page.tsx is served at /admin/dashboard. /admin/login sits outside
 * the group, which is why it gets neither the sidebar nor the auth guard.
 *
 * App Router keeps this layout mounted while moving between its pages, so auth
 * state, the sidebar and any open dialog persist across navigation — only the
 * page below is swapped.
 */
export default function AdminPortalLayout({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <AdminPortalShell>{children}</AdminPortalShell>
    </ToastProvider>
  );
}
