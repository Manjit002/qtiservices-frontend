'use client';

import { useCallback, useEffect, useState } from 'react';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { FileLightbox } from '@/components/shared/FileLightbox';
import { Pagination } from '@/components/shared/Pagination';
import { Spinner } from '@/components/shared/Spinner';
import { useAsync } from '@/hooks/useAsync';
import { useToast } from '@/hooks/useToast';
import { expertApi } from '@/lib/api/expert';
import { filesApi, resolveSignedUrl } from '@/lib/api/files';
import { fileExtension, fileIcon, fmtOrderId, formatBytes, formatDate, isImageFile } from '@/lib/utils/format';
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

  const handleUpload = useCallback(async () => {
    if (orderId == null) {
      showToast('Select an order first.', 'warning');
      return;
    }
    if (!queue.length) {
      showToast('Add files first.', 'warning');
      return;
    }

    const fd = new FormData();
    fd.append('orderId', String(orderId));
    queue.forEach((u) => fd.append('files', u.file, u.file.name));

    setUploading(true);
    setProgress(0);
    try {
      await filesApi.upload(fd, setProgress).promise;
      showToast(`${queue.length} file(s) uploaded.`, 'success');
      setQueue([]);
      setShowUpload(false);
      await files.reload();
    } catch (err) {
      showToast((err as Error).message, 'error');
    } finally {
      setUploading(false);
      setProgress(null);
    }
  }, [orderId, queue, showToast, files]);

  const handleDownload = useCallback(
    async (file: FileDTO) => {
      try {
        const res = await filesApi.downloadUrl(file.id);
        const url = resolveSignedUrl(res);
        if (!url) throw new Error('No download URL returned.');
        window.open(url, '_blank', 'noopener,noreferrer');
      } catch (err) {
        showToast((err as Error).message, 'error');
      }
    },
    [showToast],
  );

  const handlePreview = useCallback(
    async (file: FileDTO) => {
      try {
        const res = await filesApi.previewUrl(file.id);
        const url = resolveSignedUrl(res);
        if (!url) throw new Error('No preview URL returned.');
        setLightbox({ url, name: file.fileName ?? file.name ?? '' });
      } catch (err) {
        showToast((err as Error).message, 'error');
      }
    },
    [showToast],
  );

  const orderOptions = orders.data?.content ?? [];
  const fileList = files.data?.content ?? [];

  return (
    <div>
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 240px' }}>
            <label htmlFor="files-order-select" style={{ display: 'block', fontSize: '.7rem', fontWeight: 700, color: 'var(--muted)', letterSpacing: '.07em', textTransform: 'uppercase', marginBottom: 6 }}>
              Order
            </label>
            <select
              id="files-order-select"
              className="fi"
              value={orderId ?? ''}
              onChange={(e) => {
                setOrderId(e.target.value ? Number(e.target.value) : null);
                setFilesPage(0);
              }}
            >
              <option value="">— Select an order —</option>
              {orderOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {fmtOrderId(o.id)} · {o.subject || 'Untitled'}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setShowUpload((v) => !v)}
            disabled={orderId == null}
          >
            {showUpload ? '✕ Cancel' : '📤 Upload Files'}
          </button>
        </div>

        {showUpload && orderId != null && (
          <div style={{ marginTop: 18 }}>
            <FileUploadQueue
              queue={queue}
              onAdd={addToQueue}
              onRemove={(id) => setQueue((prev) => prev.filter((u) => u.localId !== id))}
              progress={progress}
              disabled={uploading}
            />
            <button
              type="button"
              className="btn btn-primary"
              style={{ marginTop: 14 }}
              onClick={handleUpload}
              disabled={uploading || !queue.length}
            >
              {uploading ? <><Spinner size="sm" onAccent /> Uploading…</> : '🚀 Upload'}
            </button>
          </div>
        )}
      </div>

      {orderId == null ? (
        <div className="card"><EmptyState icon="📁" title="Select an order" subtitle="Choose an order above to browse its files." /></div>
      ) : files.loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}><Spinner size="lg" /></div>
      ) : files.error ? (
        <ErrorState message={files.error} onRetry={files.reload} />
      ) : fileList.length === 0 ? (
        <div className="card"><EmptyState icon="📂" title="No files yet" subtitle="Uploaded files will appear here." /></div>
      ) : (
        <>
          <div className="files-grid">
            {fileList.map((f) => {
              const name = f.fileName ?? f.name ?? 'Untitled';
              const ext = fileExtension(name);
              return (
                <div key={f.id} className="file-card">
                  <div className="fc-icon" aria-hidden>{fileIcon(ext)}</div>
                  <div className="fc-name" title={name}>{name}</div>
                  <div className="fc-meta">
                    {formatBytes(f.size)} · {formatDate(f.uploadedAt)}
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                    {isImageFile(name) || ext === 'pdf' ? (
                      <button type="button" className="fc-btn" onClick={() => handlePreview(f)}>👁 Preview</button>
                    ) : null}
                    <button type="button" className="fc-btn" onClick={() => handleDownload(f)}>⬇ Download</button>
                  </div>
                </div>
              );
            })}
          </div>
          <Pagination
            page={filesPage}
            totalPages={files.data?.totalPages ?? 1}
            total={files.data?.totalElements}
            label="files"
            onPageChange={setFilesPage}
          />
        </>
      )}

      <FileLightbox url={lightbox?.url ?? null} name={lightbox?.name} onClose={() => setLightbox(null)} />
    </div>
  );
}
