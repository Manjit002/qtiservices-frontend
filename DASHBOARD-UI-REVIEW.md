# Dashboard UI review

A review of the 23 dashboard pages: 18 admin and 5 expert. It was a polish
pass inside the existing design system, not a new look. The tokens, typeface
and portal accents (azure for admin, violet for expert) are unchanged. The
public site, the sign-in screens and the 2FA logic were not touched.

## How the pages were checked

`tests/browser/visual-audit.mjs` loads every page with fixture data. It runs
each page at 1440px dark, 1440px light, 1280px and on a 390px phone, then
saves a screenshot and runs a set of checks (listed in
`tests/browser/README.md`). The pages were also reviewed by eye from those
screenshots.

| Check (23 pages)                                   | Before          | After |
|----------------------------------------------------|-----------------|-------|
| Pages that scroll sideways on a phone              | 7               | 0     |
| Pages still on the old (legacy) styling            | 5 (all expert)  | 0     |
| Tables that hide their last column at 1280–1440px  | 5               | 0     |
| Phone tap targets under 32px                       | 326             | 27¹   |
| Unnamed buttons, unlabelled inputs                 | 0               | 0     |
| Classes with no CSS rule                           | 2²              | 0     |
| Page errors                                        | 0               | 0     |

¹ The remaining 27 are expected: 23 are the theme switch, whose tap area is
already enlarged by an invisible margin, and 4 are hidden file inputs that sit
behind a visible button.
² `.spinner` was used but never styled. `.an-note` only worked on Assign
orders if Analytics had been opened first.

## Expert portal: rebuilt

The five expert pages were the last ones on the old dashboard CSS. They had
emoji icons, uppercase badges, hard-coded colours, no light theme and no
mobile layout. They now use the same components as the admin pages, and the
old stylesheets (`styles/expert-dashboard.css`, `styles/migration-additions.css`)
are deleted.

- **Dashboard**
  - Greets the expert by first name and says what needs attention.
  - Every count is a link to the matching filtered list.
  - "Up next" lists open orders, soonest deadline first, each with one obvious
    next step: Start, Submit or View.
  - Availability can be changed right on the dashboard.
- **My orders**
  - Search, a status filter with counts, and sortable columns.
  - The filter is kept in the URL, so Back and refresh keep it.
  - Open work is listed first, soonest deadline on top.
  - Each row has a single main action.
  - On a phone, rows become cards.
- **Deadlines**: overdue work and work due today, side by side, each row with
  its next action.
- **Order files**
  - A labelled order picker.
  - A drag-and-drop upload area with a progress bar for each file.
  - File-type icons, and who uploaded each file.
- **My profile**
  - Account details in a definition list.
  - Availability as a radio group that works with arrow keys. The change shows
    immediately and rolls back if the server rejects it.
- **Order detail and Submit work**: use the shared buttons, status stepper and
  deadline meter.

## Admin portal: fixes

**Layout and overflow**

- **Seven pages scrolled sideways on a phone:** Orders, Order detail, Assign
  orders, Deleted orders, Analytics, Installments and System overview.
  - The cause was CSS grid tracks declared as `1fr`, which grow to fit
    content that cannot wrap.
  - Every grid in `components/admin` now uses `minmax(0, 1fr)`.
- **Tables hid their last column on laptops.** At 1280–1440px, the Orders,
  Assign, Deleted orders, Students and Coupons tables all needed a sideways
  scroll to reach the row actions.
  - Below 1600px, cell padding tightens. This is the same point where icon
    actions fold into the ⋮ menu.
  - On Orders, Edit moves into the ⋮ menu at that width. The actions column
    takes only the width its buttons need. Subjects wrap to two lines instead
    of being cut off.
  - On Deleted orders, "Deleted at" shows the date with the time underneath.
  - Hidden tooltips no longer take up space. Before, the tooltip on the last
    icon of each row stuck out past the table edge and caused a scrollbar on
    every table.

**Content and behaviour**

- **Finished orders no longer show a red "6d overdue".**
  - Completed, cancelled and paid orders now show "Due Sep 29" in a muted tone
    with a grey bar.
  - For experts, submitted orders count as finished too: their deadline was
    met.
- **The Assign button is no longer highlighted on finished orders.** The
  highlighted button means "this row is waiting for you", and a completed
  order isn't.
- **Under an hour overdue** read "0h overdue". It now shows minutes, for
  example "32m overdue".
- **Money** is formatted with `Intl.NumberFormat` (e.g. "$18,450.50").
- **Analytics chart**
  - The y-axis labels were stretched along with the SVG. They are now real
    text in a fixed gutter.
  - Tick steps are round numbers, and counts never get fractional ticks.
- **Expert availability** only shows for people with the expert role. Admins
  no longer appear as "not available".
- **Reviews**
  - Buttons are in a safer order: Verify purchase on the left, a gap, then
    Reject and Approve.
  - Verify purchase is hidden once the purchase is verified.
- **Installments** no longer shows an empty card next to the "No order
  selected" message.
- **Grammar:** "1 order is past its deadline" and "3 orders are past their
  deadline".

**Shell**

- Sign-out is an icon button on the user row, and it stays reachable when the
  sidebar is collapsed.
- The active sidebar item scrolls into view.
- The user's name is capitalised properly ("Elena Petrova", was "elena petrova").

**Touch and keyboard**

- **Minimum tap sizes on touch screens:** 36px for small buttons, row actions,
  page numbers and filter tabs; 40–42px for the top bar and sidebar.
- **Chat:** the Reply action used to appear only on mouse hover, so it was
  unreachable on touch screens and by keyboard. It is now always shown on
  touch screens and appears on keyboard focus.

## Shared building blocks

| File | What it holds |
|---|---|
| `app/controls.css` | Shared controls: search, filter tabs, pagination, row actions and menu, tooltips, page header, stat tiles, status stepper, drop zone, note, spinner, two-line clamp, touch sizing. Imported only by the admin and expert portal layouts, so the public site never loads it. |
| `components/expert/expert.css` | Expert page layouts. |
| `components/expert/AvailabilityControl.tsx` | The availability radio group (full and compact). |
| `components/ui/FileTypeIcon.tsx` | File-type icon, used by both portals. |
| `components/admin/experts/AvailabilityText.tsx` | Availability label for expert accounts only. |

Unused components were deleted: `shared/EmptyState`, `ErrorState`,
`StatusBadge` and `StatCard`. The `ui/` versions are the ones in use. The
dead `.legacy` light-theme block was removed from `tokens.css`.

## Verification

- `tsc` and ESLint are clean, and `next build` passes.
- The browser suites all pass on the final build: login-flow 73/73, history
  65/65, quality 5/5, landing 38/38, sms-compliance 54/54.
- The quality suite had been passing for the wrong reason on expert pages. It
  seeded an admin session, so the expert pages redirected to sign-in. It now
  signs in as an expert and fails on any redirect.
- The visual audit is clean in all four views.

## Left as is

- The theme switch keeps its slim look. Its tap area is enlarged invisibly
  instead.
- Fixture counts on the expert dashboard and in the order list differ because
  they come from two endpoints. Live data will match.
