'use client';

import { useCallback, useEffect, useState } from 'react';
import { Download, Eye, FolderOpen, FolderSearch, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States';
import { FileTypeIcon } from '@/components/ui/FileTypeIcon';
import { FileLightbox } from '@/components/shared/FileLightbox';
import { Pagination } from '@/components/shared/Pagination';
import { useAsync } from '@/hooks/useAsync';
import { useToast } from '@/hooks/useToast';
import { expertApi } from '@/lib/api/expert';
import { filesApi, resolveSignedUrl } from '@/lib/api/files';
import { fileExtension, fmtOrderId, formatBytes, formatDate, isImageFile } from '@/lib/utils/format';
import { FileUploadQueue } from './FileUploadQueue';
import type { FileDTO, QueuedUpload } from '@/types';

/**
 * Order file browser + uploader.
 *
 * Downloads and previews go through the backend, which returns a short-lived
 * pre-signed S3 URL — no file URL is ever fabricated client-side.
 */
export function ExpertFilesPanel({ initialOrderId }: { initialOrderId?: number | null }) {
  const { showToast } = useToast();
  const [orderId, setOrderId] = useState<number | null>(initialOrderId ?? null);
  const [filesPage, setFilesPage] = useState(0);
  const [queue, setQueue] = useState<QueuedUpload[]>([]);
  const [progress, setProgress] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [lightbox, setLightbox] = useState<{ url: string; name: string } | null>(null);
  const [opening, setOpening] = useState<number | null>(null);

  useEffect(() => {
    if (initialOrderId != null) {
      setOrderId(initialOrderId);
      setFilesPage(0);
    }
  }, [initialOrderId]);

  const orders = useAsync((signal) => expertApi.orders(0, 200, signal), []);
  const files = useAsync(
    (signal) => (orderId == null ? Promise.resolve(null) : filesApi.byOrder(orderId, filesPage, 12, signal)),
    [orderId, filesPage],
  );

  const addToQueue = useCallback((list: FileList | null) => {
    if (!list) return;
    setQueue((prev) => [
      ...prev,
      ...Array.from(list).map((file) => ({ localId: `${file.name}-${file.size}-${Math.random()}`, file })),
    ]);
  }, []);

  const closeUpload = useCallback(() => { setShowUpload(false); setQueue([]); }, []);

  const handleUpload = useCallback(async () => {
    if (orderId == null) { showToast('Select an order first.', 'warning'); return; }
    if (!queue.length) { showToast('Add files first.', 'warning'); return; }

    const fd = new FormData();
    fd.append('orderId', String(orderId));
    queue.forEach((u) => fd.append('files', u.file, u.file.name));

    setUploading(true);
    setProgress(0);
    try {
      await filesApi.upload(fd, setProgress).promise;
      showToast(`Uploaded ${queue.length} file${queue.length === 1 ? '' : 's'} to ${fmtOrderId(orderId)}.`, 'success');
      setQueue([]);
      setShowUpload(false);
      setFilesPage(0);
      await files.reload();
    } catch (err) {
      showToast((err as Error).message, 'error');
    } finally {
      setUploading(false);
      setProgress(null);
    }
  }, [orderId, queue, showToast, files]);

  const handleDownload = useCallback(async (file: FileDTO) => {
    setOpening(file.id);
    try {
      const url = resolveSignedUrl(await filesApi.downloadUrl(file.id));
      if (!url) throw new Error('The server did not return a download link. Try again.');
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      showToast((err as Error).message, 'error');
    } finally {
      setOpening(null);
    }
  }, [showToast]);

  const handlePreview = useCallback(async (file: FileDTO) => {
    setOpening(file.id);
    try {
      const url = resolveSignedUrl(await filesApi.previewUrl(file.id));
      if (!url) throw new Error('The server did not return a preview link. Try again.');
      setLightbox({ url, name: file.fileName ?? file.name ?? '' });
    } catch (err) {
      showToast((err as Error).message, 'error');
    } finally {
      setOpening(null);
    }
  }, [showToast]);

  const orderOptions = orders.data?.content ?? [];
  const fileList = files.data?.content ?? [];

  return (
    <div className="rise">
      <div className="page-head">
        <div>
          <h1 className="t-h1">Order files</h1>
          <p className="t-sm text-dim" style={{ marginTop: 4 }}>
            The brief and references for an order, and the work uploaded to it.
          </p>
        </div>
      </div>

      <section className="card" style={{ marginBottom: 'var(--s5)' }}>
        <div className="xp-picker">
          <div className="field">
            <label htmlFor="files-order-select">Order</label>
            {orders.loading ? (
              <Skeleton h={36} />
            ) : (
              <select
                id="files-order-select"
                className="input"
                value={orderId ?? ''}
                onChange={(e) => {
                  setOrderId(e.target.value ? Number(e.target.value) : null);
                  setFilesPage(0);
                  closeUpload();
                }}
              >
                <option value="">Select an order…</option>
                {orderOptions.map((o) => (
                  <option key={o.id} value={o.id}>{fmtOrderId(o.id)} — {o.subject || 'Untitled order'}</option>
                ))}
              </select>
            )}
          </div>
          {showUpload ? (
            <Button onClick={closeUpload} disabled={uploading}><X size={14} /> Cancel upload</Button>
          ) : (
            <Button variant="primary" onClick={() => setShowUpload(true)} disabled={orderId == null}>
              <Upload size={14} /> Upload files
            </Button>
          )}
        </div>
        {orders.error && <ErrorState message={orders.error} onRetry={orders.reload} />}

        {showUpload && orderId != null && (
          <div className="xp-upload">
            <FileUploadQueue
              queue={queue}
              onAdd={addToQueue}
              onRemove={(id) => setQueue((prev) => prev.filter((u) => u.localId !== id))}
              progress={progress}
              disabled={uploading}
              label={`Drop files for ${fmtOrderId(orderId)}, or click to browse`}
            />
            <div className="xp-upload-foot">
              <Button variant="primary" onClick={handleUpload} loading={uploading} disabled={!queue.length}>
                {!uploading && <Upload size={14} />}
                {uploading ? 'Uploading…' : queue.length ? `Upload ${queue.length} file${queue.length === 1 ? '' : 's'}` : 'Upload'}
              </Button>
            </div>
          </div>
        )}
      </section>

      <section className="card">
        {orderId == null ? (
          <EmptyState
            icon={<FolderSearch size={18} />}
            title="Pick an order to see its files"
            hint="Choose one from the list above, or open Files from any order in My orders."
          />
        ) : files.loading ? (
          <div className="xp-files files-grid">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} h={118} r={10} />)}
          </div>
        ) : files.error ? (
          <ErrorState message={files.error} onRetry={files.reload} />
        ) : fileList.length === 0 ? (
          <EmptyState
            icon={<FolderOpen size={18} />}
            title={`No files on ${fmtOrderId(orderId)} yet`}
            hint="Files the student attaches, and anything you upload, appear here."
            action={!showUpload && <Button size="sm" variant="primary" onClick={() => setShowUpload(true)}><Upload size={13} /> Upload files</Button>}
          />
        ) : (
          <>
            <div className="xp-files files-grid">
              {fileList.map((f) => {
                const name = f.fileName ?? f.name ?? 'Untitled';
                const previewable = isImageFile(name) || fileExtension(name) === 'pdf';
                const busy = opening === f.id;
                return (
                  <div key={f.id} className="file-card xp-file">
                    <div className="fc-icon"><FileTypeIcon name={name} /></div>
                    <div className="fc-name" title={name}>{name}</div>
                    <div className="fc-meta">{formatBytes(f.size)} · {formatDate(f.uploadedAt)}</div>
                    {f.uploadedBy && <div className="xp-file-from">From {String(f.uploadedBy).toLowerCase()}</div>}
                    <div className="fc-actions">
                      {previewable && (
                        <button type="button" className="fc-btn" onClick={() => handlePreview(f)} disabled={busy} aria-label={`Preview ${name}`}>
                          <Eye size={12} /> Preview
                        </button>
                      )}
                      <button type="button" className="fc-btn" onClick={() => handleDownload(f)} disabled={busy} aria-label={`Download ${name}`}>
                        <Download size={12} /> Download
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            <Pagination
              page={filesPage}
              totalPages={files.data?.totalPages ?? 1}
              total={files.data?.totalElements}
              label={files.data?.totalElements === 1 ? 'file' : 'files'}
              onPageChange={setFilesPage}
            />
          </>
        )}
      </section>

      <FileLightbox url={lightbox?.url ?? null} name={lightbox?.name} onClose={() => setLightbox(null)} />
    </div>
  );
}
