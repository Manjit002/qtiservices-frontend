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

`sms-compliance.test.mjs` (54 assertions) opens the public pages **with no
session at all** and checks the required SMS wording is actually rendered, that
the footer legal links exist, that the two consent checkboxes are separate with
the right required/checked state, all five submit cases, and mobile overflow and
tap targets. It stubs nothing and needs no auth — it is the closest thing here
to what a compliance reviewer would see.

`quality.test.mjs` (5 assertions) checks what only a runtime can show: one h1
per page with no skipped heading levels across all 23 portal pages, no React
hydration / duplicate-key / DOM-nesting warnings, and that the shared layout is
genuinely not remounted between routes.

`history.test.mjs` (65 assertions) covers Back/Forward chains, direct URLs to
every route, refresh, the signed-out and wrong-portal redirects, super-admin
refusal, and the mobile drawer. It seeds a session in localStorage.

`login-flow.test.mjs` (10 assertions) drives the actual sign-in form with a
stubbed login response, then presses Back — the precise flow from the bug
report.

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
