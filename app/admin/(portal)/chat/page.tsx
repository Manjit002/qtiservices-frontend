'use client';

import { useAdminPortal } from '@/components/admin/shell/AdminPortal';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { ChatCenter } from '@/components/admin/ChatCenter';
import { Spinner } from '@/components/shared/Spinner';

/**
 * /admin/chat, or /admin/chat?order=2417 to open straight into one
 * conversation — "Open chat" on an order navigates here, so the open thread is
 * part of the URL and survives a refresh.
 */
function ChatPageInner() {
  const { user, openOrderDetail, setUnreadTotal } = useAdminPortal();
  const raw = useSearchParams()?.get('order') ?? '';
  const initialOrderId = /^\d+$/.test(raw) ? Number(raw) : null;
  return (
    <ChatCenter
      adminId={user.id}
      onViewOrder={(id) => openOrderDetail(id)}
      initialOrderId={initialOrderId}
      onUnreadTotalChange={setUnreadTotal}
    />
  );
}

// useSearchParams needs a Suspense boundary, or the build refuses to prerender the page.
export default function AdminChatPage() {
  return (
    <Suspense fallback={<div style={{ display: 'grid', placeItems: 'center', padding: 'var(--s7)' }}><Spinner /></div>}>
      <ChatPageInner />
    </Suspense>
  );
}
