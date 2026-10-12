import type { ServerDateTime } from './common';
import type { PaymentDTO } from './payment';
import type { OrderDTO } from './order';

/**
 * The student as the Students page shows it. Built from StudentProfileDTO
 * (GET /admin/students/search) plus the student's orders. Fields the DTO does
 * not carry stay unknown (null / defaults) rather than being guessed.
 */
export interface StudentProfile {
  id: number | null;
  name: string;
  email: string;
  phone: string | null;
  country: string | null;
  active: boolean;
  /** null when the profile does not say — shown as "Not available", not "Not verified". */
  verified: boolean | null;
  createdAt: ServerDateTime;
  lastSeen: ServerDateTime;
  walletBalance: number;
  /**
   * True when `createdAt` was derived from the student's earliest order rather
   * than a real profile record — the label then reads "First order", not
   * "Joined", because claiming a signup date we don't have would be a lie.
   */
  joinedFromOrders: boolean;
}

/** Counts computed client-side from the student's orders, as the source does. */
export interface StudentStats {
  totalOrders: number;
  completed: number;
  pending: number;
  totalSpent: number;
}

export interface StudentPayment extends PaymentDTO {
  orderId?: number;
  orderSubject?: string | null;
  typeLabel?: string | null;
  statusLabel?: string | null;
  isInstallment?: boolean | null;
}

export interface StudentSearchResult {
  student: StudentProfile;
  orders: OrderDTO[];
  stats: StudentStats;
  /** Set when the profile was found but the student's orders could not be loaded. */
  ordersError?: string | null;
  /** Set when the orders shown may not be all of them (see studentsApi.ordersFor). */
  ordersNote?: string | null;
}

/** Legacy list-endpoint DTO, still used by other admin surfaces. */
export interface StudentDTO {
  id: number;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  active?: boolean | null;
  walletBalance?: number | null;
  createdAt?: string | null;
  [key: string]: unknown;
}

/**
 * Body for PUT /admin/students/{id}/profile (UpdateStudentProfileDTO).
 * The DTO also declares `country`, but StudentService.updateStudentProfileByAdmin
 * never reads it — sending it would save nothing — so it is not part of this
 * request.
 */
export interface UpdateStudentProfileRequest {
  name: string;
  email: string;
  /** null leaves the stored phone untouched; "" clears it (the service sets it). */
  phone: string | null;
}

/**
 * StudentProfileDTO, as returned by GET /admin/students/search and
 * PUT /admin/students/{id}/profile. Only these fields are read, and each only
 * when present with the expected type; anything else in the DTO is ignored.
 */
export interface StudentProfileResponse {
  id?: number;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  country?: string | null;
  active?: boolean | null;
  verified?: boolean | null;
  createdAt?: ServerDateTime;
  lastSeen?: ServerDateTime;
  walletBalance?: number | null;
  [key: string]: unknown;
}
