# Public-site content restoration

Scope check first, since this task explicitly warned against touching the
dashboards: **exactly 8 files changed**, all under `components/home/**` or
three new `app/*` routes.

```
app/messaging-terms/page.tsx        (new)
app/privacy-policy/page.tsx         (new)
app/terms-of-service/page.tsx       (new)
components/home/landing.css
components/home/landing/About.tsx
components/home/landing/LegalLayout.tsx  (new)
components/home/landing/SiteFooter.tsx
components/home/landing/content.ts
```

Nothing in `admin/`, `expert/`, `lib/api/`, or any shared component. Bundle
sizes for `/admin/dashboard` and `/expert/dashboard` are byte-identical to
before this change — confirmed by comparing the build output.

## What I read before writing anything

`qtiservices-source-code.zip` — a full old QTIServices marketing site
(Vite/React/shadcn, not Next.js). It has exactly the six pages named in the
brief and nothing else: `/`, `/about`, `/services`, `/contact`,
`/privacy-policy`, `/terms-of-service`, `/messaging-terms`, confirmed from its
own `App.tsx` route table.

## Two conflicts found, handled two different ways

**Phone number — left unresolved, flagged.** The old source uses
`+1 (585) 522-2449` consistently in its own Footer *and* Contact page. The
current live site uses `+1 (800) 578-4832`. Neither carries a placeholder
marker — both are equally plausible real numbers — so there is no structural
basis to prefer one. Per instruction, **the current value is left unchanged**
and the conflict is reported here rather than guessed at. If `800...` is a
toll-free line added after the old site was built, or if `585...` was retired,
only QTIServices can say which.

**Address — resolved, with reasoning shown.** The old source itself disagrees
with itself: its Footer says *"485 Madison Ave, Fl 13, New York, NY 10022"*
(site-wide, specific, matches this site's existing "New York" city); its own
Contact page says *"123 Tech Street, Suite 100, San Francisco, CA 94105"* — a
textbook placeholder pattern (`123 [Type] Street`) that also contradicts its
own Footer. I treated the Footer's address as authoritative and used it to
enrich the current site, which previously displayed no street address at all.
This is a judgment call, not a certainty — flagging it rather than presenting
it as confirmed fact.

**Not touched:** the old source's `About` page has its own stats — 10+ years,
150+ projects, 50+ team, 98% satisfaction — that conflict with the numbers
already live on this site's hero and stats banner (500+ clients, 15+ years,
98% retention, 99.9% uptime). I did not import them. A second, contradicting
set of numbers on the same page would be worse than the qualitative content I
did restore (see Values, below).

## What changed, section by section

**Services — 6 → 10 cards.** Diffed the old source's 8-service list against
the current 6 and found three genuinely missing: **Mobile App Development**,
**Data & Analytics**, **Process Automation**. Restored in the same voice and
length as the existing six. Added **Online Tutoring & Educational Support** as
the tenth card — see below.

**About — Values restored, stats not.** Added a `VALUES` grid (Client-Centric,
Innovation, Excellence, Collaboration) as a new block beneath the existing
two-column layout. The existing paragraph, process list, quote and KPI grid
are untouched — nothing there conflicted, so nothing there needed rewriting.

**Footer — dead links wired, address added.** `Privacy Policy` and
`Terms of Service` previously pointed at `#cta` (i.e. nowhere real); there was
no `Messaging Terms` link at all. Both now route to the three new pages, moved
into the bottom bar (replacing a phone/email line that was redundant with the
Contact column above it) so nothing doubles up. The recovered street address
was added to the Contact Us column, which previously showed only email and
phone.

**Three new pages**, none of which existed before. Content is the old
source's, restructured onto this site's own design tokens rather than its
original shadcn/teal system:

| Page | What it restores |
|---|---|
| `/privacy-policy` | Full policy incl. the SMS/mobile-data section |
| `/terms-of-service` | Full terms; Services list updated to include tutoring |
| `/messaging-terms` | Full A2P-style SMS program terms: STOP/HELP, "not a condition of purchase," carriers |

Verified live: STOP, HELP, the opt-out language and the purchase-condition
disclaimer are all present on the rendered pages, not just in source.

`Last updated` is set to **today (September 16, 2026)** rather than the old
source's original date, since the content is being materially re-published now
— contact details realigned, presentation rebuilt. `Governing Law: California`
is preserved exactly as written; that is an existing legal term, not something
I have a basis to alter, even though it sits oddly next to a New York address
— a question for QTIServices' counsel, not one I can resolve.

## Online Tutoring — the compliance-sensitive part

Two images were supplied. **I used one and deliberately did not use the
other.**

**Image 1** ("Online Tutoring") is clean: one-to-one and group sessions,
named subjects (math, science, psychology, medicine, software programming),
pre-booking. This is what the new service card is built from, verbatim in
substance.

**Image 2** ("Edtech — Online Tutoring") contains exactly the framing the
compliance review flagged: *"students can also start preparing for different
competitive exams."* I did not use any of it — not the exam-prep line, and not
the surrounding filler (MOOCs, government-sector governance, device-management
software) that reads as generic template copy rather than a specific,
verifiable description of what this company does.

The result: **zero occurrences** of "exam," "test prep," "certification" or
"competitive" anywhere on the rebuilt homepage — checked against the live
rendered HTML, not just the source. Tutoring sits as the tenth of ten service
cards, styled identically to the other nine, not elevated or separated out.

## Validation

`tsc` ✅ · `lint` ✅ (0 warnings) · `build` ✅ · class coverage **586/586** ·
all three new routes compile static and return HTTP 200 · admin/expert bundle
sizes unchanged · every new CSS rule scoped under `.lp`, confirmed by grep
(163 matches, zero outside that scope).

## What I did not do

- Did not create `/about`, `/services` or `/contact` routes. The current site
  is a one-pager with anchor sections (`#about`, `#services`, `#cta`); adding
  standalone routes for content that already has a home would be a structural
  change the brief didn't ask for. Only the three legal pages are new routes,
  because nothing already existed for them.
- Did not touch `app/layout.tsx`. Each new page sets its own `metadata` export,
  the same pattern the homepage already uses — no shared file needed editing.
- Did not import the old source's numeric About stats, its alternate phone
  number, or its alternate address, for the reasons above.
