# SMS opt-in and contact landing pages

The reviewer's two wording items — the Privacy Policy SMS paragraph and the
Terms of Service SMS Terms section — were already implemented and are in this
build. This adds the landing pages, and fixes two broken-link problems found
while testing.

## What "landing pages" was read as

Two new public routes, both openable with **no session**:

| | |
|---|---|
| `/sms` | The SMS programme explained in full, then the opt-in form |
| `/contact` | A real contact URL, with details and the same form |

`/sms` is the page a carrier reviewer can be pointed at: it answers the
reviewer's bullet that *"your web form clearly explains what messages users will
receive and includes the SMS disclosure before consent is submitted."* On the
homepage the disclosure lives inside the consent checkbox; here the whole
programme is set out above the form, and the test asserts that ordering.

`/contact` exists because contact has only ever been a homepage anchor
(`#cta`), so `/contact` — the URL a reviewer or campaign is most likely to
try — returned **404**.

If you meant something else by "landing pages" (per-service marketing pages,
say), these are self-contained and easy to redirect.

## What /sms says

Sender identity, an explicit statement that we send no marketing or promotional
texts, the same six message categories used on the other three pages,
frequency, rates, STOP, HELP, and consent being optional. Two points are stated
plainly because they are what reviewers look for:

- we only text a number after someone submits the form **and actively ticks the
  SMS box**
- accepting the Privacy Policy and Messaging Terms is a **separate action that
  does not opt you in**

It also carries the non-sharing wording and the service-provider carve-out, and
links to all three legal pages.

HELP is given as a reply keyword plus the support email, not a phone number —
HELP is answered by replying to a message, and printing a number here would
invite calls to a line this page does not manage.

## Two broken-link fixes found by testing

**Footer "Support Centre" pointed at `#cta`** — an anchor that exists only on
the homepage, so from any legal page it went nowhere. It is now two real links:
*Contact us* → `/contact` and *SMS program* → `/sms`.

**The footer's Services and Company columns used `#services` and `#about`** —
same problem, 11 links that did nothing from `/privacy-policy`,
`/terms-of-service`, `/messaging-terms`, `/blog` or `/services`. Now
root-relative (`/#services`, `/#about`), which works from every page and still
scrolls on the homepage.

Both were pre-existing. Site-wide link integrity is now **0 dead links**.

## The form was not touched

`ProjectRequestForm.tsx` and `content.ts` are **byte-for-byte unchanged** — the
consent wording and the two-checkbox split are exactly what your provider
reviewed. The new pages reuse the component, so there is one consent
implementation, not three.

Re-verified on `/sms`: two checkboxes, SMS optional and unchecked, legal
required and unchecked, legal-unchecked blocks submission, empty phone submits.

## Verification

**38 new browser assertions plus the existing 54, all passing**, run against the
built site with no session.

Both pages: HTTP 200 with no redirect, exactly one `h1`, no skipped heading
levels, no horizontal overflow at 390px. Footer links to `/contact`, `/sms` and
all three legal pages confirmed on the live page. No footer anchor on a legal
page now points at a missing section.

`tsc` · `lint` · `build` all exit 0 · class coverage **638/638**.

## Scope

Added: `app/sms/page.tsx`, `app/contact/page.tsx`.
Changed: `SiteFooter.tsx` (the link fixes), `landing.css` (contact-card styles).

`app/admin`, `app/expert`, `components/admin`, `components/expert`, `hooks`,
`lib` and `types` are unchanged, as are the form and the site content.

## Still worth your decision

The site's public phone number is `+1 (585) 522-2449`. That number has since
been replaced twice — the current Text/SMS number is `+1 (817) 507-1278`, and
it is SMS-only, meaning it should be linked as `sms:` rather than `tel:`. The
site currently renders it as a `tel:` link in the header, footer, CTA and now
the contact page.

On an SMS compliance page this matters more than usual, which is why `/sms`
deliberately does not print a number. Say the word and I will update the
constant and switch the link type — it is one place in `content.ts` and flows
everywhere.
