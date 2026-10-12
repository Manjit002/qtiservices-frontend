export interface FileDTO {
  id: number;
  fileName?: string | null;
  name?: string | null;
  /** Pre-signed S3 URL when the backend supplies one. */
  url?: string | null;
  contentType?: string | null;
  size?: number | null;
  category?: string | null;
  uploadedAt?: string | null;
  uploadedBy?: string | null;
  [key: string]: unknown;
}

/** GET /files/{id}/download → { downloadUrl }, /preview → { previewUrl }. */
export interface SignedUrlResponse {
  downloadUrl?: string;
  previewUrl?: string;
  url?: string;
}

export interface QueuedUpload {
  localId: string;
  file: File;
}
