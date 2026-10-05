'use client';

import { useAdminPortal } from '@/components/admin/shell/AdminPortal';
import { StudentsPanel } from '@/components/admin/students/StudentsPanel';

export default function AdminStudentsPage() {
  const p = useAdminPortal();
  return (
    <StudentsPanel
      canEditStudent={p.canEditStudent}
      onOpenOrder={p.openOrderDetail}
      onOpenFiles={p.openFiles}
      onOpenChat={p.openChatFor}
      onPayLink={p.openPayLink}
    />
  );
}
