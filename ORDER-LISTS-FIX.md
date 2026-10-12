# Order lists: production no longer serves `/orders/all`

## 1. What the dashboard error means

> Method parameter 'orderId': Failed to convert value of type
> 'java.lang.String' to required type 'java.lang.Long'; For input string: "all"

`GET /orders/all` no longer exists on the backend. Spring now matches the path
to an `/orders/{orderId}` mapping and fails to read `"all"` as an order ID.
The order list moved to `GET /admin/all` (AdminController, "ADMIN SEARCH
ORDERS"). The previous delivery moved only the Orders page there; ten other
screens and the Students page's order list still called `/orders/all`, so all
of them failed in production.

The new test reproduces this. Run against the previous build, it shows the
same "Couldn't load this" card on the dashboard and fails 63 of 106
assertions across the other screens.

## 2. What changed

**Nothing in the app calls `/orders/all` any more**, and `API.orders.all` has
been deleted so it can't come back by accident. Every order list now reads
`/admin/all` through two helpers in `lib/api/orders.ts`:

- `ordersApi.recent(n)` gets the newest *n* orders. It asks for 100 at a time
  (the service maximum): page 0 first, then the remaining pages in parallel,
  and only as many as exist.
- `ordersApi.lookup(query)` is used by the order pickers. It runs the server
  search (`keyword`, 8 results). When the query is an order ID (`2417` or
  `OD-2417`), it also reads `GET /admin/orders/{id}` and lists that order
  first. An exact ID therefore always finds its order, whatever the keyword
  search matches.

| Screen | Before | Now | Requests |
|---|---|---|---|
| Dashboard — Needs attention | `/orders/all` size 100 | `recent(100)` | 1 |
| Chat sidebar | `/orders/all` size 60 | `recent(60)` + the bulk summary | 2, as before |
| Assign orders | `/orders/all` size 100 | `recent(100)` | 1 |
| Analytics | `/orders/all` size 500 | `recent(500)` | up to 5 |
| System overview | `/orders/all` size 200 | `recent(200)` | 2 |
| Installments: queue labels | `/orders/all` size 200 | `recent(200)` | 2 |
| Installments and Verify payments: search | 200 orders, filtered in the browser | `lookup()` searches **every** order on the server | 1–2 per search |
| Experts: active orders | `/orders/all` size 200 | `recent(200)` | 2 |
| Assign dialog: workload | 200 orders, fetched on **every admin page load** | fetched only when the dialog opens | 2 when opened, otherwise 0 |
| Create order: student picker | 200 orders, filtered by email | `GET /admin/students/search` by exact ID or email | 1 per lookup |
| Students: order list | `/orders/all?searchType=stuid` | `/admin/all?keyword=<email>`, each hit confirmed (§3) | 1 + one per hit, at most 25 |

## 3. Fields the new rows don't carry

`/admin/all` rows contain only `id`, `subject`, `assignmentType`, `price`,
`status`, `paymentStatus`, `deadline` and `createdAt`. Where a screen used to
show more, it now shows what is true rather than a wrong default:

- **Expert (Orders, Analytics' top orders):** the name when the server sends
  it. Otherwise "Assigned" for an assigned status, or "—". Never
  "Unassigned".
- **Workload (Experts page, assign dialog):** "Not available", with the
  reason, instead of "no active orders" for everyone.
- **Orders by expert (Analytics):** "Not available" instead of "No assigned
  orders in this range".
- **Student (Assign orders, pickers):** the column and lines appear only when
  the rows include a student. The search placeholders say what can be
  searched.
- **Students page:** `/admin/all` has no student filter. It searches by the
  student's email (then by ID if that finds nothing) and confirms each hit
  belongs to this student before showing it:
  - when the row carries `studentId`/`studentEmail`, it uses those;
  - otherwise it reads the order's details, at most 25, four at a time.

  A LIKE match such as `wade@example.com` inside `dwade@example.com` is
  therefore never shown on Wade's profile. The confirmed details already
  include each order's payments, so the Payments tab no longer makes its
  separate `/payments/order/{id}` calls for those orders.
- **Create order:** picking a student now fills the email, name, phone and
  country, not just the email. If the email typed matches an existing student
  except for letter case, the page says how it is stored and offers to use
  that address. `createOrderByAdmin` uses `findByEmail` exactly as typed, so a
  differently-cased address would otherwise create a second account. A new
  email searched in the picker is carried into manual entry.

Every one of these reads the missing fields when present. If the backend adds
them to `mapToOrderDTO`, the names, workload, student column and per-expert
chart come back with no frontend change, and the Students page skips its
confirmation reads.

## 4. Other problems found in the recheck

- **Proxy mode (`BACKEND_ORIGIN`, mode B) was broken both ways.** `/admin` and
  `/expert` are both page prefixes and API prefixes, and some paths are both
  at once:

  | Path | Page | API |
  |---|---|---|
  | `/admin/orders/{id}` | order detail page | order detail |
  | `/expert/orders` | expert orders page | expert orders |
  | `/expert/dashboard` | expert dashboard | expert stats |
  | `/expert/profile` | expert profile page | expert profile |

  With the old rewrites, the expert API calls got the pages' HTML. And
  opening `/admin/orders/1052` directly loaded the backend's JSON instead of
  the page.
  - **Fix:** a request under `/admin` or `/expert` that carries the bearer
    token goes to the backend first, and a request without it reaches the
    pages first. API calls always carry the token and page loads never do.
  - **Checked against a stand-in backend on a proxy-mode build:**
    - all four paths reach the backend with the token and the page without it;
    - client-side navigation still gets the page;
    - `/auth`, `/api` and `/files` are unchanged.

  Mode A (`NEXT_PUBLIC_API_BASE_URL`, the default) was not affected.
- **`.env.example` CORS list omitted PATCH.** The coupon on/off switch uses
  `PATCH /admin/coupons/{id}/toggle`. If the backend's CORS configuration was
  copied from that list, the browser's preflight would block it. PATCH is now
  listed.
- **Messages that over-promised were reworded:**
  - The Students page's "This student has not placed any orders yet" now says
    the search found none.
  - The search hints that promised student ID and email matching now say
    order ID or keyword.

## 5. Backend recommendations

1. **Add `studentId`, `studentName`, `studentEmail`, `assignedEmployeeId`,
   `assignedEmployeeName` and `expertDeadline` to `mapToOrderDTO`.** This is the
   single change that restores the expert names, workload counts, per-expert
   chart and student column, and removes the Students page's per-order
   confirmation reads. A `studentId` filter on `/admin/all` would make the
   Students page one request.
2. **Send `OrderRepository.searchOrdersAdvanced`.** The Students page finds a
   student's orders through the `keyword`. If that query doesn't match student
   emails, the page will show "The order search found no orders for this
   student's email or ID" for a student who has orders. The query decides
   this, and I can't see it.
3. **`createOrderByAdmin` looks students up with `findByEmail(dto.getStudentEmail())`,**
   which is case-sensitive, while the student search lowercases. Lowercasing
   there (or `findByEmailIgnoreCase`) prevents duplicate accounts. The form now
   warns about this, but the backend is the real fix.
4. The earlier items still stand (`ADMIN-ORDER-SEARCH.md` §6):
   - `@DateTimeFormat` on `fromDate`/`toDate`;
   - 400 instead of 500 for `IllegalArgumentException`;
   - the detail DTO's missing academic level, university and word count;
   - create ignoring country, academic level and university.

## 6. Tests run

**New: `tests/browser/order-lists.test.mjs`, 106/106 passed** as SUPER_ADMIN
and ADMIN. Its stand-in backend answers `/orders/all` with the production 400
and returns only the eight fields from `/admin/all`, rejecting size > 100. On
the previous build, 63 of the 106 assertions fail.

**Updated suites** (their stand-ins now answer `/orders/all` with the
production error):

| Suite | Result | What changed in it |
|---|---|---|
| order-search | 144/144 | — |
| student-search | 76/76 | Now checks the email search, the per-hit confirmation and payments taken from the details |
| chat-sidebar | 100/100 | — |
| chat-multiline | 292/292 | — |

**Unchanged suites:** login-flow 73/73, history 65/65, quality 5/5,
landing 38/38, sms-compliance 54/54.

**Visual audit:** all 23 portal pages in three views (69 screenshots) on the
final build:

- no call to `/orders/all`;
- no `/admin/all` request over size 100;
- no "Couldn't load this" card;
- no overflow or unlabelled control.

The only flags are the theme switch and hidden file inputs, which predate this
work.

`tsc`, `next lint` and `next build` are clean.

**Not covered:** production can't be reached from this workspace, so every
backend response was simulated. In particular, what the `/admin/all` keyword
matches (§5, item 2) is assumed by the simulation, not known.

**To confirm on production:**

1. Open the dashboard; "Needs attention" should list orders.
2. Open a student who has orders and check the Orders tab.
3. In DevTools → Network, confirm there are no `/orders/all` requests.
