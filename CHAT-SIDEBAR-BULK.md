# Admin chat sidebar: bulk summary + WebSocket

The admin chat page now loads its sidebar with two requests instead of about
120. It uses the backend's bulk summary endpoint,
`GET /api/order-chat/conversations?role=ADMIN`, which is now live. The
architecture is:

- **Bulk data for the first load:** `ordersApi.listAll()` and
  `chatApi.conversations()` run in parallel and are merged on `orderId`.
- **WebSocket for live updates:** each new message updates only the affected
  sidebar row.
- **Full history only for the open chat:** `chatApi.historyAll(orderId, 'ADMIN')`
  plus the existing `markSeen` calls.

## Request count

Measured with `tests/browser/chat-sidebar.test.mjs`, which counts every
request the chat page makes:

| Initial sidebar load | Before | After |
|---|---|---|
| Order list (`/orders/all?size=60`) | 1 | 1 |
| `history?size=1`, one per order | 60 | **0** |
| `unread-count`, one per order | 60 | **0** |
| `conversations?role=ADMIN` | n/a | 1 |
| **Total** | **121** | **2** (sent in parallel) |

| Later actions | Requests |
|---|---|
| Opening a conversation | 1 `history/all`, plus 1 `POST seen/{id}` per unseen student message (unchanged) |
| A live message arrives | 0 HTTP requests. The row is updated in place and nothing is refetched. |
| Idle | 0. There is no polling. |

The portal shell also makes its own `/orders/all?size=200` request for the
global search, on every admin page. It is not part of the sidebar and was not
touched.

## API responsibilities

| API | Used for | Not used for |
|---|---|---|
| `ordersApi.listAll(0, 60, 'createdAt,desc')` | Which rows exist: the latest 60 orders, including orders with no chat | |
| `chatApi.conversations('ADMIN')` | Student, last message, time, unread count and `hasConversation` for those rows | Message history |
| `chatApi.historyAll(orderId, 'ADMIN')` | The full thread of the ONE open conversation | The sidebar |
| `chatApi.unreadCount(orderId)` | Kept unchanged for any other use | The sidebar (no longer called by it) |
| WebSocket (existing STOMP client) | Live updates to rows and the open thread | |

## How the rows are built

1. Each order becomes a row (`orderRow`) that keeps the whole order object as
   `order`.
   - Subject, status and creation time come from the order.
   - If the order carries a student name, the row uses it.
   - Chat fields start empty: `hasConversation: false`, `lastMessage: null`,
     `unreadCount: 0`.
2. The summaries are indexed by `orderId` and overlaid on those rows
   (`applySummaries`).
   - `studentId` and `studentName` come from the summary, falling back to the
     order's values.
   - `lastMessage`, `lastMessageTime`, `unreadCount` and `hasConversation`
     come from the summary.
   - Summaries for orders outside the 60 are ignored.
3. Display:
   - `hasConversation: false` shows "No messages yet".
   - `lastMessage: null` with `hasConversation: true` shows "📎 Attachment".
   - Nothing is invented.
4. Sorting is unchanged: pinned first, then unread, then `lastMessageTime`.
   An order with no messages falls back to its creation time.

**Types.** The sidebar row type extends the API type, so the seven chat
fields are declared once under the backend's names:

- `ChatConversationSummary` matches the response exactly.
- `ChatConversation` adds `subject`, `status`, `deadline`, `createdAt` and
  `order`.
- `studentId` and `studentName` stay nullable, so a null from the backend
  cannot break anything.

## Live updates (WebSocket, unchanged transport)

- **A student message on another order:**
  - updates that row's preview and time;
  - raises its unread count and the nav badge;
  - moves it up;
  - plays the existing sound, notification and toast.
- **An admin message on another order** (for example, from a second tab):
  - updates the preview and time only;
  - does not change the unread count;
  - never adds a row for an order not in the list. *(New. Before, these
    messages were ignored.)*
- **A message in the open conversation:**
  - is appended to the thread and marked seen;
  - does not raise the unread count.

## Errors, retry and stale responses

- **The order list fails:** the sidebar's existing error state, with Retry,
  reloads both requests.
- **The summary fails** (404, 401/403, 5xx, or a non-JSON page). There is
  **no per-order fallback.**
  - The orders stay listed and every conversation still opens.
  - Rows read "Preview unavailable".
  - A notice explains that previews and unread counts could not be loaded.
- **Retry on that notice calls the bulk endpoint only.** It does not reload
  the orders.
  - The rows stay on screen while it runs, and the button shows "Retrying…".
  - The result is applied to the current rows, so a live update made in the
    meantime is kept.
- **A 401/403 from the summary alone does not sign the admin out.** The
  order-list request runs alongside it and still catches an expired session.
- **Stale responses:** the full load and the retry share one guard. Each
  aborts the previous request, and only the newest may write state, so a slow
  older response cannot overwrite a newer one. Leaving the page aborts the
  request in flight.
- **Open conversation vs a late summary:** the open conversation keeps an
  unread count of 0.
  - Without this, a summary arriving just after a deep-linked thread opened
    put its badge back, even though the messages were being marked seen.
  - This could already happen with the old per-order requests.
  - The test reproduces it, and removing the guard fails it.

## Files changed in this round

| File | Change |
|---|---|
| `types/chat.ts` | `ChatConversation` now extends `ChatConversationSummary` instead of repeating its fields, and gains `order?: OrderDTO`. |
| `components/admin/ChatCenter.tsx` | New helpers `orderRow`, `applySummaries` and `fetchSummaries`; a shared stale-response guard; `retrySummaries()` (bulk endpoint only); the open-row unread guard; admin messages on other orders update their row. |
| `components/admin/chat/ConversationSidebar.tsx` | New props `onRetryPreviews` and `previewRetrying` (a "Retrying…" state). |
| `tests/browser/chat-sidebar.test.mjs` | 80 assertions, up from 69: bulk-only retry, the late-summary race, admin live messages, and the student name taken from the order. |
| `tests/browser/README.md` | Updated description. |

Already in place from the previous round, and unchanged: `chatApi.conversations()`,
`API.chat.conversations` and `ChatConversationSummary`. Nothing was changed on
the backend, the WebSocket client, nginx, auth or timeouts.

## Verification

- **Build:** `tsc --noEmit` is clean, `next lint` reports no warnings or
  errors, and `next build` succeeds.
- **Browser suites on the final build, all passing:**
  - chat-sidebar 80/80;
  - chat-multiline 292/292;
  - login-flow 73/73;
  - history 65/65;
  - quality 5/5;
  - landing 38/38;
  - sms-compliance 54/54.
- **Visual audit of the chat page:** clean at 1440px dark and light and at
  1280px. On the phone, only the two known small tap targets are reported.

The production backend can't be reached from this workspace, so the tests
answer the REST calls themselves and use a scripted socket peer. Please run
this check once on production:

1. Open Chat with DevTools → Network, filtered by `order-chat`. Expect one
   `conversations?role=ADMIN` request (plus the order list) and no
   `history` or `unread-count` requests.
2. Click a chat. Expect one `history/all?orderId=…&role=ADMIN` request and the
   `seen/…` calls.
3. Have a student send a message on another order. Expect that row's preview,
   time and unread count to change, with no new HTTP requests.

Nothing was deployed.
