'use client';

import {
  createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode,
} from 'react';
import type { Toast, ToastType } from '@/types';

interface ToastContextValue {
  toasts: Toast[];
  showToast: (message: string, type?: ToastType, duration?: number) => void;
  dismissToast: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = 'success', duration = 4000) => {
      setToasts((prev) => {
        // De-duplicate: a repeated identical toast restarts rather than stacks,
        // which is what stops a failing poll from burying the screen.
        if (prev.some((t) => t.message === message && t.type === type)) return prev;
        const id = nextId.current++;
        const timer = setTimeout(() => {
          setToasts((cur) => cur.filter((t) => t.id !== id));
          timers.current.delete(id);
        }, duration);
        timers.current.set(id, timer);
        return [...prev, { id, message, type, duration }];
      });
    },
    []
  );

  const value = useMemo(
    () => ({ toasts, showToast, dismissToast }),
    [toasts, showToast, dismissToast]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* The stack renders here rather than being mounted by each page. A
          provider without a renderer swallows every toast silently, which is
          exactly what happened before this was moved inside. */}
      <ToastStack />
    </ToastContext.Provider>
  );
}

const TOAST_ICON: Record<ToastType, string> = {
  success: '✓', error: '!', warning: '!', info: 'i',
};

function ToastStack() {
  const ctx = useContext(ToastContext);
  if (!ctx || ctx.toasts.length === 0) return null;

  return (
    <div className="toast-stack" role="region" aria-label="Notifications">
      {ctx.toasts.map((t) => (
        <div
          key={t.id}
          className={`toast ${t.type}`}
          // Errors interrupt; everything else is announced politely.
          role={t.type === 'error' ? 'alert' : 'status'}
        >
          <span className={`toast-icon ${t.type}`} aria-hidden>{TOAST_ICON[t.type]}</span>
          <span style={{ flex: 1 }}>{t.message}</span>
          <button
            type="button"
            className="toast-close"
            onClick={() => ctx.dismissToast(t.id)}
            aria-label="Dismiss notification"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
