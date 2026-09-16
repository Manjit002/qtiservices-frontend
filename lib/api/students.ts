import { API } from './endpoints';
import { apiGet, apiPost, qs } from './client';
import { ordersApi } from './orders';
import { paymentsApi } from './payments';
import { parseServerDate } from '@/lib/utils/format';
import type {
  OrderDTO, PageResponse, StudentProfile, StudentStats, StudentPayment,
  StudentSearchResult, OrderDetailDTO,
} from '@/types';

/** Statuses the legacy page counts as "pending" for the student summary. */
const PENDING = ['REVIEW_PENDING', 'UNDER_REVIEW', 'PRICE_SET'];

export type SearchKind = 'email' | 'stuid' | 'all';

/** `263040`, `ID-263040` and `id-0263040` are all the same student. */
export function classifyQuery(raw: string): { kind: SearchKind; keyword: string } {
  const q = raw.trim();
  if (q.includes('@')) return { kind: 'email', keyword: q };
  const bare = q.replace(/^id-0*/i, '');
  if (/^\d+$/.test(bare)) return { kind: 'stuid', keyword: bare };
  return { kind: 'all', keyword: q };
}

export function computeStats(orders: OrderDTO[]): StudentStats {
  return {
    totalOrders: orders.length,
    completed: orders.filter((o) => String(o.status ?? '') === 'COMPLETED').length,
    pending: orders.filter((o) => PENDING.includes(String(o.status ?? ''))).length,
    totalSpent: orders.reduce((sum, o) => sum + (o.price ?? 0), 0),
  };
}

/** Earliest order by createdAt — the fallback for "joined". */
function earliest(orders: OrderDTO[]): OrderDTO | undefined {
  return [...orders].sort(
    (a, b) =>
      (parseServerDate(a.createdAt)?.getTime() ?? 0) -
      (parseServerDate(b.createdAt)?.getTime() ?? 0)
  )[0];
}

export const studentsApi = {
  setActive: (studentId: number, active: boolean) =>
    apiPost<unknown>(`${API.students.toggleStatus(studentId)}${qs({ active })}`),

  adjustWallet: (userId: number, amount: number, reason: string) =>
    apiPost<{ balance?: number; walletBalance?: number }>(
      `${API.students.walletAdjust}${qs({ userId, amount, reason })}`
    ),

  /**
   * Assemble a student from the order records.
   *
   * There is no student endpoint, so this reproduces the legacy sequence:
   *   1. search orders by email or student id
   *   2. no orders → the student is not findable, full stop
   *   3. read student fields off the first order's ADMIN detail
   *      (admin endpoint, so the access check is admin-level)
   *   4. probe the speculative profile endpoints; keep the first that answers
   *   5. probe the speculative wallet endpoints the same way
   *   6. fall back to the earliest order's date for "joined"
   *
   * Steps 4 and 5 are best-effort by design: every candidate may 404, and that
   * is not an error — it just means those fields stay unknown.
   */
  async search(raw: string, signal?: AbortSignal): Promise<StudentSearchResult | null> {
    const { kind, keyword } = classifyQuery(raw);

    const page = await apiGet<PageResponse<OrderDTO> | OrderDTO[]>(
      `${API.orders.all}${qs({ keyword, searchType: kind, page: 0, size: 50 })}`,
      { signal }
    );
    const orders = Array.isArray(page) ? page : page?.content ?? [];
    if (orders.length === 0) return null;

    const first = orders[0];
    if (!first) return null;

    let detail: OrderDetailDTO | null = null;
    try {
      detail = await ordersApi.detail(first.id, signal);
    } catch {
      /* fall through to the minimal profile below */
    }

    const studentId = (detail?.studentId as number | undefined) ?? null;

    const student: StudentProfile = {
      id: studentId,
      name: detail?.studentName ?? 'Student',
      email: detail?.studentEmail ?? (kind === 'email' ? keyword : ''),
      phone: detail?.studentPhone ?? null,
      country: null,
      active: true,
      verified: false,
      createdAt: null,
      lastSeen: null,
      walletBalance: 0,
      joinedFromOrders: false,
    };

    const oldest = earliest(orders);
    if (oldest?.createdAt) {
      student.createdAt = oldest.createdAt;
      student.joinedFromOrders = true;
    }

    if (studentId != null) {
      for (const ep of API.students.profileCandidates(studentId)) {
        try {
          const p = await apiGet<Record<string, unknown>>(ep, {
            signal,
            suppressAuthRedirect: true,
          });
          if (p && (p.country || p.createdAt || p.lastSeen || p.phone)) {
            if (typeof p.phone === 'string') student.phone = p.phone;
            if (typeof p.country === 'string') student.country = p.country;
            if (p.createdAt) {
              student.createdAt = p.createdAt as never;
              student.joinedFromOrders = false;
            }
            if (p.lastSeen) student.lastSeen = p.lastSeen as never;
            if (typeof p.active === 'boolean') student.active = p.active;
            if (typeof p.verified === 'boolean') student.verified = p.verified;
            if (typeof p.walletBalance === 'number') student.walletBalance = p.walletBalance;
            break;
          }
        } catch {
          /* candidate does not exist — expected */
        }
      }

      if (student.walletBalance === 0) {
        for (const ep of API.students.walletCandidates(studentId)) {
          try {
            const w = await apiGet<{ balance?: number; walletBalance?: number }>(ep, {
              signal,
              suppressAuthRedirect: true,
            });
            const bal = w?.balance ?? w?.walletBalance;
            if (bal != null) {
              student.walletBalance = bal;
              break;
            }
          } catch {
            /* candidate does not exist — expected */
          }
        }
      }
    }

    return { student, orders, stats: computeStats(orders) };
  },

  /**
   * Payments are per-order, so the student's history is the union across their
   * orders. Capped at 10 orders exactly as the source does — this is N requests
   * and an unbounded loop would hammer the backend for a prolific student.
   */
  async payments(orders: OrderDTO[], signal?: AbortSignal): Promise<StudentPayment[]> {
    const scope = orders.slice(0, 10);
    const results = await Promise.all(
      scope.map(async (o) => {
        try {
          const list = await paymentsApi.byOrder(o.id, signal);
          return (Array.isArray(list) ? list : []).map((p) => ({
            ...p,
            orderId: o.id,
            orderSubject: o.subject ?? null,
          })) as StudentPayment[];
        } catch {
          return [] as StudentPayment[];
        }
      })
    );
    return results.flat();
  },
};

/** True when more orders exist than the payment sweep covered. */
export const PAYMENT_ORDER_SCAN_LIMIT = 10;
