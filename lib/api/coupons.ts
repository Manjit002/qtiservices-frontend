import { API } from './endpoints';
import { apiGet, apiPost, apiPut, apiPatch, apiDelete } from './client';
import type { Coupon, CreateCouponRequest } from '@/types';

export const couponsApi = {
  list: (signal?: AbortSignal) =>
    apiGet<Coupon[]>(API.admin.coupons.all, { signal }),

  create: (body: CreateCouponRequest) =>
    apiPost<Coupon>(API.admin.coupons.create, body),

  /** Update takes the SAME DTO as create — six fields, nothing else. */
  update: (id: number, body: CreateCouponRequest) =>
    apiPut<Coupon>(API.admin.coupons.byId(id), body),

  /** Returns 204 No Content; the client maps that to undefined. */
  remove: (id: number) =>
    apiDelete<void>(API.admin.coupons.byId(id)),

  /**
   * Flips active server-side and returns the updated entity. The caller must
   * use that response rather than assuming `!active` — the server owns the
   * result, and assuming would drift if the rule ever changes.
   */
  toggle: (id: number) =>
    apiPatch<Coupon>(API.admin.coupons.toggle(id)),
};
