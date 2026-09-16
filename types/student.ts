import type { ServerDateTime } from './common';
import type { PaymentDTO } from './payment';
import type { OrderDTO } from './order';

/**
 * There is NO student endpoint on this backend.
 *
 * The legacy page assembles a student by searching ORDERS and reading the
 * student fields off an order's admin detail, then opportunistically probing a
 * list of profile/wallet endpoints that may or may not exist. This type models
 * that assembled shape, not a server DTO — which is why almost everything is
 * nullable.
 */
export interface StudentProfile {
  id: number | null;
  name: string;
  email: string;
  phone: string | null;
  country: string | null;
  active: boolean;
  verified: boolean;
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
