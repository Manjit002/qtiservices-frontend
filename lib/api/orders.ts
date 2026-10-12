import { API } from './endpoints';
import { apiGet, apiPost, apiPut, apiDelete, qs, uploadWithProgress } from './client';
import {
  ADMIN_SEARCH_MAX_SIZE, clampPage, clampPageSize, normalizeOrderKeyword, normalizePage,
} from '@/lib/utils/orderSearch';
import { enumValue } from '@/lib/utils/format';
import type {
  OrderDTO, OrderDetailDTO, PageResponse, AssignOrderRequest, DashboardStats,
  PayLinkResponse, OrderUpdatePayload, DeletedOrderDTO, DeadlinesPayload,
  AdminOrderQuery,
} from '@/types';

/**
 * GET /admin/all — server-side search, filtering and paging, newest first.
 * Page and size are clamped to what the service accepts, and empty filters are
 * left out of the query rather than sent blank.
 */
async function adminSearch(q: AdminOrderQuery = {}, signal?: AbortSignal): Promise<PageResponse<OrderDTO>> {
  const page = clampPage(q.page ?? 0);
  const size = clampPageSize(q.size ?? 10);
  const raw = await apiGet<unknown>(
    `${API.orders.adminSearch}${qs({
      status: q.status?.trim().toUpperCase() || undefined,
      country: q.country?.trim() || undefined,
      keyword: q.keyword?.trim() || undefined,
      fromDate: q.fromDate || undefined,
      toDate: q.toDate || undefined,
      page,
      size,
    })}`,
    { signal }
  );
  return normalizePage<OrderDTO>(raw, { page, size });
}

/**
 * Every page of a search, for CSV export: 100 rows per request (the service
 * maximum), one request at a time, stopping at `maxRows`. Rows are de-duplicated
 * by id because offset paging can repeat a row if an order arrives mid-export.
 */
async function adminSearchAll(
  q: Omit<AdminOrderQuery, 'page' | 'size'>,
  maxRows: number,
  signal?: AbortSignal
): Promise<{ rows: OrderDTO[]; total: number }> {
  const seen = new Set<number>();
  const rows: OrderDTO[] = [];
  let total = 0;
  for (let page = 0; rows.length < maxRows; page++) {
    const res = await adminSearch({ ...q, page, size: ADMIN_SEARCH_MAX_SIZE }, signal);
    total = res.totalElements;
    res.content.forEach((o) => {
      if (!seen.has(o.id)) { seen.add(o.id); rows.push(o); }
    });
    if (res.content.length === 0 || page + 1 >= res.totalPages) break;
  }
  return { rows: rows.slice(0, maxRows), total };
}

/**
 * The newest `limit` orders, from GET /admin/all (it always sorts by createdAt
 * desc). The service caps a page at 100, so a larger window is fetched as one
 * request for the first page and then the remaining pages in parallel.
 *
 * The result keeps the Page shape the screens already read: `content` is the
 * window and `totalElements` is the server's total across all orders.
 *
 * This replaces GET /orders/all, which production no longer serves — Spring
 * now matches that path to /orders/{orderId} and rejects "all" as a Long.
 */
async function recent(limit: number, signal?: AbortSignal): Promise<PageResponse<OrderDTO>> {
  const want = Math.max(1, Math.trunc(limit));
  const size = Math.min(want, ADMIN_SEARCH_MAX_SIZE);
  const first = await adminSearch({ page: 0, size }, signal);
  const pages = Math.min(Math.ceil(want / size), first.totalPages);
  const rest = pages > 1
    ? await Promise.all(
        Array.from({ length: pages - 1 }, (_, i) => adminSearch({ page: i + 1, size }, signal))
      )
    : [];
  const seen = new Set<number>();
  const content: OrderDTO[] = [];
  [first, ...rest].forEach((p) => p.content.forEach((o) => {
    if (!seen.has(o.id)) { seen.add(o.id); content.push(o); }
  }));
  const window = content.slice(0, want);
  return {
    content: window,
    totalElements: first.totalElements,
    totalPages: 1,
    number: 0,
    size: want,
    first: true,
    last: true,
    empty: window.length === 0,
  };
}

/** An order's detail, as a list row (enum fields flattened to their names). */
export function detailToRow(d: OrderDetailDTO): OrderDTO {
  return {
    ...d,
    status: enumValue(d.status) || null,
    paymentStatus: enumValue(d.paymentStatus) || null,
  } as OrderDTO;
}

/**
 * Order lookup for the pickers on Verify payments and Installments.
 *
 * Runs the server search (GET /admin/all?keyword=) and, when the query is an
 * order ID (`2417`, `OD-2417`), also reads that order from
 * GET /admin/orders/{id} and lists it first. What the keyword matches is up to
 * the repository query, so an admin who types an exact order ID still finds
 * that order whether or not the search covers IDs.
 */
async function lookup(query: string, limit = 8, signal?: AbortSignal): Promise<OrderDTO[]> {
  const keyword = normalizeOrderKeyword(query);
  if (!keyword) return [];
  const id = /^\d{1,15}$/.test(keyword) ? Number(keyword) : null;
  const [exact, found] = await Promise.allSettled([
    id != null
      ? apiGet<OrderDetailDTO>(API.orders.detail(id), { signal }).then(detailToRow)
      : Promise.resolve(null),
    adminSearch({ keyword, size: limit }, signal),
  ]);
  const aborted = [exact, found].find(
    (r) => r.status === 'rejected' && (r.reason as Error)?.name === 'AbortError'
  );
  if (aborted) throw (aborted as PromiseRejectedResult).reason;

  const hit = exact.status === 'fulfilled' ? exact.value : null;
  if (found.status === 'rejected') {
    // The ID read on its own is still an answer; with nothing to show, the
    // search's error is the one that explains why.
    if (hit) return [hit];
    throw found.reason;
  }
  const rows = found.value.content.filter((o) => o.id !== hit?.id);
  return (hit ? [hit, ...rows] : rows).slice(0, limit);
}

export const ordersApi = {
  adminSearch,
  adminSearchAll,
  recent,
  lookup,

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
