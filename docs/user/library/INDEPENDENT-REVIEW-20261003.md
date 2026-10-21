# Independent Library implementation and visual review

**Date:** 2026-10-03 (Asia/Calcutta)  
**Verdict:** The vertical shelf and first appearance checkpoint are substantially implemented and suitable for a design checkpoint, but need correctness/accessibility corrections before acceptance as complete. No P0/P1 defect was established. Large-library List behavior and native gestures are not release-verified.

## Scope and provenance

Reviewed actual modified **and untracked** files in `C:/Users/LEGION/Desktop/Bookconnect4_library`, branch `codex/library-cover-shelf`, HEAD `f91d1b064d118aa5ee438ac05e69d14e9700260f`. Existing dirty application, package, OCR/vault, migration and documentation work was preserved. This session changed only review evidence and continuity documentation.

Read the repository entry contract, ACTIVE, DOC-13 current overlay, Phase 9 session-start/master tracker/master SDD and relevant continuity/routing/supporting records; then Library TRACKER, SDD-05, interaction map, UI/UX inventory and horizontal implementation contract. The latest explicit Library review scope controls this session. Phase 9 remains `unit7c_resumed_connected_canary_pass_main_integrated`; M46/canary/main integration is complete, and further marketplace mutation requires separate authority. Older historical handoffs do not reopen work.

Visual authority: [selected vertical preview](https://stitch.withgoogle.com/preview/5737794884356081757?node-id=93ad8bd053b54ed4b3ec666d6093a291), [captured authored HTML](./stitch-reference/vertical-spines.html), [captured reference](./stitch-reference/vertical-reference-20261002.png), with SDD-05 §§11–14 corrections taking precedence. The captured source/image supplied the reference; the external Stitch preview was not independently reopened.

Inspected Home and both route layouts; Header, FilterBar, Summary, Shelf, BookSpine, Appearance, Typography, BookList, BentoGrid, cabinet texture; both layout/filter helpers; Library query hook; Search/cache/provider/storage service flow and focused tests. Compared relevant tracked changes with HEAD and read untracked component source directly.

## Findings, ordered by impact

### R1 — P2: List is nested inside a vertical plain ScrollView

**Location:** `app/(tabs)/library/index.tsx:82` (List rendered at 101); `src/components/library/LibraryBookList.tsx:146–150`.

**Evidence:** Home wraps both modes in an unconstrained vertical ScrollView. List supplies its own vertical FlatList and RefreshControl. At 430×844, the outer scrollport was 795px high with 1,561px content; the inner List scrollports were both 1,287px high with exactly 1,287px content, beginning at y=233.6. Thus the seven-row List expands to content height and the outer page owns scrolling. The installed native VirtualizedList source explicitly warns against this same-orientation nesting because it can break windowing (`node_modules/react-native/node_modules/@react-native/virtualized-lists/Lists/VirtualizedList.js:1163`).

**Impact:** The previous bounded List container becomes an unbounded child. Large collections can lose useful viewport/window measurements; native refresh is attached to a different scroll owner. Device frame/memory cost and native refresh failure were not measured, so these consequences are a supported risk, not a claimed benchmark.

**Correction:** Use one vertical scroll owner in List mode: place header/filters/summary in FlatList's ListHeaderComponent and keep refresh on that list. Preserve an outer ScrollView for Shelf mode if needed. Verify a large fixture, last-row reachability and native refresh before acceptance.

**Classification:** Regression relative to HEAD, whose Home content was `flex:1` and had no outer ScrollView. This is structural correctness, separate from deferred compact-card styling.

### R2 — P2: Several spine colors produce insufficient title contrast

**Location:** `src/features/books/utils/shelfLayout.ts:37`; rendered at `src/components/library/BookSpine.tsx:63,87`.

**Evidence:** The helper selects pale `#f0e0d1` for four medium-light backgrounds. Base sRGB ratios are 3.69:1 on `#627a4d`, 3.38:1 on `#b8622c`, 3.39:1 on `#727a80`, and **2.70:1 on `#bd7a42`**. The live “The Science of Dune” uses `#bd7a42` with a 14px title; it is visibly weak in the [390px capture](./review-evidence-20261003/shelf-390.jpg). Texture, gradient and 0.95 text opacity complicate final pixel contrast; these figures are base-pair calculations, not a complete raster audit. All four miss the 4.5:1 ordinary-text target even before that audit. The existing Appearance tests cover surrounding UI palettes, not spine materials.

**Impact:** Essential book-identification text is harder to read, especially small rotated titles. The accessible full-title label does not make the visible title readable.

**Correction:** Select ink/light text by measured contrast over the actual label region, or add a contrasting label treatment. Cover every spine color and gradient region, retaining stable per-title color selection.

**Classification:** Defect in the current vertical material implementation; later caption work is deferred and is not a substitute for fixing visible contrast.

### R3 — P2: Reading/Completed counts use different predicates from their filters

**Location:** `src/features/books/utils/libraryShelf.ts:25–26`, versus line 37.

**Evidence:** A four-entry fixture with owned-reading, wishlist-reading, owned-completed and wishlist-completed reports Reading **2** / Completed **2**, but each filter displays **1**. All/Wishlist both agree at 4/2. Status and ownership are independently editable; `booksService.updateOwnership` does not reset reading status, so these combinations are reachable. The seven live entries do not currently exhibit this mismatch.

**Impact:** Chips promise books excluded by the corresponding view, contradicting LIB-AP03 and the summary row. Both Shelf and List inherit it.

**Correction:** Compute each chip count through `filterLibraryBooks(entries, key)` or share exactly one predicate. Add cases for wishlist entries carrying reading/completed statuses and transitions into wishlist.

**Classification:** Existing issue: these count/filter predicates are unchanged from HEAD. The new checkpoint's universal count-parity completion claim is overstated.

### R4 — P2: Brush mapping includes empty space above shorter spines

**Location:** `src/features/books/utils/shelfLayout.ts:118–126`; `src/components/library/LibraryShelf.tsx:25,108`.

**Evidence:** Resolver tests the entire 160px row band, then only the book's x bounds. Layouts carry width but no per-book y/height. The review fixture puts a bottom-aligned short book below the row's y=32 top; `touchY=33` still resolves that book although this point is above its visible top. See [raw reproduction](./review-evidence-20261003/reproductions.txt). Width mapping is correct; vertical matching is not.

**Impact:** Brush lift/haptic feedback can occur while touching bare backing above a volume, violating the requested matching render/brush geometry. The pure-function mismatch is verified; its native tactile severity remains unmeasured.

**Correction:** Add height/top to each book layout from the same metric used for rendering, and reject points above each bottom-aligned book. Test short/tall books, gaps and nonzero horizontal scroll.

**Classification:** Current retained mechanics defect; full-title captions and horizontal quick look remain separate deferred work.

### R5 — P2: hitSlop does not establish the promised 44px activation width on web

**Location:** `src/components/library/BookSpine.tsx:75`.

**Evidence:** The live DOM buttons measure 24–37px wide. In installed react-native-web 0.21, Pressable's press configuration omits hitSlop and View does not create an expanded hit region. The prop expands native Pressability regions, but supplies no web wrapper/overlay. Books have only 1–3px gaps; merely enlarging independent targets would overlap neighbors. Header/view/filter controls do meet 44px height in measured phone layouts.

**Impact:** Narrow spines retain narrow web pointer targets despite the documented ≥44px target claim; native overlap/selection priority also needs device evidence. This finding concerns the explicit project target, rather than claiming all 24px targets necessarily fail a general accessibility standard.

**Correction:** Provide a deliberate platform-specific accessible activation alternative or non-overlapping target arrangement that preserves physical widths. Verify hit boundaries between neighboring books, first/last edges, keyboard and touch before claiming 44px coverage.

**Classification:** Retained interaction issue, exposed by the new 24px minimum; native boundary behavior is unverified.

## Approved requirements versus evidence

| Contract | Actual implementation | Independent result |
| --- | --- | --- |
| Rounded clamp(20 + .04 × positive pages, 24, 44); invalid pages →32 | `spineMetrics` checks finite positive number, rounds clamped width | PASS source + fresh tests + invalid/numeric-string fixtures |
| Height 144–156, independent of pages/viewport | ID/title seed modulo 7 | PASS source/tests; seven DOM books match prior dimensions |
| Size/color stable through filtering | Stable seed/title hash, no index/viewport multiplier | PASS helpers/tests; Wishlist retains 37×144 |
| Two contiguous rows, original order, bottom alignment | ceil(n/2), flex-end | PASS tests and seven-book render; 40-book static component fixture |
| Start at 12px side, small gaps, grounded brass stop | 12px offset, seeded 1–3px gaps, 20×76 stop | PASS source/live single/multi render; empty rows have no stop |
| Continuous planks and fixed sides during overflow | Decorations outside shared horizontal ScrollView | PASS source; 40-book static fixture scrolls to last bookends with sides fixed |
| Render/brush geometry match | X widths/offsets match, full-height row hit band | PARTIAL; R4 |
| Cabinet about 440px | Explicit 440px frame | PASS DOM at 390/430 and source; 440px fixture |
| Shelf/List share loaded data and filters | Same `filteredBooks` passed to both | PASS browser all four filters in each mode; count parity has R3 edge case |
| Common appearance/header/filter controls | Shared phase tokens/provider | PASS midnight render in both modes, palette Jest for all three phases; other rendered phases unverified |
| `library_viewMode` persistence | Existing key, caught async reads/writes | PASS List reload + keyboard Shelf choice; storage failure/slow-read race not runtime-reproduced |
| Count chips equal displayed set | Different wishlist exclusion | FAIL fixture; R3 |
| Add/Search existing catalogue route | Both use existing Search destination | PASS browser; catalogue offline, no search/add submitted |
| Book activation correct user-book ID | Home routes `item.id` | PASS keyboard Dune → `ae665879-eda1-40f1-a775-7d698a861b27`; browser back restores Shelf |
| Press/hover/focus/cancel/reduced motion | Pressable, reset onPressOut; guarded transforms/haptics | Source + focused mocked press/reduced-motion tests; keyboard activation verified; real hover/cancel/touch/haptics unverified |
| List windowing and refresh preserved | Nested vertical list, refresh on inner list | R1; web scroll ownership measured; native refresh/performance unverified |
| Decorative elements excluded | Grain/sides/bookends hidden/noninteractive | PASS source, test and browser tree: no bookend focus stops |
| Spine readability and activation area | Rotated 14–16.5px titles, full accessible labels | PARTIAL; R2/R5. Long visual captions remain deferred |
| Empty/loading/error/refresh/large collection | Empty UI, timeout/retry path, unpaged query | Existing focused tests pass; browser Reading empty checked; absent live states use fixtures/source only |

## Data path and performance assessment

Search calls `searchGoogleBooksCached` at `search.tsx:154`. Fresh cache retains complete Google objects; Google success caches complete items, stale cache is used on rate-limit failure, then Open Library fallback. New catalogue records save `volumeInfo.pageCount` as `books.page_count` (`booksService.ts:284–291`). Existing catalogue records return without enrichment (315–316). Library fetches `*, book:books(*)`, ordered newest first (611–629), and its local type includes optional saved pages. BookSpine and the shared layout helper both consume that field. This path needs no new query/schema.

Manual and Open Library mappings omit pages, so 32px fallback is intentional. A browser Dune entry with no saved pages rendering 32px is not evidence of broken thickness. No live schema audit was repeated, because this was a source/UI review with no database uncertainty requiring a new schema decision. No provider metadata enrichment or live add was attempted.

Library fetch is unpaged and both shelf rows mount all books. The 1,000-entry pure fixture preserves 1,000 unique IDs and produces an 18,711px track; that establishes geometry, **not** render speed. Every mounted spine has shared values, gradients, an image and a Pressable. A native large-collection memory/frame test is necessary; no FPS, latency or heap figure is claimed. R1 adds an avoidable List scroll-ownership risk. Existing 8-second query timeout rejects without cancelling the underlying request; refresh/error recovery still warrants connected-device testing.

## Visual assessment

The intended reading-room hierarchy is recognizable: serif title, explicit mode choice, reachable filters/counts, walnut cabinet and muted cloth. Grain, contact shading, side bevels and brass improve the former flat material. The material remains somewhat regular and broad in the exposed 64px band, but the reference structure is recognizable. The softer shadow is appropriately restrained.

At 390px, cabinet x≈24.8, y≈234.4, width≈340.8 and height=440. The reference begins around y=132: the additional mode/filter/count controls intentionally move the cabinet down. It therefore shows less supporting content in the first viewport. Seven actual books occupy small left clusters; this is the approved page-count/edge-support adjustment, not missing sample volumes or an accidental failure to fill the row. Desktop keeps the 600px page cap and physical book dimensions; sparse whitespace is expected.

320px wraps Wishlist to a second line; 390/430 fit all filters on one line. Add/Search and both mode controls fit without Home horizontal overflow. List wraps status tags and truncates long titles to two lines; titles and authors remain accessible via labels/details. The current missing-cover region and oversized empty Current Read card are visible deferred work. The nine default root tabs truncate labels and expose internal marketplace routes at phone sizes; this is existing shared-navigation work, not completed in this checkpoint. Vertical scrolling reaches the complete cabinet and supporting cards; bottom tabs do not make those permanently unreachable.

The readability exception is R2. Full-title captions, compact cards and missing-cover improvements remain useful later work, but do not invalidate the verified cabinet proportions.

## Verification actually performed

- Fresh exact-path Jest command from the request: **6 suites / 47 tests PASS**. [Full raw output](./review-evidence-20261003/jest.txt). Existing Search `act(...)` and Node `punycode` warnings remain.
- Fresh `npx tsc --noEmit`: **36 errors**, all outside Library, byte-for-byte equivalent after trimming to the recorded previous diagnostic output. [Raw diagnostics](./review-evidence-20261003/tsc.txt). Full repository type check is not green.
- HTTP HTML exactly equals local `dist/index.html`; HTTP/local entry SHA-256 both `D43E182114936D7582D530ECC29180F67B0E66645139D3A0D5A5F8058D7D4435`, entry `entry-f576fb2498810ca45bbe5541399c1df9.js`. [Readback](./review-evidence-20261003/build-identity.txt). No fresh export was necessary or run. Current source paths inspected and prior checkpoint evidence are consistent with this bundle; HTTP identity alone is not a build-from-source attestation.
- Browser normal viewport; 320×844, 390×844, 430×844, 1280×720; Shelf/List, all four filters, empty Reading, single Wishlist, persisted List reload, keyboard Shelf and Dune activation, correct detail and return, Add and Search catalogue entry, below-shelf scrolling. All/Shelf and default viewport restored.
- [Read-only helper reproduction script](./review-evidence-20261003/reproduce.cjs) and [output](./review-evidence-20261003/reproductions.txt): all page validity classes, 0/1/40/1000 entries, duplicate/long titles, null covers/authors, size stability, count mismatch, palette ratios, above-book brush mismatch.
- [Actual-component static harness](./review-evidence-20261003/render-fixtures.cjs) and [HTML](./review-evidence-20261003/fixtures.html): 40 books, long/duplicate titles, null cover/author, 10,000-count controls at 320px; horizontal scroll 0→518.4, last stops visible, fixed 12px side. Platform effects/typography are mocked and no production gestures are certified by it. Temporary local fixture server/tab closed after review.
- Phase 9 continuity validator and repository diff hygiene run at close; results recorded in Library TRACKER and the scoped verification log.

Captures: [390 Shelf](./review-evidence-20261003/shelf-390.jpg), [390 List](./review-evidence-20261003/list-390.jpg), [320 Shelf](./review-evidence-20261003/shelf-320.jpg), [320 List](./review-evidence-20261003/list-320.jpg), [430 Shelf](./review-evidence-20261003/shelf-430.jpg), [430 List](./review-evidence-20261003/list-430.jpg), [empty](./review-evidence-20261003/empty-reading-390.jpg), [single](./review-evidence-20261003/single-wishlist-390.jpg), [desktop](./review-evidence-20261003/shelf-desktop.jpg), [below shelf](./review-evidence-20261003/below-shelf-desktop.jpg), [fixture start](./review-evidence-20261003/fixture-40-start-320.jpg), [fixture end](./review-evidence-20261003/fixture-40-end-320.jpg).

## Remaining verification and next actions

1. Review R1–R5 and authorize a bounded correction unit: fix List scroll ownership, visible spine contrast, count parity, per-spine brush height and web activation coverage. This review does not implement those changes.
2. Verify corrected boundaries with meaningful fixtures and native device tests: large List windowing/refresh, swipe cancellation, sound/haptics, reduced motion, overlapping target edges, keyboard focus, large text and daylight/golden renders.
3. After that checkpoint, select the next previously proposed design unit. Horizontal stacks, front covers, long-press statistics, full-title captions, compact supporting cards, missing covers and shared navigation remain **pending**. Current UI contains none of the new horizontal/quick-look/cover selector features.

No native device was exercised; no actual large live collection, online provider search/add, active-reading card, native pull-refresh, OS reduced-motion toggle, hover/cancellation sequence or storage-failure race was certified. Loading/error behavior was tested with existing mocks, not induced on live user data. No security/RLS/live-schema audit is claimed.

No application source, dependency, test baseline, local migration, live books/status/ownership/reviews/notes/pages, database or Storage was changed. Only existing local view preference was exercised and restored. Nothing staged, committed, pushed, deployed or applied. Existing unrelated changes remain uncommitted. Global marketplace handoff and mutation gates are unchanged.
