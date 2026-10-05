import type { ServerDateTime } from './common';
import type { PaymentDTO } from './payment';

/**
 * Canonical backend order statuses, taken verbatim from the legacy
 * `statusBadgeClass` map and `renderStatusStepper` flows. Never rename these —
 * they are the values the Spring Boot backend sends and accepts.
 */
export const ORDER_STATUSES = [
  'CREATED', 'REVIEW_PENDING', 'PRICE_PENDING', 'PRICE_QUOTED', 'UNDER_REVIEW',
  'PRICE_SET', 'PRICE_UPDATED', 'AUTO_PRICED', 'ASSIGNED', 'REASSIGNED',
  'UNASSIGNED', 'IN_PROGRESS', 'ACTIVE', 'SUBMITTED', 'COMPLETED', 'PAID',
  'PARTIALLY_PAID', 'INSTALLMENT_ACTIVE', 'CANCELLED', 'FAILED', 'REVIEW',
  'SUCCESS', 'PENDING', 'PARTIAL',
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number] | (string & {});

export type PaymentStatus =
  | 'SUCCESS' | 'PENDING' | 'PARTIAL' | 'PARTIALLY_PAID' | 'FAILED' | 'PAID'
  | (string & {});

/**
 * Fields common to every order shape. Kept free of an index signature so that
 * `Omit<>` over it preserves the named properties — with an index signature
 * present, Omit collapses everything to `unknown`.
 */
export interface OrderBase {
  id: number;
  subject?: string | null;
  type?: string | null;
  deadline?: ServerDateTime;
  price?: number | null;
  studentId?: number | null;
  studentEmail?: string | null;
  createdAt?: ServerDateTime;
}

/** Shape returned by the list endpoints (GET /orders/all, GET /expert/orders). */
export interface OrderDTO extends OrderBase {
  status?: OrderStatus | null;
  paymentStatus?: PaymentStatus | null;
  [key: string]: unknown;
}

/**
 * Enum-ish fields arrive either as a bare string or as a serialised Java enum
 * ({ name: 'ASSIGNED' }). The source reads `d.status?.name ?? d.status`, so both
 * shapes are modelled rather than assuming one.
 */
export type EnumLike = string | { name?: string } | null | undefined;

/** Shape returned by GET /admin/orders/{id} — richer than the list DTO. */
export interface OrderDetailDTO extends OrderBase {
  status?: EnumLike;
  paymentStatus?: EnumLike;

  // Student
  studentName?: string | null;
  studentEmail?: string | null;
  studentPhone?: string | null;

  // Assignment metadata
  assignmentType?: string | null;
  academicLevel?: string | null;
  university?: string | null;
  country?: string | null;
  instructions?: string | null;
  instructionsWordCount?: number | null;

  // Expert
  assignedEmployeeId?: number | null;
  assignedEmployeeName?: string | null;
  assignedEmployeeEmail?: string | null;
  assignedEmployeeRole?: string | null;
  expertDeadline?: ServerDateTime;
  clientDeadline?: ServerDateTime;

  // Pricing — the source resolves finalPrice ?? totalPrice ?? autoPrice
  finalPrice?: number | null;
  totalPrice?: number | null;
  autoPrice?: number | null;
  adminPrice?: number | null;
  paidAmount?: number | null;
  remainingAmount?: number | null;
  autoPriced?: boolean | null;
  adjustmentRequired?: boolean | null;
  adjustmentAmount?: number | null;
  pricingNote?: string | null;
  pricingSource?: string | null;

  /**
   * Payments EMBEDDED in the order detail response. The Verify Payments page
   * reads these rather than calling /payments/order/{id} — the embedded rows
   * carry verifiedBy, failureReason and installment fields that the standalone
   * payments endpoint does not return.
   */
  payments?: PaymentDTO[] | null;

  [key: string]: unknown;
}

/** Shape returned by GET /expert/orders/{id}/details. */
export interface ExpertOrderDetailDTO extends OrderDTO {
  description?: string | null;
  instructions?: string | null;
  expertDeadline?: ServerDateTime;
  studentName?: string | null;
}

/** Request body for POST /admin/orders/{id}/assign and /reassign. */
export interface AssignOrderRequest {
  expertId: number;
  /** `yyyy-MM-ddTHH:mm:ss` — the legacy code appends `:00` to datetime-local values. */
  expertDeadline: string;
}

/**
 * Body of PUT /admin/orders/{id}/update.
 *
 * Every field is optional and the server treats an ABSENT key as "leave
 * unchanged" — so only genuinely changed fields are sent. That is not an
 * optimisation: resending an untouched value would overwrite a concurrent edit
 * by someone else.
 */
export interface OrderUpdatePayload {
  subject?: string;
  assignmentType?: string;
  academicLevel?: string;
  university?: string;
  /** `yyyy-MM-ddTHH:mm:ss`. Never sent as null — see the DTO note above. */
  deadline?: string;
  totalPrice?: number;
  instructions?: string;
  status?: OrderStatus;
}

/** The form's editable surface, all held as strings for controlled inputs. */
export interface OrderEditFields {
  subject: string;
  assignmentType: string;
  academicLevel: string;
  university: string;
  /** `yyyy-MM-ddTHH:mm` from datetime-local. */
  deadline: string;
  totalPrice: string;
  instructions: string;
  status: string;
}

/** Option lists, copied verbatim from the source. */
export const ASSIGNMENT_TYPES = [
  'Essay', 'Discussion Post', 'Research Paper', 'Homework', 'Quiz', 'Exam',
  'Lab Report', 'Case Study', 'Thesis', 'Other',
] as const;

export const ACADEMIC_LEVELS = [
  'High School', 'Undergraduate', 'Graduate', 'Masters', 'PhD',
] as const;

/**
 * Statuses an admin may set explicitly. Deliberately narrower than the full
 * status list — PAID, FAILED and the installment states are driven by payment
 * events, not by an admin dropdown.
 */
export const EDITABLE_ORDER_STATUSES = [
  'CREATED', 'REVIEW_PENDING', 'UNDER_REVIEW', 'PRICE_QUOTED', 'PRICE_SET',
  'PRICE_UPDATED', 'AUTO_PRICED', 'UNASSIGNED', 'ASSIGNED', 'REASSIGNED',
  'IN_PROGRESS', 'SUBMITTED', 'COMPLETED', 'CANCELLED',
] as const;

/**
 * GET /api/admin/orders/deleted → DeletedOrderDTO[].
 *
 * This is a SNAPSHOT taken at deletion time, not a live order — which is why
 * the key is `originalOrderId` rather than `id`, and why status and price are
 * frozen values rather than anything that can still change.
 *
 * There is no restore endpoint and no per-record detail endpoint: everything
 * the archive knows is in this object.
 */
export interface DeletedOrderDTO {
  id?: number;
  /** The id the order had before deletion. NOT `id`. */
  originalOrderId: number;

  studentName?: string | null;
  studentEmail?: string | null;
  subject?: string | null;
  assignmentType?: string | null;

  /** Status frozen at the moment of deletion. */
  orderStatus?: OrderStatus | null;
  paymentStatus?: PaymentStatus | null;

  /** Resolved `finalPrice ?? totalPrice`, as the source does. */
  finalPrice?: number | string | null;
  totalPrice?: number | string | null;
  paidAmount?: number | string | null;

  deletedByAdminName?: string | null;
  deletedByAdminId?: number | null;
  deletedAt?: ServerDateTime;
  deleteReason?: string | null;

  academicLevel?: string | null;
  university?: string | null;
  deadline?: ServerDateTime;
  createdAt?: ServerDateTime;

  [key: string]: unknown;
}

/**
 * Body of PUT /admin/orders/{id}/deadlines.
 * `clientDeadline` is the STUDENT-facing deadline — not `deadline`.
 * null means "leave unchanged"; a value can be set but never cleared back to null.
 */
export interface DeadlinesPayload {
  clientDeadline: string | null;
  expertDeadline: string | null;
}

export type StepperFlow = 'student' | 'admin' | 'expert';

export interface DashboardStats {
  reviewPending?: number;
  assignedOrders?: number;
  completedOrders?: number;
  availableExperts?: number;
  totalRevenue?: number;
  pendingPayments?: number;
  [key: string]: unknown;
}

export interface ExpertStats {
  assigned?: number;
  inProgress?: number;
  submitted?: number;
  completed?: number;
  overdue?: number;
  [key: string]: unknown;
}

export interface ExpertDashboardSummary {
  totalAssigned?: number;
  inProgress?: number;
  completed?: number;
  [key: string]: unknown;
}
