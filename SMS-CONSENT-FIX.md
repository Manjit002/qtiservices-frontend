# SMS consent — carrier compliance fix (TCR / A2P 10DLC)

## First: this fix targets something that didn't exist in this codebase yet

I checked before changing anything: **there was no form or checkbox anywhere
in this Next.js site.** The only "contact" surface was two buttons
(`mailto:` / `tel:`) in the CTA section.

The compliance note describes fixing "your current setup," which has one
bundled checkbox — that description matches the **old Vite site**
(`qtiservices-source-code.zip`) exactly, not this migration. That old source's
`ContactForm.tsx` is almost certainly what the carrier reviewer actually
looked at.

So this wasn't a case of finding and editing an existing checkbox — it was
building the compliant form for the first time in this codebase, sourced from
the old form's real fields rather than invented ones, so that whenever this
site replaces the old one, the fix is already in place.

## What was wrong with the old form, confirmed by reading it

`src/components/contact/ContactForm.tsx`, in full:

1. **One checkbox**, `smsConsent`, whose own label/disclosure text contained
   the Privacy Policy and Messaging Terms links. That's the exact violation —
   optional SMS consent and mandatory legal acceptance bundled into a single
   checkbox.
2. **Phone was required** — `phone: z.string().min(10, "Valid phone number
   required")`, label `"Phone Number *"`. Directly contradicts "the form must
   be submittable without a phone number."
3. **Submission was fake.** `onSubmit` did `await new Promise((r) =>
   setTimeout(r, 1500))`, then `console.log("Form submitted:", data)`, then
   showed a success toast. Nothing was ever sent anywhere, even before this
   fix. Worth knowing independent of the SMS issue.

## The fix

Two independent checkboxes, verified in the rendered HTML — not just in
source:

| | Checkbox 1 — SMS | Checkbox 2 — Legal |
|---|---|---|
| Default state | unchecked | unchecked |
| Required to submit | **no** | **yes** |
| Contains PP/Terms links | **no** | yes — both, real routes |
| Contains SMS language | yes | **no** |

Confirmed by parsing the two rendered `<label>` blocks independently: checkbox
1 contains the SMS phrase and zero policy links; checkbox 2 contains both
policy links and zero SMS phrasing. No cross-contamination either direction.

**Wording is reproduced exactly as given, not paraphrased** — that text is
what a reviewer checks against, so `SMS_CONSENT_LABEL` and the two consent
fragments are named constants in `content.ts`, not inline strings, so they
can't drift on a future edit without it being obvious in a diff.

**Phone is now genuinely optional** — no asterisk, labelled
`(optional)`, and not in the validation set that blocks submission.

**Submit ships `disabled` before any input** — confirmed in the raw served
HTML, not just the component logic. That's the clearest possible proof to
anyone testing the form that it cannot be submitted without the legal
checkbox, which is the exact requirement: *"form should NOT submit without
this."*

## Where it lives

Added to the existing CTA section (`id="cta"`), below the two quick-action
buttons, which are unchanged. Fields are the old form's real set — first
name, last name, email, phone, company, message — nothing invented, nothing
dropped except making phone optional as required.

## One honest deviation from the old form, worth flagging on its own

The old form's "success" state was fabricated — a fake delay, a console.log,
a toast claiming success. There is no lead-capture backend in this codebase
to send a real submission to, and I was not going to build a fake one or
reproduce a fake success message on a live consultation-request form.

Instead, submitting opens the visitor's own mail client via `mailto:`,
pre-filled with everything they entered — the same mechanism the two
CTA buttons next to this form already use, so it's consistent with the rest
of the site rather than a new pattern. The confirmation copy says exactly
that ("your email client should have opened…") rather than claiming the
request was received.

If QTIServices wants real server-side lead capture, that needs an actual
endpoint — genuine backend work, out of scope for a public-site content
restoration and not something I'd invent a fake version of.

## Validation

`tsc` ✅ · `lint` ✅ (0 warnings) · `build` ✅ · class coverage **598/598** ·
admin/expert bundle sizes unchanged · both checkboxes verified unchecked by
default in rendered HTML · zero cross-contamination between them · phone
confirmed optional · submit confirmed disabled by default.

**Files touched:** `content.ts`, `CtaSection.tsx`,
`ProjectRequestForm.tsx` (new), `landing.css`. All four under
`components/home/landing/`. Nothing in `admin/`, `expert/`, or `lib/api/`.
