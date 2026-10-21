# Independent Library Corrections Review — 2026-10-03

**Verdict: corrections required.** Four corrected behaviors are supported by current source and focused verification. One R2 defect remains: the shelf entrance animation applies parent opacity to the otherwise passing text/background contrast pair. The authenticated app tab was not available for read-only UI interaction, so live responsive, refresh, persistence, and detail-return checks remain unverified.

## Scope and app identity

Reviewed the current worktree at `C:/Users/LEGION/Desktop/Bookconnect4_library`, branch `codex/library-cover-shelf`. Existing modified and untracked files were present before the review and were preserved. This review did not edit application code, tests, package files, migrations, or user data.

The local server at `http://localhost:19006` served the current worktree export. The `/library` route returned the same 1,414-byte HTML as `dist/index.html`; its entry was `dist/_expo/static/js/web/entry-6b59ba95a006a51221f5b511c7441570.js`. Local and served entry bytes matched, with SHA-256 `A1EE0A8FEAFB012EA4C0EBB037FE9B02682C945666100B4B28F3C63867620190`. A fresh `npx expo export --platform web --max-workers 1` also passed and produced that entry bundle (2,329 modules; 5,399,431 bytes).

This verifies which worktree build the server served; it does not verify the authenticated app UI. During browser inspection, the in-app browser had an unrelated ChatGPT tab and review-created local fixtures, but no authenticated `localhost:19006/library` tab. I did not open a new authentication context or interact with Library data. I closed only the fixture tabs; the final browser inventory retained the unrelated ChatGPT tab. The running app’s controls, live filters, refresh, reload persistence, detail return, and actual Dune spine therefore remain unverified.

## R1–R5 status

| Correction | Status | Evidence and remaining boundary |
| --- | --- | --- |
| **R1 — List scrolling and refresh** | **Partially resolved** | List mode now has a single bounded vertical `FlatList`; its header carries the Library controls and `RefreshControl` calls the existing query’s `refetch`. Focus restoration is implemented. Focused tests pass, and a simulated 1,000-book web List remained windowed and reached its last book. Authenticated UI refresh, mode reload persistence, and native refresh/windowing were not exercised. |
| **R2 — Spine-title contrast** | **Partially resolved** | All 14 settled palette pairs pass 4.5:1 (minimum 4.63:1); “The Science of Dune” is 5.80:1 using `#bd7a42` and `#080604`, versus the historical 2.70:1. The label background is opaque within the spine and title opacity is the default 1. The parent shelf fades from opacity 0 to 1 over 800 ms, however, so the composed pair falls below 4.5:1 during entrance (finding below). No authenticated rendered-pixel/antialiasing audit was possible. |
| **R3 — Filter-count parity** | **Resolved** | Chip counts now call the same `filterLibraryBooks` predicate as their collections. Tests cover wishlist entries with reading/completed statuses, null ownership, empty data, and ownership transitions. The independent simulated collection also exercised all four count/filter pairs. No live entries were changed. |
| **R4 — Brush-feedback bounds** | **Partially resolved** | Shelf layouts now use the same spine width, height, and offset metrics as rendering. Tests cover short/tall top and bottom books, exact top/bottom edges, gaps, out-of-bounds points, and nonzero horizontal scroll. Filtering clears the lifted ID and resets scroll; touch end/cancel clears the lifted ID in source. Native touch cancellation, gesture arbitration, sound, and haptics were not exercised, and there is no explicit automated touch-cancel event test. |
| **R5 — Accessible book activation** | **Resolved in source/tests and isolated web fixture** | A nonempty Shelf has a named bounded chooser with independently activatable full-width rows. The isolated fixture verified scroll, focus containment, Escape dismissal/focus return, duplicate-title selection by entry ID, and closure after data replacement. This alternative addresses access to narrow spines; the physical 24–44 px spines themselves still do **not** have 44 px activation widths. Native screen-reader/touch behavior and the authenticated detail route were not exercised in the running UI. |

## Actionable finding

### P3 — R2 contrast falls below target during the shelf entrance fade

**Location:** `src/components/library/LibraryShelf.tsx:33,45–48,82–85,160`; label treatment in `src/components/library/BookSpine.tsx:84–89`.

**Reproduction:** Open Shelf with reduced motion disabled and observe the first 800 ms. `LibraryShelf` initializes `shelfOpacity` to 0 and animates it to 1; the animated style is placed on a wrapper around every spine, including each text label and its colored label background. At settled opacity 1, current palette calculations pass (minimum 4.63:1; Dune 5.80:1). Calculating the foreground and label-background composites over the page during the same fade gives a minimum of about 2.97:1 at parent alpha 0.75 and 1.97:1 at alpha 0.5 across the palette/backing combinations reviewed. These are color-composite calculations, not sampled rendered pixels.

**Expected:** The title/background pair stays at or above the stated 4.5:1 target whenever the title is displayed.

**Actual:** The settled pair passes, but ancestor opacity composites both title and label background toward the page while the entrance animation runs, reducing their effective contrast below target temporarily.

**Recommendation:** Keep the title and its opaque label region out of the opacity fade, or remove/replace the parent opacity animation so the contrast pair remains intact throughout entrance. Then verify the rendered state and recompute the pair against the actual backing. This is the only actionable implementation correction established in this rereview.

The current-source static shelf render showed the Dune title legible in its settled label, but the narrow physical-spine caption is ellipsized (`The Science of D…`). The full title remains available through the spine’s accessible label and chooser. Full-title captions are deferred by the request and are not raised here as a separate correction. No antialiased-pixel contrast claim is made.

## Verification performed

### Focused Library tests

Fresh explicit-path command from the request:

```powershell
npx jest --runInBand --runTestsByPath `
  'src/features/books/utils/__tests__/shelfLayout.test.ts' `
  'src/features/books/utils/__tests__/libraryShelf.test.ts' `
  'src/components/library/__tests__/LibraryShelf.test.tsx' `
  'src/components/library/__tests__/LibraryBookPicker.test.tsx' `
  'src/components/library/__tests__/LibraryAppearance.test.ts' `
  'app/(tabs)/library/__tests__/index.test.tsx' `
  'app/(tabs)/library/__tests__/search.test.tsx' `
  'app/(tabs)/library/__tests__/[bookId].test.tsx'
```

**Result: 8 suites, 72 tests passed.** Existing Node `punycode` deprecation and Search React `act(...)` warnings appeared.

### TypeScript and web export

- `npx tsc --noEmit`: exit 2, **36 diagnostics**, exactly matching the recorded baseline diagnostic lines (`DIAGNOSTIC_DIFF=NONE`). No Library or NoteEditor diagnostic appeared. The repository type check is not clean.
- `npx expo export --platform web --max-workers 1`: **passed**, 2,329 modules. Served HTML and entry bytes matched the local fresh export as recorded above.

### Isolated simulated-data fixtures

No authentication, database, service, or live Library data was used by these fixtures.

- A freshly compiled fixture used the current `LibraryBookList`, `LibraryBookPicker`, `LibraryHeader`, filter, and summary sources with 1,000 simulated books. The List mounted 40 rows initially at 1,280 px width; across 86 scroll steps it reached book 1,000, with a peak of 89 mounted rows. Selecting the final entry returned fixture ID `independent-999`. This demonstrates web List windowing and last-row reachability for this fixture only; it is not Shelf scalability or native performance evidence.
- At 320×844, the List occupied a bounded 272×690 px area without horizontal page overflow. At 390×844, 430×844, and 1,280×720, the measured List widths were 342.4, 382.4, and 552 px respectively, also without horizontal page overflow.
- The simulated chooser at 320×844 had a 272×557.2 px bounded panel, 44×44 px Close control, minimum 64 px rows, and a scrollable internal list. It reached later rows, contained keyboard focus during 45 Tab presses, and Escape closed it and returned focus to the opener. Duplicate titles selected the requested fixture’s distinct ID; replacing the data closed the chooser. Empty Shelf data had no chooser opener. These are isolated web fixture results, not authenticated application behavior.
- A separate current-source static render of the actual `LibraryShelf`/`BookSpine` components used 40 simulated books and mocked platform effects. It supported inspection of settled-state material integration and caption clipping only; the harness does not exercise production animation, touch, or haptics.

## Regression and remaining verification

Source and focused tests retain the page-count width formula `round(clamp(20 + 0.04 × pages, 24, 44))`, 32 px fallback, seeded 144–156 px heights, 440 px cabinet, shelf contact, support, gaps, bookends, order, existing IDs, and detail navigation. Filter selection resets the Shelf scroll position and lifted ID. Both modes use the same filtered collection.

The actual authenticated running UI remains unverified because its tab was not present. Native refresh, large-collection performance, touch cancellation/gesture behavior, haptics, reduced-motion rendering, and native assistive technology remain NOT RUN. The fixture and settled-state contrast calculations do not substitute for those checks. Deferred captions, Quick Look, search/sorting, horizontal/front-cover layouts, compact cards, and shared-navigation cleanup remain outside this correction review.

## Data and Git state

No live book, ownership, status, rating, review, note, or saved page was added, changed, or deleted. No database or Storage write, migration, provider enrichment, or external service mutation occurred. No file was staged, committed, pushed, deployed, or applied. Pre-existing modified/untracked workspace files were preserved. The retained Git-visible review changes are this report and the scoped Library/Phase 9 tracker notes. The Expo export regenerated ignored `dist` output; temporary fixture artifacts were removed and review-created servers were stopped at close.
