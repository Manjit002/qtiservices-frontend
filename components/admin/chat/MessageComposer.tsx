'use client';

import { useCallback, useEffect, useRef } from 'react';
import { Paperclip, SendHorizonal, CornerUpLeft, X } from 'lucide-react';
import { Spinner } from '@/components/ui/Button';
import { AttachmentPreview } from './AttachmentPreview';
import type { ChatMessage } from '@/types';

interface Props {
  draft: string;
  onDraftChange: (v: string) => void;
  queue: File[];
  onAddFiles: (files: FileList | null) => void;
  onRemoveFile: (index: number) => void;
  replyTo: ChatMessage | null;
  onCancelReply: () => void;
  onSend: () => void;
  sending: boolean;
  connected: boolean;
}

/** Extensions matching CHAT_ALLOWED_TYPES, so the picker offers what the backend takes. */
const ACCEPT = '.pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx';

export function MessageComposer({
  draft, onDraftChange, queue, onAddFiles, onRemoveFile,
  replyTo, onCancelReply, onSend, sending, connected,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  /** Auto-grow: reset then measure, or the box only ever grows. */
  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 148)}px`;
  }, [draft]);

  // Escape clears the attachment queue, then the reply — nearest context first.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (queue.length) { queue.forEach((_, i) => onRemoveFile(queue.length - 1 - i)); }
      else if (replyTo) onCancelReply();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [queue, replyTo, onRemoveFile, onCancelReply]);

  const canSend = (draft.trim().length > 0 || queue.length > 0) && !sending;

  const handleKey = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Enter sends; Shift+Enter newlines. IME composition must not trigger a send.
      if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
        e.preventDefault();
        if (canSend) onSend();
      }
    },
    [canSend, onSend]
  );

  return (
    <div className="ch-comp">
      {replyTo && (
        <div className="ch-reply-bar">
          <CornerUpLeft size={12} style={{ color: 'var(--accent)', flexShrink: 0 }} />
          <span className="truncate" style={{ flex: 1 }}>
            Replying to {replyTo.senderRole === 'ADMIN' ? 'yourself' : replyTo.senderName ?? 'student'}
            {' — '}
            <span className="text-dim">{replyTo.message || replyTo.fileName || 'Attachment'}</span>
          </span>
          <button type="button" onClick={onCancelReply} aria-label="Cancel reply">
            <X size={13} />
          </button>
        </div>
      )}

      {queue.length > 0 && (
        <div className="ch-queue">
          {queue.map((f, i) => (
            <AttachmentPreview key={`${f.name}-${f.size}-${i}`} file={f} onRemove={() => onRemoveFile(i)} />
          ))}
        </div>
      )}

      <div className="ch-comp-row">
        <button type="button" className="ch-attach" onClick={() => inputRef.current?.click()}
                aria-label="Attach a file" title="Attach a file" disabled={sending}>
          <Paperclip size={16} />
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT}
          className="visually-hidden"
          aria-label="Choose files to attach"
          onChange={(e) => { onAddFiles(e.target.files); e.target.value = ''; }}
        />

        <textarea
          ref={areaRef}
          className="ch-input"
          rows={1}
          value={draft}
          placeholder={connected ? 'Type a message…' : 'Waiting for connection…'}
          onChange={(e) => onDraftChange(e.target.value)}
          onKeyDown={handleKey}
          disabled={sending}
          aria-label="Message"
        />

        <button type="button" className="ch-send" onClick={onSend} disabled={!canSend}
                aria-label="Send message" title="Send">
          {sending ? <Spinner size={15} /> : <SendHorizonal size={16} />}
        </button>
      </div>

      {/* The connection banner above the thread owns this message now; a second
          copy under the composer said the same thing twice. */}
    </div>
  );
}
