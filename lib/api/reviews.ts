import { API } from './endpoints';
import { apiGet, apiPut, uploadWithProgress } from './client';
import type { ReviewResponseDTO, ExternalReviewFields } from '@/types';

export const reviewsApi = {
  /** GET → ReviewResponseDTO[] (status = PENDING). No pagination on this endpoint. */
  pending: (signal?: AbortSignal) =>
    apiGet<ReviewResponseDTO[]>(API.reviews.pending, { signal }),

  /**
   * PUT /api/admin/reviews/{id}/approve — JSON body { adminRemark }.
   * A blank remark is sent as null, not "", which is what the source does.
   */
  approve: (id: number, adminRemark: string) =>
    apiPut<ReviewResponseDTO>(API.reviews.approve(id), {
      adminRemark: adminRemark.trim() || null,
    }),

  reject: (id: number, adminRemark: string) =>
    apiPut<ReviewResponseDTO>(API.reviews.reject(id), {
      adminRemark: adminRemark.trim() || null,
    }),

  /**
   * PUT /api/admin/reviews/{id}/verify-purchase — no body. Checks the orderId
   * stored on the review against real orders and returns the updated DTO;
   * `verifiedPurchase` false means no matching order was found.
   */
  verifyPurchase: (id: number) =>
    apiPut<ReviewResponseDTO>(API.reviews.verifyPurchase(id)),

  /**
   * POST /api/admin/reviews/external — @ModelAttribute binds PLAIN multipart
   * fields, not a JSON blob part. Files go under `images` and `videos`.
   * Publishes immediately (status APPROVED); there is no moderation queue.
   */
  createExternal: (
    fields: ExternalReviewFields,
    images: File[],
    videos: File[],
    onProgress?: (p: number) => void
  ) => {
    const fd = new FormData();
    fd.append('reviewerName', fields.reviewerName);
    fd.append('country', fields.country);
    fd.append('rating', String(fields.rating));
    fd.append('title', fields.title);
    fd.append('review', fields.review);
    fd.append('reviewSource', String(fields.reviewSource));
    fd.append('sourceUrl', fields.sourceUrl);
    images.forEach((f) => fd.append('images', f, f.name));
    videos.forEach((f) => fd.append('videos', f, f.name));
    return uploadWithProgress<ReviewResponseDTO>(API.reviews.external, fd, onProgress, 'admin');
  },
};
