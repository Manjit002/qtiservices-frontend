import { API } from './endpoints';
import { apiGet, qs, uploadWithProgress } from './client';
import type { FileDTO, PageResponse, SignedUrlResponse } from '@/types';
import type { Portal } from './client';

export const filesApi = {
  listForOrder: (orderId: number, page = 0, size = 50, signal?: AbortSignal) =>
    apiGet<PageResponse<FileDTO>>(
      `${API.files.adminOrder(orderId)}${qs({ page, size })}`,
      { signal }
    ),

  /** Alias for listForOrder — the name the dashboard panels call. */
  byOrder: (orderId: number, page = 0, size = 50, signal?: AbortSignal) =>
    apiGet<PageResponse<FileDTO>>(
      `${API.files.adminOrder(orderId)}${qs({ page, size })}`,
      { signal }
    ),

  listStudentFiles: (orderId: number, page = 0, size = 50, signal?: AbortSignal) =>
    apiGet<PageResponse<FileDTO>>(
      `${API.files.studentOrder(orderId)}${qs({ page, size })}`,
      { signal }
    ),

  /** Returns a short-lived pre-signed S3 URL rather than the bytes themselves. */
  downloadUrl: (fileId: number) =>
    apiGet<SignedUrlResponse>(API.files.download(fileId)),

  previewUrl: (fileId: number) =>
    apiGet<SignedUrlResponse>(API.files.preview(fileId)),

  upload: (
    formData: FormData,
    onProgress?: (p: number) => void,
    portal: Portal = 'admin'
  ) => uploadWithProgress<unknown>(API.files.employeeUpload, formData, onProgress, portal),
};


/** Normalise the three field names the backend uses for signed URLs. */
export function resolveSignedUrl(r: SignedUrlResponse | null | undefined): string | null {
  return r?.downloadUrl ?? r?.previewUrl ?? r?.url ?? null;
}
