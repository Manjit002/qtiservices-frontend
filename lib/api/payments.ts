import { API } from './endpoints';
import { apiGet, apiPost, qs } from './client';
import type {
  PaymentDTO, InstallmentDTO, PaymentSummary, ManualVerificationResponse,
  InstallmentPlanRequest, InstallmentUpdateRequest, PayLinkResponse,
} from '@/types';

export const paymentsApi = {
  byOrder: (orderId: number, signal?: AbortSignal) =>
    apiGet<PaymentDTO[]>(API.payments.byOrder(orderId), { signal }),

  summaryForStudent: (studentId: number, signal?: AbortSignal) =>
    apiGet<PaymentSummary>(`${API.payments.summary}${qs({ studentId })}`, { signal }),

  /**
   * Verifies the intent against Stripe server-side and attaches it to the
   * order. All amount, balance and installment checks happen on the backend —
   * the frontend never decides whether a payment is valid.
   */
  manualVerification: (orderId: number, paymentIntentId: string) =>
    apiPost<ManualVerificationResponse>(
      `${API.payments.manualVerification}${qs({ orderId, paymentIntentId })}`
    ),
};

export const installmentsApi = {
  due: (signal?: AbortSignal) => apiGet<InstallmentDTO[]>(API.installments.due, { signal }),

  overdue: (signal?: AbortSignal) =>
    apiGet<InstallmentDTO[]>(API.installments.overdue, { signal }),

  forOrder: (orderId: number, signal?: AbortSignal) =>
    apiGet<InstallmentDTO[]>(API.orders.installments(orderId), { signal }),

  /** POST /installments/create/{orderId} — JSON body. */
  create: (orderId: number, body: InstallmentPlanRequest) =>
    apiPost<unknown>(API.installments.create(orderId), body),

  /**
   * POST /admin/installments/{orderId}/recreate — JSON body, same shape as
   * create. Sending query params here silently fails: the controller binds
   * @RequestBody, so months/type would arrive null.
   */
  recreate: (orderId: number, body: InstallmentPlanRequest) =>
    apiPost<unknown>(API.installments.recreate(orderId), body),

  update: (installmentId: number, body: InstallmentUpdateRequest) =>
    apiPost<unknown>(API.installments.update(installmentId), body),

  paymentLink: (installmentId: number) =>
    apiPost<PayLinkResponse>(API.installments.paymentLink(installmentId)),
};
