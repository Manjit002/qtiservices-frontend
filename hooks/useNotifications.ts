'use client';

import { useCallback, useEffect, useRef } from 'react';

/**
 * Notification sound + browser notifications for incoming chat messages.
 *
 * The sound is synthesised with the Web Audio API rather than loaded from a file
 * so there is no asset to ship or 404. The AudioContext is created lazily on the
 * first play because browsers block one created before a user gesture.
 */
export function useNotifications() {
  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    return () => {
      void audioCtxRef.current?.close();
      audioCtxRef.current = null;
    };
  }, []);

  const playSound = useCallback(() => {
    try {
      if (!audioCtxRef.current) {
        const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return;
        audioCtxRef.current = new Ctor();
      }
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
      osc.start();
      osc.stop(ctx.currentTime + 0.26);
    } catch {
      /* audio unavailable — non-fatal */
    }
  }, []);

  const requestPermission = useCallback(() => {
    if (typeof Notification === 'undefined') return;
    if (Notification.permission === 'default') void Notification.requestPermission();
  }, []);

  /** Only fires when the tab is hidden — a visible tab gets an in-app toast instead. */
  const showBrowserNotification = useCallback((body: string, title = 'QTIServices') => {
    try {
      if (typeof Notification === 'undefined') return;
      if (Notification.permission !== 'granted') return;
      if (!document.hidden) return;
      new Notification(title, { body, icon: '/favicon.ico' });
    } catch {
      /* ignore */
    }
  }, []);

  return { playSound, requestPermission, showBrowserNotification };
}
