# Recheck 8

**Four defects found, all in the form I built last turn.** Consistent with the
pattern across this project: the highest-risk code in any recheck is whatever I
wrote most recently.

## The defects

**1. Error messages weren't linked to their inputs.** Fields carried
`aria-invalid` but no `aria-describedby`, so a screen-reader user hears
"invalid" with no indication of *why*. Four fields affected. Each error span now
has an id, and each input references it — verified that all four references
resolve to spans that actually exist.

**2. Focus never moved to the first failed field.** Submit, nothing appears to
happen, and a keyboard or screen-reader user has no way to find the problem —
the errors render visually far from where focus sits. Now focuses the first
`[aria-invalid="true"]` control after a failed submit.

**3. No field length caps — and this one had a functional consequence.** The old
form capped via zod (`name 50, email 100, phone 20, message 1000`); I dropped
those when rewriting. Because this form delivers through a `mailto:` URL, and
handlers truncate somewhere around 2,000 characters, a long enquiry would have
been **silently cut off mid-word** with no warning to either party:

```
1,980-char message  →  2,934-char mailto URL   ✗ over the ceiling
with caps restored  →  1,429-char worst case   ✓ comfortably under
```

Caps restored, plus a live `n / 1000` counter so the limit is visible rather
than a silent stop.

**4. Inputs had no `name` attributes.** Browser autofill keys off `name`, so it
wasn't offering saved values. Added to all six.

## Verified at runtime, not just in source

The compliance-critical behaviour, checked against the **served HTML** a carrier
reviewer would actually inspect:

| Check | Result |
|---|---|
| Checkbox blocks rendered | 2 |
| Block 1 — policy links / SMS phrase / checked / required | no / yes / no / **no** |
| Block 2 — policy links / SMS phrase / checked / required | yes / no / no / **yes** |
| Submit ships `disabled` before any input | ✅ |
| "exam" · "test prep" · "certification" · "competitive" | **0 occurrences each** |

Zero cross-contamination in either direction — the SMS box carries no policy
links, the legal box carries no SMS language.

## Two false positives worth recording

Both were my own checks flagging **my own explanatory comments** as if they were
code:

- "no exam language in content" FAILed on the comment documenting *why* the
  exam framing was excluded.
- "CSS scoped under .lp" reported 233 unscoped selectors — my regex was parsing
  comment prose as selectors, then splitting the `:where(h1, h2, h3, h4, p, ul,
  blockquote)` list on its commas.

Re-run against the **shipped** artefacts instead of source: 0 exam occurrences
in rendered HTML, 0 unscoped rules in the delivered CSS. This is the fourth
recheck where a grep flagged prose — a FAIL always needs eyes before it's
believed, and so does a PASS.

## Project-wide regression — 32/32

API contracts (10), data shapes (2), order edit (2), chat (3), modal (3),
landing (2), content restoration (5), SMS consent form (5).

## Static and runtime

Listener / object-URL / interval balance ✅ · no styled-jsx ✅ · no explicit
`any` ✅ · no dead components or unimported stylesheets ✅ · class coverage
**599/599** ✅ · `tsc` · `lint` · `build` ✅ · all seven routes HTTP 200 ✅ ·
admin/expert bundle sizes unchanged ✅

## Open

1. **`mailto:` is not real lead capture.** The form hands the request to the
   visitor's mail client; if they have no handler configured, nothing is sent
   and they see a confirmation that says so. Real server-side capture needs an
   actual endpoint — flagged rather than faked.
2. **Phone number conflict unresolved** — old source says `+1 (585) 522-2449`,
   live site says `+1 (800) 578-4832`. Only QTIServices can say which is
   current.
3. **Four request DTOs still unverified** — both uploads arrived as 0 bytes.
4. **No REST send endpoint for chat** — delivery is STOMP-only.
5. **3 high-severity CVEs** in Next's dependency tree.
6. **Expert portal still on legacy visuals** — five panels.
7. **Still not opened in a browser.** SSR, shipped CSS and rendered HTML are
   verified; visual layout and real interaction are not.
