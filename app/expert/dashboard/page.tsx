'use client';

import { useCallback, useMemo, useState } from 'react';
import { AppShell, type NavGroup } from '@/components/layout/AppShell';
import { LayoutDashboard, ClipboardList, CalendarClock, FolderOpen, UserRound } from 'lucide-react';
import { CommandPalette } from '@/components/shared/CommandPalette';
import { Spinner } from '@/components/shared/Spinner';
import { ExpertDashboardPanel } from '@/components/expert/ExpertDashboardPanel';
import { ExpertOrdersPanel } from '@/components/expert/ExpertOrdersPanel';
import { ExpertDeadlinesPanel } from '@/components/expert/ExpertDeadlinesPanel';
import { ExpertFilesPanel } from '@/components/expert/ExpertFilesPanel';
import { ExpertProfilePanel } from '@/components/expert/ExpertProfilePanel';
import { ExpertOrderDetailModal } from '@/components/expert/ExpertOrderDetailModal';
import { SubmitWorkModal } from '@/components/expert/SubmitWorkModal';
import { ToastProvider, useToast } from '@/hooks/useToast';
import { useAuth } from '@/hooks/useAuth';
import { useCommandPalette, type CommandItem } from '@/hooks/useCommandPalette';
import { expertApi } from '@/lib/api/expert';
import type { OrderDTO } from '@/types';
import '@/styles/expert-dashboard.css';
import '@/styles/migration-additions.css';

type PanelKey = 'dashboard' | 'orders' | 'deadlines' | 'files' | 'profile';

const PANEL_TITLES: Record<PanelKey, string> = {
  dashboard: 'Dashboard',
  orders: 'My orders',
  deadlines: 'Deadlines',
  files: 'Order files',
  profile: 'My profile',
};

const NAV: NavGroup[] = [
  {
    items: [
      { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { key: 'orders', label: 'My orders', icon: ClipboardList },
      { key: 'deadlines', label: 'Deadlines', icon: CalendarClock },
    ],
  },
  {
    title: 'Work',
    items: [
      { key: 'files', label: 'Order files', icon: FolderOpen },
      { key: 'profile', label: 'My profile', icon: UserRound },
    ],
  },
];

function ExpertDashboardInner() {
  const { user, ready, logout } = useAuth('expert');
  const { showToast } = useToast();

  const [panel, setPanel] = useState<PanelKey>('dashboard');
  const [detailOrderId, setDetailOrderId] = useState<number | null>(null);
  const [submitOrder, setSubmitOrder] = useState<OrderDTO | null>(null);
  const [filesOrderId, setFilesOrderId] = useState<number | null>(null);
  const [startingId, setStartingId] = useState<number | null>(null);
  /** Bumped after a mutation so the active panel re-fetches rather than showing stale rows. */
  const [refreshKey, setRefreshKey] = useState(0);

  const goToPanel = useCallback((key: string) => setPanel(key as PanelKey), []);

  const openFilesFor = useCallback((orderId: number) => {
    setFilesOrderId(orderId);
    setPanel('files');
  }, []);

  const handleStartWork = useCallback(
    async (orderId: number) => {
      setStartingId(orderId);
      try {
        await expertApi.startWork(orderId);
        showToast('Work started — order moved to IN_PROGRESS.', 'success');
        setDetailOrderId(null);
        setRefreshKey((k) => k + 1);
      } catch (e) {
        showToast((e as Error).message, 'error');
      } finally {
        setStartingId(null);
      }
    },
    [showToast]
  );

  const commands: CommandItem[] = useMemo(
    () =>
      NAV.flatMap((g) => g.items).map((i) => ({
        id: i.key,
        label: i.label,
        icon: i.icon,
        hint: 'Go to',
        action: () => goToPanel(i.key),
      })),
    [goToPanel]
  );

  const palette = useCommandPalette(commands);

  // One neutral frame while localStorage is read — avoids flashing the dashboard
  // to a signed-out user or the login page to a signed-in one.
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
        portal="expert"
        groups={NAV}
        active={panel}
        onNavigate={goToPanel}
        title={PANEL_TITLES[panel]}
        userName={(user.email.split('@')[0] ?? 'there').replace(/[._-]/g, ' ')}
        userEmail={user.email}
        userRole={user.role}
        isSuperAdmin={false}
        onLogout={logout}
        onOpenPalette={palette.open}
      >
        {/* Only the active panel is mounted — inactive panels do not fetch or
            hold subscriptions, which is why nav always shows fresh data. */}
        <div className="legacy" data-portal="expert">
          {panel === 'dashboard' && (
            <ExpertDashboardPanel key={`dash-${refreshKey}`} onOpenOrder={setDetailOrderId} />
          )}
          {panel === 'orders' && (
            <ExpertOrdersPanel
              key={`orders-${refreshKey}`}
              onOpenDetail={setDetailOrderId}
              onSubmitWork={setSubmitOrder}
              onOpenFiles={openFilesFor}
            />
          )}
          {panel === 'deadlines' && (
            <ExpertDeadlinesPanel key={`dl-${refreshKey}`} onOpenOrder={setDetailOrderId} />
          )}
          {panel === 'files' && (
            <ExpertFilesPanel key={`files-${refreshKey}`} initialOrderId={filesOrderId} />
          )}
          {panel === 'profile' && <ExpertProfilePanel />}
        </div>

      </AppShell>

      <ExpertOrderDetailModal
        orderId={detailOrderId}
        onClose={() => setDetailOrderId(null)}
        onStartWork={handleStartWork}
        onSubmitWork={(o) => {
          setDetailOrderId(null);
          setSubmitOrder(o);
        }}
        busy={startingId !== null}
      />

      <SubmitWorkModal
        order={submitOrder}
        onClose={() => setSubmitOrder(null)}
        onSubmitted={() => setRefreshKey((k) => k + 1)}
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

export default function ExpertDashboardPage() {
  return (
    <ToastProvider>
      <ExpertDashboardInner />
    </ToastProvider>
  );
}
