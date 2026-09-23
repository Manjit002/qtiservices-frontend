import type { OrderStatus, StepperFlow } from '@/types';

/**
 * Centralised status → presentation map.
 *
 * Keys are the backend's own status strings, copied verbatim from the legacy
 * `statusBadgeClass()`. Adding a label/icon here is presentation only; the key
 * itself must always match what Spring Boot sends.
 */
interface StatusPresentation {
  badgeClass: string;
  label: string;
}

const STATUS_MAP: Record<string, StatusPresentation> = {
  CREATED:            { badgeClass: 'badge badge-pending',    label: 'Created' },
  REVIEW_PENDING:     { badgeClass: 'badge badge-pending',    label: 'Review Pending' },
  PRICE_PENDING:      { badgeClass: 'badge badge-pending',    label: 'Price Pending' },
  PRICE_QUOTED:       { badgeClass: 'badge badge-pending',    label: 'Price Quoted' },
  UNDER_REVIEW:       { badgeClass: 'badge badge-assigned',   label: 'Under Review' },
  PRICE_SET:          { badgeClass: 'badge badge-assigned',   label: 'Price Set' },
  PRICE_UPDATED:      { badgeClass: 'badge badge-assigned',   label: 'Price Updated' },
  AUTO_PRICED:        { badgeClass: 'badge badge-assigned',   label: 'Auto Priced' },
  ASSIGNED:           { badgeClass: 'badge badge-assigned',   label: 'Assigned' },
  REASSIGNED:         { badgeClass: 'badge badge-assigned',   label: 'Reassigned' },
  UNASSIGNED:         { badgeClass: 'badge badge-unassigned', label: 'Unassigned' },
  IN_PROGRESS:        { badgeClass: 'badge badge-active',     label: 'In Progress' },
  SUBMITTED:          { badgeClass: 'badge badge-active',     label: 'Submitted' },
  COMPLETED:          { badgeClass: 'badge badge-complete',   label: 'Completed' },
  PAID:               { badgeClass: 'badge badge-complete',   label: 'Paid' },
  PARTIALLY_PAID:     { badgeClass: 'badge badge-active',     label: 'Partially Paid' },
  INSTALLMENT_ACTIVE: { badgeClass: 'badge badge-active',     label: 'Installment Active' },
  CANCELLED:          { badgeClass: 'badge badge-cancelled',  label: 'Cancelled' },
  FAILED:             { badgeClass: 'badge badge-cancelled',  label: 'Failed' },
  REVIEW:             { badgeClass: 'badge badge-assigned',   label: 'Review' },
  SUCCESS:            { badgeClass: 'badge badge-complete',   label: 'Success' },
  PENDING:            { badgeClass: 'badge badge-pending',    label: 'Pending' },
  PARTIAL:            { badgeClass: 'badge badge-active',     label: 'Partial' },
  ACTIVE:             { badgeClass: 'badge badge-active',     label: 'Active' },
};

export function statusBadgeClass(status: OrderStatus | null | undefined): string {
  return STATUS_MAP[String(status ?? '')]?.badgeClass ?? 'badge badge-pending';
}

/** Raw backend value is shown, as the legacy tables did — never a prettified one. */
export function statusText(status: OrderStatus | null | undefined): string {
  return status ? String(status) : '—';
}

/** Statuses that mean an expert is currently attached to the order. */
export const ASSIGNED_STATUSES = ['ASSIGNED', 'REASSIGNED', 'IN_PROGRESS', 'SUBMITTED'];

export const isAssigned = (status: OrderStatus | null | undefined): boolean =>
  ASSIGNED_STATUSES.includes(String(status ?? ''));

/** Statuses where generating a payment link is offered. */
export const PAYLINK_STATUSES = ['PRICE_SET', 'ASSIGNED', 'IN_PROGRESS'];

// ─── Stepper flows ───────────────────────────────────────────────────────────
export interface StepDef {
  k: string;
  l: string;
  i: string;
}

export const STEPPER_FLOWS: Record<StepperFlow, StepDef[]> = {
  student: [
    { k: 'REVIEW_PENDING', l: 'Submitted', i: '📝' },
    { k: 'UNDER_REVIEW',   l: 'In Review', i: '🔍' },
    { k: 'PRICE_SET',      l: 'Priced',    i: '💰' },
    { k: 'ACTIVE',         l: 'Paid',      i: '✅' },
    { k: 'IN_PROGRESS',    l: 'Working',   i: '⚡' },
    { k: 'SUBMITTED',      l: 'Delivered', i: '📤' },
    { k: 'COMPLETED',      l: 'Done',      i: '🏁' },
  ],
  admin: [
    { k: 'REVIEW_PENDING', l: 'New',       i: '🆕' },
    { k: 'UNDER_REVIEW',   l: 'Reviewing', i: '🔍' },
    { k: 'PRICE_SET',      l: 'Priced',    i: '💰' },
    { k: 'ASSIGNED',       l: 'Assigned',  i: '🎯' },
    { k: 'IN_PROGRESS',    l: 'Working',   i: '⚡' },
    { k: 'SUBMITTED',      l: 'Submitted', i: '📤' },
    { k: 'COMPLETED',      l: 'Done',      i: '🏁' },
  ],
  expert: [
    { k: 'ASSIGNED',    l: 'Assigned',  i: '📋' },
    { k: 'IN_PROGRESS', l: 'Working',   i: '⚡' },
    { k: 'SUBMITTED',   l: 'Submitted', i: '📤' },
    { k: 'COMPLETED',   l: 'Done',      i: '🏁' },
  ],
};

/**
 * Index of the active step, with the same aliasing the legacy stepper applied:
 * AUTO_PRICED/PRICE_QUOTED fold onto PRICE_SET, INSTALLMENT_ACTIVE onto ACTIVE,
 * and REASSIGNED/UNASSIGNED onto ASSIGNED.
 */
export function activeStepIndex(status: OrderStatus | null | undefined, flow: StepDef[]): number {
  const s = String(status ?? '');
  const direct = flow.findIndex((f) => f.k === s);
  if (direct >= 0) return direct;
  if (['AUTO_PRICED', 'PRICE_QUOTED'].includes(s)) return flow.findIndex((f) => f.k === 'PRICE_SET');
  if (s === 'INSTALLMENT_ACTIVE') return flow.findIndex((f) => f.k === 'ACTIVE');
  if (s === 'REASSIGNED' || s === 'UNASSIGNED') return flow.findIndex((f) => f.k === 'ASSIGNED');
  return -1;
}
