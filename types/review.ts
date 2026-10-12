export type ReviewStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | (string & {});
export type ReviewType = 'EXTERNAL' | 'INTERNAL' | (string & {});

/** Source enum, copied verbatim from the source's reviewSourceLabel map. */
export const REVIEW_SOURCES = [
  'WEBSITE', 'GOOGLE', 'FACEBOOK', 'INSTAGRAM', 'X', 'WHATSAPP', 'EMAIL', 'TEXT', 'OTHER',
] as const;

export type ReviewSource = (typeof REVIEW_SOURCES)[number] | (string & {});

export const REVIEW_SOURCE_LABEL: Record<string, string> = {
  WEBSITE: 'Website', GOOGLE: 'Google', FACEBOOK: 'Facebook', INSTAGRAM: 'Instagram',
  X: 'X', WHATSAPP: 'WhatsApp', EMAIL: 'Email', TEXT: 'Text', OTHER: 'Other',
};

export type ReviewMediaType = 'IMAGE' | 'VIDEO' | 'PDF' | 'AUDIO' | 'DOCUMENT' | (string & {});

export interface ReviewMedia {
  id?: number;
  mediaType?: ReviewMediaType;
  fileUrl?: string;
  thumbnailUrl?: string | null;
  sortOrder?: number | null;
}

/**
 * ReviewResponseDTO.
 *
 * NOTE: there is no orderId, expertName or studentName on this DTO. Reviews are
 * not tied to an order+expert pair in the response — a link can only be
 * confirmed via the verify-purchase action, which sets `verifiedPurchase`.
 */
export interface ReviewResponseDTO {
  id: number;
  reviewerName?: string | null;
  country?: string | null;
  rating?: number | null;
  title?: string | null;
  review?: string | null;
  verifiedPurchase?: boolean | null;
  media?: ReviewMedia[] | null;
  helpfulCount?: number | null;
  reportCount?: number | null;
  status?: ReviewStatus | null;
  createdAt?: string | null;
  reviewType?: ReviewType | null;
  reviewSource?: ReviewSource | null;
  sourceUrl?: string | null;
  adminRemark?: string | null;
  [key: string]: unknown;
}

/** Body for approve and reject. `adminRemark` is null when the field is blank. */
export interface ReviewModerationRequest {
  adminRemark: string | null;
}

/** Fields posted to the external-review endpoint as plain multipart parts. */
export interface ExternalReviewFields {
  reviewerName: string;
  country: string;
  rating: number;
  title: string;
  review: string;
  reviewSource: ReviewSource;
  sourceUrl: string;
}
