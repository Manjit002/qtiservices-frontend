# Recheck 11

Two defects found, one of them a false alarm in my own test harness that I
chased down rather than reported.

## Parity: nothing was lost moving 19 panels onto their own routes

The routing refactor moved every panel render by hand, so the first check was
mechanical: extract each panel's props from the old single page and from the
new pages, and diff them.

**Every panel: identical.** `OrderDetail` 15 props vs 15, `OrdersPanel` 12 vs
12, `StudentsPanel` 5 vs 5, `ChatCenter` 4 vs 4, and the same for the rest,
admin and expert.

The one difference is intentional: `AppShell` no longer receives `onNavigate`,
because every nav item now carries an `href` and renders as a `<Link>`. That
prop is documented as "only used by items without an href", and nothing in
either portal lacks one now. The click-handler branch stays in the component as
a capability; it is simply unused here.

## Defect 1 — two pages had no `h1`

`/admin/orders/[id]` and `/admin/chat` rendered no `h1` at all, while the other
21 portal pages had exactly one. Pre-existing — neither panel ever had one —
but it matters more now that each is a real URL rather than a panel.

- **Order detail**: the order number was a `<span class="od-id">`. It is the
  page's title, so it is now an `h1` with the same class. `.od-id` is
  class-only, `base.css` zeroes all margins and `.od-title` is a flex
  container, so the tag change is visually inert — verified before making it.
- **Chat**: a two-pane layout with no visible title (the topbar shows "Chat"),
  so it gets a `visually-hidden` h1.
- **Order detail's error branch** also had no heading, since the `h1` lives in
  the success render. It now carries a hidden one, so the route has exactly one
  `h1` while loading, on error, and when loaded.

Verified across **all 23 portal pages**: one `h1` each, no skipped levels.

## Defect 2 — in my test harness, not the app

My first quality run reported *"sidebar is not the same DOM node after
navigating"*, which would have meant the shared layout was remounting on every
route change — defeating the point of the route group.

It was my interceptor. The tests stub API calls with 503 so a failed request
can't trigger the client's 401/403 logout path. But **Next fetches the RSC
payload for client-side navigation with `fetch` too**, so I was stubbing
Next's own navigation and it fell back to a full page load.

Had I taken the failure at face value I'd have reported a serious regression
that did not exist; had I taken it as noise I'd have missed that the tests were
not exercising real navigation at all. Measured instead:

| | stubbing RSC (wrong) | skipping RSC (correct) |
|---|---|---|
| full document loads per sidebar click | 1 | **0** |
| `window` state survives navigation | no | **yes** |
| sidebar is the same DOM node | no | **yes** |

Navigation is genuinely client-side and the layout genuinely persists. The
interceptors now skip anything carrying `RSC` / `Next-Router-Prefetch` /
`Next-Router-State-Tree` headers or `_rsc=`, and the README records why.

The earlier 65/65 history result still stands — it ran with hard navigations,
which is a stricter test of history, not a weaker one.

## Also added to the harness

The order-detail endpoint now returns a real payload rather than 503, so the
test exercises that page's success render instead of its error state. That is
what surfaced the missing `h1` in the first place.

## Everything else

| Check | Result |
|---|---|
| Panel prop parity, old vs new | **identical** |
| Regression suite | **28/28** |
| Browser: history, Back/Forward, direct URL, refresh, redirects, mobile | **65/65** |
| Browser: real sign-in form then Back | **10/10** |
| Browser: headings, React warnings, layout persistence | **5/5** |
| React hydration / duplicate-key / DOM-nesting warnings | **none** |
| Uncaught exceptions across all 23 pages | **none** |
| Dead internal links | **0** |
| Class coverage | **633/633** |
| `tsc` · `lint` · `build` exit codes | **0 · 0 · 0** |

## Open

- The live site still runs an older deployment; deploying is outside anything I
  can do.
- `mailto:` is not real lead capture; REST chat send, the postcss CVE and the
  expert portal's legacy visuals remain parked as separate tasks.
- The public phone number is the retired `+1 (585) 522-2449`; the current Text
  & Call number is `+1 (234) 428-4110`. One line, on your word.
