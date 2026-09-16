'use client';

import { useCallback, useState } from 'react';
import { Modal } from '@/components/shared/Modal';
import { FileUploadQueue } from './FileUploadQueue';
import { useToast } from '@/hooks/useToast';
import { expertApi } from '@/lib/api/expert';
import { fmtOrderId } from '@/lib/utils/format';
import type { OrderDTO, QueuedUpload } from '@/types';

interface Props {
  order: OrderDTO | null;
  onClose: () => void;
  onSubmitted: () => void;
}

/**
 * Work submission.
 *
 * Multipart field name is `files` (repeated), exactly as the legacy
 * doSubmitWork() sent it — the Spring controller binds on that name.
 */
export function SubmitWorkModal({ order, onClose, onSubmitted }: Props) {
  const { showToast } = useToast();
  const [queue, setQueue] = useState<QueuedUpload[]>([]);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const addFiles = useCallback((list: FileList | null) => {
    if (!list) return;
    setQueue((prev) => [
      ...prev,
      ...Array.from(list).map((file) => ({
        localId: `${file.name}-${file.size}-${Math.random().toString(36).slice(2)}`,
        file,
      })),
    ]);
    setError('');
  }, []);

  const removeFile = useCallback((localId: string) => {
    setQueue((prev) => prev.filter((q) => q.localId !== localId));
  }, []);

  const reset = useCallback(() => {
    setQueue([]);
    setProgress(null);
    setError('');
    setBusy(false);
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  const submit = useCallback(async () => {
    if (!order) return;
    if (queue.length === 0) {
      setError('⚠️ Add at least one file to submit.');
      return;
    }
    setBusy(true);
    setError('');
    setProgress(0);

    const fd = new FormData();
    queue.forEach((q) => fd.append('files', q.file, q.file.name));

    try {
      const { promise } = expertApi.submitWork(order.id, fd, setProgress);
      await promise;
      showToast(`${fmtOrderId(order.id)} submitted successfully! 🎉`, 'success', 5000);
      reset();
      onSubmitted();
      onClose();
    } catch (e) {
      const message = (e as Error).message;
      setError(`⚠️ ${message}`);
      showToast(message, 'error');
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }, [order, queue, showToast, reset, onSubmitted, onClose]);

  return (
    <Modal
      isOpen={order != null}
      onClose={handleClose}
      title={<>Submit Work — {fmtOrderId(order?.id ?? null)}</>}
      maxWidth="560px"
      closeOnOverlay={!busy}
      labelledBy="submit-work-title"
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={handleClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={submit} disabled={busy}>
            {busy ? 'Submitting…' : '🚀 Submit Work'}
          </button>
        </>
      }
    >
      {error && <div className="alert error" role="alert">{error}</div>}
      <p style={{ fontSize: '.82rem', color: 'var(--muted)', marginBottom: 14, lineHeight: 1.7 }}>
        Attach your completed deliverables. The order moves to <strong>SUBMITTED</strong> once
        the upload finishes.
      </p>
      <FileUploadQueue
        queue={queue}
        onAdd={addFiles}
        onRemove={removeFile}
        progress={progress}
        disabled={busy}
        label="Drop your completed work here or click to browse"
      />
    </Modal>
  );
}
