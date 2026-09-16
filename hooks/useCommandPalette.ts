'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';

import type { LucideIcon } from 'lucide-react';

export interface CommandItem {
  id: string;
  label: string;
  icon: LucideIcon;
  hint?: string;
  action: () => void;
}

/**
 * Ctrl+K / Cmd+K palette. The listener is bound to the document and removed on
 * unmount; typing into an input or textarea is ignored so the shortcut cannot
 * hijack the chat composer.
 */
export function useCommandPalette(items: CommandItem[]) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => i.label.toLowerCase().includes(q));
  }, [items, query]);

  const close = useCallback(() => {
    setIsOpen(false);
    setQuery('');
    setActiveIndex(0);
  }, []);

  const open = useCallback(() => {
    setIsOpen(true);
    setQuery('');
    setActiveIndex(0);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsOpen((v) => !v);
        setQuery('');
        setActiveIndex(0);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, Math.max(0, filtered.length - 1)));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) => Math.max(0, i - 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const item = filtered[activeIndex];
        if (item) {
          item.action();
          close();
        }
      }
    },
    [filtered, activeIndex, close]
  );

  return { isOpen, open, close, query, setQuery, filtered, activeIndex, setActiveIndex, onKeyDown };
}
