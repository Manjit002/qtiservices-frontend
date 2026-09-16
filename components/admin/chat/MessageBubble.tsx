'use client';

import { CornerUpLeft, FileText, Download } from 'lucide-react';
import { chatTime } from '@/lib/utils/chatFormat';
import { formatBytes } from '@/lib/utils/format';
import type { ChatMessage } from '@/types';

interface Props {
  message: ChatMessage;
  parent: ChatMessage | null;
  onReply: (m: ChatMessage) => void;
  onOpenImage: (url: string) => void;
}

export function MessageBubble({ message: m, parent, onReply, onOpenImage }: Props) {
  const mine = m.senderRole === 'ADMIN';

  return (
    <div className={`ch-row${mine ? ' mine' : ''}`}>
      <div className="ch-bubble">
        {/* Sender name only on incoming — labelling our own messages is noise. */}
        {!mine && m.senderName && (
          <div className="ch-quote-name" style={{ marginBottom: 3 }}>{m.senderName}</div>
        )}

        {parent && (
          <div className="ch-quote">
            <div className="ch-quote-name">
              {parent.senderRole === 'ADMIN' ? 'You' : parent.senderName ?? 'Student'}
            </div>
            <div className="ch-quote-text truncate">
              {parent.message || parent.fileName || 'Attachment'}
            </div>
          </div>
        )}

        {m.fileKey && m.messageType === 'IMAGE' && m.fileUrl && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            className="ch-img"
            src={m.fileUrl}
            alt={m.fileName ?? 'Attachment'}
            onClick={() => onOpenImage(m.fileUrl as string)}
          />
        )}

        {m.fileKey && m.messageType !== 'IMAGE' && (
          <a className="ch-file" href={m.fileUrl ?? '#'} target="_blank" rel="noopener noreferrer">
            <FileText size={15} style={{ color: 'var(--accent-text)', flexShrink: 0 }} />
            <span style={{ minWidth: 0, flex: 1 }}>
              <span className="truncate" style={{ display: 'block' }}>
                {m.fileName ?? 'Attachment'}
              </span>
              {m.fileSize != null && (
                <span className="t-xs text-dim">{formatBytes(m.fileSize)}</span>
              )}
            </span>
            <Download size={13} style={{ flexShrink: 0, opacity: .6 }} />
          </a>
        )}

        {m.message && <div>{m.message}</div>}

        <div className="ch-meta">
          <span>{chatTime(m.createdAt)}</span>
          {mine && (
            <span className={`ch-tick${m.seen ? ' seen' : ''}`} aria-label={m.seen ? 'Seen' : 'Sent'}>
              {m.seen ? '✓✓' : '✓'}
            </span>
          )}
          <button type="button" className="ch-reply" onClick={() => onReply(m)}
                  aria-label="Reply to this message">
            <CornerUpLeft size={11} />
          </button>
        </div>
      </div>
    </div>
  );
}
