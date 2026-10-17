# Library Browser QA — 2026-10-04

## Scope and build

Reviewed the current Library web export on `codex/library-cover-shelf` at
`http://localhost:19006/library`. The local static server returns `dist`; the
served bundle returned HTTP 200 and matched the current export:

- `entry-3009c7c404666084dfc21441b1a44acf.js`
- SHA-256 `02321BE0A73522DCD1B32860F9BCFD370EE58B97B26F9FBD47F1E23C816C8464`

## Browser coverage

| Area | Result |
|---|---|
| Library filters | All (8), Reading (0), Completed (0), Wishlist (1); Wishlist shows only *The Black Swan*. Returned to All. |
| Views | List and Shelf; vertical and horizontal shelf selectors. Book details open from the horizontal shelf. |
| Horizontal shelf | Book faces remain on the planks. Upper/lower shelf labels and scroll arrows render. Next advances to the end and disables; Previous restores the initial position. The current eight-book collection does not need overflow at every width; the prior isolated 17-book fixture covers longer overflow and independent tier scrolling. |
| Arrange | Earlier/Later, cross-tier mouse drag, Undo and Cancel were exercised. Cancel restored the original order. Save was not used, so no saved arrangement preference was changed. |
| Quick Look | Chooser lists all eight books. Long-title facts fit at 320px; Escape closes and returns focus to the chooser entry point. Quick Look via the chooser and its View Details route were checked earlier in this QA session. The physical 450ms long-press gesture was not directly timed in the browser; the React Native Web responder test covers its timing contract. |
| Search | Search and Add Book entry points open Search Books. Dune query returned Open Library fallback results while Google Books was unavailable. Fiction filter selected/applied; Title A–Z and Relevance sort were exercised earlier in this session. Preview opened the public Open Library Dune record in a separate tab, which was then closed. Manual-entry form was opened and canceled. Add was not otherwise exercised after cleanup; Wishlist and Share actions were not exercised because they write live data or launch an external share action. |
| Detail | Reading status, ownership, lending, condition, rating/review, notes, saved pages and removal affordances were inspected. No status, rating, review, note or lending edits were saved. Removal confirmation explicitly warns it cannot be undone. |
| Responsive | Checked 320×844, 390×844, 430×844, and 1280×900. At 320px filters wrap and long titles truncate/wrap; page scroll reaches lower shelf, chooser, Current Read and summary cards. At 390/430px controls and cabinet fit without horizontal page overflow. At 1280px the mobile-oriented Library remains centered in a narrow column with wide side gutters. |

## Findings and limits

1. **Search provider state is confusing in this run.** The screen reported “You’re offline. Search requires internet” while also showing Open Library fallback results and a total of 48,254. Google Books results and its page-count metadata were unavailable, so those paths remain unverified.
2. **Search keyboard/accessibility needs follow-up.** The browser accessibility tree exposed Filter, Sort, filter chips, Apply Filters, and result actions as generic containers/text rather than buttons. Tab traversal moved through bottom navigation and did not reach the search field/filter controls in the observed pass. This may be a React Native Web snapshot limitation; confirm with a dedicated keyboard/axe audit before classifying it as a code defect.
3. **Filtered result count did not visibly change** after applying Fiction; the fallback still displayed 48,254. Confirm whether this is the intended provider-wide count or a stale/unfiltered count.
4. **Native behavior remains unverified:** touch momentum and gesture cancellation, pull-to-refresh, native back, screen-reader focus, reduced-motion device settings, and representative large-library performance.
5. Persistent account actions were intentionally left untouched: status/ownership/lending/condition/rating/review edits, Wishlist changes, account Save, and external Share. Thus this is broad browser coverage, not a claim that every write path has been end-to-end tested.

## Data correction during QA

While checking a no-results search state at 320px, Open Library fallback results
arrived between observations. A stale coordinate intended for “Add it manually”
activated Add on the first search result, creating a second Dune entry
(`c3dcedc6-9d5d-4097-b1a7-b5bc72679178`). The original Dune route
(`ae665879-eda1-40f1-a775-7d698a861b27`) was preserved. After the user approved
removing only the new row, the in-app Remove confirmation was accepted. The
Library returned from 9 to 8 books and the duplicate disappeared. No other
book, note, saved page, arrangement, or field was changed. This involved one
brief user-books insert and its subsequent deletion through the app; no direct
SQL or migration was used.

## Closeout

Final observed state: the test tab ended at Library → All → Shelf → Horizontal,
eight books, with the temporary viewport reset. The original user tab was left
unchanged; a read-only check confirmed its pre-existing Arrange draft remained
open and showed eight books. No source code changed; the QA report and tracker
entry are uncommitted. No staging, commit, push, deployment, migration, or Phase
9 action occurred.

## Search correction follow-up — 2026-10-04

The earlier search findings above are retained as the original QA observations.
The subsequent correction now applies supported genre and language filters to
Open Library fallback requests; marks Free/Paid as unsupported by that provider;
labels approximate totals; and reports the loaded result count when fallback
cannot apply a selected filter. Search query edits clear stale results and
invalidate in-flight responses; identical query/filter submissions are
deduplicated. Short queries and offline empty states now explain the minimum
query length and connectivity requirement. Search and modal controls expose
explicit accessible names, roles, and selected/expanded state.

Verification for the correction: **49 tests passed across 5 focused suites**
(search route, book search service, filter modal, result card, offline banner).
The fresh Expo web export succeeded. The running server's HTML and entry bundle
match local `dist`: `entry-a1b3663a792d785e8e7b56efb0e3e20e.js`, SHA-256
`DE72CAD269EC57306248BCEE00CCFA49D48BA3E2C92B985BAA0E614F288D34F1`.
Read-only browser inspection showed the Back button and Search input and did not
expose the hidden idle offline banner to assistive technology. No query was
submitted in the browser, so live provider filtering, result totals, and
keyboard/screen-reader interaction remain unverified. Focused Jest output
included existing React `act(...)` and Node `punycode` warnings plus deliberate
mocked network failure logs; all suites passed.

The full TypeScript check still has 36 diagnostics outside Library: one E2E
fixture union typing issue and `.ts` import-extension diagnostics under
`supabase/functions/_shared/imageInventory`. No Library diagnostics appeared.
Phase 9 continuity validation and `git diff --check` passed. This correction
implementation made no account-data/database/Supabase Storage/provider write or
migration. The later browser query may refresh the local Recent Searches item;
that read-only provider verification is recorded below. Changes and
documentation remain uncommitted; nothing was staged, committed, pushed, or
deployed. The app is ready for user review of the live Search result below.

## Live Search verification — 2026-10-04

The first interaction used an already-open tab with an older JavaScript entry
(`entry-ac8af888beb978e522e87f80b39c0092.js`), which still showed an offline
banner. Reloaded the existing tab; the browser then loaded the current entry
`entry-a1b3663a792d785e8e7b56efb0e3e20e.js` (matching the current local export
and served-bundle identity). The offline banner disappeared and the search was
allowed to run.

Read-only live Open Library results for “Dune” were checked in the running app:

- Unfiltered: **48,254 results**.
- Fiction: **949 results**, with Dune titles visible in the result cards.
- Fiction + English: **457 results**.
- Fiction + Free Only: **20 shown** with the message that Open Library does not
  provide pricing and therefore did not apply the Free/Paid filter.

The accessibility tree exposed named Search, Filter, Sort, remove-filter, and
result-action controls. The screenshot showed the current Search layout and
filtered result cards. No Add, Wishlist, or Share control was activated. The
“Dune” query was already in Recent Searches before this check; searching may
refresh that local history item. No book/library row, database/Supabase Storage
record, or provider record was changed.

These counts are a live provider snapshot and can change as Open Library's
catalogue changes. This verifies the fallback path and the tested filters in
this browser session; Google Books remained unavailable, and native keyboard,
screen-reader, and touch behavior remain unverified. The browser is left on
Search with “Dune”, Fiction, and English visible for review.
