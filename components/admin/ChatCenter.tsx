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
import type { ChatConversation, ChatMessage, PresenceUpdate, TypingUpdate } from '@/types';

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
 * Building the list costs two requests per order (last message + unread count),
 * so it is bounded to the most recent N orders — the original's CC_PREVIEW_LIMIT.
 * Raising this multiplies backend load; 60 orders is already 120 requests.
 */
const CC_PREVIEW_LIMIT = 60;

export function ChatCenter({ adminId, onViewOrder, initialOrderId, onUnreadTotalChange }: Props) {
  const { showToast } = useToast();
  const { playSound, requestPermission, showBrowserNotification } = useNotifications();

  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [convLoading, setConvLoading] = useState(true);
  const [convError, setConvError] = useState<string | null>(null);
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
  const loadConversations = useCallback(async () => {
    setConvLoading(true);
    setConvError(null);
    try {
      const page = await ordersApi.listAll(0, CC_PREVIEW_LIMIT, 'createdAt,desc');
      const rows = page.content;

      // The last message and unread count come from the paged history endpoint
      // (size=1), one call per order, run concurrently. Failures degrade to an
      // empty preview rather than failing the whole list.
      const enriched = await Promise.all(
        rows.map(async (o): Promise<ChatConversation> => {
          const base: ChatConversation = {
            orderId: o.id,
            subject: o.subject ?? '',
            status: (o.status as string) ?? null,
            deadline: null,
            studentId: o.studentId ?? null,
            studentName: null,
            lastMessage: null,
            lastMessageTime: null,
            unreadCount: 0,
            hasConversation: false,
            // Fallback sort key: an order with no messages has no
            // lastMessageTime, and would otherwise sink below every old thread
            // precisely when the admin most needs to reach the student.
            createdAt: parseServerDate(o.createdAt)?.getTime() ?? null,
          };
          try {
            const [last, unread] = await Promise.all([
              chatApi.historyPage(o.id, 'ADMIN', 0, 1),
              chatApi.unreadCount(o.id).catch(() => 0),
            ]);
            const m = last.content?.[0];
            if (m) {
              base.lastMessage = m.message || (m.fileName ? `📎 ${m.fileName}` : '');
              base.lastMessageTime = m.createdAt;
              base.hasConversation = true;
              if (m.senderRole === 'STUDENT') {
                base.studentName = m.senderName ?? null;
                base.studentId = m.senderId ?? base.studentId;
              }
            }
            base.unreadCount = Number(unread) || 0;
          } catch {
            /* no conversation yet for this order */
          }
          return base;
        })
      );

      /**
       * ROOT CAUSE FIX.
       *
       * This previously read `.filter((c) => c.hasConversation)`, and
       * `hasConversation` is only true once a message exists. Every order the
       * student had never written in was therefore dropped from the list, so
       * the admin could not open — let alone start — a conversation until the
       * student spoke first.
       *
       * The ORDER is the source of truth for whether a conversation should be
       * available. Messages are optional content within it, not the thing that
       * brings it into existence. Nothing is filtered here now; threads with
       * no messages render an explicit empty state instead of disappearing.
       */
      const fresh = enriched;
      // Keep whatever the admin currently has open, even if it fell outside this
      // window (e.g. a thread created after the page size cut-off).
      const openId = activeOrderRef.current;
      if (openId != null && !fresh.some((c) => c.orderId === openId)) {
        const kept =
          conversationsRef.current.find((c) => c.orderId === openId) ??
          enriched.find((c) => c.orderId === openId);
        if (kept) fresh.push(kept);
      }
      setConversations(fresh);
    } catch (e) {
      setConvError((e as Error).message);
    } finally {
      setConvLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    onUnreadTotalChange?.(conversations.reduce((sum, c) => sum + c.unreadCount, 0));
  }, [conversations, onUnreadTotalChange]);

  const upsertPreview = useCallback((m: ChatMessage, incrementUnread: boolean) => {
    setConversations((prev) => {
      const idx = prev.findIndex((c) => c.orderId === m.orderId);
      const next = [...prev];
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
        if (!c) return prev;
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
    });
  }, []);

  // ── Socket ─────────────────────────────────────────────────────────────────
  const handleIncoming = useCallback(
    (m: ChatMessage) => {
      if (m.orderId !== activeOrderRef.current) {
        if (m.senderRole !== 'ADMIN') {
          upsertPreview(m, true);
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
    // Ignore our own echo — only the counterpart's typing should show.
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
  const openConversation = useCallback(
    async (orderId: number) => {
      setActiveOrderId(orderId);
      /* Set the ref synchronously as well. It is otherwise only assigned during
         render, so a fetch that resolves before React re-renders would compare
         against the PREVIOUS order and let stale messages through — the exact
         race this guard exists to close. */
      activeOrderRef.current = orderId;
      setMobileThreadOpen(true);
      setMessages([]);
      setReplyTo(null);
      setTypingLabel(null);
      setOlderPage(0);
      setHasOlder(true);
      setMsgLoading(true);
      setMsgError(null);
      setActiveOrder(orderId);

      try {
        const history = await chatApi.historyAll(orderId, 'ADMIN');

        /**
         * Discard a response whose conversation is no longer open.
         *
         * Clicking A then B fires two history requests. If A is slower it
         * resolves last, and without this guard its messages are written into
         * B's open thread — the admin reads one student's conversation under
         * another's name. Every state write below is gated on the order still
         * being the active one.
         */
        if (activeOrderRef.current !== orderId) return;

        const list = Array.isArray(history) ? history : [];
        setMessages(list);
        setConversations((prev) =>
          prev.map((c) => (c.orderId === orderId ? { ...c, unreadCount: 0 } : c))
        );
        // Mark the student's unseen messages as read.
        await Promise.all(
          list
            .filter((m) => m.senderRole !== 'ADMIN' && !m.seen)
            .map((m) => chatApi.markSeen(m.messageId).catch(() => undefined))
        );
      } catch (e) {
        if (activeOrderRef.current === orderId) setMsgError((e as Error).message);
      } finally {
        // A stale request must not clear the spinner for the thread now open.
        if (activeOrderRef.current === orderId) setMsgLoading(false);
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
    const nextPage = olderPage + 1;
    try {
      const page = await chatApi.historyPage(activeOrderId, 'ADMIN', nextPage, PAGE_SIZE);
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
      showToast((e as Error).message, 'error');
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

    setSending(true);
    try {
      if (queue.length > 0) {
        // Each attachment is uploaded, then published. Files that fail STAY in
        // the queue so the admin can retry them — clearing the lot would
        // silently discard work.
        const failed: File[] = [];
        let anySent = false;

        for (let i = 0; i < queue.length; i += 1) {
          const file = queue[i];
          if (!file) continue;
          const isLast = i === queue.length - 1;
          try {
            const uploaded = await chatApi.uploadAttachment(file);
            const published = sendMessage(activeOrderId, {
              message: isLast ? text : '',
              messageType: chatMediaType(uploaded.contentType),
              replyToMessageId: replyTo?.messageId ?? null,
              fileKey: uploaded.fileKey,
              fileName: uploaded.fileName,
              contentType: uploaded.contentType,
              fileSize: uploaded.fileSize,
            });
            if (published) anySent = true;
            else failed.push(file);
          } catch (e) {
            failed.push(file);
            showToast(`${file.name}: ${(e as Error).message}`, 'error');
          }
        }

        setQueue(failed);
        // The caption rode on the last attachment, so only drop the draft if
        // something actually went out.
        if (anySent && failed.length === 0) {
          setDraft('');
          setReplyTo(null);
        }
        if (failed.length > 0) {
          showToast(`${failed.length} attachment(s) could not be sent — still queued.`, 'warning');
        }
      } else {
        // publish() returns false when the socket dropped between the check
        // above and the send. Keeping the draft is the difference between a
        // retry and a lost message.
        const published = sendMessage(activeOrderId, {
          message: text,
          messageType: 'TEXT',
          replyToMessageId: replyTo?.messageId ?? null,
        });
        if (published) {
          setDraft('');
          setReplyTo(null);
        } else {
          showToast('Message could not be sent — it has been kept in the box.', 'error');
        }
      }
      sendTyping(activeOrderId, false);
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
        onRetry={loadConversations}
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
