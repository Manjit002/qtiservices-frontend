'use client';

import { useEffect, useRef, useState } from 'react';
import { STATS } from './content';

/**
 * Counters that run once when the strip scrolls into view — the source's
 * IntersectionObserver behaviour, with the same cubic ease-out and 1600ms
 * duration.
 *
 * Differences from the original, both deliberate:
 *  - honours prefers-reduced-motion by showing the final value immediately
 *  - renders the final value as the SSR output, so the numbers are correct
 *    before hydration and for anyone with JS disabled
 */
const DURATION = 1600;

function format(v: number, decimals: number, suffix: string) {
  return v.toFixed(decimals) + suffix;
}

export function StatsBanner() {
  const ref = useRef<HTMLDivElement>(null);
  const [values, setValues] = useState<number[] | null>(null);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;

    let fired = false;
    const io = new IntersectionObserver(
      (entries) => {
        if (fired || !entries.some((e) => e.isIntersecting)) return;
        fired = true;
        io.disconnect();

        const t0 = performance.now();
        const tick = (now: number) => {
          const p = Math.min((now - t0) / DURATION, 1);
          const ease = 1 - Math.pow(1 - p, 3);
          setValues(STATS.map((s) => s.target * ease));
          if (p < 1) raf.current = requestAnimationFrame(tick);
          else setValues(null);          // settle on the exact target
        };
        raf.current = requestAnimationFrame(tick);
      },
      { threshold: 0.3 }
    );

    io.observe(el);
    return () => {
      io.disconnect();
      if (raf.current !== null) cancelAnimationFrame(raf.current);
    };
  }, []);

  return (
    <div className="lp-stats" id="stats" ref={ref}>
      <div className="lp-stats-row">
        {STATS.map((s, i) => (
          <div className="lp-stat" key={s.label}>
            <span className="lp-stat-val">
              {format(values ? (values[i] ?? s.target) : s.target, s.decimals, s.suffix)}
            </span>
            <span className="lp-stat-lbl">{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
