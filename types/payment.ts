import type { PaymentStatus } from './order';

export interface PaymentDTO {
  id?: number;
  orderId?: number;
  amount?: number | null;
  status?: PaymentStatus | null;
  paymentIntentId?: string | null;
  createdAt?: string | null;
  method?: string | null;

  /** Present on payments embedded in GET /admin/orders/{id}. */
  isInstallment?: boolean | null;
  installmentNumber?: number | null;
  /** Set when Stripe rejected the charge. */
  failureReason?: string | null;
  /** Admin who manually attached this payment. */
  verifiedBy?: string | null;

  [key: string]: unknown;
}

/**
 * Response of POST /admin/payments/manual-verification.
 *
 * This is the ONLY payment-verification path — the source notes it replaced the
 * old per-payment verify, verify-by-intent and recover endpoints, all
 * consolidated here.
 */
export interface ManualVerificationResponse {
  verified?: boolean;
  paymentId?: number;
  orderId?: number;
  paymentIntentId?: string;
  amount?: number;
}

/**
 * Java LocalDate is serialised either as `yyyy-MM-dd` or as a [y, M, d] tuple,
 * depending on the Jackson config in play. The source handles both.
 */
export type ServerDate = string | number[] | null;

export interface InstallmentDTO {
  id: number;
  orderId?: number;
  studentId?: number | null;
  /** The authoritative amount. NOT `amount` — the backend field is finalAmount. */
  finalAmount?: number | null;
  /** Full timestamp; preferred over dueDate when present. */
  dueDateTime?: string | null;
  dueDate?: ServerDate;
  status?: PaymentStatus | null;
  paid?: boolean | null;
  installmentNumber?: number | null;
  adminNotes?: string | null;
  [key: string]: unknown;
}

/**
 * Body for BOTH create and recreate.
 *
 * `preferredDates` must always be present, even as `[]`: the recreate
 * controller calls `request.getPreferredDates().stream()` with no null guard
 * (unlike create, which does check), so omitting it NPEs server-side.
 */
export interface InstallmentPlanRequest {
  months: number;
  type: InstallmentPlanType;
  preferredDates: string[];
}

export type InstallmentPlanType = 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'CUSTOM';

/** Body for POST /admin/installments/{id}/update. */
export interface InstallmentUpdateRequest {
  finalAmount: number;
  /** `yyyy-MM-ddTHH:mm:ss` */
  dueDateTime: string;
  adminNotes: string;
}

/** An installment counts as settled on any of these three signals. */
export function isInstallmentPaid(i: InstallmentDTO): boolean {
  return Boolean(i.paid) || i.status === 'SUCCESS' || i.status === 'PAID';
}

export interface PaymentSummary {
  totalPaid?: number;
  totalDue?: number;
  [key: string]: unknown;
}

/** POST /admin/orders/{id}/payment-link — the source reads these three, in order. */
export interface PayLinkResponse {
  paymentUrl?: string;
  url?: string;
  checkoutUrl?: string;
  [key: string]: unknown;
}

/**
 * A payment is actionable while it is neither settled nor failed — this is the
 * exact test the source uses to decide whether to offer manual verification.
 */
export function isPendingPayment(status: unknown): boolean {
  const s = typeof status === 'string' ? status : String(status ?? '');
  return s !== 'SUCCESS' && s !== 'FAILED';
}
