# Detailed service content — 9 services × 2 blocks

## Counts, verified in rendered HTML

**9 services · 18 blocks · exactly 2 per service.** Confirmed by parsing each
rendered page, not by counting the source:

| Service | Blocks | Key Areas |
|---|---|---|
| Cloud Solutions | 2 | 12 |
| Cybersecurity | 2 | 12 |
| Software Development | 2 | 12 |
| Managed IT Services | 2 | 12 |
| Network Infrastructure | 2 | 12 |
| IT Consulting | 2 | 12 |
| Mobile App Development | 2 | 12 |
| Data & Analytics | 2 | 12 |
| Online Tutoring & Educational Support | 2 | 12 |

No services added, removed, or renamed — service titles and the existing card
descriptions were diffed against the previous build and are **byte-identical**.

## The two blocks per service are structurally different

Each service splits along the same axis, which makes the pages predictable to
read while the content within each stays specific:

- **Block 1 — what is built or delivered.** Scope and capability.
- **Block 2 — how it is run, governed, or sustained.** Operations and practice.

For example, Cloud Solutions is *Migration and Modernization* then *Operations
and Cost Management*; Software Development is *Custom Application Engineering*
then *Delivery Practices and Quality Assurance*.

**No duplication anywhere**, verified mechanically:

- Shared bullets between a service's two blocks: **0**
- Any bullet appearing more than once across all 18 blocks: **0**
- Duplicate block titles or descriptions within a service: **none**

## Where the content lives

These 18 blocks needed a home. The service cards already had a **"Learn More"**
link that pointed at `#cta` — the contact form — so it led to a form rather
than to information about the service.

Each service now has a detail page at `/services/{slug}`, and Learn More points
there. Nine pages, all statically pre-rendered at build. That also serves the
SEO requirement in the brief: each service targets its own URL and metadata
rather than competing for one.

The homepage Services section itself is unchanged — same grid, same cards, same
copy. Only the Learn More destination changed.

## Design

No new design language. Blocks use the existing bordered-panel treatment (1px
gap over `--line`, cards on `--paper`), the gold underline from
`.lp-srv-title`, and the gold tick used elsewhere for list markers. Existing
tokens only — no new colors, fonts, radii, or shadows. Two columns on desktop,
stacked below 900px.

## Two editorial notes

**Spelling inconsistency, not introduced here.** The new content is American
English as instructed. The existing card descriptions use British spelling
(`optimisation`, `organisation`) and one says *"every pound of IT investment"* —
unusual for a company with a New York address and a US phone number. I left
those untouched because the brief said not to rewrite the card descriptions,
so the page currently mixes both conventions. The three British spellings
visible on the rendered service pages all come from those unchanged
descriptions echoed in the page hero. Worth a decision; a one-line fix each if
you want them aligned.

**Compliance maintained.** The Online Tutoring blocks carry no exam, test-prep,
certification, or competitive-exam language — verified **0 occurrences** on the
rendered page, the same constraint applied to the service card and the blog.

## Verification

- All 9 service pages HTTP 200; unknown slug returns **404**
- Exactly one `h1` per page, no skipped heading levels
- Link integrity: **0 dead internal links** site-wide
- Class coverage **623/623**
- `tsc` ✅ · `lint` ✅ (0 warnings) · `build` ✅
- Admin/expert bundles unchanged

## Files

New: `service-content.ts`, `app/services/[slug]/page.tsx`
Modified: `content.ts` (added `slug` to each service — titles and descriptions
untouched), `Services.tsx` (Learn More target), `landing.css` (block styles)

Nothing else touched — no DTOs, phone number, mailto form, PostCSS, chat,
admin, expert, or authentication.
