import { API } from './endpoints';
import { apiGet, apiPost, apiPut, apiDelete, qs, uploadWithProgress } from './client';
import type {
  OrderDTO, OrderDetailDTO, PageResponse, AssignOrderRequest, DashboardStats,
  PayLinkResponse, OrderUpdatePayload, DeletedOrderDTO, DeadlinesPayload,
} from '@/types';

export const ordersApi = {
  /**
   * The legacy dashboard fetched a wide page (size=200) and then filtered,
   * sorted and paginated client-side, because the backend does not implement
   * server-side status filtering. That behaviour is preserved deliberately —
   * changing it would change which rows the admin sees.
   */
  listAll: (page = 0, size = 200, sort = 'createdAt,desc', signal?: AbortSignal) =>
    apiGet<PageResponse<OrderDTO>>(`${API.orders.all}${qs({ page, size, sort })}`, { signal }),

  search: (keyword: string, searchType: string, page = 0, size = 50, signal?: AbortSignal) =>
    apiGet<PageResponse<OrderDTO>>(
      `${API.orders.all}${qs({ keyword, searchType, page, size })}`,
      { signal }
    ),

  detail: (id: number, signal?: AbortSignal) =>
    apiGet<OrderDetailDTO>(API.orders.detail(id), { signal }),

  dashboardStats: (signal?: AbortSignal) =>
    apiGet<DashboardStats>(API.admin.dashboard, { signal }),

  assign: (id: number, body: AssignOrderRequest) =>
    apiPost<unknown>(API.orders.assign(id), body),

  reassign: (id: number, body: AssignOrderRequest) =>
    apiPost<unknown>(API.orders.reassign(id), body),

  unassign: (id: number) => apiPost<unknown>(API.orders.unassign(id)),

  startReview: (id: number) => apiPost<unknown>(API.orders.startReview(id)),

  setPrice: (id: number, price: number) => apiPost<unknown>(API.orders.setPrice(id, price)),

  complete: (id: number) => apiPost<unknown>(API.orders.complete(id)),

  paymentLink: (id: number) => apiPost<PayLinkResponse>(API.orders.paymentLink(id)),

  /**
   * PUT (not POST) /admin/orders/{id}/deadlines — body
   * { clientDeadline, expertDeadline }, both optional, null = leave unchanged.
   *
   * The backend applies NO validation here: no 12-hour rule, no status gate.
   * It is a deliberate override tool, so the UI warns rather than blocks.
   */
  updateDeadlines: (id: number, body: DeadlinesPayload) =>
    apiPut<unknown>(API.orders.deadlines(id), body),

  /** Partial update. Pass ONLY the fields that changed. */
  update: (id: number, body: OrderUpdatePayload) =>
    apiPut<unknown>(API.orders.update(id), body),

  installments: (id: number, signal?: AbortSignal) =>
    apiGet<unknown>(API.orders.installments(id), { signal }),

  /** Multipart create — @ModelAttribute AdminCreateOrderRequestDTO + files. */
  create: (formData: FormData, onProgress?: (p: number) => void) =>
    uploadWithProgress<unknown>(API.orders.create, formData, onProgress, 'admin'),

  softDelete: (id: number, adminId: number, reason: string) =>
    apiDelete<unknown>(`${API.orders.softDelete(id)}${qs({ adminId, reason })}`),

  /**
   * Returns a plain array — no pagination, no query parameters. Search and
   * totals are therefore computed client-side, as the source does.
   */
  listDeleted: (signal?: AbortSignal) =>
    apiGet<DeletedOrderDTO[]>(API.orders.deleted, { signal }),
};
