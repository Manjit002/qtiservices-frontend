'use client';

import { ChevronLeft, Search, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/Badge';
import { chatTime } from '@/lib/utils/chatFormat';
import { fmtOrderId } from '@/lib/utils/format';
import type { ChatConversation, ConnectionState } from '@/types';

interface Props {
  conversation: ChatConversation | null;
  orderId: number;
  connectionState: ConnectionState;
  presence: { online: boolean; lastSeen: number | null };
  searchOpen: boolean;
  onToggleSearch: () => void;
  onBack: () => void;
  onViewOrder: (orderId: number) => void;
}

export function ChatHeader({
  conversation, orderId, connectionState, presence,
  searchOpen, onToggleSearch, onBack, onViewOrder,
}: Props) {
  const name = conversation?.studentName ?? conversation?.subject ?? 'Student';

  return (
    <div className="ch-head">
      <Button variant="ghost" size="sm" iconOnly className="ch-back" onClick={onBack}
              aria-label="Back to conversations">
        <ChevronLeft size={16} />
      </Button>

      <span className="avatar" aria-hidden>{name.charAt(0).toUpperCase()}</span>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="ch-head-name truncate">{name}</div>
        <div className="ch-ctx">
          <span className={`ch-head-sub${presence.online ? ' online' : ''}`}>
            <span className={`conn ${connectionState}`} title={`Connection: ${connectionState}`} />
            {presence.online ? 'Online'
              : presence.lastSeen ? `Last seen ${chatTime(presence.lastSeen)}`
              : 'Offline'}
          </span>
          <span className="text-faint">·</span>
          {/* Order context stays in the header — this is order-management chat,
              and the thread is meaningless without knowing which order it is. */}
          <button type="button" className="ch-item-ord" onClick={() => onViewOrder(orderId)}
                  title="Open this order">
            {fmtOrderId(orderId)}
          </button>
        </div>
      </div>

      {conversation?.status && <StatusBadge status={conversation.status} />}

      <Button variant="ghost" size="sm" onClick={() => onViewOrder(orderId)}
              aria-label="View order details">
        <ExternalLink size={14} /> <span className="ch-hide-sm">View order</span>
      </Button>

      <Button variant="ghost" size="sm" iconOnly aria-pressed={searchOpen}
              onClick={onToggleSearch} aria-label="Search messages">
        <Search size={15} />
      </Button>
    </div>
  );
}
