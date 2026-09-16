'use client';

import { useEffect, useState, type ReactNode } from 'react';
import {
  Menu, PanelLeftClose, PanelLeft, Search, Bell, LogOut, ChevronRight,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import './shell.css';

export interface NavItem {
  key: string;
  label: string;
  icon: LucideIcon;
  superOnly?: boolean;
  count?: number;
  urgent?: boolean;
}

export interface NavGroup {
  title?: string;
  items: NavItem[];
}

interface AppShellProps {
  portal: 'admin' | 'expert';
  groups: NavGroup[];
  active: string;
  onNavigate: (key: string) => void;
  title: string;
  /** Parent crumb, e.g. "Orders" when viewing an order. */
  parent?: { label: string; onClick: () => void };
  userName: string;
  userEmail: string;
  userRole: string;
  isSuperAdmin: boolean;
  onLogout: () => void;
  onOpenPalette: () => void;
  notificationCount?: number;
  children: ReactNode;
}

export function AppShell({
  portal, groups, active, onNavigate, title, parent, userName, userEmail, userRole,
  isSuperAdmin, onLogout, onOpenPalette, notificationCount = 0, children,
}: AppShellProps) {
  const [drawer, setDrawer] = useState(false);
  const [rail, setRail] = useState(false);

  // Collapse preference is per-device, so it lives in localStorage rather than
  // being pushed to the backend.
  useEffect(() => {
    try {
      setRail(window.localStorage.getItem('qti_rail') === '1');
    } catch { /* private mode */ }
  }, []);

  const toggleRail = () => {
    setRail((v) => {
      const next = !v;
      try { window.localStorage.setItem('qti_rail', next ? '1' : '0'); } catch { /* ignore */ }
      return next;
    });
  };

  useEffect(() => setDrawer(false), [active]);

  useEffect(() => {
    if (!drawer) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setDrawer(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [drawer]);

  const initial = (userName || userEmail || '?').charAt(0).toUpperCase();

  return (
    <div className={`app${rail ? ' rail' : ''}`} data-portal={portal}>
      <aside className={`side${drawer ? ' open' : ''}`} aria-label="Main">
        <div className="side-top">
          <span className="wordmark">QTI<em>Services</em></span>
        </div>

        <nav className="side-nav scroll-y">
          {groups.map((group, gi) => {
            const items = group.items.filter((i) => !i.superOnly || isSuperAdmin);
            if (!items.length) return null;
            return (
              <div className="nav-group" key={group.title ?? gi}>
                {group.title && <div className="nav-group-title">{group.title}</div>}
                {items.map((item) => {
                  const Icon = item.icon;
                  const on = active === item.key;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      className={`nav-item${on ? ' on' : ''}`}
                      onClick={() => onNavigate(item.key)}
                      aria-current={on ? 'page' : undefined}
                      title={rail ? item.label : undefined}
                    >
                      <Icon size={16} strokeWidth={2} />
                      <span className="nav-label">{item.label}</span>
                      {item.count != null && item.count > 0 && (
                        <span className={`nav-count${item.urgent ? ' urgent' : ''}`}>
                          {item.count > 99 ? '99+' : item.count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </nav>

        <div className="side-foot">
          <div className="user-row">
            <div className="avatar" aria-hidden>{initial}</div>
            <div className="user-meta truncate" style={{ flex: 1 }}>
              <div className="t-sm truncate" style={{ fontWeight: 600 }}>{userName}</div>
              <div className="t-xs text-dim truncate">{userRole.replace(/_/g, ' ').toLowerCase()}</div>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onLogout} style={{ width: '100%', marginTop: 4 }}>
            <LogOut size={13} /> Sign out
          </Button>
        </div>
      </aside>

      <div className={`scrim${drawer ? ' on' : ''}`} onClick={() => setDrawer(false)} aria-hidden />

      <div className="main">
        <header className="topbar">
          <button type="button" className="icon-btn menu-btn" onClick={() => setDrawer(true)} aria-label="Open menu">
            <Menu size={17} />
          </button>
          <button
            type="button"
            className="icon-btn rail-btn"
            onClick={toggleRail}
            aria-label={rail ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {rail ? <PanelLeft size={17} /> : <PanelLeftClose size={17} />}
          </button>

          <div className="crumb">
            {parent && (
              <>
                <button type="button" className="crumb-parent" onClick={parent.onClick}
                        style={{ color: 'inherit' }}>
                  {parent.label}
                </button>
                <ChevronRight size={13} className="crumb-parent" />
              </>
            )}
            <strong>{title}</strong>
          </div>

          <div style={{ flex: 1 }} />

          <button type="button" className="search-trigger" onClick={onOpenPalette} aria-label="Search">
            <Search size={14} />
            <span>Search</span>
            <kbd>⌘K</kbd>
          </button>

          <ThemeToggle compact />

          <button type="button" className="icon-btn" aria-label={`Notifications${notificationCount ? `, ${notificationCount} unread` : ''}`}>
            <Bell size={17} />
            {notificationCount > 0 && <span className="pip" />}
          </button>

          <div className="avatar" title={userEmail} aria-hidden>{initial}</div>
        </header>

        <main className="content">{children}</main>
      </div>
    </div>
  );
}
