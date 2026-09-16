'use client';

import { useCallback, useMemo, useState } from 'react';
import { AppShell, type NavGroup } from '@/components/layout/AppShell';
import { DashboardHome } from '@/components/admin/DashboardHome';
import {
  LayoutDashboard, Boxes, Send, GraduationCap, Users, MessagesSquare, UserPlus,
  CreditCard, BadgeCheck, FilePlus2, Star, PenLine, LineChart, ShieldCheck,
  KeyRound, Trash2, Ticket,
} from 'lucide-react';
import { CommandPalette } from '@/components/shared/CommandPalette';
import { Spinner } from '@/components/shared/Spinner';
import { OrdersPanel } from '@/components/admin/OrdersPanel';
import { AssignOrderDialog } from '@/components/admin/assign/AssignOrderDialog';
import { AssignOrdersPanel } from '@/components/admin/assign/AssignOrdersPanel';
import { ExpertsPanel } from '@/components/admin/experts/ExpertsPanel';
import { StudentsPanel } from '@/components/admin/students/StudentsPanel';
import { VerifyPaymentsPanel } from '@/components/admin/payments/VerifyPaymentsPanel';
import { InstallmentsPanel } from '@/components/admin/installments/InstallmentsPanel';
import { CreateOrderPanel } from '@/components/admin/create-order/CreateOrderPanel';
import { AddExpertPanel } from '@/components/admin/experts/AddExpertPanel';
import { ReviewsPanel } from '@/components/admin/reviews/ReviewsPanel';
import { ExternalReviewPanel } from '@/components/admin/reviews/ExternalReviewPanel';
import { DeletedOrdersPanel } from '@/components/admin/deleted/DeletedOrdersPanel';
import { RolesPanel } from '@/components/admin/roles/RolesPanel';
import { SystemOverviewPanel } from '@/components/admin/system/SystemOverviewPanel';
import { CouponsPanel } from '@/components/admin/coupons/CouponsPanel';
import { AnalyticsPanel } from '@/components/admin/analytics/AnalyticsPanel';
import { OrderDetail } from '@/components/admin/OrderDetail';
import { EditDeadlinesModal } from '@/components/admin/EditDeadlinesModal';
import { DeleteOrderModal } from '@/components/admin/DeleteOrderModal';
import { OrderEditDialog } from '@/components/admin/OrderEditDialog';
import { SetPriceModal } from '@/components/admin/SetPriceModal';
import { PayLinkModal } from '@/components/admin/PayLinkModal';
import { FileGalleryModal } from '@/components/admin/FileGalleryModal';
import { ChatCenter } from '@/components/admin/ChatCenter';
import { ToastProvider, useToast } from '@/hooks/useToast';
import { useAuth } from '@/hooks/useAuth';
import { useAsync } from '@/hooks/useAsync';
import { useCommandPalette, type CommandItem } from '@/hooks/useCommandPalette';
import { trackRecentOrder } from '@/lib/utils/recentOrders';
import { ordersApi } from '@/lib/api/orders';
import { fmtOrderId } from '@/lib/utils/format';
import type { OrderDTO, OrderDetailDTO } from '@/types';
import '@/styles/migration-additions.css';

type PanelKey =
  | 'dashboard' | 'analytics' | 'orders' | 'assign' | 'experts' | 'super'
  | 'roles' | 'create-expert' | 'installments' | 'payverify' | 'create-order' | 'coupons'
  | 'reviews' | 'add-review' | 'students' | 'chats' | 'deleted-orders'
  | 'order-detail';

/** Titles are the exact strings from the legacy PANEL_TITLES map. */
const PANEL_TITLES: Record<PanelKey, string> = {
  dashboard: 'Dashboard',
  analytics: 'Analytics',
  orders: 'Orders',
  assign: 'Assign orders',
  experts: 'Experts',
  super: 'System overview',
  roles: 'Roles & access',
  'create-expert': 'Add expert',
  installments: 'Installments',
  payverify: 'Verify payments',
  coupons: 'Coupons',
  'create-order': 'Create order',
  reviews: 'Reviews',
  'add-review': 'External review',
  students: 'Students',
  chats: 'Chat',
  'deleted-orders': 'Deleted orders',
  'order-detail': 'Order detail',
};

const NAV: NavGroup[] = [
  {
    items: [
      { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { key: 'orders', label: 'Orders', icon: Boxes },
      { key: 'assign', label: 'Assign orders', icon: Send },
      // Deleted orders sits with the other order views — it is an order archive,
      // not a system-administration tool.
      { key: 'deleted-orders', label: 'Deleted orders', icon: Trash2 },
      { key: 'analytics', label: 'Analytics', icon: LineChart },
    ],
  },
  {
    title: 'People',
    items: [
      { key: 'students', label: 'Students', icon: GraduationCap },
      { key: 'experts', label: 'Experts', icon: Users },
      { key: 'chats', label: 'Chat', icon: MessagesSquare },
    ],
  },
  {
    title: 'Billing',
    items: [
      { key: 'installments', label: 'Installments', icon: CreditCard },
      { key: 'payverify', label: 'Verify payments', icon: BadgeCheck },
      { key: 'coupons', label: 'Coupons', icon: Ticket },
    ],
  },
  {
    title: 'Content',
    items: [
      { key: 'create-order', label: 'Create order', icon: FilePlus2 },
      { key: 'reviews', label: 'Reviews', icon: Star },
      { key: 'add-review', label: 'External review', icon: PenLine },
    ],
  },
  {
    title: 'Super admin',
    items: [
      { key: 'super', label: 'System overview', icon: ShieldCheck, superOnly: true },
      { key: 'roles', label: 'Roles & access', icon: KeyRound, superOnly: true },
      // Creating accounts is account administration — it belongs here, and the
      // superOnly flag now matches the guard the form already applied.
      { key: 'create-expert', label: 'Add expert', icon: UserPlus, superOnly: true },
    ],
  },
];

function AdminDashboardInner() {
  const { user, ready, isSuperAdmin, logout } = useAuth('admin');
  const { showToast } = useToast();

  const [panel, setPanel] = useState<PanelKey>('dashboard');
  const [refreshKey, setRefreshKey] = useState(0);
  const [chatOrderId, setChatOrderId] = useState<number | null>(null);
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [assignTarget, setAssignTarget] = useState<{ order: OrderDTO; reassign: boolean } | null>(null);
  const [priceTarget, setPriceTarget] = useState<OrderDTO | null>(null);
  const [payLinkTarget, setPayLinkTarget] = useState<OrderDTO | null>(null);
  const [filesTarget, setFilesTarget] = useState<OrderDTO | null>(null);
  const [detailOrderId, setDetailOrderId] = useState<number | null>(null);
  const [deadlinesTarget, setDeadlinesTarget] = useState<OrderDTO | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<OrderDTO | null>(null);
  const [orderBusy, setOrderBusy] = useState(false);
  const [editTarget, setEditTarget] = useState<OrderDetailDTO | null>(null);
  const [editLoadingId, setEditLoadingId] = useState<number | null>(null);

  const goToPanel = useCallback((key: string) => setPanel(key as PanelKey), []);

  const openOrderDetail = useCallback((id: number, subject = '') => {
    trackRecentOrder(id, subject);
    setDetailOrderId(id);
    setPanel('order-detail');
  }, []);

  const runOrderAction = useCallback(
    async (fn: () => Promise<unknown>, message: string) => {
      setOrderBusy(true);
      try {
        await fn();
        showToast(message, 'success');
        setRefreshKey((k) => k + 1);
      } catch (e) {
        showToast((e as Error).message, 'error');
      } finally {
        setOrderBusy(false);
      }
    },
    [showToast]
  );

  /**
   * The orders LIST DTO has no university, academic level or instructions, so
   * opening the editor from a table row fetches the full detail first. Opening
   * from the detail page already has it and passes it straight through.
   */
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

  const openChatFor = useCallback((order: OrderDTO) => {
    setChatOrderId(order.id);
    setPanel('chats');
  }, []);

  const nav = useMemo(
    () =>
      NAV.map((g) => ({
        ...g,
        items: g.items.map((i) =>
          i.key === 'chats' ? { ...i, count: unreadTotal, urgent: unreadTotal > 0 } : i
        ),
      })),
    [unreadTotal]
  );

  const commands: CommandItem[] = useMemo(
    () =>
      NAV.flatMap((g) => g.items)
        .filter((i) => !i.superOnly || isSuperAdmin)
        .map((i) => ({
          id: i.key,
          label: PANEL_TITLES[i.key as PanelKey] ?? i.label,
          icon: i.icon,
          hint: 'Panel',
          action: () => goToPanel(i.key),
        })),
    [isSuperAdmin, goToPanel]
  );

  const palette = useCommandPalette(commands);

  /**
   * Expert workload, counted from real order records rather than invented.
   * The API exposes no workload figure, so this counts orders currently
   * attached to each expert within the fetched window — and the dialog states
   * that window so the number is not read as an absolute.
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
  const displayName = (user?.email.split('@')[0] ?? 'there').replace(/[._-]/g, ' ');

  if (!ready) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        <Spinner />
      </div>
    );
  }
  if (!user) return null;

  return (
    <>
      <AppShell
        portal="admin"
        groups={nav}
        active={panel}
        onNavigate={goToPanel}
        title={PANEL_TITLES[panel]}
        parent={panel === 'order-detail' ? { label: 'Orders', onClick: () => goToPanel('orders') } : undefined}
        userName={displayName}
        userEmail={user.email}
        userRole={user.role}
        isSuperAdmin={isSuperAdmin}
        onLogout={logout}
        onOpenPalette={palette.open}
        notificationCount={unreadTotal}
      >
        {panel === 'dashboard' && (
          <DashboardHome
            key={`dash-${refreshKey}`}
            name={displayName}
            showRevenue={isSuperAdmin}
            onOpenOrder={openOrderDetail}
            onNavigate={goToPanel}
          />
        )}

        {panel === 'orders' && (
          <OrdersPanel
            refreshKey={refreshKey}
            onOpenDetail={openOrderDetail}
            onAssign={(order, reassign) => setAssignTarget({ order, reassign })}
            onOpenChat={openChatFor}
            onOpenFiles={setFilesTarget}
            onSetPrice={setPriceTarget}
            onPayLink={setPayLinkTarget}
            onEditDeadlines={setDeadlinesTarget}
            onEditOrder={openEditor}
            editLoadingId={editLoadingId}
            onDelete={isSuperAdmin ? setDeleteTarget : undefined}
            onCreate={() => goToPanel('create-order')}
          />
        )}

        {panel === 'order-detail' && detailOrderId != null && (
          <OrderDetail
            key={`detail-${detailOrderId}-${refreshKey}`}
            orderId={detailOrderId}
            isSuperAdmin={isSuperAdmin}
            busy={orderBusy}
            onBack={() => goToPanel('orders')}
            onAssign={(order, reassign) => setAssignTarget({ order, reassign })}
            onSetPrice={setPriceTarget}
            onPayLink={setPayLinkTarget}
            onOpenFiles={setFilesTarget}
            onOpenChat={openChatFor}
            onEditDeadlines={setDeadlinesTarget}
            onEditOrder={setEditTarget}
            onDelete={setDeleteTarget}
            onUnassign={(order) =>
              runOrderAction(() => ordersApi.unassign(order.id), `${fmtOrderId(order.id)} unassigned.`)}
            onComplete={(order) =>
              runOrderAction(() => ordersApi.complete(order.id), `${fmtOrderId(order.id)} marked completed.`)}
          />
        )}

        {panel === 'assign' && (
          <AssignOrdersPanel
            key={`assign-${refreshKey}`}
            refreshKey={refreshKey}
            onAssign={(order) => setAssignTarget({ order, reassign: false })}
            onOpenDetail={openOrderDetail}
          />
        )}

        {panel === 'students' && (
          <StudentsPanel
            onOpenOrder={openOrderDetail}
            onOpenFiles={setFilesTarget}
            onOpenChat={openChatFor}
            onPayLink={setPayLinkTarget}
          />
        )}

        {panel === 'payverify' && <VerifyPaymentsPanel />}

        {panel === 'installments' && <InstallmentsPanel />}

        {panel === 'create-expert' && <AddExpertPanel isSuperAdmin={isSuperAdmin} />}

        {panel === 'reviews' && <ReviewsPanel onAddExternal={() => goToPanel('add-review')} />}

        {panel === 'add-review' && <ExternalReviewPanel onDone={() => goToPanel('reviews')} />}

        {panel === 'deleted-orders' && <DeletedOrdersPanel />}

        {panel === 'roles' && <RolesPanel isSuperAdmin={isSuperAdmin} />}

        {panel === 'coupons' && <CouponsPanel key={`coupons-${refreshKey}`} />}

        {panel === 'analytics' && (
          <AnalyticsPanel
            key={`analytics-${refreshKey}`}
            onNavigate={goToPanel}
            onOpenOrder={openOrderDetail}
          />
        )}

        {panel === 'super' && (
          <SystemOverviewPanel
            key={`sys-${refreshKey}`}
            isSuperAdmin={isSuperAdmin}
            onNavigate={goToPanel}
            onOpenOrder={openOrderDetail}
          />
        )}

        {panel === 'create-order' && (
          <CreateOrderPanel
            onViewOrder={(id) => openOrderDetail(id)}
            onCreated={() => setRefreshKey((k) => k + 1)}
            onSetPrice={async (id) => {
              // The success screen only has the new order's ID, and SetPriceModal
              // needs the record — fetch it rather than passing a stub.
              try {
                // detail's `status` is EnumLike (string or {name}); the modal
                // only reads id/subject/price, so the narrowing is safe here.
                const detail = await ordersApi.detail(id);
                setPriceTarget(detail as unknown as OrderDTO);
              } catch (e) {
                showToast((e as Error).message, 'error');
              }
            }}
          />
        )}

        {panel === 'experts' && (
          <ExpertsPanel key={`experts-${refreshKey}`} onNavigate={goToPanel} />
        )}

        {panel === 'chats' && (
          <ChatCenter
            adminId={user.id}
            onViewOrder={(id) => openOrderDetail(id)}
            initialOrderId={chatOrderId}
            onUnreadTotalChange={setUnreadTotal}
          />
        )}
      </AppShell>

      <AssignOrderDialog
        order={assignTarget?.order ?? null}
        isReassign={assignTarget?.reassign ?? false}
        workload={workload}
        workloadNote={workloadNote}
        onClose={() => setAssignTarget(null)}
        onAssigned={() => setRefreshKey((k) => k + 1)}
      />

      <SetPriceModal
        order={priceTarget}
        onClose={() => setPriceTarget(null)}
        onSaved={() => setRefreshKey((k) => k + 1)}
      />

      <PayLinkModal order={payLinkTarget} onClose={() => setPayLinkTarget(null)} />

      <FileGalleryModal order={filesTarget} onClose={() => setFilesTarget(null)} />

      <EditDeadlinesModal
        order={deadlinesTarget}
        onClose={() => setDeadlinesTarget(null)}
        onSaved={() => setRefreshKey((k) => k + 1)}
      />

      <OrderEditDialog
        order={editTarget}
        onClose={() => setEditTarget(null)}
        onSaved={() => setRefreshKey((k) => k + 1)}
      />

      <DeleteOrderModal
        order={deleteTarget}
        adminId={user?.id ?? null}
        onClose={() => setDeleteTarget(null)}
        onDeleted={() => { setDeleteTarget(null); goToPanel('orders'); setRefreshKey((k) => k + 1); }}
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
    </>
  );
}

export default function AdminDashboardPage() {
  return (
    <ToastProvider>
      <AdminDashboardInner />
    </ToastProvider>
  );
}
