import type { OrderDTO } from './order';

export type ChatSenderRole = 'ADMIN' | 'STUDENT' | 'EXPERT' | (string & {});
/**
 * Values the backend accepts on /app/chat.send. Taken verbatim from the
 * source's chatMediaType(): images → IMAGE, videos → VIDEO, everything else
 * with an attachment → DOCUMENT. There is no 'FILE' member.
 */
export type ChatMessageType = 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT' | (string & {});

/** Message shape both received over STOMP and returned by the REST history APIs. */
export interface ChatMessage {
  messageId: number;
  orderId: number;
  senderId: number | null;
  senderRole: ChatSenderRole;
  senderName?: string | null;
  message?: string | null;
  messageType?: ChatMessageType;
  replyToMessageId?: number | null;
  fileKey?: string | null;
  fileName?: string | null;
  fileUrl?: string | null;
  contentType?: string | null;
  fileSize?: number | null;
  createdAt: number;
  seen?: boolean;
  delivered?: boolean;
  [key: string]: unknown;
}

/** Body published to /app/chat.send. */
export interface OutgoingChatMessage {
  orderId: number;
  senderId: number | null;
  senderRole: ChatSenderRole;
  message: string;
  messageType: ChatMessageType;
  replyToMessageId: number | null;
  fileKey: string | null;
  fileName: string | null;
  contentType: string | null;
  fileSize: number | null;
}

/** Body published to /app/chat.typing. */
export interface TypingEvent {
  orderId: number;
  senderId: number | null;
  senderName: string;
  typing: boolean;
}

/** Received on /topic/chat/{orderId}/typing. */
export interface TypingUpdate extends TypingEvent {}

/** Received on /topic/presence. */
export interface PresenceUpdate {
  userId: number | string;
  online: boolean;
  lastSeen?: number | null;
}

/** Response of POST /api/order-chat/upload. */
export interface ChatUploadResponse {
  fileKey: string;
  fileName: string;
  contentType: string;
  fileSize: number;
  url?: string;
}

/**
 * A sidebar row: an order, enriched by its conversation summary. Extends the
 * summary so the seven chat fields are declared once, with the API's names.
 */
export interface ChatConversation extends ChatConversationSummary {
  subject: string;
  status: string | null;
  deadline: string | null;
  /** Order creation time, used to sort threads that have no messages yet. */
  createdAt?: number | null;
  /**
   * The order the row was built from, kept whole for any order detail the UI
   * needs. Absent on a row a live message created for an order outside the
   * loaded list.
   */
  order?: OrderDTO;
}

/**
 * One row of GET /api/order-chat/conversations?role=ADMIN — the bulk summary
 * the chat sidebar is built from, in a single request. Contract documented in
 * CHAT-SIDEBAR-BULK.md; field names and meanings match ChatConversation so the
 * two merge without translation.
 */
export interface ChatConversationSummary {
  orderId: number;
  studentId: number | null;
  studentName: string | null;
  /** Text of the most recent message; null when the order has no messages. */
  lastMessage: string | null;
  /** Epoch milliseconds of the most recent message — same unit as ChatMessage.createdAt. */
  lastMessageTime: number | null;
  /** Messages from the other side that the requesting role has not marked seen. */
  unreadCount: number;
  /** True once at least one message exists on the order. */
  hasConversation: boolean;
}

export type ConnectionState =
  | 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'error' | 'closed';
