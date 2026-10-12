# Orders page: ADMIN SEARCH ORDERS integration and AdminController API recheck

## 1. What changed

| File | Change |
|---|---|
| `lib/api/endpoints.ts` | Added `API.orders.adminSearch = '/admin/all'`, with its parameters and the fields its rows carry. (`/orders/all` has since been removed — see `ORDER-LISTS-FIX.md`.) |
| `lib/api/orders.ts` | New `ordersApi.adminSearch(query)` and `ordersApi.adminSearchAll(query, maxRows)` (used for CSV export). Removed `ordersApi.search`, which was unused. |
| `lib/utils/orderSearch.ts` (new) | Page and size clamping, `OD-` prefix removal, date conversion, both Spring Page JSON shapes, and error wording. |
| `types/order.ts` | `AdminOrderQuery`. |
| `components/admin/OrdersPanel.tsx` | Status, keyword, country, created dates and paging now run on the server. Also: the Expert column, selection across pages, export of every matching order, loading and error states. |
| `components/admin/orders.css` | Country and date filters, phone layout, dimmed rows while a page loads. |
| `components/admin/EditDeadlinesModal.tsx` | Reads the current expert deadline from the order details when the row doesn't have it. |
| `components/admin/assign/AssignOrderDialog.tsx` | No "Student unknown" line for rows that carry no student fields. |
| `components/admin/OrderDetail.tsx` | A field the server doesn't send reads "Not available", not "Not provided". |
| `components/admin/OrderEditDialog.tsx` | Academic level and University say the saved value isn't included and that leaving them empty keeps it. |
| `lib/utils/csv.ts` | The Type column also reads `assignmentType`. |
| `tests/browser/order-search.test.mjs` (new), `visual-audit.mjs`, `README.md` | Tests. |

No backend, Student-site or public-site files were changed.

## 2. How the Orders page uses `GET /admin/all`

`AdminController` is `@RequestMapping("/admin")` and the method is
`@GetMapping("/all")`, so the request is
`GET https://main.myonlineclasspro.com/admin/all`. It goes through the
existing API client, so the bearer token and 401 handling are unchanged.

| Parameter | What the page sends |
|---|---|
| `status` | The tab's enum name (`REVIEW_PENDING`, `UNDER_REVIEW`, `PRICE_SET`, `ASSIGNED`, `IN_PROGRESS`, `SUBMITTED`, `COMPLETED`, `CANCELLED`). Not sent for **All**. |
| `keyword` | The search box, debounced 400 ms and trimmed. `OD-2417`, `od 2417` and `#2417` are sent as `2417`, because the page shows IDs as `OD-…` and the server compares the keyword as typed. |
| `country` | The new Country box, debounced and trimmed. |
| `fromDate` / `toDate` | The new **Created** dates, as `yyyy-MM-ddT00:00:00` and `yyyy-MM-ddT23:59:59`. A reversed range is not sent; the page explains why and **Clear filters** stays available. |
| `page` | Zero-based. Any filter change returns to page 0 in the same request. |
| `size` | 15 per page. Always clamped to 1–100, the range the service accepts. |

There is no `sort` parameter, because the service always sorts by `createdAt` descending.
Clicking a column header now reorders only the rows on screen, and the
header line says "this page sorted by …" instead of "newest first".

Things removed or changed on the page:

- The **"All fields / Order ID / Subject / Student ID / Email" select is gone.**
  The endpoint has a single `keyword` and no `searchType`, so the select would
  have done nothing. What the keyword matches is up to the repository query
  (§6).
- **Export CSV** exports every matching order, not just the page on screen. It
  fetches 100 rows per request, one request at a time, up to 2,000 rows. If
  more orders match, a message says how many were exported.
- **Selection** keeps each picked row, so **Export selected** includes rows
  picked on other pages.
- **Changing page or filter** keeps the current rows on screen, dimmed, until
  the new page arrives. A slower, older search can't overwrite a newer one.
- **Errors** say what to do next. A 400 while dates are set says the server
  couldn't read the date filter. A 500 while a status is selected says the
  server may not accept that status. Both offer Retry.
- **Both Page JSON shapes** are read: the default `PageImpl` and Spring Data's
  `{content, page:{…}}`. A serialisation setting on the server can't empty the
  table.

## 3. Fields `/admin/all` rows don't have

`OrderService.mapToOrderDTO` sets only eight fields: `id`, `subject`,
`assignmentType`, `price`, `status`, `paymentStatus`, `deadline` and `createdAt`.
The page used to read three more, and handles each one honestly:

| Needed for | Before | Now |
|---|---|---|
| Expert column | `assignedEmployeeName`; every row would have said "Unassigned" | The name if the server sends it. Otherwise "Assigned" for an assigned status, or "—", with a tooltip to open the order. It never claims "Unassigned" without knowing. |
| Edit deadlines → expert deadline | `expertDeadline` from the row; the field would have opened empty | Reads it from `GET /admin/orders/{id}` when the dialog opens. Save waits for that read. |
| Assign dialog → student line | `studentEmail` / `studentId`; would have said "Student unknown" | Shows the line only when the row has a student. |

If the backend adds these fields to `mapToOrderDTO`, the page shows them with
no frontend change.

## 4. ~~Screens still on `/orders/all`~~ — superseded

**Superseded by `ORDER-LISTS-FIX.md`.** Production no longer serves
`/orders/all`. The dashboard showed "Method parameter 'orderId': Failed to
convert … For input string: "all"". Every screen that used it now reads
`/admin/all`.

## 5. AdminController recheck: all 30 mappings

The frontend was compared with every mapping in the shared
`AdminController.java`, checking the verb, path, path variables, query
parameters and body.

| # | Mapping | Frontend | Result |
|---|---|---|---|
| 1 | `GET /admin/employees` | Experts, Roles & access | ✓ |
| 2 | `POST /admin/employee/{empId}/role?roleName=` | Roles & access, Experts | ✓ Query parameter, no body |
| 3 | `POST /admin/employee/{empId}/status?active=` | Experts | ✓ |
| 4 | `POST /admin/orders/{orderId}/assign` (body) | Assign dialog | ✓ Body `{ expertId, expertDeadline }` |
| 5 | `POST /admin/orders/{orderId}/reassign` (body) | Assign dialog | ✓ Same body |
| 6 | `POST /admin/orders/{orderId}/unassign` | Orders, Order detail | ✓ No body |
| 7 | `GET /admin/experts/available` | Assign dialog | ✓ |
| 8 | `GET /admin/orders` → `List<OrderDTO>` | Not used | Unpaged, with the same 8-field rows. Deliberately not used. |
| 9 | **`GET /admin/all` → `Page<OrderDTO>`** | **Orders page (new)** | ✓ §2 |
| 10 | `GET /admin/orders/{orderId}` | Order detail, Edit order, Edit deadlines | ✓ Gaps in §6, item 5 |
| 11 | `PUT /admin/orders/{orderId}/deadlines` (body) | Edit deadlines | ✓ PUT, body `{ clientDeadline, expertDeadline }`, null = unchanged |
| 12 | `POST /admin/orders/create` (multipart `@ModelAttribute` + `files`) | Create order | ✓ Three fields are ignored; §6, item 6 |
| 13 | `POST /admin/orders/{orderId}/start-review` | Orders "Review" | ✓ |
| 14 | `POST /admin/orders/{orderId}/set-price?price=` | Set price | ✓ The UI blocks `≤ 0`, matching the controller's check |
| 15 | `POST /admin/payments/manual-verification?orderId=&paymentIntentId=` | Verify payments | ✓ Query parameters, no body |
| 16 | `POST /admin/orders/{orderId}/payment-link` → `{ paymentUrl }` | Payment link | ✓ Reads `paymentUrl` |
| 17 | `POST /admin/installments/{installmentId}/payment-link` → `{ paymentUrl }` | Installments | ✓ |
| 18 | `POST /admin/orders/{orderId}/complete` | Order detail | ✓ |
| 19 | `GET /admin/admin-dashboard` | Dashboard, Analytics, System overview | ✓ All 6 keys match |
| 20 | `POST /admin/installments/{installmentId}/update` (body) | Installments | ✓ Path and verb. Body `{ finalAmount, dueDateTime, adminNotes }`; the DTO class wasn't shared. |
| 21 | `POST /admin/installments/{orderId}/recreate` (body) | Installment plan | ✓ Always sends `preferredDates` (even `[]`); the controller calls `.stream()` on it without a null check. |
| 22 | `GET /admin/orders/{orderId}/installments` | Installments, Order detail | ✓ |
| 23 | `PUT /admin/orders/{orderId}/update` (body) | Edit order | ✓ PUT, only changed fields; matches `updateOrder`'s 8 fields |
| 24 | `PUT /admin/students/{studentId}/profile` (`@PreAuthorize`) | Students → Edit profile | ✓ |
| 25 | `POST /admin/coupons/create` | Coupons | ✓ |
| 26 | `GET /admin/coupons/all` | Coupons | ✓ |
| 27 | `PUT /admin/coupons/{couponId}` | Coupons | ✓ |
| 28 | `DELETE /admin/coupons/{couponId}` | Coupons | ✓ |
| 29 | `PATCH /admin/coupons/{couponId}/toggle` | Coupons | ✓ PATCH, reads the returned entity |
| 30 | `GET /admin/students/search` (`@PreAuthorize`) | Students | ✓ |

Frontend calls under `/admin` that aren't in this controller:

- `GET/POST /admin/roles` and `PUT /admin/roles/{id}/permissions` (Roles & access). These presumably come from a separate role controller. Its source wasn't shared, so they weren't rechecked here.
- `/admin/wallet/{studentId}`, one of the Students page's legacy wallet probes. It is only tried when the profile has no `walletBalance`, and a 404 is expected there.

## 6. Backend findings

No backend changes were made. In priority order:

1. **`mapToOrderDTO` has no student or expert fields.** Adding `studentId`,
   `studentName`, `studentEmail`, `assignedEmployeeId`, `assignedEmployeeName`,
   `expertDeadline` and `country` would:
   - show real names in the Orders page's Expert column;
   - save the extra detail read in Edit deadlines;
   - give the other order lists their student and expert details back (they moved to `/admin/all` in `ORDER-LISTS-FIX.md`).

   The frontend already reads all of these when present.
2. **`fromDate` / `toDate` have no `@DateTimeFormat`.** The page sends ISO
   `yyyy-MM-ddTHH:mm:ss`. Whether Spring binds that without the annotation
   depends on the Spring version: newer versions fall back to ISO parsing, older
   ones return 400. Adding `@DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)`
   to both removes the doubt. If production returns 400, the page says the date
   filter couldn't be read and the rest of the search still works.
3. **Bad input reaches the client as a 500.** An unknown `status` makes
   `OrderStatus.valueOf` throw `IllegalArgumentException`, which is a 500 unless
   a handler maps it. The same applies to a reversed date range and to page or
   size out of range. The page never sends any of these, but other clients
   could. Mapping `IllegalArgumentException` to 400 with its message fixes it.
4. **`RuntimeException` messages are lost.** Messages like "Order not found",
   "Invalid price" and "Order cancelled" become a bare 500 unless a
   `@ControllerAdvice` writes them out. The frontend already shows the server's
   message whenever one is present.
5. **`mapToOrderDetailDTO` doesn't send `academicLevel`, `university` or
   `instructionsWordCount`.**
   - Order detail now says "Not available" for them, instead of "Not provided".
   - Edit order opens those two fields empty, with a note that leaving them
     empty keeps the saved value.
   - Interestingly, `PUT …/update` does return `academicLevel` and
     `university` in its response.
6. **`createOrderByAdmin` ignores `country`, `academicLevel` and `university`.**
   The create form sends them, but the service never reads them.
   - Academic level and university can be set afterwards with Edit order.
   - Country can't be set at all, because `updateOrder` has no country field.
7. **Unknown: what `keyword`, `country` and the date range match.** That's
   decided in `OrderRepository.searchOrdersAdvanced`, which I haven't seen.
   The page labels the date range "Created" because the results are sorted by
   `createdAt`. **Please send that repository method** so I can confirm:
   - whether the keyword covers order ID, subject and student email;
   - whether the country match is exact or case-sensitive;
   - which date the range uses.

## 7. Tests run

**`tests/browser/order-search.test.mjs`: 142/142 passed.** This was a
production build in headless Chrome, as ADMIN and SUPER_ADMIN, on desktop
(1440px) and on a 390px phone. Every request was checked for:

- size 1–100;
- page ≥ 0;
- no `sort` parameter;
- the session's bearer token.

The test found two bugs in my first version, both now fixed and covered:

- Clearing the filters went back to the page number last used without filters,
  instead of page 0.
- With a reversed date range, **Clear filters** disappeared.

**Other checks, all passing:**

- `tsc` is clean, `next lint` reports no warnings, and `next build` succeeds.
- Regression suites:

  | Suite | Result |
  |---|---|
  | student-search | 70/70 |
  | chat-sidebar | 99/99 |
  | chat-multiline | 292/292 |
  | login-flow | 73/73 |
  | history | 65/65 |
  | quality | 5/5 |
  | landing | 38/38 |
  | sms-compliance | 54/54 |

- Visual audit of all 23 portal pages in 1440px dark, 1440px light, 1280px and
  phone views. There is no horizontal scroll, no unlabelled input and no
  unstyled class. The only phone flag is the theme switch's 21px height, which
  is in the shared header, on every page, and predates this change.

**What these tests could not cover:** production can't be reached from this
workspace, so `/admin/all` was simulated. The simulation follows the service's
validation and the mapper's eight fields; its keyword and country matching is
a guess. One check on production will confirm it: open Orders, then in
DevTools → Network:

1. Select a status tab.
2. Search for an order ID.
3. Set a date.

Then look at the `/admin/all` requests and responses.
