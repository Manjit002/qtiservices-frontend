# Route-based dashboards

## Why Back went to Login — three causes, not one

1. **19 admin panels (5 expert) shared one URL.** Clicking a sidebar item
   changed React state, never history, so Back skipped every panel at once.
2. **Sign-in used `router.push`**, leaving `/admin/login` in history directly
   behind the dashboard — so the first Back that escaped the dashboard landed
   on the login form.
3. **The login page did not forward an already-signed-in user**, so arriving
   there showed a logged-in admin the login form.

Fixing only the routing would still have left a signed-in admin one Back press
away from the login form. All three are fixed, and the browser test proves it:
with the routing fixed but the old sign-in restored, Back still ends on
`/admin/login`.

## Admin routes — every sidebar item, plus order detail

| | |
|---|---|
| Dashboard | `/admin/dashboard` |
| Orders | `/admin/orders` |
| Order detail | `/admin/orders/[id]` |
| Assign orders | `/admin/assign-orders` |
| Deleted orders | `/admin/deleted-orders` |
| Analytics | `/admin/analytics` |
| Students | `/admin/students` |
| Experts | `/admin/experts` |
| Chat | `/admin/chat` · `?order=2417` opens one thread |
| Installments | `/admin/installments` |
| Verify payments | `/admin/verify-payments` |
| Coupons | `/admin/coupons` |
| Create order | `/admin/create-order` |
| Reviews | `/admin/reviews` |
| External review | `/admin/external-reviews` |

## Super Admin routes

| | |
|---|---|
| System overview | `/admin/system-overview` |
| Roles & access | `/admin/roles-access` |
| Add expert | `/admin/add-expert` |

**These sit under `/admin/`, not a separate `/super-admin/` tree, deliberately.**
Super Admin is a role inside the admin portal, not a separate portal: one
login, one sidebar, entries shown by role. A separate URL tree would make a
super admin cross between two layouts mid-session for no gain, and there is no
middleware that a path prefix would help guard. Each page checks the role and
says *"Super Admin access required"* rather than silently redirecting, so
someone following a shared link learns why.

## Expert routes

| | |
|---|---|
| Dashboard | `/expert/dashboard` |
| My orders | `/expert/orders` |
| Deadlines | `/expert/deadlines` |
| Order files | `/expert/files` · `?order=2417` preselects an order |
| My profile | `/expert/profile` |

**No `/expert/chat`.** The expert sidebar has never had a chat entry, and this
change adds no functionality.

## Structure

```
app/admin/login/page.tsx          ← outside the group: no shell, no guard
app/admin/(portal)/layout.tsx     ← auth, sidebar, shared modals, palette
app/admin/(portal)/orders/page.tsx
app/admin/(portal)/orders/[id]/page.tsx
… 18 pages
```

`(portal)` is a route group: it adds no URL segment, so the folder
`dashboard/page.tsx` is served at `/admin/dashboard`. App Router keeps a layout
mounted while moving between its pages, which is what makes navigation cheap
and keeps the session, the sidebar and any open dialog alive across routes.

The giant page held state several panels shared — seven dialogs, a refresh
counter, the chat unread badge, the command palette, and the 200-order workload
figure the assign dialog needs. That moved into the layout and is passed down
through a context, so each page is now just its panel with its props.

Sidebar entries are real `<Link>`s with `aria-current="page"`, and the
highlight comes from `usePathname`, not local state — so it is correct after a
direct URL visit or a refresh, not only after a click.

## Verified in a real browser, not asserted

A headless Chrome 131 drove the built app: **75 assertions, all passing**.

- Dashboard → Orders → **Back → Dashboard** (the reported bug)
- Dashboard → Orders → Reviews → Back → Back → Back → the page *before*
  sign-in, never the login form
- Forward through the same chain
- Refresh on `/admin/orders` stays signed in on `/admin/orders`
- Direct URL to **all 19 admin routes and all 5 expert routes**, each with the
  right title and the right sidebar item highlighted
- Signed out → any portal URL redirects to that portal's login
- An EXPERT opening `/admin/orders` goes to `/expert/dashboard`, and the reverse
- A non-super ADMIN gets "Super Admin access required" on the three restricted
  URLs, which are also absent from their sidebar
- Mobile (390px): drawer navigates, closes, and Back still works
- No uncaught page errors anywhere

The suites are in `tests/browser/`, with instructions. They were checked against
the bug itself — see that README.

## Authentication

`useAuth`, `authService` and the API client are **byte-for-byte unchanged**.
The guard still runs, now once per portal in the layout instead of once per
page, so ordinary navigation no longer re-runs it. Two changes in the sign-in
form only: `replace` instead of `push` after a successful sign-in, and
forwarding a user who is already signed in.

## A side effect worth knowing

Per-page code splitting came for free. `/admin/dashboard` first-load JS went
from **219 kB to 137 kB**, because a visit no longer downloads all 19 panels.
The heaviest page is now `/admin/chat` at 167 kB, which is the only page that
loads the chat socket client.

## Scope

Changed: `app/admin/(portal)/**` and `app/expert/(portal)/**` (new),
`components/admin/shell/**` and `components/expert/shell/**` (new),
`SignInForm.tsx` (the two navigation fixes), `AppShell.tsx` (close the mobile
drawer when the current page is tapped).

Removed: the two single-page dashboards they replace, and
`components/admin/portal/` — an unused, near-identical earlier draft of this
same refactor that was sitting in the workspace, imported by nothing. It was
never in a shipped archive.

Untouched and verified unchanged: the entire public site (`components/home`,
`app/blog`, `app/services`, the three legal pages, `app/page.tsx`), every API
module, and all authentication.

`tsc` exit 0 · `lint` exit 0 · `build` exit 0 · class coverage **633/633** ·
no dead components.
