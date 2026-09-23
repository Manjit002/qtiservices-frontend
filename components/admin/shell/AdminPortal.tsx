'use client';

import {
  createContext, useCallback, useContext, useMemo, useState, type ReactNode,
} from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { CommandPalette } from '@/components/shared/CommandPalette';
import { Spinner } from '@/components/shared/Spinner';
import { AssignOrderDialog } from '@/components/admin/assign/AssignOrderDialog';
import { EditDeadlinesModal } from '@/components/admin/EditDeadlinesModal';
import { DeleteOrderModal } from '@/components/admin/DeleteOrderModal';
import { OrderEditDialog } from '@/components/admin/OrderEditDialog';
import { SetPriceModal } from '@/components/admin/SetPriceModal';
import { PayLinkModal } from '@/components/admin/PayLinkModal';
import { FileGalleryModal } from '@/components/admin/FileGalleryModal';
import { useToast } from '@/hooks/useToast';
import { useAuth } from '@/hooks/useAuth';
import { useAsync } from '@/hooks/useAsync';
import { useCommandPalette, type CommandItem } from '@/hooks/useCommandPalette';
import { trackRecentOrder } from '@/lib/utils/recentOrders';
import { ordersApi } from '@/lib/api/orders';
import type { AuthUser, OrderDTO, OrderDetailDTO } from '@/types';
import {
  ADMIN_NAV, ADMIN_PAGES, chatHref, hrefFor, isOrderDetailPath, keyForPath,
  orderDetailHref, titleForPath,
} from './adminRoutes';

/**
 * Everything that used to live in the single dashboard page and is needed by
 * more than one route.
 *
 * This component is rendered by app/admin/(portal)/layout.tsx. App Router keeps
 * a layout mounted while navigating between its child pages, so the signed-in
 * user, the sidebar, the chat unread count and any open dialog survive moving
 * from /admin/orders to /admin/reviews — only the page content is swapped.
 */
interface AdminPortalValue {
  user: AuthUser;
  isSuperAdmin: boolean;
  /** ADMIN or SUPER_ADMIN — the roles PUT /admin/students/{id}/profile accepts. */
  canEditStudent: boolean;
  displayName: string;

  /** Bumped after a mutation; pages key their panels on it to re-fetch. */
  refreshKey: number;
  bumpRefresh: () => void;
  setUnreadTotal: (n: number) => void;

  /** Navigate by sidebar key — the vocabulary panels already use. */
  navigate: (key: string) => void;
  openOrderDetail: (id: number, subject?: string) => void;
  openChatFor: (order: OrderDTO) => void;

  openAssign: (order: OrderDTO, reassign: boolean) => void;
  openSetPrice: (order: OrderDTO) => void;
  openPayLink: (order: OrderDTO) => void;
  openFiles: (order: OrderDTO) => void;
  openDeadlines: (order: OrderDTO) => void;
  /** From a list row: fetches the full detail first (the list DTO lacks fields the form needs). */
  openEditor: (order: OrderDTO) => Promise<void>;
  /** From the detail page, which already has the full record. */
  openEditorWith: (detail: OrderDetailDTO) => void;
  openDelete: (order: OrderDTO) => void;
  editLoadingId: number | null;
}

const AdminPortalContext = createContext<AdminPortalValue | null>(null);

export function useAdminPortal(): AdminPortalValue {
  const v = useContext(AdminPortalContext);
  if (!v) throw new Error('useAdminPortal must be used inside the admin portal layout.');
  return v;
}

export function AdminPortalShell({ children }: { children: ReactNode }) {
  const { user, ready, isSuperAdmin, logout } = useAuth('admin');
  const { showToast } = useToast();
  const router = useRouter();
  const pathname = usePathname() ?? ADMIN_PAGES.dashboard.href;

  /**
   * Mirrors @PreAuthorize("hasAnyRole('ADMIN','SUPER_ADMIN')") on
   * PUT /admin/students/{id}/profile. useAuth deliberately lets an
   * unrecognised role stay on this portal, so the action is hidden from anyone
   * the endpoint would refuse — the endpoint remains the real enforcement.
   */
  const canEditStudent = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';

  const [refreshKey, setRefreshKey] = useState(0);
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [assignTarget, setAssignTarget] = useState<{ order: OrderDTO; reassign: boolean } | null>(null);
  const [priceTarget, setPriceTarget] = useState<OrderDTO | null>(null);
  const [payLinkTarget, setPayLinkTarget] = useState<OrderDTO | null>(null);
  const [filesTarget, setFilesTarget] = useState<OrderDTO | null>(null);
  const [deadlinesTarget, setDeadlinesTarget] = useState<OrderDTO | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<OrderDTO | null>(null);
  const [editTarget, setEditTarget] = useState<OrderDetailDTO | null>(null);
  const [editLoadingId, setEditLoadingId] = useState<number | null>(null);

  const bumpRefresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  // router.push, so every destination becomes a history entry Back returns to.
  const navigate = useCallback((key: string) => router.push(hrefFor(key)), [router]);

  const openOrderDetail = useCallback(
    (id: number, subject = '') => {
      trackRecentOrder(id, subject);
      router.push(orderDetailHref(id));
    },
    [router]
  );

  const openChatFor = useCallback((order: OrderDTO) => router.push(chatHref(order.id)), [router]);

  const openEditor = useCallback(
    async (order: OrderDTO) => {
      setEditLoadingId(order.id);
      try {
        setEditTarget(await ordersApi.detail(order.id));
      } catch (e) {
        showToast((e as Error).message, 'error');
      } finally {
        setEditLoadingId(null);
      }
    },
    [showToast]
  );

  /**
   * Expert workload for the assign dialog, counted from real order records —
   * the API exposes no workload figure. Lives here, not on a page, because the
   * dialog can be opened from Orders, Order detail and Assign orders alike.
   */
  const workloadSource = useAsync(
    (s) => ordersApi.listAll(0, 200, 'createdAt,desc', s),
    [refreshKey]
  );
  const { workload, workloadNote } = useMemo(() => {
    const rows = workloadSource.data?.content ?? [];
    const m = new Map<string, number>();
    rows.forEach((o) => {
      const name = (o.assignedEmployeeName as string | undefined)?.trim();
      const st = String(o.status ?? '');
      if (!name || ['COMPLETED', 'CANCELLED', 'PAID'].includes(st)) return;
      m.set(name, (m.get(name) ?? 0) + 1);
    });
    return {
      workload: m,
      workloadNote: rows.length
        ? `Active-order counts are from the ${rows.length} most recent orders — the API exposes no workload figure.`
        : '',
    };
  }, [workloadSource.data]);

  const nav = useMemo(
    () =>
      ADMIN_NAV.map((g) => ({
        ...g,
        items: g.items.map((i) =>
          i.key === 'chats' ? { ...i, count: unreadTotal, urgent: unreadTotal > 0 } : i
        ),
      })),
    [unreadTotal]
  );

  const commands: CommandItem[] = useMemo(
    () =>
      ADMIN_NAV.flatMap((g) => g.items)
        .filter((i) => !i.superOnly || isSuperAdmin)
        .map((i) => ({
          id: i.key,
          label: ADMIN_PAGES[i.key as keyof typeof ADMIN_PAGES]?.title ?? i.label,
          icon: i.icon,
          hint: 'Page',
          action: () => navigate(i.key),
        })),
    [isSuperAdmin, navigate]
  );
  const palette = useCommandPalette(commands);

  const displayName = (user?.email.split('@')[0] ?? 'there').replace(/[._-]/g, ' ');

  const value = useMemo<AdminPortalValue | null>(
    () =>
      user
        ? {
            user, isSuperAdmin, canEditStudent, displayName,
            refreshKey, bumpRefresh, setUnreadTotal,
            navigate, openOrderDetail, openChatFor,
            openAssign: (order, reassign) => setAssignTarget({ order, reassign }),
            openSetPrice: setPriceTarget,
            openPayLink: setPayLinkTarget,
            openFiles: setFilesTarget,
            openDeadlines: setDeadlinesTarget,
            openEditor,
            openEditorWith: setEditTarget,
            openDelete: setDeleteTarget,
            editLoadingId,
          }
        : null,
    [user, isSuperAdmin, canEditStudent, displayName, refreshKey, bumpRefresh,
     navigate, openOrderDetail, openChatFor, openEditor, editLoadingId]
  );

  // One neutral frame while localStorage is read: shows neither the portal to a
  // signed-out visitor nor the login page to a signed-in one. useAuth redirects
  // a visitor with no session to the login page.
  if (!ready) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        <Spinner />
      </div>
    );
  }
  if (!user || !value) return null;

  const onDetail = isOrderDetailPath(pathname);

  return (
    <AdminPortalContext.Provider value={value}>
      <AppShell
        portal="admin"
        groups={nav}
        active={keyForPath(pathname) ?? ''}
        title={titleForPath(pathname)}
        parent={onDetail ? { label: 'Orders', onClick: () => navigate('orders') } : undefined}
        userName={displayName}
        userEmail={user.email}
        userRole={user.role}
        isSuperAdmin={isSuperAdmin}
        onLogout={logout}
        onOpenPalette={palette.open}
        notificationCount={unreadTotal}
      >
        {children}
      </AppShell>

      <AssignOrderDialog
        order={assignTarget?.order ?? null}
        isReassign={assignTarget?.reassign ?? false}
        workload={workload}
        workloadNote={workloadNote}
        onClose={() => setAssignTarget(null)}
        onAssigned={bumpRefresh}
      />
      <SetPriceModal order={priceTarget} onClose={() => setPriceTarget(null)} onSaved={bumpRefresh} />
      <PayLinkModal order={payLinkTarget} onClose={() => setPayLinkTarget(null)} />
      <FileGalleryModal order={filesTarget} onClose={() => setFilesTarget(null)} />
      <EditDeadlinesModal order={deadlinesTarget} onClose={() => setDeadlinesTarget(null)} onSaved={bumpRefresh} />
      <OrderEditDialog order={editTarget} onClose={() => setEditTarget(null)} onSaved={bumpRefresh} />
      <DeleteOrderModal
        order={deleteTarget}
        adminId={user.id ?? null}
        onClose={() => setDeleteTarget(null)}
        onDeleted={() => {
          setDeleteTarget(null);
          bumpRefresh();
          // replace, not push: the deleted order's detail page must not be a
          // place Back can return to — it would only show an error.
          router.replace(ADMIN_PAGES.orders.href);
        }}
      />
      <CommandPalette
        isOpen={palette.isOpen}
        query={palette.query}
        setQuery={palette.setQuery}
        items={palette.filtered}
        activeIndex={palette.activeIndex}
        setActiveIndex={palette.setActiveIndex}
        onKeyDown={palette.onKeyDown}
        onClose={palette.close}
      />
    </AdminPortalContext.Provider>
  );
}

/**
 * Wraps a super-admin page. The sidebar already hides these entries from other
 * roles, but each is now a real URL that can be typed or bookmarked, so the
 * page itself says so rather than rendering a panel the backend will refuse.
 */
export function SuperAdminOnly({ children }: { children: ReactNode }) {
  const { isSuperAdmin, navigate } = useAdminPortal();
  if (isSuperAdmin) return <>{children}</>;
  return (
    <div className="card" style={{ padding: 'var(--s6)', textAlign: 'center', maxWidth: 520, margin: '0 auto' }}>
      <h2 className="t-h3" style={{ marginBottom: 'var(--s2)' }}>Super Admin access required</h2>
      <p className="t-sm text-dim" style={{ marginBottom: 'var(--s4)' }}>
        This page is available to Super Admin accounts only.
      </p>
      <button type="button" className="btn btn-primary" onClick={() => navigate('dashboard')}>
        Go to dashboard
      </button>
    </div>
  );
}
