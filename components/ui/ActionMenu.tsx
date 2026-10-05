'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { MoreVertical } from 'lucide-react';

export interface MenuAction {
  key: string;
  label: string;
  icon: ReactNode;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
}

/**
 * Overflow menu for secondary row actions on narrow viewports.
 *
 * Actions move here rather than disappearing — the label is always shown, so a
 * control that is icon-only on desktop becomes fully readable on mobile, which
 * is the opposite of the usual responsive compromise.
 */
export function ActionMenu({ actions, label = 'More actions' }: { actions: MenuAction[]; label?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, close]);

  if (actions.length === 0) return null;

  return (
    <div className="amenu" ref={ref}>
      <button
        type="button"
        className="act act-icon"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((v) => !v)}
      >
        <MoreVertical size={13} />
      </button>

      {open && (
        <div className="amenu-pop" role="menu">
          {actions.map((a) => (
            <button
              key={a.key}
              type="button"
              role="menuitem"
              className={`amenu-item${a.danger ? ' danger' : ''}`}
              disabled={a.disabled}
              onClick={() => { a.onSelect(); close(); }}
            >
              {a.icon}
              <span>{a.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
