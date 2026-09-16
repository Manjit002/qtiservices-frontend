'use client';

import { Search, Pin } from 'lucide-react';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States';
import { StatusBadge } from '@/components/ui/Badge';
import { ccTimeAgo } from '@/lib/utils/chatFormat';
import { fmtOrderId } from '@/lib/utils/format';
import type { ChatConversation } from '@/types';

export type ConvFilter = 'all' | 'unread' | 'active' | 'closed';

interface Props {
  conversations: ChatConversation[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  activeOrderId: number | null;
  onSelect: (orderId: number) => void;
  search: string;
  onSearch: (v: string) => void;
  filter: ConvFilter;
  onFilter: (f: ConvFilter) => void;
  pinned: number[];
  onTogglePin: (orderId: number) => void;
}

const FILTERS: ConvFilter[] = ['all', 'unread', 'active', 'closed'];

export function ConversationSidebar({
  conversations, loading, error, onRetry, activeOrderId, onSelect,
  search, onSearch, filter, onFilter, pinned, onTogglePin,
}: Props) {
  return (
    <div className="ch-list">
      <div className="ch-list-head">
        <div className="ord-search">
          <Search size={14} />
          <input
            className="input"
            placeholder="Search student or order…"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            aria-label="Search conversations"
          />
        </div>
        <div className="seg" role="group" aria-label="Filter conversations">
          {FILTERS.map((f) => (
            <button key={f} type="button" className={filter === f ? 'on' : ''}
                    onClick={() => onFilter(f)} aria-pressed={filter === f}>
              {f[0]!.toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="ch-list-body">
        {loading && (
          <div style={{ padding: 'var(--s3)', display: 'grid', gap: 'var(--s3)' }}>
            {Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} h={48} />)}
          </div>
        )}
        {error && <ErrorState message={error} onRetry={onRetry} />}
        {!loading && !error && conversations.length === 0 && (
          <EmptyState
            title="No conversations"
            hint={search || filter !== 'all'
              ? 'Nothing matches this search or filter.'
              : 'Threads appear once a student sends the first message on an order.'}
          />
        )}

        {conversations.map((c) => {
          const label = c.studentName ?? c.subject ?? 'Student';
          const isPinned = pinned.includes(c.orderId);
          return (
            <div
              key={c.orderId}
              role="button"
              tabIndex={0}
              aria-current={activeOrderId === c.orderId ? 'true' : undefined}
              className={`ch-item${activeOrderId === c.orderId ? ' on' : ''}`}
              onClick={() => onSelect(c.orderId)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(c.orderId); }
              }}
            >
              <span className="avatar" aria-hidden>{label.charAt(0).toUpperCase()}</span>
              <span className="ch-item-body">
                <span className="ch-item-row">
                  <span className="ch-item-name truncate">{label}</span>
                  <span className="ch-item-time">{ccTimeAgo(c.lastMessageTime)}</span>
                </span>
                {/* `hasConversation` is the explicit signal that this order has
                    ever been written in; inferring it from lastMessage worked
                    but left the flag write-only and the intent implicit. */}
                <span className={`ch-item-prev truncate${c.hasConversation ? '' : ' ch-item-new'}`}
                      style={{ display: 'block' }}>
                  {c.hasConversation
                    ? c.lastMessage
                    : 'No messages yet · start the conversation'}
                </span>
                <span className="ch-item-meta">
                  <span className="ch-item-ord">{fmtOrderId(c.orderId)}</span>
                  {c.status && <StatusBadge status={c.status} />}
                  <span style={{ flex: 1 }} />
                  {c.unreadCount > 0 && <span className="ch-unread">{c.unreadCount}</span>}
                </span>
              </span>
              <button
                type="button"
                className={`ch-pin${isPinned ? ' on' : ''}`}
                aria-label={isPinned ? 'Unpin conversation' : 'Pin conversation'}
                aria-pressed={isPinned}
                onClick={(e) => { e.stopPropagation(); onTogglePin(c.orderId); }}
              >
                <Pin size={13} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
