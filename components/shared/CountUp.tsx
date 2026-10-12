'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Count-up animation for the stat cards. Non-numeric values (e.g. "$1,200")
 * render immediately, matching the original behaviour.
 */
export function CountUp({ value, duration = 600 }: { value: number | string; duration?: number }) {
  const isNumeric = typeof value === 'number';
  const [display, setDisplay] = useState<number | string>(isNumeric ? 0 : value);
  const frameRef = useRef(0);

  useEffect(() => {
    if (!isNumeric) {
      setDisplay(value);
      return;
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDisplay(value);
      return;
    }

    const target = value;
    const start = performance.now();

    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      // easeOutQuad — fast start, gentle settle
      setDisplay(Math.round(target * (1 - (1 - progress) * (1 - progress))));
      if (progress < 1) frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(frameRef.current);
  }, [value, duration, isNumeric]);

  return <>{display}</>;
}
