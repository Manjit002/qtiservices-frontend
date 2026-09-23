'use client';

import { Modal } from './Modal';

interface ConfirmDialogProps {
  isOpen: boolean;
  message: string;
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Nested-safe confirmation. Overlay click is disabled so a destructive action
 * can only be dismissed deliberately.
 */
export function ConfirmDialog({
  isOpen,
  message,
  title = 'Please confirm',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title={title}
      closeOnOverlay={false}
      maxWidth="440px"
      labelledBy="confirm-dialog-title"
      footer={
        <>
          <button className="btn btn-ghost" onClick={onCancel} disabled={busy} type="button">
            {cancelLabel}
          </button>
          <button
            className={danger ? 'btn btn-danger' : 'btn btn-primary'}
            onClick={onConfirm}
            disabled={busy}
            type="button"
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </>
      }
    >
      <p style={{ fontSize: '.88rem', lineHeight: 1.7 }}>{message}</p>
    </Modal>
  );
}
