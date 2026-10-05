'use client';

import { useEffect, useState } from 'react';

/**
 * Ticks once a minute so "in 3h" / "overdue 2d" labels stay honest without
 * re-fetching. One shared interval per mounted panel, cleared on unmount.
 */
export function useLiveClock(intervalMs = 60_000): number {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return tick;
}
