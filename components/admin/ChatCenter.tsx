'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { EmptyState } from '@/components/ui/States';
import { FileLightbox } from '@/components/shared/FileLightbox';
import { ConversationSidebar, type ConvFilter } from './chat/ConversationSidebar';
import { ChatHeader } from './chat/ChatHeader';
import { MessageList } from './chat/MessageList';
import { MessageComposer } from './chat/MessageComposer';
import { ConnectionBanner } from './chat/ConnectionBanner';
import { ChatWaitingState } from './chat/ChatWaitingState';
import './chat.css';
import { useToast } from '@/hooks/useToast';
import { useChatSocket } from '@/hooks/useChatSocket';
import { useNotifications } from '@/hooks/useNotifications';
import { parseServerDate } from '@/lib/utils/format';
import { useDebounce } from '@/hooks/useDebounce';
import { chatApi } from '@/lib/api/chat';
import { ordersApi } from '@/lib/api/orders';
import { CHAT_ALLOWED_TYPES, chatMediaType } from '@/lib/utils/chatFormat';
import { getPinnedChats, togglePinnedChat } from '@/lib/utils/recentOrders';
import type {
  ChatConversation, ChatConversationSummary, ChatMessage, OrderDTO, PresenceUpdate, ServerDateTime, TypingUpdate,
} from '@/types';

interface Props {
  adminId: number | null;
  /** Opens the order this conversation belongs to. */
  onViewOrder: (orderId: number) => void;
  /** When set, that conversation opens immediately (e.g. from an order row). */
  initialOrderId?: number | null;
  onUnreadTotalChange?: (total: number) => void;
}

const PAGE_SIZE = 20;

/**
 * The sidebar lists the most recent N orders — the original's CC_PREVIEW_LIMIT.
 * The list costs two requests whatever N is: the orders, and one bulk summary
 * from /api/order-chat/conversations. (It used to cost one history call plus
 * one unread-count call PER order — about 120 requests for 60 orders, which the
 * browser queued for seconds.)
 */
const CC_PREVIEW_LIMIT = 60;

/** The summary's lastMessageTime is epoch ms; tolerate a server date as well. */
function epochMs(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  return parseServerDate(v as ServerDateTime)?.getTime() ?? null;
}

/**
 * A sidebar row for an order, before any chat data is known. The ORDER list
 * decides which rows exist: an order nobody has written in is still listed,
 * so the admin can send the first message.
 */
function orderRow(o: OrderDTO): ChatConversation {
  const orderStudentName = typeof o.studentName === 'string' && o.studentName ? o.studentName : null;
  return {
    orderId: o.id,
    subject: o.subject ?? '',
    status: (o.status as string) ?? null,
    deadline: null,
    studentId: o.studentId ?? null,
    studentName: orderStudentName,
    lastMessage: null,
    lastMessageTime: null,
    unreadCount: 0,
    hasConversation: false,
    // Fallback sort key: an order with no messages has no lastMessageTime,
    // and would otherwise sink below every old thread precisely when the
    // admin most needs to reach the student.
    createdAt: parseServerDate(o.createdAt)?.getTime() ?? null,
    order: o,
  };
}

/** A row for an order known only by its ID (open, but outside the loaded list). */
function blankRow(orderId: number): ChatConversation {
  return {
    orderId, subject: '', status: null, deadline: null, studentId: null, studentName: null,
    lastMessage: null, lastMessageTime: null, unreadCount: 0, hasConversation: false,
  };
}

/**
 * Enrich rows with the bulk summary, matched on orderId. Only the chat fields
 * come from the summary; the order data is left as it is. Summaries for orders
 * that are not rows (outside the 60-order window) are ignored. `summaries` is
 * null when the summary request failed: rows are returned untouched.
 *
 * The open conversation keeps an unread count of 0: the admin is reading it and
 * its messages are being marked seen, so a summary fetched around the same
 * moment must not put a badge back on it.
 */
function applySummaries(
  rows: ChatConversation[],
  summaries: ChatConversationSummary[] | null,
  openOrderId: number | null
): ChatConversation[] {
  if (!summaries) return rows;
  const byOrder = new Map(summaries.map((s) => [Number(s.orderId), s]));
  return rows.map((row) => {
    const s = byOrder.get(row.orderId);
    if (!s) return row;
    const hasConversation = Boolean(s.hasConversation);
    return {
      ...row,
      studentId: s.studentId ?? row.studentId,
      studentName: s.studentName ?? row.studentName,
      // An attachment-only last message has no text; say so, as the toast does.
      lastMessage: s.lastMessage || (hasConversation ? '📎 Attachment' : null),
      lastMessageTime: epochMs(s.lastMessageTime),
      unreadCount: row.orderId === openOrderId ? 0 : Number(s.unreadCount) || 0,
      hasConversation,
    };
  });
}

/**
 * Apply one live (WebSocket) message to the sidebar rows: preview, time, and
 * optionally +1 unread. A row is added for an order not yet in the list.
 * Pure, so the same logic serves live updates and the replay after a load.
 */
function withLiveMessage(rows: ChatConversation[], m: ChatMessage, incrementUnread: boolean): ChatConversation[] {
  const idx = rows.findIndex((c) => c.orderId === m.orderId);
  const next = [...rows];
  const preview = m.message || (m.fileName ? `📎 ${m.fileName}` : '');
  if (idx === -1) {
    next.unshift({
      orderId: m.orderId,
      subject: '',
      status: null,
      deadline: null,
      studentId: m.senderRole === 'STUDENT' ? m.senderId : null,
      studentName: m.senderRole === 'STUDENT' ? (m.senderName ?? null) : null,
      lastMessage: preview,
      lastMessageTime: m.createdAt,
      unreadCount: incrementUnread ? 1 : 0,
      hasConversation: true,
    });
  } else {
    const c = next[idx];
    if (!c) return rows;
    next[idx] = {
      ...c,
      lastMessage: preview,
      lastMessageTime: m.createdAt,
      hasConversation: true,
      studentName: m.senderRole === 'STUDENT' ? (m.senderName ?? c.studentName) : c.studentName,
      studentId: m.senderRole === 'STUDENT' ? (m.senderId ?? c.studentId) : c.studentId,
      unreadCount: incrementUnread ? c.unreadCount + 1 : c.unreadCount,
    };
  }
  return next.sort((a, b) => (b.lastMessageTime ?? 0) - (a.lastMessageTime ?? 0));
}

/** A live message seen while a sidebar load was in flight. */
interface LiveEntry { m: ChatMessage; incrementUnread: boolean }

/**
 * Re-apply live messages that arrived while a load was in flight and that the
 * loaded data cannot contain: newer than the row's lastMessageTime as loaded,
 * or for a row the load did not have. Without this, a message received during
 * the load is overwritten by the (older) snapshot and its unread count is lost.
 */
function replayLive(rows: ChatConversation[], log: LiveEntry[], openOrderId: number | null): ChatConversation[] {
  let out = rows;
  for (const { m, incrementUnread } of log) {
    const row = out.find((c) => c.orderId === m.orderId);
    if (row?.lastMessageTime != null && m.createdAt <= row.lastMessageTime) continue;
    out = withLiveMessage(out, m, incrementUnread && m.orderId !== openOrderId);
  }
  return out;
}

/**
 * Full history, plus any live messages for this thread that arrived while it
 * was loading and are not in it (the history was read before they were saved).
 */
function mergeHistory(history: ChatMessage[], live: ChatMessage[]): ChatMessage[] {
  const known = new Set(history.map((m) => m.messageId));
  const extra = live.filter((m) => !known.has(m.messageId));
  return extra.length ? [...history, ...extra] : history;
}

/**
 * GET /api/order-chat/conversations, never throwing except on abort: a failure
 * comes back as `{ rows: null, error }` so the sidebar can keep its orders and
 * say previews are unavailable. There is deliberately NO per-order fallback.
 */
async function fetchSummaries(
  signal: AbortSignal
): Promise<{ rows: ChatConversationSummary[] | null; error: string | null }> {
  try {
    const r = await chatApi.conversations('ADMIN', signal);
    if (!Array.isArray(r)) return { rows: null, error: 'the conversations endpoint returned an unexpected response' };
    return { rows: r, error: null };
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    return { rows: null, error: (e as Error).message };
  }
}

export function ChatCenter({ adminId, onViewOrder, initialOrderId, onUnreadTotalChange }: Props) {
  const { showToast } = useToast();
  const { playSound, requestPermission, showBrowserNotification } = useNotifications();

  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [convLoading, setConvLoading] = useState(true);
  const [convError, setConvError] = useState<string | null>(null);
  /** Set when the orders loaded but the bulk summary did not. */
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [summaryRetrying, setSummaryRetrying] = useState(false);
  const [pinned, setPinned] = useState<number[]>([]);
  const [convFilter, setConvFilter] = useState<ConvFilter>('all');
  const [convSearch, setConvSearch] = useState('');

  const [activeOrderId, setActiveOrderId] = useState<number | null>(initialOrderId ?? null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [msgError, setMsgError] = useState<string | null>(null);
  const [olderPage, setOlderPage] = useState(0);
  const [hasOlder, setHasOlder] = useState(true);

  const [draft, setDraft] = useState('');
  const [queue, setQueue] = useState<File[]>([]);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [sending, setSending] = useState(false);
  const [typingLabel, setTypingLabel] = useState<string | null>(null);
  const [presence, setPresence] = useState<{ online: boolean; lastSeen: number | null }>({
    online: false, lastSeen: null,
  });
  const [searchOpen, setSearchOpen] = useState(false);
  const [msgSearch, setMsgSearch] = useState('');
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  /** Mobile: false = conversation list, true = thread. Desktop shows both. */
  const [mobileThreadOpen, setMobileThreadOpen] = useState(false);

  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingSentAt = useRef(0);
  /** Read inside socket callbacks so they never need to be re-registered. */
  const activeOrderRef = useRef<number | null>(activeOrderId);
  activeOrderRef.current = activeOrderId;
  const conversationsRef = useRef<ChatConversation[]>(conversations);
  conversationsRef.current = conversations;
  /**
   * Unsent work is kept per conversation. Switching threads used to carry the
   * draft, the queued files and the reply target over to the next student,
   * where one Enter would send them to the wrong order.
   */
  const composerRef = useRef({ draft, queue, replyTo });
  composerRef.current = { draft, queue, replyTo };
  const savedComposers = useRef(new Map<number, { draft: string; queue: File[]; replyTo: ChatMessage | null }>());
  const adminIdRef = useRef(adminId);
  adminIdRef.current = adminId;

  const activeConv = useMemo(
    () => conversations.find((c) => c.orderId === activeOrderId) ?? null,
    [conversations, activeOrderId]
  );
  const activeConvRef = useRef<ChatConversation | null>(activeConv);
  activeConvRef.current = activeConv;

  useEffect(() => {
    setPinned(getPinnedChats());
    requestPermission();
  }, [requestPermission]);

  // ── Conversation list ──────────────────────────────────────────────────────
  /**
   * Stale-response guard shared by the full load and the summary retry: each
   * aborts the previous request and only the newest may write state, so a slow
   * earlier response can never overwrite a newer one.
   */
  const loadSeq = useRef(0);
  const loadAbort = useRef<AbortController | null>(null);
  /** Live messages received while a load is in flight; null when none is. */
  const liveDuringLoad = useRef<LiveEntry[] | null>(null);
  const beginLoad = useCallback(() => {
    loadAbort.current?.abort();
    const ctrl = new AbortController();
    loadAbort.current = ctrl;
    // Kept across a superseded load: those messages are still unaccounted for.
    if (liveDuringLoad.current === null) liveDuringLoad.current = [];
    return { signal: ctrl.signal, seq: ++loadSeq.current };
  }, []);
  /** Take the log once the newest load has finished (committed or failed). */
  const takeLiveLog = useCallback((): LiveEntry[] => {
    const log = liveDuringLoad.current ?? [];
    liveDuringLoad.current = null;
    return log;
  }, []);

  /**
   * Sidebar = orders + ONE bulk summary, requested in parallel and merged on
   * orderId. Two requests whatever the number of orders. (It used to be one
   * history call plus one unread-count call PER order — about 120 requests for
   * 60 orders, which the browser queued for seconds.)
   */
  const loadConversations = useCallback(async () => {
    const { signal, seq } = beginLoad();
    setConvLoading(true);
    setConvError(null);
    setSummaryRetrying(false);
    try {
      const [page, summaries] = await Promise.all([
        ordersApi.listAll(0, CC_PREVIEW_LIMIT, 'createdAt,desc', signal),
        fetchSummaries(signal),
      ]);
      if (seq !== loadSeq.current) return;

      /**
       * ROOT CAUSE FIX (kept).
       *
       * This once filtered on `hasConversation`, which dropped every order the
       * student had never written in, so the admin could not start a
       * conversation until the student spoke first. The ORDER is the source of
       * truth for whether a conversation is available; nothing is filtered.
       */
      const openId = activeOrderRef.current;
      let fresh = applySummaries((page.content ?? []).map(orderRow), summaries.rows, openId);
      // Keep whatever the admin currently has open, even if it fell outside this
      // window (e.g. a deep link to an older order). Its summary, when there is
      // one, supplies the student and preview the header needs.
      if (openId != null && !fresh.some((c) => c.orderId === openId)) {
        const kept =
          conversationsRef.current.find((c) => c.orderId === openId) ??
          applySummaries([blankRow(openId)], summaries.rows, openId)[0];
        if (kept) fresh = [...fresh, kept];
      }
      setConversations(replayLive(fresh, takeLiveLog(), openId));
      setSummaryError(summaries.error);
    } catch (e) {
      if ((e as Error).name === 'AbortError' || seq !== loadSeq.current) return;
      takeLiveLog();
      setConvError((e as Error).message);
    } finally {
      if (seq === loadSeq.current) setConvLoading(false);
    }
  }, [beginLoad, takeLiveLog]);

  /**
   * Retry after the summary failed: the BULK endpoint only. The orders are
   * already listed and stay on screen; the result is applied to the current
   * rows, so anything a live message updated meanwhile is kept.
   */
  const retrySummaries = useCallback(async () => {
    const { signal, seq } = beginLoad();
    setSummaryRetrying(true);
    try {
      const summaries = await fetchSummaries(signal);
      if (seq !== loadSeq.current) return;
      const log = takeLiveLog();
      if (summaries.rows) {
        const rows = summaries.rows;
        const openId = activeOrderRef.current;
        setConversations((prev) => replayLive(applySummaries(prev, rows, openId), log, openId));
      }
      setSummaryError(summaries.error);
    } catch {
      /* aborted by a newer load */
    } finally {
      if (seq === loadSeq.current) setSummaryRetrying(false);
    }
  }, [beginLoad, takeLiveLog]);

  useEffect(() => {
    void loadConversations();
    return () => loadAbort.current?.abort();
  }, [loadConversations]);

  useEffect(() => {
    // Not while the list is loading: the empty list would flash the badge to 0.
    if (convLoading) return;
    onUnreadTotalChange?.(conversations.reduce((sum, c) => sum + c.unreadCount, 0));
  }, [conversations, convLoading, onUnreadTotalChange]);

  const upsertPreview = useCallback((m: ChatMessage, incrementUnread: boolean) => {
    liveDuringLoad.current?.push({ m, incrementUnread });
    setConversations((prev) => withLiveMessage(prev, m, incrementUnread));
  }, []);

  // ── Socket ─────────────────────────────────────────────────────────────────
  const handleIncoming = useCallback(
    (m: ChatMessage) => {
      if (m.orderId !== activeOrderRef.current) {
        // A message on another order updates that row's preview and time.
        // Only the student's raise the unread count and alert the admin, and
        // only they may add a row for an order not in the list.
        const fromStudent = m.senderRole !== 'ADMIN';
        if (fromStudent || conversationsRef.current.some((c) => c.orderId === m.orderId)) {
          upsertPreview(m, fromStudent);
        }
        if (fromStudent) {
          playSound();
          const text = `${m.senderName ?? 'Student'}: ${m.message || '📎 Attachment'}`;
          showBrowserNotification(text);
          // A hidden tab gets the OS notification; a visible tab on another
          // conversation gets a toast, so the message is never silently missed.
          if (!document.hidden) showToast(`💬 ${text.slice(0, 60)}`, 'info', 5000);
        }
        return;
      }
      setMessages((prev) => (prev.some((x) => x.messageId === m.messageId) ? prev : [...prev, m]));
      upsertPreview(m, false);
      if (m.senderRole !== 'ADMIN') {
        playSound();
        void chatApi.markSeen(m.messageId).catch(() => undefined);
      }
    },
    [upsertPreview, playSound, showBrowserNotification, showToast]
  );

  const handleStatusUpdate = useCallback((m: ChatMessage) => {
    if (m.orderId !== activeOrderRef.current) return;
    setMessages((prev) => prev.map((x) => (x.messageId === m.messageId ? m : x)));
  }, []);

  const handleTyping = useCallback((t: TypingUpdate) => {
    if (t.orderId !== activeOrderRef.current) return;
    // Ignore our own echo — only the counterpart's typing should show. The
    // admin-ID check also covers a thread whose student is not known yet.
    if (adminIdRef.current != null && String(t.senderId) === String(adminIdRef.current)) return;
    const studentId = activeConvRef.current?.studentId;
    if (studentId && String(t.senderId) !== String(studentId)) return;
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    if (t.typing) {
      setTypingLabel(`${t.senderName || 'Student'} is typing…`);
      typingTimeout.current = setTimeout(() => setTypingLabel(null), 3000);
    } else {
      setTypingLabel(null);
    }
  }, []);

  const handlePresence = useCallback((p: PresenceUpdate) => {
    const studentId = activeConvRef.current?.studentId;
    if (!studentId || String(p.userId) !== String(studentId)) return;
    setPresence({ online: p.online, lastSeen: p.lastSeen ?? null });
  }, []);

  const { connectionState, isConnected, reconnect, sendMessage, sendTyping, setActiveOrder } = useChatSocket({
    senderRole: 'ADMIN',
    senderId: adminId,
    senderName: 'Support Team',
    onMessage: handleIncoming,
    onStatusUpdate: handleStatusUpdate,
    onTyping: handleTyping,
    onPresence: handlePresence,
  });

  // ── Open a conversation ────────────────────────────────────────────────────
  /** Each open gets a number; only the newest may write the thread. */
  const historySeq = useRef(0);

  const openConversation = useCallback(
    async (orderId: number) => {
      const seq = ++historySeq.current;
      const previousId = activeOrderRef.current;

      // Park the unsent draft, files and reply of the thread being left, and
      // bring back whatever was parked for the one being opened.
      if (previousId !== orderId) {
        if (previousId != null) {
          const c = composerRef.current;
          if (c.draft || c.queue.length || c.replyTo) savedComposers.current.set(previousId, c);
          else savedComposers.current.delete(previousId);
        }
        const saved = savedComposers.current.get(orderId);
        savedComposers.current.delete(orderId);
        setDraft(saved?.draft ?? '');
        setQueue(saved?.queue ?? []);
        setReplyTo(saved?.replyTo ?? null);
        // Presence belongs to the previous student until an event says otherwise.
        setPresence({ online: false, lastSeen: null });
      } else {
        setReplyTo(null);
      }

      setActiveOrderId(orderId);
      /* Set the ref synchronously as well. It is otherwise only assigned during
         render, so a fetch that resolves before React re-renders would compare
         against the PREVIOUS order and let stale messages through — the exact
         race this guard exists to close. */
      activeOrderRef.current = orderId;
      setMobileThreadOpen(true);
      setMessages([]);
      setTypingLabel(null);
      setOlderPage(0);
      setHasOlder(true);
      setMsgLoading(true);
      setMsgError(null);
      setActiveOrder(orderId);

      /**
       * Discard a response that is no longer the newest open. Clicking A then B
       * fires two history requests; if A is slower it resolves last, and
       * without this its messages would be written into B's thread. Comparing
       * the request number (not just the order ID) also covers A → B → A and a
       * double click, where an older response for the same order lands last.
       */
      const stale = () => seq !== historySeq.current || activeOrderRef.current !== orderId;

      try {
        const history = await chatApi.historyAll(orderId, 'ADMIN');
        if (stale()) return;

        const list = Array.isArray(history) ? history : [];
        // Merge, not replace: a socket message that arrived while the history
        // was loading is already in the thread and may not be in `list`.
        setMessages((live) => mergeHistory(list, live));
        setConversations((prev) =>
          prev.map((c) => (c.orderId === orderId ? { ...c, unreadCount: 0 } : c))
        );
        // The thread is readable now; marking seen happens in the background.
        setMsgLoading(false);
        list
          .filter((m) => m.senderRole !== 'ADMIN' && !m.seen)
          .forEach((m) => { void chatApi.markSeen(m.messageId).catch(() => undefined); });
      } catch (e) {
        if (stale()) return;
        setMsgError((e as Error).message);
        setMsgLoading(false);
      }
    },
    [setActiveOrder]
  );

  useEffect(() => {
    if (initialOrderId != null) void openConversation(initialOrderId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialOrderId]);

  const loadOlder = useCallback(async () => {
    if (activeOrderId == null || !hasOlder) return;
    const orderId = activeOrderId;
    const nextPage = olderPage + 1;
    try {
      const page = await chatApi.historyPage(orderId, 'ADMIN', nextPage, PAGE_SIZE);
      // The admin may have switched threads meanwhile: never put one order's
      // messages into another order's thread.
      if (activeOrderRef.current !== orderId) return;
      const older = page.content ?? [];
      if (older.length === 0) {
        setHasOlder(false);
        return;
      }
      setMessages((prev) => {
        const known = new Set(prev.map((m) => m.messageId));
        return [...older.filter((m) => !known.has(m.messageId)).reverse(), ...prev];
      });
      setOlderPage(nextPage);
    } catch (e) {
      if (activeOrderRef.current === orderId) showToast((e as Error).message, 'error');
    }
  }, [activeOrderId, olderPage, hasOlder, showToast]);

  // ── Composer ───────────────────────────────────────────────────────────────
  const addFiles = useCallback(
    (list: FileList | null) => {
      if (!list) return;
      const accepted: File[] = [];
      Array.from(list).forEach((f) => {
        if (CHAT_ALLOWED_TYPES.has(f.type)) accepted.push(f);
        else showToast(`${f.name}: unsupported file type.`, 'warning');
      });
      if (accepted.length) setQueue((q) => [...q, ...accepted]);
    },
    [showToast]
  );

  const send = useCallback(async () => {
    const text = draft.trim();
    if (!text && queue.length === 0) return;
    if (activeOrderId == null) return;
    if (!isConnected) {
      showToast('Not connected — your message has been kept. Try again in a moment.', 'error');
      return;
    }
    // The order this send belongs to. If the admin switches threads while files
    // upload, the outcome is written back to THIS order's parked composer, not
    // to whichever thread is open when the uploads finish.
    const target = activeOrderId;
    const settle = (next: { draft: string; queue: File[]; replyTo: ChatMessage | null }) => {
      if (activeOrderRef.current === target) {
        setDraft(next.draft);
        setQueue(next.queue);
        setReplyTo(next.replyTo);
      } else if (next.draft || next.queue.length || next.replyTo) {
        savedComposers.current.set(target, next);
      } else {
        savedComposers.current.delete(target);
      }
    };

    setSending(true);
    try {
      if (queue.length > 0) {
        // Each attachment is uploaded, then published. Files that fail STAY in
        // the queue so the admin can retry them — clearing the lot would
        // silently discard work.
        const failed: File[] = [];
        let captionSent = false;

        for (let i = 0; i < queue.length; i += 1) {
          const file = queue[i];
          if (!file) continue;
          const isLast = i === queue.length - 1;
          try {
            const uploaded = await chatApi.uploadAttachment(file);
            const published = sendMessage(target, {
              message: isLast ? text : '',
              messageType: chatMediaType(uploaded.contentType),
              replyToMessageId: replyTo?.messageId ?? null,
              fileKey: uploaded.fileKey,
              fileName: uploaded.fileName,
              contentType: uploaded.contentType,
              fileSize: uploaded.fileSize,
            });
            if (published) { if (isLast) captionSent = true; }
            else failed.push(file);
          } catch (e) {
            failed.push(file);
            showToast(`${file.name}: ${(e as Error).message}`, 'error');
          }
        }

        // The caption rides on the last attachment. Once that went out the
        // draft is cleared even if earlier files failed — keeping it would
        // send the same caption again with the retry.
        settle({
          draft: captionSent ? '' : draft,
          queue: failed,
          replyTo: failed.length === 0 ? null : replyTo,
        });
        if (failed.length > 0) {
          showToast(`${failed.length} attachment(s) could not be sent — still queued.`, 'warning');
        }
      } else {
        // publish() returns false when the socket dropped between the check
        // above and the send. Keeping the draft is the difference between a
        // retry and a lost message.
        const published = sendMessage(target, {
          message: text,
          messageType: 'TEXT',
          replyToMessageId: replyTo?.messageId ?? null,
        });
        if (published) {
          settle({ draft: '', queue: [], replyTo: null });
        } else {
          showToast('Message could not be sent — it has been kept in the box.', 'error');
        }
      }
      sendTyping(target, false);
    } finally {
      setSending(false);
    }
  }, [draft, queue, activeOrderId, isConnected, replyTo, sendMessage, sendTyping, showToast]);

  const onDraftChange = useCallback(
    (value: string) => {
      setDraft(value);
      if (activeOrderId == null) return;
      // Throttle typing events to one per second rather than one per keystroke.
      const now = Date.now();
      if (now - typingSentAt.current > 1000) {
        typingSentAt.current = now;
        sendTyping(activeOrderId, true);
      }
    },
    [activeOrderId, sendTyping]
  );

  const debouncedMsgSearch = useDebounce(msgSearch, 400);
  const [searchResults, setSearchResults] = useState<ChatMessage[] | null>(null);
  // Results belong to one thread: drop them as soon as another one opens,
  // rather than showing them under the new student's header until the new
  // search returns.
  useEffect(() => { setSearchResults(null); }, [activeOrderId]);

  useEffect(() => {
    if (!searchOpen || !debouncedMsgSearch.trim() || activeOrderId == null) {
      setSearchResults(null);
      return;
    }
    let active = true;
    chatApi
      .search(activeOrderId, debouncedMsgSearch.trim(), 'ADMIN', 0, 50)
      .then((r) => { if (active) setSearchResults(r.content ?? []); })
      .catch(() => { if (active) setSearchResults([]); });
    return () => { active = false; };
  }, [debouncedMsgSearch, searchOpen, activeOrderId]);

  // ── Derived lists ──────────────────────────────────────────────────────────
  const visibleConversations = useMemo(() => {
    const CLOSED = ['COMPLETED', 'CANCELLED'];
    let list = conversations;
    if (convFilter === 'unread') list = list.filter((c) => c.unreadCount > 0);
    if (convFilter === 'active') list = list.filter((c) => !CLOSED.includes(String(c.status ?? '')));
    if (convFilter === 'closed') list = list.filter((c) => CLOSED.includes(String(c.status ?? '')));
    const kw = convSearch.trim().toLowerCase();
    if (kw) {
      list = list.filter(
        (c) =>
          String(c.orderId).includes(kw.replace(/^od-/, '')) ||
          (c.subject ?? '').toLowerCase().includes(kw) ||
          (c.studentName ?? '').toLowerCase().includes(kw)
      );
    }
    return [...list].sort((a, b) => {
      const ap = pinned.includes(a.orderId) ? 1 : 0;
      const bp = pinned.includes(b.orderId) ? 1 : 0;
      if (ap !== bp) return bp - ap;
      const au = a.unreadCount > 0 ? 1 : 0;
      const bu = b.unreadCount > 0 ? 1 : 0;
      if (au !== bu) return bu - au;
      // Newest activity first, where "activity" falls back to the order's own
      // creation time for threads that have never been written in.
      const at = a.lastMessageTime ?? a.createdAt ?? 0;
      const bt = b.lastMessageTime ?? b.createdAt ?? 0;
      return bt - at;
    });
  }, [conversations, convFilter, convSearch, pinned]);

  const rendered = searchResults ?? messages;

  /**
   * PENDING = the socket is not usable yet but has not given up
   * (idle / connecting / reconnecting). `error` and `closed` are failures, not
   * waits, and get the retry banner instead.
   *
   * The full card only replaces the thread when there is genuinely nothing to
   * read: no messages AND no history error. A history error must stay visible —
   * covering it with a spinner would hide the one thing the admin needs.
   */
  const pending = ['idle', 'connecting', 'reconnecting'].includes(connectionState);
  const showWaitCard = pending && messages.length === 0 && !msgError && !msgLoading;
  /** PENDING + history: slim bar, and the thread beneath it is covered. */
  const coverThread = pending && messages.length > 0 && !msgError;

  return (
    <div className={`ch${mobileThreadOpen ? ' open' : ''}`}>
      {/* No visible title in this two-pane layout — the shell's topbar shows
          "Chat" — but the page still needs exactly one h1. */}
      <h1 className="visually-hidden">Chat</h1>
      <ConversationSidebar
        conversations={visibleConversations}
        loading={convLoading}
        error={convError}
        onRetry={() => void loadConversations()}
        previewError={summaryError}
        onRetryPreviews={() => void retrySummaries()}
        previewRetrying={summaryRetrying}
        activeOrderId={activeOrderId}
        onSelect={(id) => void openConversation(id)}
        search={convSearch}
        onSearch={setConvSearch}
        filter={convFilter}
        onFilter={setConvFilter}
        pinned={pinned}
        onTogglePin={(id) => setPinned(togglePinnedChat(id))}
      />

      <div className="ch-thread">
        {activeOrderId == null ? (
          <EmptyState
            icon={<MessageSquare size={18} />}
            title="Select a conversation"
            hint="Pick a student from the list to read the thread and reply."
          />
        ) : (
          <>
            <ChatHeader
              conversation={activeConv}
              orderId={activeOrderId}
              connectionState={connectionState}
              presence={presence}
              searchOpen={searchOpen}
              onToggleSearch={() => { setSearchOpen((v) => !v); setMsgSearch(''); }}
              onBack={() => setMobileThreadOpen(false)}
              onViewOrder={onViewOrder}
            />

            {/* Which waiting presentation applies:
                  PENDING + no history → full card, replacing the thread
                  PENDING + history    → slim bar, messages stay visible
                  HISTORY ERROR        → neither; the error is preserved
                An outright connection failure (error/closed) is not PENDING:
                it shows the failed banner with Retry, not an indefinite wait. */}
            {/* No waiting affordance at all when history failed: the error is
                the thing to read, and a "connecting…" strip above it implies
                the failure is transient when it may not be. */}
            {!msgError && !showWaitCard && (
              <ConnectionBanner state={connectionState} onRetry={reconnect} />
            )}

            {searchOpen && (
              <div className="ch-search">
                <input className="input" placeholder="Search in this conversation…"
                       value={msgSearch} onChange={(e) => setMsgSearch(e.target.value)}
                       aria-label="Search messages" autoFocus />
              </div>
            )}

            {showWaitCard ? (
              <ChatWaitingState />
            ) : (
            <MessageList
              messages={rendered}
              all={messages}
              loading={msgLoading}
              error={msgError}
              onRetry={() => void openConversation(activeOrderId)}
              hasOlder={hasOlder && messages.length >= PAGE_SIZE}
              onLoadOlder={() => void loadOlder()}
              isSearchResult={searchResults !== null}
              covered={coverThread}
              typingLabel={typingLabel}
              onReply={setReplyTo}
              onOpenImage={setLightboxUrl}
            />
            )}

            <MessageComposer
              draft={draft}
              onDraftChange={onDraftChange}
              queue={queue}
              onAddFiles={addFiles}
              onRemoveFile={(i) => setQueue((q) => q.filter((_, idx) => idx !== i))}
              replyTo={replyTo}
              onCancelReply={() => setReplyTo(null)}
              onSend={() => void send()}
              sending={sending}
              connected={isConnected}
            />
          </>
        )}
      </div>

      <FileLightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />
    </div>
  );
}
