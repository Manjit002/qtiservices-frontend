'use client';

import type { ReactNode } from 'react';
import { AlertTriangle, RotateCw } from 'lucide-react';
import { Button } from './Button';

export function Skeleton({ w = '100%', h = 14, r }: { w?: string | number; h?: number; r?: number }) {
  return <div className="skel" style={{ width: w, height: h, borderRadius: r ?? 'var(--r-sm)' }} />;
}

/** Table placeholder that matches the real row height, so nothing shifts on load. */
export function SkeletonRows({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r}>
          {Array.from({ length: cols }).map((__, c) => (
            <td key={c}><Skeleton w={c === 0 ? '55%' : c === cols - 1 ? '40%' : '75%'} /></td>
          ))}
        </tr>
      ))}
    </>
  );
}

/**
 * Empty is an invitation, not a failure — it names what would appear here and
 * offers the action that creates it.
 */
export function EmptyState({
  icon, title, hint, action,
}: { icon?: ReactNode; title: string; hint?: string; action?: ReactNode }) {
  return (
    <div style={{ textAlign: 'center', padding: 'var(--s12) var(--s5)' }}>
      {icon && (
        <div style={{
          width: 40, height: 40, margin: '0 auto var(--s4)', borderRadius: 'var(--r-md)',
          background: 'var(--raised)', border: '1px solid var(--line)',
          display: 'grid', placeItems: 'center', color: 'var(--text-dim)',
        }}>
          {icon}
        </div>
      )}
      <div className="t-h3">{title}</div>
      {hint && <div className="t-sm text-dim" style={{ marginTop: 4, maxWidth: 340, marginInline: 'auto' }}>{hint}</div>}
      {action && <div style={{ marginTop: 'var(--s5)' }}>{action}</div>}
    </div>
  );
}

/** Errors say what failed and how to fix it. No stack traces, no apologies. */
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div style={{ textAlign: 'center', padding: 'var(--s10) var(--s5)' }} role="alert">
      <div style={{
        width: 40, height: 40, margin: '0 auto var(--s4)', borderRadius: 'var(--r-md)',
        background: 'var(--danger-bg)', display: 'grid', placeItems: 'center', color: 'var(--danger)',
      }}>
        <AlertTriangle size={18} />
      </div>
      <div className="t-h3">Couldn&rsquo;t load this</div>
      <div className="t-sm text-dim" style={{ marginTop: 4, maxWidth: 380, marginInline: 'auto' }}>{message}</div>
      {onRetry && (
        <div style={{ marginTop: 'var(--s5)' }}>
          <Button variant="secondary" size="sm" onClick={onRetry}>
            <RotateCw size={13} /> Try again
          </Button>
        </div>
      )}
    </div>
  );
}
