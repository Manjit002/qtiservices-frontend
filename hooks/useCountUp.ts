'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Count-up animation for the stat cards.
 *
 * Non-numeric targets (e.g. "$1,200") are shown immediately rather than
 * animated, matching the legacy behaviour, and the rAF loop is cancelled on
 * unmount. Honours prefers-reduced-motion.
 */
export function useCountUp(target: number | string, duration = 600): number | string {
  const [display, setDisplay] = useState<number | string>(
    typeof target === 'number' ? 0 : target
  );
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof target !== 'number' || !Number.isFinite(target)) {
      setDisplay(target);
      return;
    }

    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduced || duration <= 0) {
      setDisplay(target);
      return;
    }

    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      // easeOutQuad — matches the original's feel
      const eased = 1 - (1 - progress) * (1 - progress);
      setDisplay(Math.round(target * eased));
      if (progress < 1) frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);

    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [target, duration]);

  return display;
}
