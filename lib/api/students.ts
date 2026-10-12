import { API } from './endpoints';
import { apiGet, apiPost, apiPut, qs } from './client';
import { paymentsApi } from './payments';
import { detailToRow, ordersApi } from './orders';
import { parseServerDate } from '@/lib/utils/format';
import type {
  OrderDTO, PaymentDTO, StudentProfile, StudentStats, StudentPayment,
  StudentSearchResult, UpdateStudentProfileRequest, StudentProfileResponse,
} from '@/types';

/**
 * At most this many search hits are confirmed by reading their details. The
 * order search has no student filter and its rows carry no student fields, so
 * each hit has to be checked before it can be shown on a student's profile.
 */
export const ORDER_VERIFY_LIMIT = 25;

/** Run `fn` over `items`, at most `limit` at a time, keeping input order. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

/** Statuses the legacy page counts as "pending" for the student summary. */
const PENDING = ['REVIEW_PENDING', 'UNDER_REVIEW', 'PRICE_SET'];

/** The two search types GET /admin/students/search accepts. */
export type SearchKind = 'email' | 'id';

export type QueryCheck =
  | { kind: SearchKind; keyword: string }
  | { kind: 'empty' }
  | { kind: 'invalid'; message: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Decide the searchType from what was typed, after trimming whitespace.
 * `263050`, `ID-263050` and `id-0263050` are all a student ID; anything with an
 * `@` is an email. Everything else is rejected here, before any request — the
 * endpoint only takes `id` or `email`.
 */
export function classifyQuery(raw: string): QueryCheck {
  const q = raw.trim();
  if (!q) return { kind: 'empty' };
  if (q.includes('@')) {
    return EMAIL.test(q)
      ? { kind: 'email', keyword: q }
      : { kind: 'invalid', message: 'That email address looks incomplete. Check it and try again.' };
  }
  const bare = q.replace(/^id-?0*(?=\d)/i, '');
  if (/^\d+$/.test(bare)) {
    // The backend parses a Java Long; 18 digits keeps well inside it.
    return bare.length <= 18
      ? { kind: 'id', keyword: bare }
      : { kind: 'invalid', message: 'That student ID is too long. Student IDs are numbers like 263050.' };
  }
  return { kind: 'invalid', message: 'Enter a numeric student ID (e.g. 263050) or an email address.' };
}

/** How a failed search should be presented. */
export type SearchFailure =
  | { kind: 'notfound' }
  | { kind: 'invalid'; message: string }
  | { kind: 'expired' }
  | { kind: 'forbidden' }
  | { kind: 'error'; message: string };

/**
 * Map an error from the search endpoint to what the page should say. The
 * service reports a missing student as "Student not found" and a bad ID as
 * "Student ID must be numeric" (status depends on the backend's exception
 * handling, so the message is checked as well as the status).
 */
export function classifySearchError(e: unknown): SearchFailure {
  const status = (e as { status?: number })?.status;
  const message = (e as Error)?.message ?? '';
  if (status === 401) return { kind: 'expired' };
  if (status === 403) return { kind: 'forbidden' };
  if (status === 404 || /student not found/i.test(message)) return { kind: 'notfound' };
  if (/must be numeric|searchType must be|is required/i.test(message)) return { kind: 'invalid', message };
  if (status === 400) return { kind: 'invalid', message: message || 'The search was not accepted. Check the student ID or email address.' };
  return { kind: 'error', message: message || 'The search could not be completed.' };
}

/** StudentProfileDTO → the page's StudentProfile. Absent fields stay unknown. */
export function profileFromDto(dto: StudentProfileResponse, fallbackId: number | null): StudentProfile {
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v : null);
  return {
    id: typeof dto.id === 'number' ? dto.id : fallbackId,
    name: str(dto.name) ?? 'Student',
    email: str(dto.email) ?? '',
    phone: str(dto.phone),
    country: str(dto.country),
    active: typeof dto.active === 'boolean' ? dto.active : true,
    verified: typeof dto.verified === 'boolean' ? dto.verified : null,
    createdAt: dto.createdAt ?? null,
    lastSeen: dto.lastSeen ?? null,
    walletBalance: typeof dto.walletBalance === 'number' ? dto.walletBalance : 0,
    joinedFromOrders: false,
  };
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
  /**
   * PUT /admin/students/{id}/profile — see API.students.updateProfile.
   *
   * suppressAuthRedirect: the shared client treats 401 and 403 alike and logs
   * the admin out. For this endpoint a 403 means "signed in, but the role is not
   * accepted by @PreAuthorize" — logging out would throw away the open form and
   * hide the reason. The dialog reports both cases itself instead: 401 as an
   * expired session, 403 as a permission refusal.
   */
  updateProfile: (studentId: number, body: UpdateStudentProfileRequest) =>
    apiPut<StudentProfileResponse>(API.students.updateProfile(studentId), body, {
      suppressAuthRedirect: true,
    }),

  setActive: (studentId: number, active: boolean) =>
    apiPost<unknown>(`${API.students.toggleStatus(studentId)}${qs({ active })}`),

  adjustWallet: (userId: number, amount: number, reason: string) =>
    apiPost<{ balance?: number; walletBalance?: number }>(
      `${API.students.walletAdjust}${qs({ userId, amount, reason })}`
    ),

  /**
   * GET /admin/students/search — the student's profile (StudentProfileDTO).
   *
   * suppressAuthRedirect, as for updateProfile: a 403 here means
   * @PreAuthorize refused the role, and logging out would hide that. The page
   * signs the admin out itself on a 401 (an expired session).
   */
  searchProfile: (keyword: string, searchType: SearchKind, signal?: AbortSignal) =>
    apiGet<StudentProfileResponse>(`${API.students.search}${qs({ keyword, searchType })}`, {
      signal,
      suppressAuthRedirect: true,
    }),

  /**
   * The student's orders.
   *
   * GET /admin/all has no student filter and its rows carry no student
   * fields, so this searches by the student's email (then, if that finds
   * nothing, their ID) and CONFIRMS every hit belongs to this student before
   * showing it: by the row's studentId/studentEmail when the server sends them,
   * otherwise by reading the order's details (GET /admin/orders/{id}), at most
   * ORDER_VERIFY_LIMIT, four at a time. A hit that can't be confirmed is never
   * shown, so a partial keyword match ("an@x.com" inside "dan@x.com") can't put
   * another student's order on this profile.
   */
  async ordersFor(
    student: StudentProfile,
    signal?: AbortSignal
  ): Promise<{ orders: OrderDTO[]; note: string | null }> {
    const email = student.email.trim().toLowerCase();
    const keywords = [email, student.id != null ? String(student.id) : ''].filter(Boolean);
    if (!keywords.length) return { orders: [], note: null };

    let hits: OrderDTO[] = [];
    let total = 0;
    for (const keyword of keywords) {
      const page = await ordersApi.adminSearch({ keyword, size: 100 }, signal);
      hits = page.content;
      total = page.totalElements;
      if (hits.length) break;
    }

    /** true / false when the row says whose order it is; null when it doesn't. */
    const belongs = (o: OrderDTO): boolean | null => {
      if (student.id != null && o.studentId != null) return Number(o.studentId) === student.id;
      if (typeof o.studentEmail === 'string' && o.studentEmail.trim()) {
        return o.studentEmail.trim().toLowerCase() === email;
      }
      return null;
    };

    const mine: OrderDTO[] = [];
    const unknown: OrderDTO[] = [];
    hits.forEach((o) => {
      const b = belongs(o);
      if (b === true) mine.push(o);
      else if (b === null) unknown.push(o);
    });

    const toCheck = unknown.slice(0, ORDER_VERIFY_LIMIT);
    const checked = await mapLimit(toCheck, 4, async (o) => {
      try {
        return detailToRow(await ordersApi.detail(o.id, signal));
      } catch (e) {
        if ((e as Error).name === 'AbortError') throw e;
        return null;
      }
    });
    let unchecked = unknown.length - toCheck.length;
    checked.forEach((row) => {
      if (row && belongs(row) === true) mine.push(row);
      else if (!row || belongs(row) === null) unchecked += 1;
    });

    mine.sort((a, b) =>
      (parseServerDate(b.createdAt)?.getTime() ?? 0) - (parseServerDate(a.createdAt)?.getTime() ?? 0));

    let note: string | null = null;
    if (unchecked > 0 || total > hits.length) {
      note = `Showing the ${mine.length} most recent order${mine.length === 1 ? '' : 's'} found for this student. `
        + 'Older ones may not be listed — search the Orders page for the rest.';
    }
    return { orders: mine, note };
  },

  /**
   * Find a student: ONE call to the search endpoint for the profile, then the
   * existing order search for their orders (orders feed the Orders, Payments
   * and Files tabs). A student with no orders is still found. If the orders
   * cannot be loaded, the profile is still returned with `ordersError` set.
   *
   * Throws for an empty or invalid query (callers check classifyQuery first)
   * and for any error from the search endpoint.
   */
  async search(raw: string, signal?: AbortSignal): Promise<StudentSearchResult> {
    const q = classifyQuery(raw);
    if (q.kind === 'empty' || q.kind === 'invalid') {
      throw new Error(q.kind === 'empty' ? 'Enter a student ID or email address.' : q.message);
    }

    const dto = await studentsApi.searchProfile(q.keyword, q.kind, signal);
    if (!dto || typeof dto !== 'object') throw new Error('The search returned an unexpected response.');
    const student = profileFromDto(dto, q.kind === 'id' ? Number(q.keyword) : null);

    let orders: OrderDTO[] = [];
    let ordersNote: string | null = null;
    let ordersError: string | null = null;
    try {
      ({ orders, note: ordersNote } = await studentsApi.ordersFor(student, signal));
    } catch (e) {
      if ((e as Error).name === 'AbortError') throw e;
      ordersError = (e as Error).message || 'Orders could not be loaded.';
    }

    // No signup date in the profile: fall back to the earliest order, labelled
    // as such ("First order"), never as a join date.
    if (!student.createdAt) {
      const oldest = earliest(orders);
      if (oldest?.createdAt) {
        student.createdAt = oldest.createdAt;
        student.joinedFromOrders = true;
      }
    }

    // Wallet: from the profile when it has one; otherwise the legacy probes.
    if (typeof dto.walletBalance !== 'number' && student.id != null) {
      for (const ep of API.students.walletCandidates(student.id)) {
        try {
          const w = await apiGet<{ balance?: number; walletBalance?: number }>(ep, {
            signal,
            suppressAuthRedirect: true,
          });
          const bal = w?.balance ?? w?.walletBalance;
          if (typeof bal === 'number') {
            student.walletBalance = bal;
            break;
          }
        } catch (e) {
          if ((e as Error).name === 'AbortError') throw e;
          /* candidate does not exist — expected */
        }
      }
    }

    return { student, orders, stats: computeStats(orders), ordersError, ordersNote };
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
          // A row confirmed from the order details already carries its
          // payments; only the others need GET /payments/order/{id}.
          const list = Array.isArray(o.payments)
            ? (o.payments as PaymentDTO[])
            : await paymentsApi.byOrder(o.id, signal);
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
