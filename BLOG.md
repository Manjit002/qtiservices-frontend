# Public Blog feature

## What was added

| Item | Detail |
|---|---|
| Header nav | `Blog` added between Technologies and Contact → `/blog` |
| Homepage section | `Insights & Updates`, placed between Technologies and the CTA |
| `/blog` | Article index |
| `/blog/[slug]` | Three articles, statically pre-rendered at build |

Nav order verified in rendered HTML: **Services → About Us → Technologies →
Blog → Contact**.

## Nav entries needed a small structural change

Existing nav items are in-page anchors (`#services`). Blog is a real route, so
entries now carry an optional `route: true` flag and render as `next/link`
rather than a bare `<a>`.

This also fixes a latent issue: the header is shared with the legal pages,
where `#services` pointed at a section that does not exist on those pages. The
Blog link works correctly from every page that renders the header.

## Design

No new design language. The blog grid reuses the exact `.lp-srv-grid`
treatment — 3 columns, 1px gap over a border-coloured background, cards on
`--paper` with the same hover — and the section shell reuses `.lp-eyebrow`,
`.lp-h2`, `.lp-sub` and `.lp-sec`. Read More reuses `.lp-srv-more`, so the
arrow and its hover-gap animation are identical to the Services cards.

Existing tokens only: no new colours, fonts, radii or shadows. Dark mode works
through the same `[data-theme='dark']` variables as the rest of the page.
Breakpoints match Services: 3 columns → 2 at 960px → 1 at 600px.

Hero, Services, Stats, About, Technologies, CTA and Footer are untouched.

## Content decisions

The articles are **real, written pieces** about work QTIServices actually does
— cloud migration planning, zero trust, and the technology behind online
tutoring. No placeholder text: verified 0 occurrences of lorem / TBD /
placeholder / coming soon in the rendered output.

Two deliberate omissions, both to avoid asserting things that aren't true:

**No publication dates.** Inventing them would imply a posting history that
does not exist. Cards show category and reading time instead, which are
accurate. Dates are easy to add once there is a real editorial calendar.

**No named authors.** Attribution is "QTIServices Team", consistent with the
site's existing "QTIServices Leadership Team" quote. No fabricated individuals.

## Compliance

The educational-support article was written under the same constraint as the
tutoring service card. Verified across **all five** blog-related rendered
pages:

| Term | Occurrences |
|---|---|
| exam | **0** |
| test prep | **0** |
| certification | **0** |
| competitive | **0** |

(The source file matches those words once each — inside the comment recording
that they are excluded. Nothing rendered.)

The blog presents QTIServices as a technology/IT services company: two of three
articles are cloud and security, with educational support as the third.

## Verification

- All routes HTTP 200; an unknown slug correctly returns **404** via `notFound()`
- Link integrity: **0 dead internal links** across 9 static routes + 1 dynamic
- Heading hierarchy on `/blog` and articles: exactly one `h1`, no skipped levels
- Class coverage **625/625**
- `tsc` ✅ · `lint` ✅ (0 warnings) · `build` ✅
- Admin/expert bundle sizes unchanged (`103 kB` / `11.1 kB`)

## Accessibility note

Cards are not wrapped in a single large link — a nested link inside a clickable
card breaks keyboard navigation and produces confusing screen-reader output.
The title carries the link, and Read More points to the same target with a
visually-hidden suffix naming the article, so "Read More" is never ambiguous
out of context.

## Files

New: `blog-content.ts`, `Blog.tsx`, `app/blog/page.tsx`,
`app/blog/[slug]/page.tsx`
Modified: `content.ts` (nav entry), `SiteHeader.tsx` (route links),
`app/page.tsx` (section insert), `landing.css` (blog styles)

Nothing else in the project was touched — no DTOs, phone number, mailto form,
PostCSS, chat, admin, expert, or authentication.
