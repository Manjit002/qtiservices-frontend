# Admin and Super Admin chat: multiline messages

Messages typed with line breaks were displayed as one paragraph. The text was
never changed. The browser simply wasn't told to show the line breaks.

The fix is one CSS rule plus one class name on the message text. No data,
API, socket, backend or Student-side code was touched.

## 1. Root cause

The problem is in how messages are **rendered**, not in how they are typed
or sent.

`components/admin/chat/MessageBubble.tsx` printed the message as
`<div>{m.message}</div>`. Nothing in `chat.css` set `white-space` on that
element, so it used the browser default, `white-space: normal`.

Under `normal`, the browser draws every `\n` as an ordinary space and merges
runs of blank lines. The string still contained every line break; the screen
just didn't show them.

## 2. Admin chat

- **Component responsible:** `MessageBubble`. It draws every message in the
  thread: sent, received, from history, and in search results.
- **What changed:** the text element gets a class, `ch-text`. The admin chat
  stylesheet gives that class `white-space: pre-wrap` and
  `overflow-wrap: anywhere`.
  - `pre-wrap` shows line breaks, blank lines and indentation exactly as typed,
    and still wraps long lines at the bubble edge.
  - `overflow-wrap: anywhere` lets a long unspaced string, such as a URL or a
    login, break inside the bubble. Before the fix, such a string spilled out
    of the bubble.
- **What did not change:** the bubble's size, colours, padding, font, line
  height and meta row.

## 3. Super Admin chat

Super Admin uses the same page as Admin. `/admin/chat` renders `ChatCenter`
for both roles; the Chat link is not limited to super admins, and both roles
send as `senderRole: 'ADMIN'`.

So the same component was responsible and the same change fixes it. There is
no separate Super Admin chat in this codebase.

## 4. Message flow

The new browser test checks each stage separately. Results on the build
**before** the fix:

| Stage | What was checked | Line breaks |
|---|---|---|
| A. Composer | `textarea` value after typing with Shift+Enter | kept |
| B. Send | `send()` uses `draft.trim()`, which removes only leading and trailing whitespace | kept |
| C. Socket payload | JSON body of the STOMP `SEND` to `/app/chat.send` | kept, exact match |
| D. Received | `MESSAGE` frame on `/topic/chat/{orderId}`, and `/api/order-chat/history/all` | kept |
| E. App state | `setMessages` stores the message as received; the DOM text node matches exactly | kept |
| F. Rendering | `innerText` of the bubble, which reflects CSS | **collapsed** |

On that build, every payload and state check passed. All 84 failures were at
stage F.

**About `trim()`:** it was left as is. It only removes accidental whitespace
at the start and end of the message; blank lines and indentation inside the
message are kept. The test sends `"   \nHello\n\n    indented line\n  "` and
the payload is `"Hello\n\n    indented line"`.

No code path in the admin chat replaces, splits, joins, sanitizes, or converts
the text to Markdown or HTML. React prints it as plain text, so it stays
escaped.

## 5. Backend

**The backend was not modified.**

- The frontend sends the exact text, newlines included, in the STOMP payload
  (stage C).
- The admin side displays whatever text it receives; the only defect was in
  how it was drawn (stage F).

The production backend can't be reached from this workspace, so its round
trip could not be observed directly. Two things suggest it already preserves
newlines:

- The Student-side chat was fixed on the frontend and uses the same backend.
- The brief's rule applies: if the newlines survive the round trip, no
  backend change is needed.

To confirm on production in about a minute:

1. Open Chrome DevTools, go to Network, select the `/ws/chat` request, and
   open its Messages tab.
2. Send a two-line message.
3. Check that both the outgoing `SEND` frame and the incoming `MESSAGE` frame
   contain `\n`.

## 6. Files changed

| File | Change |
|---|---|
| `components/admin/chat/MessageBubble.tsx` | `className="ch-text"` added to the message text element (one line). |
| `components/admin/chat.css` | Added `.ch-text { white-space: pre-wrap; overflow-wrap: anywhere; }` with a comment explaining why. |
| `tests/browser/chat-multiline.test.mjs` | New test (292 assertions). Test code only; it does not ship. |
| `tests/browser/README.md` | Documents the new test. |
| `CHAT-MULTILINE-FIX.md` | This report. |

## 7. Student side

- **Student chat:** this codebase contains no Student chat; the Student site
  is a separate app. Nothing on the Student side was modified.
- **The stylesheet:** `chat.css` is imported only by `ChatCenter`, the admin
  chat. The new `.ch-text` class exists only there, so nothing global
  changed.

## 8. Testing

`tests/browser/chat-multiline.test.mjs` uses the real chat page with real
keystrokes and the real Send button.

**What ran:**

- Both roles, ADMIN and SUPER_ADMIN.
- Both viewports, desktop (1440px) and phone (390px, touch).

**How the backend was simulated:**

- REST calls are intercepted.
- The SockJS socket is replaced, in the test only, by a small STOMP peer. It
  records each frame the app sends and broadcasts each chat message back
  unchanged.

| Case | ADMIN desktop | ADMIN phone | SUPER_ADMIN desktop | SUPER_ADMIN phone |
|---|---|---|---|---|
| TC1 single newline | ✓ | ✓ | ✓ | ✓ |
| TC2 blank line | ✓ | ✓ | ✓ | ✓ |
| TC3 multiple paragraphs | ✓ | ✓ | ✓ | ✓ |
| TC4 bullet list | ✓ | ✓ | ✓ | ✓ |
| TC5 business message (the brief's text) | ✓ | ✓ | ✓ | ✓ |
| TC8 received from history | ✓ | ✓ | ✓ | ✓ |
| TC8 received live over the socket | ✓ | ✓ | ✓ | ✓ |
| TC9 long message, including an unbreakable token | ✓ | ✓ | ✓ | ✓ |
| Indentation and trimming | ✓ | ✓ | ✓ | ✓ |
| Attachment with a multiline caption | ✓ | ✓ | ✓ | ✓ |

**What each case checks:** the composer value, the exact payload, the stored
string, the rendered line breaks, the line count, and that nothing overflows
the bubble or the page.

**Results:**

- Before the fix: 208/292.
- After the fix: **292/292**.

## 9. Regression check

- **Sending and receiving:**
  - The payload shape is unchanged: same fields, `messageType` TEXT or
    DOCUMENT, `senderRole` ADMIN.
  - Live delivery over `/topic/chat/{orderId}` still renders.
  - The composer clears after a successful send.
- **Enter key:** the existing convention is kept. Enter sends and Shift+Enter
  adds a new line; the test checks both.
- **Attachments:** the file uploads and is published with its key, the file
  card still renders, and the caption keeps its line breaks.
- **Single-line places stay single-line by design:**
  - the conversation preview in the sidebar (`nowrap`, checked);
  - the reply quote;
  - the reply bar above the composer;
  - the notification toast.
- **Other suites, unchanged:** login-flow 73/73, history 65/65, quality 5/5,
  landing 38/38, sms-compliance 54/54.
- **Visual audit of the chat page:** clean at 1440px dark, 1440px light and
  1280px. On the phone it reports only the two known small targets: the
  theme switch and the hidden file input.
- **Build:** `tsc`, ESLint and `next build` are clean.

## Note, not changed

On a phone keyboard there is no Shift key, so Enter always sends. An admin
on a phone can therefore only add line breaks by pasting text. Messages
still display correctly on a phone.

This is the existing convention, and the brief asks to keep it. If phone
admins should be able to type line breaks, the change would be small: on
touch screens, Enter adds a line and the Send button sends. That would be a
separate decision.
