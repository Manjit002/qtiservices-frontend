'use client';

import { AlertTriangle, RotateCw } from 'lucide-react';
import { Spinner } from '@/components/ui/Button';
import type { ConnectionState } from '@/types';

/**
 * Chat delivery runs over STOMP only — the backend exposes no REST send
 * endpoint — so a socket that never connects means the admin cannot send at
 * all. That has to be visible and actionable rather than a permanent
 * "Connecting…" placeholder in the composer.
 *
 * Nothing is rendered once connected; the banner exists only while the
 * connection is not usable.
 */
export function ConnectionBanner({
  state, onRetry,
}: { state: ConnectionState; onRetry: () => void }) {
  if (state === 'connected') return null;

  const busy = state === 'connecting' || state === 'reconnecting' || state === 'idle';
  const failed = state === 'error' || state === 'closed';

  return (
    <div className={`ch-conn${failed ? ' failed' : ''}`} role="status" aria-live="polite">
      {busy ? <Spinner size={13} /> : <AlertTriangle size={14} />}
      <span className="ch-conn-text">
        {state === 'idle' && 'Preparing chat…'}
        {state === 'connecting' && 'Connecting to conversation…'}
        {state === 'reconnecting' && 'Connection lost — reconnecting…'}
        {state === 'error' && 'Could not connect. Messages cannot be sent until this reconnects.'}
        {state === 'closed' && 'Disconnected. Reconnect to send messages.'}
      </span>
      {failed && (
        <button type="button" className="ch-conn-retry" onClick={onRetry}>
          <RotateCw size={12} /> Retry
        </button>
      )}
    </div>
  );
}
