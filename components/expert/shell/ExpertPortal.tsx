'use client';

import {
  createContext, useCallback, useContext, useMemo, useState, type ReactNode,
} from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, ClipboardList, CalendarClock, FolderOpen, UserRound } from 'lucide-react';
import { AppShell, type NavGroup } from '@/components/layout/AppShell';
import { CommandPalette } from '@/components/shared/CommandPalette';
import { Spinner } from '@/components/shared/Spinner';
import { ExpertOrderDetailModal } from '@/components/expert/ExpertOrderDetailModal';
import { SubmitWorkModal } from '@/components/expert/SubmitWorkModal';
import { useToast } from '@/hooks/useToast';
import { useAuth } from '@/hooks/useAuth';
import { useCommandPalette, type CommandItem } from '@/hooks/useCommandPalette';
import { expertApi } from '@/lib/api/expert';
import type { AuthUser, OrderDTO } from '@/types';

/**
 * Expert portal route table. Every sidebar entry is its own App Router page
 * under app/expert/(portal)/. There is no chat entry: the expert sidebar has
 * never had one, and this change adds no functionality.
 */
export const EXPERT_PAGES = {
  dashboard: { href: '/expert/dashboard', title: 'Dashboard' },
  orders:    { href: '/expert/orders',    title: 'My orders' },
  deadlines: { href: '/expert/deadlines', title: 'Deadlines' },
  files:     { href: '/expert/files',     title: 'Order files' },
  profile:   { href: '/expert/profile',   title: 'My profile' },
} as const;

type ExpertKey = keyof typeof EXPERT_PAGES;

export const expertFilesHref = (orderId?: number | null) =>
  orderId != null ? `${EXPERT_PAGES.files.href}?order=${orderId}` : EXPERT_PAGES.files.href;

export function expertKeyForPath(pathname: string): ExpertKey | null {
  for (const [key, page] of Object.entries(EXPERT_PAGES) as [ExpertKey, { href: string }][]) {
    if (pathname === page.href || pathname.startsWith(page.href + '/')) return key;
  }
  return null;
}

export const EXPERT_NAV: NavGroup[] = [
  {
    items: [
      { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, href: EXPERT_PAGES.dashboard.href },
      { key: 'orders', label: 'My orders', icon: ClipboardList, href: EXPERT_PAGES.orders.href },
      { key: 'deadlines', label: 'Deadlines', icon: CalendarClock, href: EXPERT_PAGES.deadlines.href },
    ],
  },
  {
    title: 'Work',
    items: [
      { key: 'files', label: 'Order files', icon: FolderOpen, href: EXPERT_PAGES.files.href },
      { key: 'profile', label: 'My profile', icon: UserRound, href: EXPERT_PAGES.profile.href },
    ],
  },
];

interface ExpertPortalValue {
  user: AuthUser;
  refreshKey: number;
  openDetail: (orderId: number) => void;
  openSubmit: (order: OrderDTO) => void;
  /** Goes to Order files with that order preselected, via ?order= in the URL. */
  openFilesFor: (orderId: number) => void;
}

const ExpertPortalContext = createContext<ExpertPortalValue | null>(null);

export function useExpertPortal(): ExpertPortalValue {
  const v = useContext(ExpertPortalContext);
  if (!v) throw new Error('useExpertPortal must be used inside the expert portal layout.');
  return v;
}

export function ExpertPortalShell({ children }: { children: ReactNode }) {
  const { user, ready, logout } = useAuth('expert');
  const { showToast } = useToast();
  const router = useRouter();
  const pathname = usePathname() ?? EXPERT_PAGES.dashboard.href;

  const [detailOrderId, setDetailOrderId] = useState<number | null>(null);
  const [submitOrder, setSubmitOrder] = useState<OrderDTO | null>(null);
  const [startingId, setStartingId] = useState<number | null>(null);
  /** Bumped after a mutation so the active page re-fetches rather than showing stale rows. */
  const [refreshKey, setRefreshKey] = useState(0);

  const navigate = useCallback(
    (key: string) => router.push(EXPERT_PAGES[key as ExpertKey]?.href ?? EXPERT_PAGES.dashboard.href),
    [router]
  );
  const openFilesFor = useCallback((orderId: number) => router.push(expertFilesHref(orderId)), [router]);

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
      EXPERT_NAV.flatMap((g) => g.items).map((i) => ({
        id: i.key,
        label: i.label,
        icon: i.icon,
        hint: 'Go to',
        action: () => navigate(i.key),
      })),
    [navigate]
  );
  const palette = useCommandPalette(commands);

  const value = useMemo<ExpertPortalValue | null>(
    () =>
      user
        ? { user, refreshKey, openDetail: setDetailOrderId, openSubmit: setSubmitOrder, openFilesFor }
        : null,
    [user, refreshKey, openFilesFor]
  );

  // One neutral frame while localStorage is read — avoids flashing the portal
  // to a signed-out user or the login page to a signed-in one.
  if (!ready) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        <Spinner />
      </div>
    );
  }
  if (!user || !value) return null;

  const key = expertKeyForPath(pathname);

  return (
    <ExpertPortalContext.Provider value={value}>
      <AppShell
        portal="expert"
        groups={EXPERT_NAV}
        active={key ?? ''}
        title={key ? EXPERT_PAGES[key].title : 'Expert'}
        userName={(user.email.split('@')[0] ?? 'there').replace(/[._-]/g, ' ')}
        userEmail={user.email}
        userRole={user.role}
        isSuperAdmin={false}
        onLogout={logout}
        onOpenPalette={palette.open}
      >
        {/* The expert portal's panels still use the legacy stylesheet, scoped
            under this wrapper — it moved here from the old single page so every
            route keeps it. */}
        <div className="legacy" data-portal="expert">{children}</div>
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
    </ExpertPortalContext.Provider>
  );
}
