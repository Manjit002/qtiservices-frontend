# Code recheck: October 2026

## What was checked

- **Static checks:** a clean `tsc --noEmit`, `next lint` and `next build`.
- **Browser suites:** every suite, on the final build.
- **Visual audit:** all 23 portal pages at 1440px dark, 1440px light, 1280px
  and phone width, which makes 92 page views.
- **Independent review:** a separate reviewer read the admin chat line by
  line: `ChatCenter`, the sidebar, bubble, composer, message list, socket
  client and API layer. Every finding below was then confirmed in the code
  before it was fixed.
- **Codebase sweep** for the kinds of bug fixed recently:
  - per-order request fan-outs;
  - secrets in logs;
  - unsafe HTML;
  - polling;
  - free text whose line breaks collapse.

## Bugs found and fixed

Bugs 1, 2, 3, 4, 5, 8, 9 and 13 have browser assertions that reproduce them.
Run against the build from before this recheck, those 11 assertions fail; the
fixed build passes them all. The other fixes were confirmed by tracing the
code path.

| # | Bug | Effect | Fix |
|---|---|---|---|
| 1 | "Load earlier messages" had no check that the same thread was still open | Opening another order while it loaded put the first order's messages into the second order's thread. A reply to one of them would go to the wrong order. | The response is dropped if a different thread is open (`ChatCenter.loadOlder`). |
| 2 | Opening a thread replaced the list with its history | A message that arrived over the socket while the history was loading disappeared, although it had already been marked seen. | History is merged with live messages by `messageId` (`mergeHistory`). |
| 3 | A sidebar load overwrote live updates | A student message received during the load (or a Retry) lost its preview and unread count when the older summary landed. The nav badge undercounted. | Live messages received during a load are logged and replayed if they are newer than the loaded data (`replayLive`). |
| 4 | Retry on the connection banner dropped the open thread's subscriptions | After a manual reconnect, the open thread stopped getting messages, typing and seen receipts. | `stompClient.reconnect()` keeps the active order across the disconnect. |
| 5 | Presence was not reset when switching students | The next student showed as "Online" because the previous one was. | Presence resets when a different conversation opens. |
| 6 | Own typing echo when the student was unknown | Deep links to older orders showed "Support Team is typing…" while the admin typed. | Typing events from the admin's own ID are ignored. |
| 6b | Deep link to an order outside the 60 most recent got an empty row | The header said "Student" with no name. | The open order's row is built from its summary when it isn't in the list. |
| 7 | Nav unread badge flashed to 0 on every visit to Chat | Small visual glitch. | No total is reported while the list is still loading. |
| 8 | Keyboard on the pin button | Enter on a pin opened the conversation instead of pinning it, and an unpinned pin was invisible when focused and on touch screens. | Keys on the pin no longer reach the row. Pins show on focus, and faintly on touch screens. |
| 9 | Draft, queued files and reply target carried over to the next student | One Enter could send files meant for one order to another. An upload still running for the first order could also clear the second order's draft. | Unsent work is parked per conversation and restored on return. A send writes its outcome back to its own order. |
| 10 | Opening a thread was guarded by order ID only | With A → B → A or a double click, an older response for the same order could land last and stop the loading spinner early. | Each open gets a request number, and only the newest may write. |
| 11 | The thread kept its loading skeleton until every seen-request finished | The skeleton sat on top of loaded messages, and stayed forever if one request hung. | Loading ends when the history arrives; marking seen runs in the background. |
| 12 | Search results from the previous thread stayed on screen | The new student's header showed the old thread's matches. | Results reset when the conversation changes. |
| 13 | Escape anywhere cleared the attachment queue | Closing the image preview or command palette discarded queued files. | Escape only acts while the composer has focus. Clicking Reply now moves focus to the box. |
| 14 | Caption sent twice after a partial failure | If an earlier file failed but the last one, which carries the caption, went out, retrying sent the caption again. | The draft is cleared once the caption has gone out. |
| 15 | Smaller items | A blank label when a subject is empty. Chat images could only be opened with a mouse. The covered thread was still reachable with Tab. | `||` fallbacks. Images are buttons. The covered thread is `inert`. |
| 16 | A deleted order's reason lost its line breaks | It is typed in a multi-line box but showed as one paragraph in the details drawer. | `white-space: pre-wrap` on the drawer values. |

**Files changed:**

- `components/admin/ChatCenter.tsx`
- `components/admin/chat/ConversationSidebar.tsx`
- `components/admin/chat/ChatHeader.tsx`
- `components/admin/chat/MessageComposer.tsx`
- `components/admin/chat/MessageBubble.tsx`
- `components/admin/chat/MessageList.tsx`
- `components/admin/chat.css`
- `components/admin/deleted/deleted.css`
- `lib/websocket/stompClient.ts` (`reconnect()` only)
- `tests/browser/chat-sidebar.test.mjs` and `tests/browser/README.md`

No API calls, request counts, socket destinations or timeouts changed. The
sidebar still loads with two requests.

## Found, not changed: your call

1. **Messages on orders older than the 60 most recent stay hidden.**
   - Summaries for those orders are ignored, as your brief for the bulk
     endpoint specified.
   - So a student who writes on an older order while no admin is on the Chat
     page does not appear in the list or the badge until a live message
     arrives.
   - Fix: show summary rows with `unreadCount > 0` even when the order is
     outside the window. This needs no extra request.
2. **The nav unread badge only updates on the Chat page.**
   - On other admin pages it keeps its last value. This was already the case
     before these changes.
   - Keeping it live everywhere means either the summary request on every
     admin page, or the socket staying connected across the portal.
3. **Pin buttons sit inside clickable rows.**
   - Keyboard behaviour is fixed. Making the row a real button beside the pin
     would be the full accessibility fix, but it changes the row markup.
4. **The student detail page makes one request per order for payments.**
   - It is capped at 10 orders by design and documented. A bulk payments
     endpoint would remove it.
5. **Backend (from the `OrderChatController` review):**
   - `role` comes from the URL, so check that the service enforces it.
   - Confirm that Super Admin works with `role=ADMIN`.
   - An empty upload returns a 500 instead of a 400.

## Sweep results (no action needed)

- **No other per-order request bursts:** the only `Promise.all` loops are the
  sidebar's two-request load and the capped payments lookup.
- **No `console` logging anywhere in app code,** so no tokens, OTPs or
  passwords in logs.
- **One `dangerouslySetInnerHTML`:** the static no-flash theme script in
  `app/layout.tsx`, which is a constant with no user input.
- **One `setInterval`:** the minute tick that keeps deadline labels current.
  It makes no requests.
- **Free text with line breaks** keeps them everywhere it's shown: order
  instructions (admin and expert), reviews, chat messages, and now deleted
  orders' reasons.

## Verification (final build)

- **Static checks:** `tsc` is clean, ESLint reports no warnings or errors,
  and `next build` succeeds.
- **Browser suites, all passing:**
  - chat-sidebar 99/99;
  - chat-multiline 292/292;
  - login-flow 73/73;
  - history 65/65;
  - quality 5/5;
  - landing 38/38;
  - sms-compliance 54/54.
- **Visual audit:** 92 page views with no page errors, no sideways scroll and
  no clipped tables. The only items reported are the known small targets on
  the phone: the theme switch and hidden file inputs.

The browser tests run against stubbed API responses and a scripted socket,
because the production backend can't be reached from this workspace.
