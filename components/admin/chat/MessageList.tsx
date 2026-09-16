'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDown, Search } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States';
import { MessageBubble } from './MessageBubble';
import { chatDateLabel } from '@/lib/utils/chatFormat';
import type { ChatMessage } from '@/types';

interface Props {
  messages: ChatMessage[];
  /** All loaded messages, used to resolve reply parents even when filtered. */
  all: ChatMessage[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  hasOlder: boolean;
  onLoadOlder: () => void;
  isSearchResult: boolean;
  /**
   * PENDING + history: the thread is obscured while the connection is not
   * usable, so loaded messages are not read as current. The list stays mounted
   * (scroll position and paging survive the reconnect) but is hidden from both
   * sight and assistive tech.
   */
  covered?: boolean;
  typingLabel: string | null;
  onReply: (m: ChatMessage) => void;
  onOpenImage: (url: string) => void;
}

/** Distance from the bottom still counted as "reading the latest". */
const NEAR_BOTTOM_PX = 120;

export function MessageList({
  messages, all, loading, error, onRetry, hasOlder, onLoadOlder,
  isSearchResult, covered = false, typingLabel, onReply, onOpenImage,
}: Props) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const [atBottom, setAtBottom] = useState(true);
  const [unseen, setUnseen] = useState(0);
  const lastCount = useRef(messages.length);

  const scrollToBottom = useCallback((smooth = false) => {
    const el = bodyRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
    setUnseen(0);
  }, []);

  const onScroll = useCallback(() => {
    const el = bodyRef.current;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
    setAtBottom(near);
    if (near) setUnseen(0);
  }, []);

  /**
   * Only auto-scroll when the admin is already at the bottom. If they are
   * reading older messages, a new arrival must not yank the viewport — it
   * increments the pill instead.
   */
  useEffect(() => {
    const grew = messages.length > lastCount.current;
    lastCount.current = messages.length;
    if (!grew) return;
    if (atBottom) scrollToBottom();
    else setUnseen((n) => n + 1);
  }, [messages.length, atBottom, scrollToBottom]);

  // Jump to the newest message when a different conversation opens.
  useEffect(() => {
    if (!loading && messages.length) {
      requestAnimationFrame(() => scrollToBottom());
      setAtBottom(true);
      setUnseen(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  return (
    <div className="ch-thread-inner">
      {/* aria-hidden as well as visually covered: "not visible" has to mean not
          announced either, or a screen reader still reads a thread the sighted
          admin cannot see. */}
      <div
        className={`ch-body${covered ? ' covered' : ''}`}
        ref={bodyRef}
        onScroll={onScroll}
        aria-hidden={covered || undefined}
      >
        {loading && (
          <div style={{ display: 'grid', gap: 'var(--s3)', padding: 'var(--s3) 0' }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} h={38} w={i % 2 ? '58%' : '44%'} />
            ))}
          </div>
        )}

        {error && <ErrorState message={error} onRetry={onRetry} />}

        {!loading && !error && !isSearchResult && hasOlder && messages.length > 0 && (
          <Button size="sm" variant="ghost" style={{ alignSelf: 'center', marginBottom: 'var(--s3)' }}
                  onClick={onLoadOlder}>
            Load earlier messages
          </Button>
        )}

        {isSearchResult && messages.length === 0 && (
          <EmptyState icon={<Search size={18} />} title="No matching messages" />
        )}

        {!loading && !error && !isSearchResult && messages.length === 0 && (
          <EmptyState
            title="No messages yet"
            hint="Send the first message to start this conversation."
          />
        )}

        {messages.map((m, i) => {
          const prev = messages[i - 1];
          const showDay = !prev || chatDateLabel(prev.createdAt) !== chatDateLabel(m.createdAt);
          const parent = m.replyToMessageId
            ? all.find((x) => x.messageId === m.replyToMessageId) ?? null
            : null;
          return (
            <div key={m.messageId} style={{ display: 'contents' }}>
              {showDay && <div className="ch-day">{chatDateLabel(m.createdAt)}</div>}
              <MessageBubble message={m} parent={parent} onReply={onReply} onOpenImage={onOpenImage} />
            </div>
          );
        })}

        {typingLabel && (
          <div className="ch-typing" style={{ padding: '4px 0 0' }} aria-live="polite">
            <span className="ch-dots"><i /><i /><i /></span> {typingLabel}
          </div>
        )}
      </div>

      {covered && <div className="ch-cover" aria-hidden />}

      {unseen > 0 && !covered && (
        <button type="button" className="ch-new" onClick={() => scrollToBottom(true)}>
          <ArrowDown size={13} />
          {unseen} new message{unseen > 1 ? 's' : ''}
        </button>
      )}
    </div>
  );
}
