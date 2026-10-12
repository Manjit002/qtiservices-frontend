import { filesApi, resolveSignedUrl } from '@/lib/api/files';

/**
 * The backend hands back a short-lived pre-signed S3 URL rather than the file
 * bytes, so downloading is: ask for the URL, then navigate to it. No file URL
 * is ever constructed by hand.
 */
export async function downloadFileById(fileId: number, fileName?: string): Promise<void> {
  const res = await filesApi.downloadUrl(fileId);
  const url = resolveSignedUrl(res);
  if (!url) throw new Error('No download URL returned by the server.');

  const a = document.createElement('a');
  a.href = url;
  if (fileName) a.download = fileName;
  a.rel = 'noopener';
  a.target = '_blank';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export async function getPreviewUrl(fileId: number): Promise<string> {
  const res = await filesApi.previewUrl(fileId);
  const url = resolveSignedUrl(res);
  if (!url) throw new Error('No preview URL returned by the server.');
  return url;
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(String(text));
    return true;
  } catch {
    return false;
  }
}
