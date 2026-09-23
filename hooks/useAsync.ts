'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

interface UseAsyncResult<T> extends AsyncState<T> {
  reload: () => void;
  setData: (updater: T | ((prev: T | null) => T | null)) => void;
}

/**
 * Runs an async loader, exposing loading / error / data plus a retry.
 *
 * Every request is aborted on unmount and superseded requests are ignored, so
 * a slow response for a panel the admin already navigated away from can never
 * overwrite the current one — the stale-write bug that DOM-mutating dashboards
 * are prone to.
 */
export function useAsync<T>(
  loader: (signal: AbortSignal) => Promise<T>,
  deps: unknown[] = [],
  { immediate = true }: { immediate?: boolean } = {}
): UseAsyncResult<T> {
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    loading: immediate,
    error: null,
  });
  const [nonce, setNonce] = useState(0);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  useEffect(() => {
    if (!immediate && nonce === 0) return;

    const controller = new AbortController();
    let active = true;
    setState((s) => ({ ...s, loading: true, error: null }));

    loaderRef
      .current(controller.signal)
      .then((data) => {
        if (active) setState({ data, loading: false, error: null });
      })
      .catch((e: unknown) => {
        if (!active) return;
        if ((e as Error)?.name === 'AbortError') return;
        setState({
          data: null,
          loading: false,
          error: (e as Error)?.message || 'Something went wrong.',
        });
      });

    return () => {
      active = false;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce, immediate, ...deps]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  const setData = useCallback((updater: T | ((prev: T | null) => T | null)) => {
    setState((s) => ({
      ...s,
      data:
        typeof updater === 'function'
          ? (updater as (prev: T | null) => T | null)(s.data)
          : updater,
    }));
  }, []);

  return { ...state, reload, setData };
}
