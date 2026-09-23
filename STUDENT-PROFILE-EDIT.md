# Admin / Super Admin: edit student profile

## API recheck — all 27 mappings in AdminController

Every mapping in the controller you pasted, checked against the frontend for
path, verb and parameter binding: **27/27**, including the new one.

| New endpoint | |
|---|---|
| `PUT /admin/students/{studentId}/profile` | ✅ verb and path exact |
| Body `{ name, email, phone }` | ✅ matches `UpdateStudentProfileDTO` |
| `country` | not sent — the DTO declares it, but `updateStudentProfileByAdmin` never reads it, so sending it would save nothing |

## A defect I found in my own build during the recheck

**A 403 would have logged the admin out.** The shared API client treats 401 and
403 alike: clear the session, redirect to login. For this endpoint a 403 means
"signed in, but `@PreAuthorize` rejected the role" — so a refused admin clicking
Save would have been bounced to the login page, losing the open form, and the
"not permitted" message I'd written would never have appeared.

Fixed by suppressing the redirect **for this one call only** — the shared client
is unchanged. The dialog now reports 401 as an expired session and 403 as a
permission refusal, and the admin stays where they are.

## Where it is

**Order Detail → Student card** (the card with name, `ID-263050`, email, phone):
an **Edit Profile** action in the card header.

**Students panel → profile header**: the same action beside the identity block.

Both open one shared dialog.

## The service's rules are asymmetric — the UI follows them exactly

| Field | Blank value | Otherwise |
|---|---|---|
| Name | **ignored** by the service — old name kept | trimmed |
| Email | **ignored** by the service — old email kept | trimmed, **lowercased**, duplicate-checked |
| Phone | `""` **clears it**; `null` leaves it | trimmed |

So a blank name or email is **blocked in the form** — submitting one would look
successful while nothing changed.

Phone gets one refinement: an empty field is sent as `null` when the student had
no phone to begin with. Sending `""` there would make the service write an empty
string over a null on every save of a phoneless student — a silent change nobody
asked for. An empty field over an existing number is sent as `""`, a deliberate
clear.

Phone validation is intentionally lenient: 7–15 digits (the E.164 maximum), any
spaces, `+`, dashes, brackets or dots. Tested against `+1 (585) 522-2449`,
`+44 20 7946 0958`, `585.522.2449`, `+91 98765 43210`.

## Display after saving

The card updates from the **PUT response**, not a refetch. Two reasons:

- **There is no GET for a single student** — the code's own endpoint notes record
  that all four candidate paths 404. The response is the only authoritative read.
- It shows what was actually stored. The service lowercases email, so
  `Wade@Gmail.com` is saved — and shown — as `wade@gmail.com`.

## Your eight test scenarios

29 unit tests on the logic, **29/29 passing**. Payloads for T1–T4 are
byte-identical to the request bodies in your brief.

| | |
|---|---|
| T1–T4 name / email / phone / all | ✅ exact payloads |
| T5 duplicate email | ✅ "Email already exists." on the email field — **see caveat 1** |
| T6 cancel | ✅ form resets to the card's values on every open |
| T7 rapid double-click | ✅ one request — a ref guard, since two clicks in one tick both read `saving` as false |
| T8 persisted after reload | ⚠️ **see caveat 2** |

Save is disabled while saving and when nothing has changed; the dialog cannot be
closed mid-request; Enter submits; field errors are linked for screen readers.

## Caveats that live in the backend

**1. Whether "Email already exists." reaches the browser.** The service throws a
plain `RuntimeException`. With an exception handler that writes `message` into
the response body, the exact text arrives and is shown. Under Spring Boot's
default error handling the body carries no message and the status is a bare 500.
The UI handles both — and in the second case it says the email **may** belong to
another student rather than asserting it, because it cannot know. A handler
mapping this to **409 with the message** would make it exact, and a duplicate
email arguably should not be a 500.

**2. Whether reloads show the new values.** The save itself persists — the
service returns the updated profile. But after a page reload, the Order Detail
card is rebuilt from `OrderDetailDTO`. If that DTO reads the student live, the
new values show. If it holds a copy taken when the order was placed, **the old
values reappear on reload even though the student record is updated.** I cannot
see the mapping; worth checking `getOrderDetailForAdmin`.

**3. Two conditions for the permission check to behave.** `@PreAuthorize` only
takes effect if method security is enabled (`@EnableMethodSecurity`). And
`hasAnyRole('ADMIN','SUPER_ADMIN')` matches authorities named `ROLE_ADMIN` /
`ROLE_SUPER_ADMIN` — if the JWT filter grants plain `ADMIN`, every admin gets a
403. If admins report "not permitted" on their first save, that prefix is the
likeliest cause.

Also worth knowing: this is the **only** endpoint in `AdminController` with
`@PreAuthorize`. The other 26 rely on whatever `SecurityConfig` applies to
`/admin/**`.

## Permissions

The action is shown only to **ADMIN** and **SUPER_ADMIN**. That matters because
the admin portal deliberately lets an unrecognised role stay signed in — without
the gate, such a user would see a button the endpoint refuses. The gate is a
courtesy; `@PreAuthorize` remains the enforcement, untouched.

## Files

New: `EditStudentProfileDialog.tsx`, `lib/utils/studentProfile.ts`
Modified: `endpoints.ts`, `students.ts` (API), `types/student.ts`,
`OrderDetail.tsx`, `StudentsPanel.tsx`, `StudentProfileHeader.tsx`,
`app/admin/dashboard/page.tsx` (reads the role; `useAuth` unchanged)

`tsc` ✅ · `lint` ✅ (0 warnings) · `build` ✅ · class coverage **633/633** ·
all routes HTTP 200 · no public-site, auth, or backend files changed.
