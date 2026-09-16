# QTIServices — Next.js Frontend Migration

Next.js 15 (App Router) + React 19 + TypeScript (strict). Replaces the
Thymeleaf/vanilla-JS admin and expert frontends. **The Spring Boot backend is
unchanged** — every path, method, query param and body shape is preserved.

```bash
cp .env.example .env.local     # already points at the live backend
npm install
npm run dev
```

> `.env.example` is a template — Next.js does **not** read it. You must copy it
> to `.env.local` (or `.env.production`) or every request will go to the wrong
> origin.

## Backend configuration

The Spring Boot backend is at **`https://main.myonlineclasspro.com`**. Two ways
to reach it — pick based on how you host the frontend.

### Mode A — Direct (default; required for static/Hostinger hosting)

```
NEXT_PUBLIC_API_BASE_URL=https://main.myonlineclasspro.com
NEXT_PUBLIC_WS_URL=https://main.myonlineclasspro.com/ws/chat
```

The browser calls the backend cross-origin, so **Spring Boot must allow your
frontend origin**. Auth is a Bearer token from localStorage, not a cookie, so
`allowCredentials` is not needed:

- Allowed origin: your frontend origin (e.g. `https://qtiservices.com`)
- Allowed methods: `GET, POST, PUT, DELETE, OPTIONS`
- Allowed headers: `Authorization, Content-Type`
- **`/ws/chat` needs the origin allowed in the WebSocket registry too** —
  Spring configures WebSocket CORS separately from MVC CORS. This is the single
  most common reason REST works but chat silently fails to connect.

### Mode B — Proxy (only with a Node server, `next start`)

```
NEXT_PUBLIC_API_BASE_URL=
BACKEND_ORIGIN=https://main.myonlineclasspro.com
NEXT_PUBLIC_WS_URL=https://main.myonlineclasspro.com/ws/chat
```

`next.config.ts` rewrites forward the same relative paths the Thymeleaf pages
used, so the browser only talks to your origin and CORS never applies. Two
limits: rewrites are inert in a static export, and they cannot proxy a
WebSocket upgrade — which is why `NEXT_PUBLIC_WS_URL` stays absolute in both
modes.

---

## Status — read this first

| Area | State |
|---|---|
| Foundation (types, API layer, auth, WebSocket, shared UI, theme) | ✅ Complete |
| Admin login · Expert login | ✅ Complete |
| **Expert portal — all 5 panels** | ✅ **Complete** |
| Admin shell, sidebar, command palette, toasts, modals, guards | ✅ Complete |
| Admin: Dashboard · All Orders · **Order Detail** · **Assign Orders** · **Experts** · Student Chats (STOMP) | ✅ Complete |
| Admin modals: Assign/Reassign · **Set Price** · **Pay Link** · **File Gallery** | ✅ Complete |
| Admin: 10 remaining panels | ⏳ Scaffolded — render a labelled placeholder |
| Expert chat | ❌ Not built — **does not exist in the source** (see audit §1.1) |

`npm run typecheck` ✅ · `npm run lint` ✅ (0 warnings) · `npm run build` ✅ (6 routes)
CSS class coverage: **227/227 resolve** · styled-jsx overrides: **0**

> A post-delivery recheck found seven defects that all compiled and built
> cleanly — including 79 unstyled classes, 466 lines of styled-jsx silently
> overriding the original design, two login pages that never loaded their
> stylesheet, and three buttons wired to no-ops. All fixed; see
> `MIGRATION-AUDIT.md` §5.

**This is not a finished migration.** The admin dashboard is 7,039 lines and 251
functions; six of sixteen panels are built, plus the four order-action modals. What is here
works and compiles — I have not claimed anything that isn't in the code. The
remaining panels are listed at the bottom with the exact endpoints each needs.

---

## Structure

```
app/
  layout.tsx  page.tsx  globals.css
  admin/login/page.tsx        admin/dashboard/page.tsx
  expert/login/page.tsx       expert/dashboard/page.tsx
components/
  shared/    Modal ConfirmDialog Toaster Spinner EmptyState ErrorState
             StatusBadge StatusStepper Pagination ParticleCanvas
             CommandPalette FileLightbox LoadingBar CountUp StatCard
             LoginShell LoginForm DashboardShell
  admin/     AdminDashboardPanel AdminOrdersPanel AssignOrderModal ChatCenter
  expert/    ExpertDashboardPanel ExpertOrdersPanel ExpertOrdersTable
             ExpertDeadlinesPanel ExpertFilesPanel ExpertProfilePanel
             ExpertOrderDetailModal SubmitWorkModal FileUploadQueue
hooks/       useAuth useToast useAsync useDebounce usePagination useModal
             useChatSocket useNotifications useCommandPalette useCountUp
             useLiveDeadlines
lib/
  api/       endpoints.ts client.ts orders experts files payments students
             reviews expert chat
  auth/      authService.ts jwt.ts
  websocket/ stompClient.ts
  utils/     format deadline statusConfig csv recentOrders download chatFormat
types/       auth order employee student payment file chat review common
styles/      admin-dashboard.css expert-dashboard.css admin-login.css
             expert-login.css   ← lifted verbatim from the originals
```

### Verifying visual fidelity

A green build says nothing about whether a class name exists. Re-run this after
any UI change — it diffs every `className` token in JSX against every selector
in `styles/` + `globals.css`:

```bash
python3 - <<'EOF'
import re, glob
used=set()
for f in glob.glob('components/**/*.tsx',recursive=True)+glob.glob('app/**/*.tsx',recursive=True):
    for m in re.finditer(r'className=(?:"([^"]*)"|\{`([^`]*)`\})', open(f).read()):
        raw=re.sub(r'\$\{[^}]*\}',' ', m.group(1) or m.group(2) or '')
        used|={t for t in raw.split() if re.match(r'^[a-zA-Z][\w-]*$',t)}
defined=set()
for f in glob.glob('styles/*.css')+['app/globals.css']:
    defined|=set(re.findall(r'\.([a-zA-Z][\w-]*)', open(f).read()))
print(sorted(used-defined) or 'all classes resolve')
EOF
```

Two rules worth enforcing:

1. **Never add a `<style jsx>` block.** Scoped styles outrank the verbatim
   originals and will silently replace the design. New UI belongs in
   `styles/migration-additions.css`.
2. **Never add a bare element selector** (`nav`, `body`, `table`) to a
   stylesheet. Every route shares one document, so it will leak to all of them —
   this is what threw the sidebar across the top of the page. The portal
   stylesheets are scoped under `.shell[data-portal="admin"|"expert"]` and the
   login ones under `.auth-page`; keep new rules inside those scopes.

Because the portal stylesheets are now `(0,3,0)` specificity, an override in
`migration-additions.css` needs `.shell[data-portal] .foo` to win.

### Why the CSS was copied, not rewritten

The four `<style>` blocks (1,227 lines) were extracted verbatim and the original
class names (`.sb-item`, `.stat-card`, `.badge-assigned`, `.filter-btn`…) are
reproduced in JSX. Retyping them into Tailwind or CSS Modules would have
guaranteed visual drift on a task whose §16 requirement is that nothing changes
visually. Each portal's stylesheet is imported by its own route, so the
overlapping class names in the two themes never collide.

---

## Authentication flow

1. `LoginForm` → `authService.login()` → `POST /auth/employee/login`.
2. Response persisted under the **original** keys (`token`, `refreshToken`,
   `userId`, `userRole`, `userEmail`), so a half-migrated deployment shares one session.
3. Success banner, then `router.push()` after ~1s — same as the original.
4. `useAuth(portal)` guards dashboard routes: no token → login page; wrong role →
   that role's dashboard. `ready` gates one neutral frame so nothing flashes
   during the client-side localStorage read.
5. Every request adds `Authorization: Bearer …`. A 401/403 clears the session and
   redirects **once** — a module-level `redirecting` flag stops a redirect storm
   when a dozen in-flight calls fail together.

The user id comes from the JWT's `sub` claim, matching the backend's
`WebSocketAuthInterceptor`.

> Route guards are UX only. The backend remains the authorization authority; an
> expert who edits localStorage still gets 403s from every admin endpoint.

---

## Chat / WebSocket architecture

`lib/websocket/stompClient.ts` is a **module singleton** wrapping
`@stomp/stompjs` over SockJS.

- **No duplicate clients** — an in-flight connect promise is reused, so switching
  conversation mid-connect can't orphan a socket (the bug the legacy
  `_chatConnectPromise` guard existed for). Being a singleton also means React
  StrictMode's double-invoked effects cannot open two sockets.
- **Subscriptions are reinstated on reconnect** — `@stomp/stompjs` re-runs
  `onConnect` on every reconnect and subscriptions do **not** survive, so the
  active order id is held in module state and re-subscribed there. Required, not defensive.
- **Ref-counted lifecycle** — `acquire()`/`release()`; the socket closes only
  when the last consumer unmounts.
- **`useChatSocket`** holds handlers in a ref, so typing in the composer
  re-renders the parent without tearing down a single subscription.

Attachments upload over REST first (`/api/order-chat/upload`), then the returned
`fileKey`/`fileName`/`contentType`/`fileSize` are published on `/app/chat.send`.
Typing events are throttled to one per second. No polling anywhere.

---

## Environment

| Variable | Scope | Purpose |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | public | Backend origin. **Empty = same-origin relative paths**, exactly like the Thymeleaf pages. |
| `NEXT_PUBLIC_WS_URL` | public | SockJS endpoint, default `/ws/chat`. |
| `BACKEND_ORIGIN` | server | Dev-only `next.config.ts` rewrites. |

No secret ever belongs here — JWT signing keys, DB credentials, AWS and Stripe
secrets stay in Spring Boot.

## Dependencies added

`@stomp/stompjs`, `sockjs-client` (+ `@types/sockjs-client`) — required by the
existing WebSocket contract. **Nothing else.** No UI kit, no table library, no
state library, no data-fetching library: pagination, sorting, CSV, modals,
toasts and the focus trap are all a few dozen lines each and are in `lib/` and
`components/shared/`.

---

## Not yet migrated

Each renders a labelled placeholder rather than a blank panel. Endpoints, types
and shared components for all of them already exist.

| Panel | Endpoints ready in `lib/api` |
|---|---|
| Analytics · Super Dashboard | `API.admin.dashboard` |
| Add Expert | `expertsApi.create` |
| Manage Roles | `expertsApi.listRoles / setRole / setPermissions` |
| Student Details | `studentsApi.*`, `paymentsApi.summaryForStudent` |
| Installments · Verify Payments | `installmentsApi.*`, `paymentsApi.*` |
| Create Order | `ordersApi.create` (multipart + progress) |
| Pending Reviews · External Review | `reviewsApi.*` |
| Deleted Orders | `ordersApi.listDeleted / softDelete` |
| Edit Deadlines | `ordersApi.updateDeadlines` |

The patterns are set by `AdminOrdersPanel` (table + filters + sort + bulk + CSV),
`AdminExpertsPanel` (filtered table + confirm + mutation), `OrderDetailPanel`
(detail fetch + stepper + action bar) and `SetPriceModal` (form + validation +
mutation + toast).

---

## Manual test checklist

**Auth** — bad credentials show inline error · good credentials store all five
keys and redirect · Enter submits from either field · eye toggles password ·
`/admin/dashboard` while signed out → `/admin/login` · expert token on
`/admin/dashboard` → `/expert/dashboard` · logout clears storage.

**Expert** — stats load · orders filter/search/sort/paginate · Start Work moves
to `IN_PROGRESS` · Submit Work uploads with a real progress bar and moves to
`SUBMITTED` · deadlines split due-today vs overdue · file upload and
download/preview open pre-signed URLs · availability persists and rolls back on
failure · Ctrl/Cmd+K palette.

**Admin** — stats and recently-viewed load · orders search by all five modes ·
sort every column both directions · select-all, copy IDs, export CSV **and
selected CSV** (open in Excel: accents intact, commas/quotes in subjects
escaped) · assign rejects a deadline <12h before the student's · reassign and
unassign · Start Review on `REVIEW_PENDING`.

**Chat** — thread loads, unread clears · send text · Enter sends, Shift+Enter
newlines · attachment uploads then appears · typing indicator from the student ·
presence online/last-seen · reply quotes the parent · load-older keeps scroll
position · message search · unread badge on a background conversation, with
sound + OS notification when hidden and a toast when visible · **kill the
backend → status dot changes, restore it → reconnects and messages still
arrive** (the reconnect-subscription path).

**Responsive** — 1920/1440/1024/768/390 · sidebar drawer + overlay + Escape ·
tables scroll horizontally without the page overflowing · chat list→thread→back
on mobile · attach and send never overlap · composer survives the soft keyboard.
