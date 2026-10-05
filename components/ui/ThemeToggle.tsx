'use client';

import { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';

/**
 * Two-state switch with the knob carrying the icon.
 *
 * Renders a neutral placeholder until mounted: the server cannot know the
 * theme, so painting either icon during SSR guarantees a hydration mismatch.
 */
export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { theme, toggle } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isLight = theme === 'light';

  if (!mounted) {
    return <span className={`theme-switch${compact ? ' compact' : ''}`} aria-hidden />;
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isLight}
      aria-label={`Switch to ${isLight ? 'dark' : 'light'} theme`}
      title={`Switch to ${isLight ? 'dark' : 'light'} theme`}
      className={`theme-switch${compact ? ' compact' : ''}${isLight ? ' on' : ''}`}
      onClick={toggle}
    >
      <span className="theme-knob">
        {isLight ? <Sun size={11} /> : <Moon size={11} />}
      </span>
    </button>
  );
}
