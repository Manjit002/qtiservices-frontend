# Public SMS compliance content

Everything below was verified on the **rendered public pages, with no session**,
not by reading the source. 54 browser assertions, all passing.

## 1. Privacy Policy — YES

The existing "SMS & Mobile Data Privacy" block was **rewritten in place** rather
than joined by a second section, so there is one SMS statement, not two that can
drift. Heading is now **"SMS and Mobile Information"**, carrying the required
wording:

- mobile information used for *inquiries, appointments, tutoring services,
  project updates, payment links, and customer support*
- **"will not be shared with third parties or affiliates for their own marketing
  purposes"**
- the service-provider carve-out, "subject to appropriate confidentiality
  obligations"

Operational disclosures sit under it: frequency varies, rates may apply, STOP,
HELP, consent optional and not a condition of purchase.

**User control** ("Your Rights" → **"Your Rights and Choices"**): how to exercise
each right, how to ask what data is held, and how to withdraw SMS consent — reply
STOP, or email `support@qtiservices.com`. It also states that withdrawing SMS
consent does not cancel a service request; replies continue by email.

No contact details were invented: the only address used is the one already on the
site.

## 2. Terms of Service — YES

New **"SMS Terms"** section (after Payment Terms), carrying the required
disclosures: message purpose, frequency may vary, rates may apply, STOP, HELP,
and a reference to the Privacy Policy.

## 3. Messaging Terms — YES, reviewed and aligned

No new page — the existing one is the right home for the detail. Three changes so
the pages cannot contradict each other:

- Program categories now match the Privacy Policy and Terms word for word
- Non-sharing wording matched, including **affiliates** and the service-provider
  carve-out
- The relationship is stated on both sides: Terms of Service holds the summary,
  Messaging Terms holds the detail, and each links to the other

## 4–9. Form, phone and public access

The contact form was **already correct and is untouched** — verified rather than
rewritten: two separate checkboxes, both unchecked, SMS optional with no policy
links inside it, legal acceptance required with inline links to both pages and no
SMS language, phone not required.

All five submit cases confirmed in the browser: legal unchecked blocks submission
whether or not SMS is checked; an empty phone submits fine.

Public pages load with **no session and no redirect**: `/`, `/privacy-policy`,
`/terms-of-service`, `/messaging-terms`, `/blog`, `/services`. Footer links to all
three legal pages confirmed present on the live homepage.

## One discrepancy to decide — the only thing I could not reconcile

The brief mandates **two different category lists, both verbatim**:

| Where | Categories |
|---|---|
| Consent checkbox (§4, quoted exactly) | service request, requirement confirmation, pricing discussion, payment links, reminders, support updates |
| Privacy Policy / Terms (§1, §2, and §9 "use consistently") | inquiries, appointments, tutoring services, project updates, payment links, customer support |

I kept **both exactly as written**, because each is quoted as required text and
the checkbox wording is what your provider has already reviewed. The two describe
the same service messaging in different words, and the Messaging Terms now
includes a plain-language line bridging them.

If your provider compares the form's consent text against the policy text
literally, they may query the difference. Aligning them is a one-line change —
but it would mean altering text this brief mandates verbatim, so I have not
done it on my own judgement.

## Everything else

Changed: `app/privacy-policy/page.tsx`, `app/terms-of-service/page.tsx`,
`app/messaging-terms/page.tsx`. Nothing else in the project differs — confirmed
by diffing the whole tree.

`app/admin`, `app/expert`, `components/admin`, `components/expert`, `hooks`,
`lib` and `types` are **byte-for-byte unchanged**, as are the contact form,
footer and site content.

`tsc` · `lint` · `build` all exit 0. Mobile checked at 390px: no horizontal
overflow on any legal page, consent checkbox meets the 16px tap target and its
label fits the viewport.

## Final report

| | |
|---|---|
| 1. Privacy Policy updated | **YES** |
| 2. Terms of Service updated | **YES** |
| 3. Messaging Terms reviewed | **YES** (aligned, not duplicated) |
| 4. Public legal URLs verified without login | **YES** |
| 5. SMS consent remains optional | **YES** |
| 6. Separate mandatory Privacy/Messaging checkbox | **YES** |
| 7. Phone field remains optional | **YES** |
| 8. STOP / HELP disclosures present | **YES** |
| 9. SMS data-sharing disclosure present | **YES** |
| 10. Admin dashboard untouched | **YES** |
| 11. Super Admin dashboard untouched | **YES** |
| 12. Expert dashboard untouched | **YES** |
| 13. Login / authentication untouched | **YES** |
| 14. Mobile / responsive verified | **YES** |

One caveat on all of the above: this describes the **code in this archive**. The
live site is still serving an older deployment, so none of it is public until
this build is deployed.
