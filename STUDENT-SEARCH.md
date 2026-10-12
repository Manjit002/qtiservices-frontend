# Students page: student search integration

## 1. Files changed

| File | Change |
|---|---|
| `lib/api/endpoints.ts` | Added `API.students.search = '/admin/students/search'`. Removed the four guessed profile URLs, which the page no longer needs. |
| `lib/api/students.ts` | `classifyQuery` now returns `id` / `email` / `empty` / `invalid`. New `searchProfile`, `ordersFor`, `profileFromDto` and `classifySearchError`. `search()` is rebuilt on the new endpoint. |
| `types/student.ts` | `StudentProfileResponse` lists the DTO fields that are read. `StudentSearchResult.ordersError` added. `verified` can be unknown. |
| `components/admin/students/StudentsPanel.tsx` | Validation, the duplicate-submit guard, stale-result protection, and the not-found, forbidden and expired-session states. Orders retry. |
| `components/admin/students/StudentSearch.tsx` | Detected-type hint, validation message under the field, Enter on an empty field. |
| `components/admin/students/StudentTabs.tsx` | If orders fail to load, the Orders, Payments and Files tabs show the error with Retry instead of "No orders". |
| `components/admin/students/StudentSummary.tsx` | Shows "—" for the counts when orders are unavailable, and "Not available" when verification status is unknown. |
| `lib/api/client.ts` | `handleUnauthorized` is now exported. No behaviour change. |
| `tests/browser/student-search.test.mjs` (new), `visual-audit.mjs`, `README.md` | Tests. |

No backend, database, Student-site or other dashboard files were changed.

## 2. Endpoint

`GET https://main.myonlineclasspro.com/admin/students/search?keyword=…&searchType=id|email`

`AdminController` is annotated `@RequestMapping("/admin")` (checked against the
controller source shared earlier), and the method is `@GetMapping("/students/search")`,
so the path is `/admin/students/search` with no doubled prefix. The base URL comes
from the existing `NEXT_PUBLIC_API_BASE_URL`. Query values are encoded with the
existing `qs()` helper (`URLSearchParams`), so `chyna+test@gmail.com` arrives
intact.

## 3. How `searchType` is chosen

The input is trimmed first, then:

- Anything containing `@` is an **email** if it looks complete (`x@y.z`). If it
  doesn't, a message is shown and no request is sent.
- Digits are an **ID**. `263050`, `ID-263050` and `id-0263050` all become
  `263050`, with a maximum of 18 digits so it fits the backend's `Long`.
- Anything else, and empty input, gets a message under the field and no
  request is sent. The endpoint only accepts `id` or `email`.

The email is sent as typed (trimmed), because the service lowercases it
itself. Only one `searchType` is sent per search.

## 4. Authentication

The existing API client attaches `Authorization: Bearer <token>`. The search
call follows the same rule as the existing profile-edit call, which is also
protected by `@PreAuthorize`:

- **403** means the role was refused. The page says
  "Your account is not permitted to search students" and the admin stays
  signed in.
- **401** means the session expired. The app's normal sign-out runs (clear the
  session, go to `/admin/login`).

Nothing about the role checks changed.

## 5. DTO → page

I couldn't see `StudentProfileDTO` itself. So the page reads only the fields
this codebase already uses from it, and each one only when it is present with
the right type. Anything missing shows as unknown.

| Field | Used for | If absent |
|---|---|---|
| `id` | ID chip, orders lookup, wallet and status actions | The searched ID (ID searches only) |
| `name`, `email`, `phone`, `country` | Header and Student information | "Student", or "Not available" |
| `active` | Status badge and the Activate/Deactivate button | Treated as active, as before |
| `verified` | "Email verified" | "Not available", no longer "Not verified" |
| `createdAt`, `lastSeen` | Joined / Last seen | Joined falls back to the earliest order, labelled "First order" |
| `walletBalance` | Wallet card | The existing wallet lookups are tried, as before |

`name`, `email` and `phone` are confirmed fields: the existing Edit Profile
flow already reads them from the same DTO. **Please send `StudentProfileDTO.java`.**
If it names any of these fields differently (for example `fullName` or
`balance`), it's a one-line change in `profileFromDto`.

## 6. Orders, payments, files and wallet

The search endpoint returns a profile, not an order history, so:

- **Orders** come from the existing order search,
  `GET /orders/all?keyword=<studentId>&searchType=stuid`. This is one request
  after the profile, falling back to the email if the DTO has no ID. Only
  orders belonging to this student are kept, so a partial match such as
  `2630501` can't show another student's order.
- **Payments and Files** are the existing tabs, built from those orders as
  before.
- **Wallet** uses `walletBalance` from the DTO when present. Otherwise it tries
  the legacy wallet lookups, which were already in the code.
- **A student with no orders is now found.** The old page searched orders
  first, so such a student could not be looked up at all.

## 7. States

- **Loading:** the input and button are disabled and a skeleton is shown. The
  previous student is removed at once. Repeated Enter or clicks still send one
  request.
- **Validation:** shown under the field for empty, non-ID/non-email or too-long
  input. Backend messages such as "Student ID must be numeric" appear there
  too.
- **Not found:** "Student not found. No student matches "…". Please check the
  Student ID or email address." This shows for a 404, or for the service's
  "Student not found" message at any status.
- **Server or network error:** error card with Retry.
- **Orders fail but the profile loads:** the profile shows. The Orders,
  Payments and Files tabs say the orders couldn't be loaded and offer Retry,
  which fetches orders only. The count tiles show "—".
- **Stale results:** each search is numbered, and actions such as activate,
  wallet adjustment and edit profile only update the student still on screen.
  So one student's data can never land on another's.

## 8. Admin and Super Admin

Both roles use the same page (`/admin/students` → `StudentsPanel`), so both
get this change. The test runs the full flow as each role.

## 9. Tests run

**`tests/browser/student-search.test.mjs`: 70/70 passed.** This is a
production build in headless Chrome, as ADMIN and SUPER_ADMIN, on desktop and
on a 390px phone. It covered all 15 cases in the brief:

- valid ID;
- valid email;
- uppercase email;
- surrounding whitespace;
- empty input;
- not found, both message and bare 404;
- invalid ID;
- a second student;
- server error;
- loading and duplicate prevention;
- 401 and 403;
- both roles;
- phone and desktop;
- orders and wallet still shown (the test did not open the Payments and Files
  tabs; they load from the orders as before);
- Edit Profile still offered.

**Other checks, all passing:**

- `tsc` is clean, `next lint` reports no warnings, and `next build` succeeds.
- Suites: login-flow 73/73, history 65/65, quality 5/5.
- Visual audit of the Students page at 1440px light and dark, 1280px and
  phone: no overflow and no errors.

**What these tests could not cover:** the production backend can't be reached
from this workspace, so the backend's responses were simulated in the test,
including "Student not found" as a 500 with a message and as a bare 404. One
real search per type on production will confirm the DTO field names. Watch
DevTools → Network for `/admin/students/search`.

## 10. Backend

No backend changes were made or needed for the integration. Three
recommendations:

- **"Student not found" is thrown as `RuntimeException`.** Without a handler
  that writes the message, it arrives as a bare 500. The page then shows a
  generic error instead of "Student not found". Mapping it to a **404** makes
  it exact.
- **`IllegalArgumentException`** (empty keyword, non-numeric ID, bad
  `searchType`) should map to **400** with the message. The frontend already
  blocks these before sending, so this only matters for other clients.
- **Email lookup is `findByEmail(value.toLowerCase())`.** A student whose
  email was stored with capitals, from before the profile-edit flow started
  lowercasing, won't be found by email. Searching by ID still finds them.
