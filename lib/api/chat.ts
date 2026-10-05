import { API } from './endpoints';
import { apiGet, apiPost, qs } from './client';
import type {
  ChatMessage, ChatUploadResponse, PageResponse, ChatSenderRole, ChatConversationSummary,
} from '@/types';

export const chatApi = {
  /** Full history for an order — used when opening a conversation. */
  historyAll: (orderId: number, role: ChatSenderRole, signal?: AbortSignal) =>
    apiGet<ChatMessage[]>(`${API.chat.historyAll}${qs({ orderId, role })}`, { signal }),

  /** Paged history — used for "Load earlier messages" in the open thread. */
  historyPage: (
    orderId: number,
    role: ChatSenderRole,
    page = 0,
    size = 20,
    signal?: AbortSignal
  ) =>
    apiGet<PageResponse<ChatMessage>>(
      `${API.chat.history}${qs({ orderId, role, page, size })}`,
      { signal }
    ),

  search: (
    orderId: number,
    keyword: string,
    role: ChatSenderRole,
    page = 0,
    size = 50,
    signal?: AbortSignal
  ) =>
    apiGet<PageResponse<ChatMessage>>(
      `${API.chat.search}${qs({ orderId, keyword, role, page, size })}`,
      { signal }
    ),

  /**
   * Bulk sidebar summary: last message, unread count and student for every
   * order, in ONE request — replacing one history call plus one unread-count
   * call per order.
   *
   * suppressAuthRedirect: the sidebar always requests the order list alongside
   * this, and that call still signs the admin out on an expired session. A
   * 401/403 from this endpoint alone (not deployed yet, or Spring forwarding an
   * unmapped path to a protected /error) must not end the session.
   */
  conversations: (role: ChatSenderRole, signal?: AbortSignal) =>
    apiGet<ChatConversationSummary[]>(`${API.chat.conversations}${qs({ role })}`, {
      signal,
      suppressAuthRedirect: true,
    }),

  /** 200 with no body. */
  markSeen: (messageId: number) => apiPost<void>(API.chat.seen(messageId)),

  /**
   * Single-order unread count. The sidebar no longer calls this — its counts
   * come from `conversations()` — but it stays available for other uses.
   * Background call — must not trigger a logout redirect on a transient 403.
   */
  unreadCount: (orderId: number, signal?: AbortSignal) =>
    apiGet<number>(`${API.chat.unreadCount}${qs({ orderId })}`, {
      signal,
      suppressAuthRedirect: true,
    }),

  uploadAttachment: (file: File) => {
    const fd = new FormData();
    fd.append('file', file, file.name);
    return apiPost<ChatUploadResponse>(API.chat.upload, fd);
  },
};
