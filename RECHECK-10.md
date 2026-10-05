# Recheck 10

**Two defects, both mine. This archive supersedes the one you were about to
deploy — deploy this one instead.**

## 1. My "18/18 verbatim" claim about the blog was false

Two turns ago I reported that all 18 blog titles and descriptions matched your
spec exactly. They did not. The check passed because I compared the file
against an expected list **I had typed myself, with American spelling** —
not against your text. It could not have failed.

Checked against your spec this time:

| | Reported before | Actual |
|---|---|---|
| Titles matching your spec | 18/18 | **16/18** |
| Descriptions matching your spec | 18/18 | **8/18** |

Every divergence was spelling or punctuation, not wording — I had silently
converted your British spelling to American and your straight apostrophes to
curly ones:

- #06 title — "Modernizing" → your "**Modernising**"
- #09 title — "Organization" → your "**Organisation**"
- 10 descriptions — optimization, organizations, modernization,
  visualization, and two apostrophes (`organisation's`, `today's`)

**Fixed.** All 18 titles and descriptions now come from your text, and are
verified **18/18 and 18/18 character for character** in the rendered `/blog`
page, with HTML entities decoded so the comparison cannot pass by accident.
Article bodies were not touched.

This matters because your checklist lists "Modernising" and "Organisation" —
comparing the live site against it would have shown two mismatches in titles
I had told you were exact.

## 2. `/services` had no `<h1>`

I built that page two turns ago by rendering only the service-detail section,
whose top heading is an `<h2>` — it sits under the hero's `<h1>` on the
homepage, but alone on `/services` it left the page with no primary heading.
That hurts screen-reader navigation and search indexing.

Added a page title in the same hero pattern as `/blog` and the legal pages.
Now `h1 → h2 → h3 → h4 → h5` with no skips; all 18 service blocks still render.

## Also corrected

The comment at the top of `blog-content.ts` described the file wrongly: it
called using your text a "substitution," and pointed at "reasoning this file
previously carried" — text I had deleted when I rewrote the file. It now
describes the file as it actually is.

## Two decisions for you

**Mixed spelling on each article page.** The spec covered titles and
descriptions; the article bodies are mine and are in American English. So an
article page now shows your British title and lede, then an American body.
Converting the bodies to British is a mechanical change — say if you want it.

**One URL keeps American spelling.** The slug
`/blog/modernizing-legacy-applications` was left as it is so no existing link
breaks. Slugs are identifiers, not displayed text.

## Page weight

The homepage is **144 KB** of HTML now that it carries 18 service blocks and
18 blog cards — roughly half of that is Next's serialized page data, which
compresses well over the wire. Not a defect, just much heavier than the
3-card version. Both sections are there because both were asked for.

## Verification

| Check | Result |
|---|---|
| Regression suite | **29/29** |
| Heading hierarchy, all 8 public page types | one `h1`, no skips ✅ |
| Dead internal links | **0** |
| Class coverage | **633/633** |
| Listener / URL / interval balance, styled-jsx, `any`, dead components | clean ✅ |
| `tsc` · `lint` · `build` | ✅ |
| All routes incl. admin/expert | HTTP 200 ✅ |

**Files changed:** `components/home/landing/blog-content.ts` (titles,
descriptions, header comment) and `app/services/page.tsx` (page title).
Nothing else.

## Still open

- The live site is still running an older deployment — 3 blog posts, and no
  service-detail section. I cannot deploy; this archive needs to go through
  your existing deploy process. Once it has, I can re-fetch
  `https://qtiservices.com/blog` and give you the real live count.
- `mailto:` contact form, REST chat send, the postcss CVE, and the expert
  portal visuals remain parked as separate tasks.
