# Browser tests for dashboard routing and history

These drive a real headless Chrome. They exist because the bug they cover —
Back landing on the login page — cannot be caught by a typecheck, a lint or a
build.

They are not wired into `package.json`, so they add no dependency to the app.
To run them:

```bash
mkdir -p /tmp/bt && cd /tmp/bt && npm init -y
npm i puppeteer-core @sparticuz/chromium

# in the project, in another shell
npm run build && npx next start -p 7600

# then
BASE=http://localhost:7600 node /path/to/tests/browser/history.test.mjs
BASE=http://localhost:7600 node /path/to/tests/browser/login-flow.test.mjs
```

`landing.test.mjs` (38 assertions) covers the two public landing pages — /sms
and /contact — loading with no session, the SMS programme being explained above
the consent checkbox, the opt-in form's behaviour there, footer reachability,
headings and mobile overflow.

`sms-compliance.test.mjs` (54 assertions) opens the public pages **with no
session at all** and checks the required SMS wording is actually rendered, that
the footer legal links exist, that the two consent checkboxes are separate with
the right required/checked state, all five submit cases, and mobile overflow and
tap targets. It stubs nothing and needs no auth — it is the closest thing here
to what a compliance reviewer would see.

`quality.test.mjs` (5 assertions) checks what only a runtime can show: one h1
per page with no skipped heading levels across all 23 portal pages, no React
hydration / duplicate-key / DOM-nesting warnings, and that the shared layout is
genuinely not remounted between routes. It seeds an EXPERT session for the
expert pages (they redirect any other role) and fails if a page redirects, so
it can no longer pass by checking the login screen in place of a dashboard.

`chat-multiline.test.mjs` (292 assertions) types multiline messages into the
admin chat with real keystrokes (Shift+Enter for a new line), signed in as
ADMIN and as SUPER_ADMIN, on desktop and phone. For every message it checks
the composer value, the STOMP SEND payload, the stored string (`textContent`)
and what the browser renders (`innerText`) separately, so a failure names the
stage that lost the line breaks. It also covers received messages (history and
live), long text with an unbreakable token, the Enter/Shift+Enter convention,
trimming, and an attachment with a multiline caption. The backend is not
reachable from the test machine, so REST calls are intercepted and the SockJS
socket is replaced, in the test only, by a small in-page STOMP peer that
records what the app sends and broadcasts it back unchanged. On the build
before the fix it fails 84 assertions, every one at the render stage.

```bash
BASE=http://localhost:7600 OUT=/tmp/chat-shots node chat-multiline.test.mjs
```

`chat-sidebar.test.mjs` (99 assertions) counts every request the admin chat
page makes. The sidebar must cost exactly two: the order list (size=60) and one
`GET /api/order-chat/conversations?role=ADMIN`, sent in parallel. There must be
no per-order `history?size=1` or `unread-count` calls; the build before the
bulk endpoint made 120 of them. It also checks:

- the sidebar still shows everything it did: student, preview, time, unread
  badges, "No messages yet" rows, unread-first sorting, the Unread filter and
  search;
- opening a thread is unchanged: one `history/all` plus `markSeen` for each
  unseen message;
- live socket messages update only the affected row and the nav badge.
  Student messages raise the unread count; admin messages update the preview
  only;
- a summary that arrives after a deep-linked thread has opened does not put a
  badge back on it. Removing that guard fails 2 assertions;
- there is no polling while idle;
- the thread fixes from the code recheck. Each of these failed on the build
  before the fix:
  - pin by keyboard;
  - Escape only clears the composer when it has focus;
  - drafts are kept per conversation;
  - presence resets when switching students;
  - history merges with live messages instead of replacing them;
  - "Load earlier" can't land in another thread;
  - Retry re-subscribes the open thread;
  - a message received while the sidebar loads is not lost;
- if the summary endpoint returns 404, 403 or an HTML page, the orders still
  list, a notice says previews are unavailable, the admin is not signed out,
  and nothing falls back to per-order requests. Retry calls the bulk endpoint
  once and does not reload the orders.

```bash
BASE=http://localhost:7600 [OUT=/tmp/sidebar-shots] node chat-sidebar.test.mjs
```

`extension-hydration.test.mjs` (8 pages) needs a **dev** server, because
production React does not report attribute mismatches. It simulates a form-fill
extension, which adds `fdprocessedid` to inputs and buttons before React
hydrates, and expects no hydration warnings on the public forms, the sign-in
pages or the portals. Before the fix, the home, contact and SMS pages and both
sign-in pages warned.

```bash
npx next dev -p 7600
BASE=http://localhost:7600 node extension-hydration.test.mjs
```

`visual-audit.mjs` is not a pass/fail suite: it screenshots all 23 portal pages
(18 admin, 5 expert) with fixture data in four views — 1440px dark, 1440px
light, 1280px laptop and a 390px phone — and reports, per page:

- sideways page scroll on the phone, measured against the device width (a
  page wider than the screen makes Chrome widen `innerWidth` to match, which
  would otherwise hide the very overflow being looked for);
- table wrappers that need a sideways scroll on a desktop, which hides the row
  actions in the last column;
- buttons and links with no accessible name, and inputs with no label;
- tap targets under 32px on the phone;
- class names that no loaded stylesheet styles (a page borrowing another
  route's CSS only looks right if that route was visited first);
- leftover `.legacy` panels and page errors.

```bash
BASE=http://localhost:7600 OUT=/tmp/shots node visual-audit.mjs            # all views
BASE=http://localhost:7600 OUT=/tmp/shots VIEWS=phone node visual-audit.mjs
```

Screenshots and `report.json` land in `OUT`. Expected noise: the topbar theme
switch is 36×21 (its tap area is widened by an invisible `::after`, which the
box measurement cannot see) and the visually hidden file inputs are 1×1.

`history.test.mjs` (65 assertions) covers Back/Forward chains, direct URLs to
every route, refresh, the signed-out and wrong-portal redirects, super-admin
refusal, and the mobile drawer. It seeds a session in localStorage.

`login-flow.test.mjs` (73 assertions) drives the real two-step employee sign-in
(password → emailed OTP) with both endpoints scripted. It checks:

- nothing is stored and no challenge leaks to storage, cookies or the URL
  before the code is verified;
- the exact request bodies, and that double submits send one request;
- OTP input behaviour: digits only, paste, focus, numeric keypad;
- every role reaches its own dashboard only after the OTP step;
- Back to Login issues a fresh challenge;
- 13 OTP-step and 7 password-step failures map to the fixed messages, with no
  backend text shown and no 401-triggered reload;
- a pending challenge never opens a dashboard;
- the console never shows a password, OTP or token;
- the phone layout fits, and Back from the portal never lands on the login form.

It was checked against the regression it guards: making step 1 store the
response again fails 22 assertions.

All three stub API calls with 503 so a failed request can never trigger the client's
401/403 logout path and skew a routing result.

**They must not stub Next's own RSC requests.** Client-side navigation fetches
the RSC payload with `fetch`; stubbing it makes Next fall back to a full page
load, and a soft-navigation check then reports a false failure. The
interceptors skip any request carrying `RSC` / `Next-Router-Prefetch` /
`Next-Router-State-Tree` headers or `_rsc=`.

**These tests have been checked against the bug.** Reinstating the old sign-in
behaviour (`router.push`, no forwarding of signed-in users) makes
`login-flow.test.mjs` fail on exactly the two assertions about Back — so a
pass means something.
