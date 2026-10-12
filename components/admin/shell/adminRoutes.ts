import {
  LayoutDashboard, Boxes, Send, GraduationCap, Users, MessagesSquare, UserPlus,
  CreditCard, BadgeCheck, FilePlus2, Star, PenLine, LineChart, ShieldCheck,
  KeyRound, Trash2, Ticket,
} from 'lucide-react';
import type { NavGroup, NavItem } from '@/components/layout/AppShell';

/**
 * The admin portal's route table — the one place that maps a sidebar key to a
 * URL, a page title and a permission.
 *
 * Every sidebar entry is its own App Router page under app/admin/(portal)/.
 * The keys are the vocabulary components already use when they ask to go
 * somewhere (DashboardHome, Analytics and System overview all call
 * onNavigate('orders'), onNavigate('payverify') and so on); `hrefFor` turns
 * those requests into real navigations, so none of those components change.
 *
 * Super-admin pages live under /admin/ rather than a separate /super-admin/
 * tree because that is how the product actually works: one admin portal, one
 * login, one sidebar, with super-admin entries shown to that role. A separate
 * URL tree would make a super admin cross between two layouts mid-session.
 */
export interface AdminPage {
  href: string;
  title: string;
  superOnly?: boolean;
}

export const ADMIN_PAGES = {
  dashboard:        { href: '/admin/dashboard',        title: 'Dashboard' },
  orders:           { href: '/admin/orders',           title: 'Orders' },
  assign:           { href: '/admin/assign-orders',    title: 'Assign orders' },
  'deleted-orders': { href: '/admin/deleted-orders',   title: 'Deleted orders' },
  analytics:        { href: '/admin/analytics',        title: 'Analytics' },
  students:         { href: '/admin/students',         title: 'Students' },
  experts:          { href: '/admin/experts',          title: 'Experts' },
  chats:            { href: '/admin/chat',             title: 'Chat' },
  installments:     { href: '/admin/installments',     title: 'Installments' },
  payverify:        { href: '/admin/verify-payments',  title: 'Verify payments' },
  coupons:          { href: '/admin/coupons',          title: 'Coupons' },
  'create-order':   { href: '/admin/create-order',     title: 'Create order' },
  reviews:          { href: '/admin/reviews',          title: 'Reviews' },
  'add-review':     { href: '/admin/external-reviews', title: 'External review' },
  super:            { href: '/admin/system-overview',  title: 'System overview', superOnly: true },
  roles:            { href: '/admin/roles-access',     title: 'Roles & access',  superOnly: true },
  'create-expert':  { href: '/admin/add-expert',       title: 'Add expert',      superOnly: true },
} as const satisfies Record<string, AdminPage>;

export type AdminPageKey = keyof typeof ADMIN_PAGES;

export const ORDER_DETAIL_TITLE = 'Order detail';

export function hrefFor(key: string): string {
  return (ADMIN_PAGES as Record<string, AdminPage>)[key]?.href ?? ADMIN_PAGES.dashboard.href;
}

export const orderDetailHref = (id: number) => `/admin/orders/${id}`;
export const chatHref = (orderId?: number | null) =>
  orderId != null ? `${ADMIN_PAGES.chats.href}?order=${orderId}` : ADMIN_PAGES.chats.href;

/**
 * Which sidebar entry owns this pathname. Matches exactly or on a path
 * boundary, so /admin/orders/2417 highlights Orders — while /admin/orders does
 * not accidentally claim /admin/orders-archive if such a page ever exists.
 */
export function keyForPath(pathname: string): AdminPageKey | null {
  let best: { key: AdminPageKey; len: number } | null = null;
  for (const [key, page] of Object.entries(ADMIN_PAGES) as [AdminPageKey, AdminPage][]) {
    const h = page.href;
    if (pathname === h || pathname.startsWith(h + '/')) {
      if (!best || h.length > best.len) best = { key, len: h.length };
    }
  }
  return best?.key ?? null;
}

export const isOrderDetailPath = (pathname: string) => /^\/admin\/orders\/[^/]+$/.test(pathname);

export function titleForPath(pathname: string): string {
  if (isOrderDetailPath(pathname)) return ORDER_DETAIL_TITLE;
  const key = keyForPath(pathname);
  return key ? ADMIN_PAGES[key].title : 'Admin';
}

const link = (key: AdminPageKey, label: string, icon: NavItem['icon']): NavItem => {
  const page: AdminPage = ADMIN_PAGES[key];
  return { key, label, icon, href: page.href, superOnly: page.superOnly === true };
};

/** Sidebar groups — same order and grouping as before; every item is now a real link. */
export const ADMIN_NAV: NavGroup[] = [
  {
    items: [
      link('dashboard', 'Dashboard', LayoutDashboard),
      link('orders', 'Orders', Boxes),
      link('assign', 'Assign orders', Send),
      link('deleted-orders', 'Deleted orders', Trash2),
      link('analytics', 'Analytics', LineChart),
    ],
  },
  {
    title: 'People',
    items: [
      link('students', 'Students', GraduationCap),
      link('experts', 'Experts', Users),
      link('chats', 'Chat', MessagesSquare),
    ],
  },
  {
    title: 'Billing',
    items: [
      link('installments', 'Installments', CreditCard),
      link('payverify', 'Verify payments', BadgeCheck),
      link('coupons', 'Coupons', Ticket),
    ],
  },
  {
    title: 'Content',
    items: [
      link('create-order', 'Create order', FilePlus2),
      link('reviews', 'Reviews', Star),
      link('add-review', 'External review', PenLine),
    ],
  },
  {
    title: 'Super admin',
    items: [
      link('super', 'System overview', ShieldCheck),
      link('roles', 'Roles & access', KeyRound),
      link('create-expert', 'Add expert', UserPlus),
    ],
  },
];
