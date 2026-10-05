import { apiUrl, API_BASE_URL } from '@/lib/config';
import { authService } from '@/lib/auth/authService';
import { ROUTES } from './endpoints';

export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;
  constructor(message: string, status: number, body?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

export type Portal = 'admin' | 'expert';

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: BodyInit | null;
  /** Which login page a 401/403 should bounce to. Defaults to 'admin'. */
  portal?: Portal;
  /** Skip the auth redirect (used by polling/background calls). */
  suppressAuthRedirect?: boolean;
  signal?: AbortSignal;
}

/**
 * Guards against a redirect storm: once we've decided the session is dead we
 * navigate exactly once, even if a dozen in-flight requests all 401 together.
 */
let redirecting = false;

function handleUnauthorized(portal: Portal): void {
  if (redirecting) return;
  redirecting = true;
  authService.clear();
  if (typeof window !== 'undefined') {
    window.location.href = portal === 'expert' ? ROUTES.expertLogin : ROUTES.adminLogin;
  }
}

/**
 * Single fetch wrapper for every authenticated backend call.
 *
 * Behaviour is deliberately identical to the legacy `api()` helper: bearer
 * token from storage, optional CSRF header, 401/403 → logout, non-2xx → throw
 * with the backend's `message`, JSON parsed when the content-type says so and
 * text returned otherwise.
 */
export async function apiFetch<T = unknown>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const { portal = 'admin', suppressAuthRedirect, headers: extraHeaders, ...rest } = options;

  const token = authService.getToken();
  const headers = new Headers(extraHeaders);
  if (token) headers.set('Authorization', `Bearer ${token}`);

  // Do NOT set Content-Type for FormData — the browser must add the multipart
  // boundary itself, and overriding it silently breaks every upload endpoint.
  const isFormData = rest.body instanceof FormData;
  if (!isFormData && rest.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  let res: Response;
  try {
    res = await fetch(apiUrl(path), { ...rest, headers });
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') throw e;
    // Name the origin that actually failed. A misconfigured backend URL and a
    // genuinely offline network produce the same TypeError otherwise, and the
    // difference is the first thing you need to know.
    const target = API_BASE_URL || (typeof window !== 'undefined' ? window.location.origin : '');
    throw new ApiError(
      `Could not reach the backend at ${target || 'the configured origin'}. ` +
        'Check NEXT_PUBLIC_API_BASE_URL and that the server allows this origin (CORS).',
      0
    );
  }

  if (res.status === 401 || res.status === 403) {
    if (!suppressAuthRedirect) handleUnauthorized(portal);
    throw new ApiError(
      res.status === 401 ? 'Session expired. Please sign in again.' : 'Not permitted.',
      res.status
    );
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const message =
      (body as { message?: string })?.message || `Request failed (${res.status})`;
    throw new ApiError(message, res.status, body);
  }

  if (res.status === 204) return undefined as T;

  const contentType = res.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) return (await res.json()) as T;
  return (await res.text()) as unknown as T;
}

export const apiGet = <T>(path: string, o: RequestOptions = {}) =>
  apiFetch<T>(path, { ...o, method: 'GET' });

export const apiPost = <T>(path: string, body?: unknown, o: RequestOptions = {}) =>
  apiFetch<T>(path, {
    ...o,
    method: 'POST',
    body:
      body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
  });

export const apiPut = <T>(path: string, body?: unknown, o: RequestOptions = {}) =>
  apiFetch<T>(path, {
    ...o,
    method: 'PUT',
    body:
      body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
  });

export const apiDelete = <T>(path: string, o: RequestOptions = {}) =>
  apiFetch<T>(path, { ...o, method: 'DELETE' });

/** PATCH — used by the coupon toggle, which is the only PATCH in the API. */
export const apiPatch = <T>(path: string, body?: unknown, o: RequestOptions = {}) =>
  apiFetch<T>(path, {
    ...o,
    method: 'PATCH',
    body:
      body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
  });

/**
 * Multipart upload with real progress events.
 *
 * fetch() still cannot report upload progress, so — exactly as the legacy
 * expert dashboard did — this drops to XMLHttpRequest. Returns an abort handle
 * so callers can cancel on unmount.
 */
export function uploadWithProgress<T = unknown>(
  path: string,
  formData: FormData,
  onProgress?: (percent: number) => void,
  portal: Portal = 'admin'
): { promise: Promise<T>; abort: () => void } {
  const xhr = new XMLHttpRequest();

  const promise = new Promise<T>((resolve, reject) => {
    xhr.open('POST', apiUrl(path));

    const token = authService.getToken();
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status === 401 || xhr.status === 403) {
        handleUnauthorized(portal);
        reject(new ApiError('Session expired. Please sign in again.', xhr.status));
        return;
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        const ct = xhr.getResponseHeader('content-type') ?? '';
        if (ct.includes('application/json')) {
          try {
            resolve(JSON.parse(xhr.responseText) as T);
          } catch {
            resolve(xhr.responseText as unknown as T);
          }
        } else {
          resolve(xhr.responseText as unknown as T);
        }
        return;
      }
      let message = `Upload failed (${xhr.status})`;
      try {
        const parsed = JSON.parse(xhr.responseText) as { message?: string };
        if (parsed?.message) message = parsed.message;
      } catch {
        /* keep the generic message */
      }
      reject(new ApiError(message, xhr.status));
    };

    xhr.onerror = () => reject(new ApiError('Network error', 0));
    xhr.onabort = () => reject(new DOMException('Aborted', 'AbortError'));
    xhr.send(formData);
  });

  return { promise, abort: () => xhr.abort() };
}

/** Build a query string, dropping null/undefined and encoding values. */
export function qs(params: Record<string, string | number | boolean | null | undefined>): string {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== null && v !== undefined && v !== '') sp.set(k, String(v));
  });
  const s = sp.toString();
  return s ? `?${s}` : '';
}
