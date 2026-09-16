'use client';

import {
  createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode,
} from 'react';

export type Theme = 'light' | 'dark';
export type ThemePref = Theme | 'system';

const KEY = 'qti_theme';

interface ThemeContextValue {
  /** What the user chose — may be 'system'. */
  preference: ThemePref;
  /** What is actually painted right now. */
  theme: Theme;
  setPreference: (p: ThemePref) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function systemTheme(): Theme {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function apply(theme: Theme) {
  const el = document.documentElement;
  el.setAttribute('data-theme', theme);
  // Tells the browser to theme form controls and scrollbars to match.
  el.style.colorScheme = theme;
}

/**
 * One theme system for the whole app. Mount once at the root.
 *
 * The initial paint is handled by the inline script in app/layout.tsx — this
 * provider only takes over afterwards, so there is no flash of the wrong theme
 * and no hydration mismatch (the server never guesses a theme).
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPref] = useState<ThemePref>('system');
  const [theme, setTheme] = useState<Theme>('dark');

  useEffect(() => {
    let stored: ThemePref = 'system';
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw === 'light' || raw === 'dark' || raw === 'system') stored = raw;
    } catch { /* private mode */ }

    setPref(stored);
    const resolved = stored === 'system' ? systemTheme() : stored;
    setTheme(resolved);
    apply(resolved);
  }, []);

  // Follow the OS only while the user is actually on 'system'.
  useEffect(() => {
    if (preference !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const onChange = () => {
      const next = mq.matches ? 'light' : 'dark';
      setTheme(next);
      apply(next);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [preference]);

  const setPreference = useCallback((p: ThemePref) => {
    setPref(p);
    try { window.localStorage.setItem(KEY, p); } catch { /* ignore */ }
    const resolved = p === 'system' ? systemTheme() : p;
    setTheme(resolved);
    apply(resolved);
  }, []);

  const toggle = useCallback(() => {
    setPreference(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setPreference]);

  const value = useMemo(
    () => ({ preference, theme, setPreference, toggle }),
    [preference, theme, setPreference, toggle]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  // Falling back rather than throwing keeps a stray component from crashing the
  // page if it renders outside the provider.
  if (!ctx) {
    return { preference: 'dark', theme: 'dark', setPreference: () => {}, toggle: () => {} };
  }
  return ctx;
}
