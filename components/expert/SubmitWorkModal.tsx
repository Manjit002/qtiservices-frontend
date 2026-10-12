'use client';

import { useCallback, useState } from 'react';
import { AlertTriangle, Send } from 'lucide-react';
import { Modal } from '@/components/shared/Modal';
import { Button } from '@/components/ui/Button';
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
      setError('Add at least one file — the finished work is what gets submitted.');
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
      showToast(`Submitted ${fmtOrderId(order.id)}.`, 'success', 5000);
      reset();
      onSubmitted();
      onClose();
    } catch (e) {
      const message = (e as Error).message;
      setError(message);
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
      title={<>Submit work — {fmtOrderId(order?.id ?? null)}</>}
      maxWidth="560px"
      closeOnOverlay={!busy}
      labelledBy="submit-work-title"
      footer={
        <>
          <Button variant="ghost" onClick={handleClose} disabled={busy}>Cancel</Button>
          <Button variant="primary" onClick={submit} loading={busy}>
            {!busy && <Send size={14} />} {busy ? 'Submitting…' : queue.length > 1 ? `Submit ${queue.length} files` : 'Submit work'}
          </Button>
        </>
      }
    >
      {error && (
        <div className="alert error" role="alert" style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} /> <span>{error}</span>
        </div>
      )}
      {order?.subject && <p className="t-sm" style={{ fontWeight: 600, marginBottom: 4 }}>{order.subject}</p>}
      <p className="t-sm text-dim" style={{ marginBottom: 'var(--s4)', lineHeight: 1.6 }}>
        Attach your finished deliverables. The order moves to <strong>submitted</strong> once the upload completes.
      </p>
      <FileUploadQueue
        queue={queue}
        onAdd={addFiles}
        onRemove={removeFile}
        progress={progress}
        disabled={busy}
        label="Drop your finished work here, or click to browse"
      />
    </Modal>
  );
}
