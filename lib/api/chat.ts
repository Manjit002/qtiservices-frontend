import { API } from './endpoints';
import { apiGet, apiPost, qs } from './client';
import type {
  ChatMessage, ChatUploadResponse, PageResponse, ChatSenderRole,
} from '@/types';

export const chatApi = {
  /** Full history for an order — used when opening a conversation. */
  historyAll: (orderId: number, role: ChatSenderRole, signal?: AbortSignal) =>
    apiGet<ChatMessage[]>(`${API.chat.historyAll}${qs({ orderId, role })}`, { signal }),

  /** Paged history — used for "load older messages" and for last-message previews. */
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

  markSeen: (messageId: number) => apiPost<unknown>(API.chat.seen(messageId)),

  /** Background call — must not trigger a logout redirect on a transient 403. */
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
