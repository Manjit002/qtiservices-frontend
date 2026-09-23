'use client';

import { useCallback, useRef, useState } from 'react';
import { FolderOpen } from 'lucide-react';
import { Modal } from '@/components/shared/Modal';
import { Spinner } from '@/components/ui/Button';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { FileLightbox } from '@/components/shared/FileLightbox';
import { useAsync } from '@/hooks/useAsync';
import { useToast } from '@/hooks/useToast';
import { filesApi } from '@/lib/api/files';
import { downloadFileById, getPreviewUrl } from '@/lib/utils/download';
import { fileIcon, extensionOf, formatBytes, fmtOrderId, formatDate } from '@/lib/utils/format';
import type { FileDTO, OrderDTO } from '@/types';
import '@/components/admin/orders.css';

interface Props {
  order: OrderDTO | null;
  onClose: () => void;
}

const PAGE_SIZE = 12;

export function FileGalleryModal({ order, onClose }: Props) {
  const { showToast } = useToast();
  const [page, setPage] = useState(0);
  const [preview, setPreview] = useState<{ url: string; name: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<(() => void) | null>(null);

  const files = useAsync(
    (signal) =>
      order == null
        ? Promise.resolve(null)
        : filesApi.listForOrder(order.id, page, PAGE_SIZE, signal),
    [order?.id, page]
  );

  const handleDownload = useCallback(
    async (f: FileDTO) => {
      try {
        await downloadFileById(f.id, f.fileName ?? f.name ?? undefined);
      } catch (e) {
        showToast((e as Error).message, 'error');
      }
    },
    [showToast]
  );

  const handlePreview = useCallback(
    async (f: FileDTO) => {
      try {
        const url = await getPreviewUrl(f.id);
        setPreview({ url, name: f.fileName ?? f.name ?? 'File' });
      } catch (e) {
        showToast((e as Error).message, 'error');
      }
    },
    [showToast]
  );

  const handleUpload = useCallback(
    async (list: FileList | null) => {
      if (!list || list.length === 0 || !order) return;
      const fd = new FormData();
      fd.append('orderId', String(order.id));
      Array.from(list).forEach((f) => fd.append('files', f, f.name));

      setUploading(true);
      setProgress(0);
      const { promise, abort } = filesApi.upload(fd, setProgress, 'admin');
      abortRef.current = abort;
      try {
        await promise;
        showToast(`${list.length} file(s) uploaded.`, 'success');
        setPage(0);
        files.reload();
      } catch (e) {
        if ((e as Error).name !== 'AbortError') showToast((e as Error).message, 'error');
      } finally {
        setUploading(false);
        setProgress(0);
        abortRef.current = null;
      }
    },
    [order, files, showToast]
  );

  const close = useCallback(() => {
    // Cancel an in-flight upload rather than leaving it running against a
    // modal the admin has already dismissed.
    abortRef.current?.();
    setPreview(null);
    setPage(0);
    onClose();
  }, [onClose]);

  const rows = files.data?.content ?? [];
  const totalPages = files.data?.totalPages ?? 1;

  return (
    <>
      <Modal
        isOpen={order != null}
        onClose={close}
        title={<>📁 Files — {fmtOrderId(order?.id ?? null)}</>}
        maxWidth="860px"
        labelledBy="file-gallery-title"
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={close}>Close</button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? `Uploading… ${progress}%` : '⬆ Upload Files'}
            </button>
          </>
        }
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          style={{ display: 'none' }}
          onChange={(e) => { void handleUpload(e.target.files); e.target.value = ''; }}
        />

        {uploading && (
          <div className="upload-prog-wrap" style={{ marginBottom: 14 }}>
            <div className="upload-prog-bar" style={{ width: `${progress}%` }} />
          </div>
        )}

        {files.loading && <div style={{ textAlign: 'center', padding: 34 }}><Spinner /></div>}
        {files.error && <ErrorState message={files.error} onRetry={files.reload} />}

        {!files.loading && !files.error && rows.length === 0 && (
          <EmptyState
            icon={<FolderOpen size={18} />}
            title="No files yet"
            hint="Upload deliverables or reference material for this order."
          />
        )}

        {rows.length > 0 && (
          <div className="files-grid">
            {rows.map((f) => {
              const name = f.fileName ?? f.name ?? `File ${f.id}`;
              return (
                <div key={f.id} className="file-card">
                  <div className="fc-icon" aria-hidden>{fileIcon(extensionOf(name))}</div>
                  <div className="fc-name" title={name}>{name}</div>
                  <div className="fc-meta">
                    {formatBytes(f.size)}
                    {f.uploadedAt ? ` · ${formatDate(f.uploadedAt)}` : ''}
                  </div>
                  <div className="fc-actions">
                    <button type="button" className="fc-btn" onClick={() => void handlePreview(f)}>
                      👁 Preview
                    </button>
                    <button type="button" className="fc-btn" onClick={() => void handleDownload(f)}>
                      ⬇ Download
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {totalPages > 1 && (
          <div className="pager">
            <span className="t-xs text-dim">
              Page {page + 1} of {totalPages}
              {files.data?.totalElements != null && ` · ${files.data.totalElements} files`}
            </span>
            <div className="pager-nums">
              <button className="pg-n" onClick={() => setPage(page - 1)} disabled={page === 0}
                      aria-label="Previous page">‹</button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const start = Math.max(0, Math.min(page - 2, totalPages - 5));
                const p = start + i;
                return (
                  <button key={p} className={`pg-n${p === page ? ' on' : ''}`}
                          onClick={() => setPage(p)}
                          aria-current={p === page ? 'page' : undefined}>
                    {p + 1}
                  </button>
                );
              })}
              <button className="pg-n" onClick={() => setPage(page + 1)}
                      disabled={page >= totalPages - 1} aria-label="Next page">›</button>
            </div>
          </div>
        )}
      </Modal>

      <FileLightbox
        url={preview?.url ?? null}
        name={preview?.name}
        onClose={() => setPreview(null)}
      />
    </>
  );
}
