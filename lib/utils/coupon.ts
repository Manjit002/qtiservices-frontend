import type { Coupon, CouponDiscountType, CreateCouponRequest } from '@/types';

export interface CouponFields {
  code: string;
  discountType: CouponDiscountType;
  discountValue: string;
  /** `yyyy-MM-ddTHH:mm` from datetime-local; empty means never expires. */
  expiryDate: string;
  usageLimit: string;
  active: boolean;
}

export const EMPTY_COUPON: CouponFields = {
  code: '',
  discountType: 'PERCENTAGE',
  discountValue: '',
  expiryDate: '',
  usageLimit: '',
  active: true,
};

/**
 * Client-side mirror of CouponService's rules, so a mistake gets an immediate,
 * field-level answer instead of a round trip that returns a RuntimeException
 * as a 500.
 *
 * `usedCount` is passed on edit only: the service refuses a usageLimit below
 * the number of redemptions already recorded.
 */
export function validateCoupon(
  f: CouponFields,
  usedCount?: number
): Partial<Record<keyof CouponFields, string>> {
  const e: Partial<Record<keyof CouponFields, string>> = {};

  if (!f.code.trim()) e.code = 'Coupon code is required.';

  const value = parseFloat(f.discountValue);
  if (!f.discountValue.trim() || Number.isNaN(value) || value <= 0) {
    e.discountValue = 'Discount value must be greater than 0.';
  } else if (f.discountType === 'PERCENTAGE' && value > 100) {
    e.discountValue = 'A percentage discount cannot exceed 100.';
  }

  if (f.expiryDate) {
    // The server compares against LocalDateTime.now(), so a past date is
    // rejected outright rather than saved as an already-expired coupon.
    if (new Date(f.expiryDate).getTime() < Date.now()) {
      e.expiryDate = 'Expiry date cannot be in the past.';
    }
  }

  if (f.usageLimit.trim()) {
    const limit = parseInt(f.usageLimit, 10);
    if (Number.isNaN(limit) || limit <= 0) {
      e.usageLimit = 'Usage limit must be greater than 0.';
    } else if (usedCount != null && limit < usedCount) {
      e.usageLimit = `Cannot be below the ${usedCount} redemption${usedCount === 1 ? '' : 's'} already recorded.`;
    }
  }

  return e;
}

/** The backend wants seconds; datetime-local gives 16 chars. */
const withSeconds = (v: string) => (v.length === 16 ? `${v}:00` : v);

/**
 * Builds CreateCouponRequestDTO — exactly six fields.
 *
 * `id`, `usedCount`, `createdAt` and `updatedAt` are backend-managed and are
 * never sent, on create or update. An empty expiry or usage limit becomes
 * `null` (meaning "no expiry" / "unlimited"), not an empty string.
 */
export function buildCouponPayload(f: CouponFields): CreateCouponRequest {
  return {
    // The service uppercases anyway; doing it here keeps the UI honest about
    // what will be stored.
    code: f.code.trim().toUpperCase(),
    discountType: f.discountType,
    discountValue: parseFloat(f.discountValue),
    expiryDate: f.expiryDate ? withSeconds(f.expiryDate) : null,
    usageLimit: f.usageLimit.trim() ? parseInt(f.usageLimit, 10) : null,
    active: f.active,
  };
}

/** Prefills the form from an existing coupon for editing. */
export function couponToFields(c: Coupon): CouponFields {
  return {
    code: c.code ?? '',
    discountType: c.discountType ?? 'PERCENTAGE',
    discountValue: c.discountValue != null ? String(c.discountValue) : '',
    // Trim the seconds: datetime-local only accepts yyyy-MM-ddTHH:mm.
    expiryDate: c.expiryDate ? c.expiryDate.slice(0, 16) : '',
    usageLimit: c.usageLimit != null ? String(c.usageLimit) : '',
    active: c.active !== false,
  };
}
