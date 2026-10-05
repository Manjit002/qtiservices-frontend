/** Spring Data `Page<T>` as returned by the backend. */
export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
  first?: boolean;
  last?: boolean;
  empty?: boolean;
}

/**
 * Java LocalDateTime is serialised either as an ISO string or as a
 * [y, M, d, h, m, s] tuple depending on the Jackson config in play.
 * Both shapes appear in the legacy code (see `parseServerDeadline`), so both
 * are modelled here rather than assuming one.
 */
export type ServerDateTime = string | number[] | null | undefined;

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: number;
  message: string;
  type: ToastType;
  duration: number;
}

export interface ApiErrorShape {
  message?: string;
  error?: string;
  status?: number;
}
