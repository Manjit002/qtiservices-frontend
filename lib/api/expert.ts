import { API } from './endpoints';
import { apiGet, apiPost, qs, uploadWithProgress } from './client';
import type {
  OrderDTO, ExpertOrderDetailDTO, PageResponse, EmployeeDTO,
  ExpertStats, ExpertDashboardSummary, AvailabilityStatus,
} from '@/types';

/** Every expert call bounces to /expert/login on 401/403, not /admin/login. */
const P = { portal: 'expert' as const };

export const expertApi = {
  dashboard: (signal?: AbortSignal) =>
    apiGet<ExpertDashboardSummary>(API.expert.dashboard, { ...P, signal }),

  stats: (signal?: AbortSignal) => apiGet<ExpertStats>(API.expert.stats, { ...P, signal }),

  /** NOTE: `deadline` on these rows is the EXPERT deadline, not the student one. */
  orders: (page = 0, size = 50, signal?: AbortSignal) =>
    apiGet<PageResponse<OrderDTO>>(`${API.expert.orders}${qs({ page, size })}`, {
      ...P,
      signal,
    }),

  orderDetail: (id: number, signal?: AbortSignal) =>
    apiGet<ExpertOrderDetailDTO>(API.expert.orderDetail(id), { ...P, signal }),

  dueToday: (signal?: AbortSignal) =>
    apiGet<OrderDTO[]>(API.expert.dueToday, { ...P, signal }),

  overdue: (signal?: AbortSignal) =>
    apiGet<OrderDTO[]>(API.expert.overdue, { ...P, signal }),

  profile: (signal?: AbortSignal) =>
    apiGet<EmployeeDTO>(API.expert.profile, { ...P, signal }),

  setAvailability: (status: AvailabilityStatus) =>
    apiPost<unknown>(`${API.expert.status}${qs({ status })}`, undefined, P),

  /** Alias for setAvailability — the name the profile panel calls. */
  setStatus: (status: AvailabilityStatus) =>
    apiPost<unknown>(`${API.expert.status}${qs({ status })}`, undefined, P),

  startWork: (orderId: number) =>
    apiPost<unknown>(API.expert.startWork(orderId), undefined, P),

  /** Multipart, field name `files` (repeated). */
  submitWork: (orderId: number, formData: FormData, onProgress?: (p: number) => void) =>
    uploadWithProgress<unknown>(API.expert.submitWork(orderId), formData, onProgress, 'expert'),
};
