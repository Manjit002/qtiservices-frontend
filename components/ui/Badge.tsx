'use client';

import type { ReactNode } from 'react';
import { enumValue } from '@/lib/utils/format';

export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'accent';

export function Badge({
  tone = 'neutral', dot = false, children,
}: { tone?: Tone; dot?: boolean; children: ReactNode }) {
  return (
    <span className={`badge badge-${tone}`}>
      {dot && <span className="dot" />}
      {children}
    </span>
  );
}

/**
 * Backend status → tone. Keys are the backend's own values and must never be
 * renamed; only the presentation is ours.
 */
const TONE: Record<string, Tone> = {
  CREATED: 'neutral', REVIEW_PENDING: 'warning', PRICE_PENDING: 'warning',
  PRICE_QUOTED: 'warning', UNDER_REVIEW: 'info', PRICE_SET: 'info',
  PRICE_UPDATED: 'info', AUTO_PRICED: 'info', ASSIGNED: 'accent',
  REASSIGNED: 'accent', UNASSIGNED: 'neutral', IN_PROGRESS: 'accent',
  ACTIVE: 'accent', SUBMITTED: 'info', COMPLETED: 'success', PAID: 'success',
  SUCCESS: 'success', PARTIALLY_PAID: 'warning', PARTIAL: 'warning',
  INSTALLMENT_ACTIVE: 'warning', PENDING: 'warning', CANCELLED: 'danger',
  FAILED: 'danger', REVIEW: 'info',
};

/** Underscores become spaces — `REVIEW_PENDING` is a wire value, not a label. */
export function StatusBadge({ status }: { status: unknown }) {
  const raw = enumValue(status);
  if (!raw) return <span className="text-faint">—</span>;
  return <Badge tone={TONE[raw] ?? 'neutral'} dot>{raw.replace(/_/g, ' ').toLowerCase()}</Badge>;
}
