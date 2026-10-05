'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { STOMP } from '@/lib/api/endpoints';
import { chatSocket } from '@/lib/websocket/stompClient';
import type {
  ChatMessage, ChatSenderRole, ConnectionState, OutgoingChatMessage,
  PresenceUpdate, TypingUpdate,
} from '@/types';

export interface ChatSocketHandlers {
  onMessage?: (m: ChatMessage) => void;
  /** Delivery/seen receipts — same payload shape as a message. */
  onStatusUpdate?: (m: ChatMessage) => void;
  onTyping?: (t: TypingUpdate) => void;
  onPresence?: (p: PresenceUpdate) => void;
}

interface UseChatSocketOptions extends ChatSocketHandlers {
  /** Role publishing the messages — 'ADMIN' from the admin portal. */
  senderRole: ChatSenderRole;
  senderId: number | null;
  /** Display name sent with typing events. */
  senderName?: string;
  /** Set false to keep the socket closed (e.g. panel not open yet). */
  enabled?: boolean;
}

/**
 * React binding for the STOMP chat socket.
 *
 * Handlers are held in a ref and read at call time, so re-rendering the parent
 * (which happens on literally every keystroke in the composer) never tears down
 * or re-establishes a subscription. Only `enabled` drives connect/disconnect.
 */
export function useChatSocket({
  senderRole,
  senderId,
  senderName = 'Support Team',
  enabled = true,
  onMessage,
  onStatusUpdate,
  onTyping,
  onPresence,
}: UseChatSocketOptions) {
  const [state, setState] = useState<ConnectionState>('idle');
  const [error, setError] = useState<string | null>(null);

  const handlers = useRef<ChatSocketHandlers>({});
  handlers.current = { onMessage, onStatusUpdate, onTyping, onPresence };

  useEffect(() => {
    if (!enabled) return;

    chatSocket.acquire();
    chatSocket.setCallbacks({
      onStateChange: setState,
      onMessage: (b) => handlers.current.onMessage?.(b as ChatMessage),
      onDelivered: (b) => handlers.current.onStatusUpdate?.(b as ChatMessage),
      onSeen: (b) => handlers.current.onStatusUpdate?.(b as ChatMessage),
      onTyping: (b) => handlers.current.onTyping?.(b as TypingUpdate),
      onPresence: (b) => handlers.current.onPresence?.(b as PresenceUpdate),
    });

    chatSocket.connect().catch((e: Error) => setError(e.message));

    // release() is ref-counted — StrictMode's mount/unmount/mount cycle nets to
    // one consumer, so the socket is not torn down and rebuilt on every mount.
    return () => chatSocket.release();
  }, [enabled]);

  const setActiveOrder = useCallback((orderId: number | null) => {
    chatSocket.setActiveOrder(orderId);
  }, []);

  const sendMessage = useCallback(
    (
      orderId: number,
      fields: Partial<Pick<
        OutgoingChatMessage,
        'message' | 'messageType' | 'replyToMessageId' | 'fileKey' | 'fileName' | 'contentType' | 'fileSize'
      >>
    ): boolean => {
      const payload: OutgoingChatMessage = {
        orderId,
        senderId,
        senderRole,
        message: fields.message ?? '',
        messageType: fields.messageType ?? 'TEXT',
        replyToMessageId: fields.replyToMessageId ?? null,
        fileKey: fields.fileKey ?? null,
        fileName: fields.fileName ?? null,
        contentType: fields.contentType ?? null,
        fileSize: fields.fileSize ?? null,
      };
      return chatSocket.publish(STOMP.publish.send, payload);
    },
    [senderId, senderRole]
  );

  const sendTyping = useCallback(
    (orderId: number, typing: boolean) => {
      chatSocket.publish(STOMP.publish.typing, { orderId, senderId, senderName, typing });
    },
    [senderId, senderName]
  );

  const reconnect = useCallback(() => {
    void chatSocket.reconnect();
  }, []);

  return {
    connectionState: state,
    isConnected: state === 'connected',
    error,
    setActiveOrder,
    sendMessage,
    sendTyping,
    reconnect,
  };
}
