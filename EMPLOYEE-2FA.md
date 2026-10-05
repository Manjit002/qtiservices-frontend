# Employee 2FA login

Every employee role — ADMIN, SUPER_ADMIN, EXPERT and any other — now signs in
in two steps: password, then a 6-digit code emailed by the backend. The
existing auth service, hook, token storage, guards and dashboards are reused.
Nothing was redesigned, and no second auth system was added.

## Where the login happened, and what changed

There is one employee sign-in path, shared by both portals (Super Admin uses
the admin portal):

```
app/{admin,expert}/login/page.tsx → SignInForm → useAuth().login → authService.login
```

Before this change, `authService.login` stored the login response immediately.
Now it stores nothing.

| File | Change |
|---|---|
| `lib/api/endpoints.ts` | + `auth.employeeVerifyOtp: '/auth/employee/verify-otp'` |
| `types/auth.ts` | + `EmployeeLoginChallengeResponse`, `EmployeeChallenge`, `EmployeeVerifyOtpRequest` (none has a token field) |
| `lib/auth/authErrors.ts` | **new.** Maps failures to the fixed messages; backend text is never shown |
| `lib/auth/authService.ts` | `login()` returns `{ challengeToken }` and **stores nothing**; new `verifyOtp()` is the only place a session is stored, using the existing `persist()` and keys; `homeFor(role)` |
| `hooks/useAuth.ts` | `login` no longer sets the user; new `verifyOtp`; the guard uses `homeFor` (identical behaviour) |
| `components/auth/SignInForm.tsx` | the two-step form |
| `components/auth/auth.css` | `.otp-input` only |
| `app/admin/login/page.tsx`, `app/expert/login/page.tsx` | button "Login" (was "Sign in"); heading "Log in" to match it |
| `tests/browser/login-flow.test.mjs` | rewritten for 2FA (73 assertions) |
| `README.md`, `tests/browser/README.md` | auth flow and test docs updated |

## API endpoints used

| Step | Call | Body | Stored |
|---|---|---|---|
| 1 | `POST /auth/employee/login` | `{ email, password }` | nothing |
| 2 | `POST /auth/employee/verify-otp` | `{ challengeToken, otp }` | `token`, `refreshToken`, `userId`, `userRole`, `userEmail` (same keys as before) |

Both calls use a bare `fetch`, as the original login already did, not
`apiFetch`. `apiFetch` treats every 401/403 as an expired session: it wipes
storage and hard-reloads. A mistyped code would then destroy the challenge.
Both calls send no `Authorization` header and time out after 20 seconds.

## Employee login flow

1. **Email + password, then Login.** The button reads "Logging in..." while
   the request runs.
2. **Response arrives.** The form switches in place, with no reload and no URL
   change, to:
   - the heading **"Verify Your Identity"**;
   - the message **"We've sent a 6-digit verification code to your registered
     email address."**;
   - a small "Signing in as …" line.

   The challengeToken lives in this component's React state only, never in
   storage, cookies or the URL. The password is cleared from memory at this
   point.
3. **Code field.**
   - Accepts 6 digits only; letters are dropped as you type.
   - Paste works, e.g. "Code: 483-921" becomes 483921.
   - Focused automatically, with a numeric keypad and one-time-code autofill.
   - It is a single field rather than six boxes, so paste, autofill and screen
     readers work without focus juggling.
4. **Verify & Continue.** The button reads "Verifying..." while the request
   runs. A ref guard means double clicks or Enter send one request.
5. **Success.** Tokens are stored through the existing `persist()`, after
   clearing any previous session so stale fields can't mix in. The employee
   then goes to the role's dashboard:
   - EXPERT goes to `/expert/dashboard`.
   - ADMIN and SUPER_ADMIN go to `/admin/dashboard`.
   - An unknown role goes to the portal's own dashboard, where the existing
     guard leaves it to the backend, as before.

   Navigation uses `replace()`, so Back never lands on the login form.
6. **← Back to Login.** Clears the challenge, the code and the errors, returns
   to step 1 with the email kept, and focuses the password field. No verify
   request is ever sent for an abandoned challenge.

**Guards.** Unchanged: they read only the stored `accessToken`. During the OTP
step there is none, so typing a dashboard URL returns to the login page.
Refreshing, or leaving and coming back, discards the challenge.

### Error messages

| Backend says (by wording, or status if no wording) | Shown | Then |
|---|---|---|
| invalid / incorrect / wrong code; other 4xx | Invalid verification code. Please check the code and try again. | stay; code selected for retyping |
| expired | This verification code has expired. Please log in again. | back to step 1 |
| already used | This verification code has already been used. Please log in again. | back to step 1 |
| max / too many / exceeded attempts; 429 | Maximum verification attempts exceeded. Please log in again. | back to step 1 |
| challenge / session; 404 / 410 | Your login session has expired. Please log in again. | back to step 1 |
| inactive / disabled; 423 | Your employee account is inactive. Please contact your administrator. | back to step 1 |
| employee / account not found | at step 1: same as a wrong password; at step 2: "…could not be found. Please contact your administrator." | — |
| wrong password | Incorrect email or password. Please try again. | stay |
| 5xx / network / timeout | fixed generic lines | stay |

"2 attempts remaining" is not treated as exhausted. Recognisable wording beats
the status code, so a 500 saying "Invalid OTP" still reads as a wrong code. A
stack trace in the body is never shown, and this is tested.

## Student flow

Unchanged. There is no student auth anywhere in this codebase: no
`/auth/student/*`, no `send-otp`, no `login-otp`. The change can't touch it.

## Security checks

- No `console.*` anywhere in the auth code. The test also scans the browser
  console for the password, OTP, challenge, access token and refresh token;
  none appear.
- The OTP and challenge travel only in the POST body.
- Fail closed: a step-1 response without a challengeToken is an error, even if
  it carries an `accessToken`. A token sent alongside a challenge is ignored.

## Verification

- `tsc`, `next lint` and `next build`: all clean.
- Browser suites on the final build: **235/235** passing.
  - `login-flow`: 73 (new)
  - `history`: 65
  - `quality`: 5
  - `landing`: 38
  - `sms-compliance`: 54
- **Negative control.** Making step 1 store the response again fails 22
  login-flow assertions, so a pass means something.
- Not run against the real backend: there were no employee credentials or
  mailbox here. All runs used stubs shaped exactly per the brief's contract.

## Assumptions, and contract points to confirm

1. **Error shapes aren't in the contract.** The status code and wording for
   wrong, expired, used, max-attempts, challenge-invalid and inactive failures
   weren't specified. Mapping uses message keywords first and status second.
   If you send the backend `AuthService.verifyEmployeeOtp` / `loginEmployee`
   and the exception handler, I can pin this to the exact messages.
2. **OTP type.** The code is sent as a JSON string, so leading zeros survive.
   If `EmployeeVerifyOtpRequestDTO.otp` is declared numeric, codes starting
   with 0 will fail. It should be `String`.
3. **Deploy backend and frontend together.**
   - New frontend + old backend: login fails closed (no challenge).
   - Old frontend + new backend: login silently bounces back to the login page
     (no token at step 1).
4. **CORS.** `/auth/employee/verify-otp` needs the same CORS allowance as
   `/auth/employee/login`.
5. **Refresh tokens.** This frontend stores the refresh token but has never
   called `/auth/refresh`, and nor did the legacy pages. Left unchanged.
6. **Step-1 fields ignored.** The step-1 `message`, `role` and `userId` aren't
   used. The fixed copy is shown, and routing waits for the verified response's
   role.
7. **Back/forward cache.** If the browser restores the page from the
   back/forward cache, a `pageshow` handler resets it to step 1. The cache
   didn't engage in the headless runs, so that specific path is coded but not
   exercised. Switching tabs or apps to read the email deliberately keeps the
   challenge.

### Backend observation (not changed — frontend doesn't call it)

In the pasted `AuthController.logout`, an employee's role must contain `ADMIN`
or `EMPLOYEE`; any other role is treated as a STUDENT. `ROLE_EXPERT` contains
neither, so an expert's logout deletes refresh tokens for user type STUDENT
with the expert's id. The expert's own refresh token survives, and a student
with the same numeric id would lose theirs. It also reads only the first
authority, which may be a permission rather than the role.
