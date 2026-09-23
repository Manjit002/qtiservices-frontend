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

export interface ChatConversation {
  orderId: number;
  subject: string;
  status: string | null;
  deadline: string | null;
  studentId: number | null;
  studentName: string | null;
  lastMessage: string | null;
  lastMessageTime: number | null;
  unreadCount: number;
  hasConversation: boolean;
  /** Order creation time, used to sort threads that have no messages yet. */
  createdAt?: number | null;
}

export type ConnectionState =
  | 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'error' | 'closed';
