'use client';

import { useCallback, useState } from 'react';

/** Modal open/close state with an optional payload carried through. */
export function useModal<T = void>() {
  const [isOpen, setIsOpen] = useState(false);
  const [payload, setPayload] = useState<T | null>(null);

  const open = useCallback((data?: T) => {
    setPayload((data ?? null) as T | null);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setPayload(null);
  }, []);

  return { isOpen, payload, open, close };
}
