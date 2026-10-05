/**
 * Coupons.
 *
 * NOTE ON PATHS: the brief documents these as `/coupons/*`, but the controller
 * is annotated `@RequestMapping("/admin")`, so every route is actually
 * `/admin/coupons/*`. Using the documented paths would 404 on all five.
 */

/** The switch in CouponService handles exactly these two. */
export const COUPON_DISCOUNT_TYPES = ['PERCENTAGE', 'FIXED'] as const;
export type CouponDiscountType = (typeof COUPON_DISCOUNT_TYPES)[number];

/**
 * The endpoints return the raw `CouponEntity`, not a trimmed DTO, so the
 * backend-managed fields come back and must be displayed but never sent.
 */
export interface Coupon {
  id: number;
  code: string;
  discountType: CouponDiscountType;
  discountValue: number;
  /** ISO LocalDateTime, or null for a coupon that never expires. */
  expiryDate: string | null;
  usageLimit: number | null;
  active: boolean | null;
  /** Maintained by the backend — read-only here. */
  usedCount: number;
  createdAt?: string | null;
  updatedAt?: string | null;
  [key: string]: unknown;
}

/**
 * CreateCouponRequestDTO — used verbatim by BOTH create and update.
 * Exactly six fields; id, usedCount, createdAt and updatedAt are never sent.
 */
export interface CreateCouponRequest {
  code: string;
  discountType: CouponDiscountType;
  discountValue: number;
  expiryDate: string | null;
  usageLimit: number | null;
  active: boolean | null;
}

/** Derived display state — "expired" is not a backend field. */
export type CouponState = 'active' | 'inactive' | 'expired';

export function couponState(c: Coupon): CouponState {
  if (c.expiryDate && new Date(c.expiryDate).getTime() < Date.now()) return 'expired';
  return c.active ? 'active' : 'inactive';
}
