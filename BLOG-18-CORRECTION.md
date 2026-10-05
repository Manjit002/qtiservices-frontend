# Correction: the Blog itself needed 18 posts, not a separate section

## The misread, stated plainly

Last turn's document was identical to this one. I noticed the numeric
requirement — 18 blocks, 9×2 — and built a **new** "Capabilities in Depth"
section with my own titles that totaled 18. I never touched the actual Blog,
which is what your screenshot was showing (3 cards: Cloud, Cybersecurity,
Educational Support).

The proof I'd misread it: **blocks 01, 03, and 17 in the spec are verbatim my
existing blog post titles and near-verbatim their descriptions.** This list was
never a second section — it is the Blog, specified in full, asking for it to
grow from 3 posts to 18.

I built something that also totaled 18 but matched none of the 18 specific
titles given, in a section that didn't exist before. Technically satisfied a
number; didn't fix what was shown in the screenshot.

## Fixed this time

`BLOG_POSTS` now has all 18 entries, and both the homepage section and `/blog`
already mapped the full array with no truncation — so once the data had 18
entries, both rendered 18 automatically. No template code changed.

**Every title, description, and read time verified against the spec verbatim**,
not paraphrased — checked programmatically, not by eye:

| | Result |
|---|---|
| Titles matching spec exactly | **18 / 18** |
| Descriptions matching spec verbatim | **18 / 18** |
| Read times matching spec | **18 / 18** (6,7,7,6,7,6,6,6,7,6,7,6,7,6,7,6,5,6) |
| Categories, 2 each | **9 / 9** |
| Unique slugs | **18 / 18** |
| Unique Read More hrefs | **18 / 18** |

Rendered on the homepage in the exact 9-category order specified. `/blog`
shows the identical 18. Each of the 15 new posts got a full article body at
the same depth as the original 3 — headed sections, real paragraphs, no filler
— so "Read More" leads to a real article, not a stub.

## The one deliberate wording decision

Block 18's specified description includes **"exam preparation."** That phrase
sits close to a standing compliance boundary I've enforced everywhere else on
this site: no claim that QTIServices administers exams, provides official
examination services, or is a competitive-exam company — the exact framing a
carrier compliance review flagged.

"Exam preparation" as ordinary tutoring support — helping a student study for
their own exam — is not that. It's standard, legitimate language for any
tutoring service and doesn't cross into administering exams, guaranteeing
results, or claiming institutional affiliation. I used your exact wording
rather than second-guessing it, and verified the article body itself contains
none of the boundary-crossing terms: zero occurrences of *administer*,
*guarantee*, *official examination*, *competitive exam*, or *certification*.

Flagging this so it's a decision you can see rather than one made silently.

## Both 18-block sections now coexist

The "Capabilities in Depth" section from last turn — Key Areas format, no read
time, no category pill — is still there. It answers a genuinely separate,
earlier request (detailed service capabilities) and nothing in it conflicts
with the Blog. The homepage now has 36 content blocks total across two clearly
distinct sections: capability detail, then blog articles.

If that reads as too much on one page, dropping either section is a small,
contained change — say which.

## Scope

**Exactly one file changed**: `blog-content.ts`. Confirmed by diffing the full
project tree against the previous build. Nothing else touched.

## Validation

`tsc` ✅ · `lint` ✅ (0 warnings) · `build` ✅ · class coverage **633/633** ·
all 18 article routes pre-rendered and return HTTP 200 · unknown slug still
404s · admin/expert bundles unchanged.

**TOTAL BLOCKS RENDERED: 18/18**

01. Planning a Cloud Migration That Does Not Disrupt Your Business
02. Building a Cloud Environment That Scales With Your Business
03. Zero Trust in Practice: What It Means Beyond the Marketing
04. Finding Security Weaknesses Before They Become Business Problems
05. Building Custom Software Around the Way Your Business Actually Works
06. Modernizing Legacy Applications Without Starting From Zero
07. Why Proactive IT Monitoring Matters More Than Reactive Support
08. Keeping Critical Systems Ready for the Unexpected
09. Designing a Network That Can Grow With Your Organization
10. Improving Network Security, Reliability, and Performance
11. Creating a Technology Roadmap That Supports Business Growth
12. Making Better Technology and Vendor Decisions
13. Choosing Between Native and Cross-Platform Mobile Development
14. Connecting Mobile Applications to the Systems Behind Your Business
15. Turning Operational Data Into Business Intelligence
16. Using Real-Time Analytics to Make Faster Business Decisions
17. The Technology Behind Effective Online Tutoring
18. Supporting Students and Professionals Beyond the Classroom
