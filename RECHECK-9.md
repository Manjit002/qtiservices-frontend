# Recheck 9

Last turn's change was one content-only edit, so repeating the same eight
sweeps a ninth time had little value. I ran **checks I had never run before**
instead. Two found real defects.

## New check 1 — internal link integrity

Every `href="/…"` in the codebase, resolved against the actual `app/**/page.tsx`
route table.

**0 dead links** across 8 real routes. Worth having run: I've added six routes
across this engagement, and a link to a route that was renamed or never built
would fail silently — no build error, no type error, just a 404 for the visitor.

## New check 2 — duplicate class definitions across stylesheets ❗

Found `.row-actions` defined in **both** `base.css` and
`migration-additions.css`, with conflicting rules:

```css
base.css                 .row-actions { opacity: 0 }  /* until row hover */
migration-additions.css  .row-actions { display: flex; flex-wrap: wrap }
```

Both are bare single-class selectors — **identical specificity (0,1,0)** — so
the winner is whichever sheet Next's CSS chunking happens to emit last. Not
something I control or should depend on.

It is currently harmless **only because nothing references it**: I replaced
hover-revealed row actions with the always-visible `.acts` pattern several
rounds ago and never removed the old rules. But had any component still used
it, its buttons would have been invisible-until-hover or not depending on
bundler ordering — and invisible-until-hover on a touch device means
unreachable. That is precisely the defect I fixed in the orders table earlier.

Dead code carrying an order-dependent conflict is worth deleting, not
documenting. Removed from both sheets; zero references remain.

## New check 3 — heading hierarchy ❗

Checked `h1`–`h6` sequence on all four public pages.

Every page jumped **`h2 → h4`**, skipping `h3`. The cause is shared: the
footer's three column headings (`Services`, `Company`, `Contact Us`) were
`<h4>` sitting after page-level `<h2>`s.

This predates my work — it was in the original landing page — but it is a
genuine accessibility defect affecting every public page. A screen-reader user
navigating by heading hears a gap that implies a missing section.

Changed to `<h3>` and moved the CSS selector with it, so the rendered styling
is byte-identical — verified in the shipped CSS. Re-checked: **all four pages
now have exactly one `h1` and no skipped levels.**

## Security posture — changed since I last looked

| | Then | Now |
|---|---|---|
| Vulnerabilities | 3 high | **2 (1 moderate, 1 high)** |

`sharp` has dropped out entirely and `next` downgraded from high to moderate —
the npm install picked up `next@15.5.25` (from the `^15.1.0` range) since I last
audited. The remaining one is `postcss` (XSS via unescaped `</style>`, arbitrary
file read), reached transitively through `next`. Still needs a deliberate,
tested Next upgrade rather than an `audit fix` in passing — the last time I ran
that with `--omit=dev` it pruned devDependencies and broke the typecheck.

## Regression suite — 33/33

Including this round's two fixes and last round's Services change (9 cards,
numbering ends at 09, Process Automation absent).

## Static and runtime

Listener / object-URL / interval balance ✅ · no styled-jsx ✅ · no explicit
`any` ✅ · no dead components or unimported stylesheets ✅ · class coverage
**599/599** ✅ · `tsc` · `lint` · `build` ✅ · all routes HTTP 200 ✅

## Open

1. **`mailto:` is not real lead capture** — needs a backend endpoint.
2. **Phone number**: the old QTI source uses `+1 (585) 522-2449` in both its
   Footer and Contact page; the live site uses `+1 (800) 578-4832`. Still
   unresolved — one line to change once confirmed.
3. **Four request DTOs unverified** — both uploads arrived as 0 bytes.
4. **No REST send endpoint for chat** — delivery is STOMP-only.
5. **postcss vulnerability** — planned Next upgrade.
6. **Expert portal still on legacy visuals** — five panels.
7. **Still not opened in a browser.** Heading order, link integrity, shipped CSS
   and rendered HTML are all verified; visual layout is not.
