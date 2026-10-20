# Horizontal Shelf: source inspection and implementation contract

**Date:** 2026-10-02  
**Status:** horizontal layout/browsing/Arrange and the physical-material follow-up are implemented and web-reviewed. The vertical replica remains available (SDD-05 §§11–12, 20–22). Native, assistive-technology, and large-library performance acceptance remain pending.
**Latest sequencing (2026-10-05):** vertical baseline/Arrange/contact depth is committed through `e372945`; vertical realism is committed as `f8b171a`. Horizontal layout, interactions, and tier membership are implemented and web-reviewed in §§12–18. Native, assistive-technology, and large-library performance checks remain open.
**Worktree/branch:** `Bookconnect4_library` / `codex/library-cover-shelf`.  
**Horizontal scope:** keep the existing vertical/list presentations and complete the horizontal stacked shelf using the shared order; horizontal styling must fit the measured volume and shelf geometry. Spines/Covers presentation choices are outside this horizontal unit. Existing uncommitted Library work is preserved.

**Current resume (2026-10-04):** vertical Arrange/contact depth is committed as `e372945`, with vertical physical-material follow-up at `f8b171a`. Horizontal layout, browsing/quick look, horizontal Arrange and material follow-up are implemented and web-reviewed. Sections 12–13 and 16–18 own the current implementation and verification; earlier checkpoint/pending statements are historical. Native, assistive-technology and large-library performance acceptance remain unverified.

## 1. Exact reference and capture

The selected reference is **Library Home — Shelf (Horizontal Stacks)** in Stitch project `2331124625547392526`, screen `b64af6d9e5b140358fab35e66b30926f`:

- [Exact screen preview](https://stitch.withgoogle.com/preview/2331124625547392526?node-id=b64af6d9e5b140358fab35e66b30926f).
- [Captured HTML/CSS/JavaScript](./stitch-reference/horizontal-stacks.html).
- [Upper tier scrolled to the right](./stitch-reference/horizontal-stacks-scrolled.png).

The source was read from the selected screen's rendered `iframe.srcdoc` in the Stitch canvas. Stitch's injected editing/capture scripts, injected editing styles, and agent-cursor element were removed from the saved reference. Authored markup, Tailwind configuration, custom styles, List/Shelf script, and the preview's `data-stitch-css-vh` height rewrite are retained. This is a rendered-source capture, not a production React Native component or a downloaded export bundle. None of its scripts were run locally.

The previous preview node `37d7eced4f94471087a286d52d2e6eaf` is **Library - Working Reading Journey**; it is a different draft. The Front Covers screen is also a different reference. Neither supplies the first horizontal-shelf layout.

## 2. Visual structure found in source

| Element | Source contract |
| --- | --- |
| Shell | One Library header; Search and Add actions; List/Shelf control; All/Reading/Completed/Wishlist filters; five app tabs. |
| Cabinet | Fixed `height: 500px`; two tiers, each `flex-1`; rounded corners, light cabinet back, subtle dotted texture, and outer shadow. |
| Shelves | Continuous planks below each tier, outside its horizontal scroll track. Plank layers are 4 px top, 16 px gradient face, and 4 px bottom. |
| Piles | Two example piles per tier, with 4 and 3 books respectively. First pile width 256 px; second pile width 240 px; 24 px between piles; 16 px horizontal inset. |
| Volumes | Flat horizontal cloth-colored edges, title at left, uppercase author at right; first pile widths 208/224/240/256 px and heights 32/36/40/44 px; layers overlap by 4 px. |
| Palette | Ivory `#FDF9F3`, walnut `#2E190E`, brass `#C5A059`; forest `#1D3323`, cream `#F7F3EB`, navy `#1A2B3C`, terracotta `#752A1D`, purple `#30214A`. |
| Plank face | `#2E190E` -> `#24130A` -> `#1A0C06`; top `#4A2E1D`; bottom `#120703`. |
| Type | Google-hosted Playfair Display and Inter. Book-edge classes ultimately use 12 px titles and 9 px author labels. These fonts are not bundled/loaded by the reviewed application. |
| Resting state | No stats overlay and no progress panel. A later pile peeks from the right edge. |

Generated headings `Main Study`, `Essays & Discourse`, `Tier I/II`, `Archival Stacks`, and `Cabinet Overview` do not represent existing personal categories or shelf-location data. Use neutral display labels or omit them.

## 3. Behavior actually present and observed

| Behavior | Source and live-preview evidence |
| --- | --- |
| Horizontal overflow | Each tier independently uses `overflow-x: auto`, `scroll-snap-type: x mandatory`, and `-webkit-overflow-scrolling: touch`. Each pile has `scroll-snap-align: start`. |
| Actual movement | Both tracks measured 358 px client width / 552 px scroll width, with initial `scrollLeft=16`. Focusing the upper track and pressing ArrowRight moved it to `193.6000061035156`; the lower track stayed at 16. The horizontal right-scroll tool attempt did not move the track; touch/trackpad input and motion quality were not certified by this check. |
| Smoothness | Computed `scroll-behavior` is `auto`. There is no authored smooth-scroll controller. Mandatory snapping can prevent small movements from settling between piles. |
| Desktop drag | No authored mouse/pointer drag handler. A `cursor-pointer` class does not implement dragging. |
| Book feedback | Only the top book in each pile has hover translation -4 px, scale 1.01, and a larger shadow, with a 200 ms transition. No authored touch/press handler or reduced-motion rule. |
| Book tap | Volumes are `div` elements. No authored book navigation handler. Clicking the visible Midnight Library book kept the same preview screen and showed no details panel. |
| Long press | No authored timer, touch/pointer long-press handler, or book-summary/stats sheet. This must be implemented in the app. |
| List/Shelf | The authored script changes selected-button classes only. Separate Stitch prototype connections can supply navigation; this captured script is not application routing. |
| Filters/data | Static buttons and sample markup. No filtering, dynamic grouping, persistence, or library-data binding in the authored source. |

The source renders 14 sample book instances, including titles repeated across tiers. Production placement must use each actual library-entry ID exactly once; equal titles with different IDs remain distinct records.

## 4. Source defects and integration adjustments

1. `w-54` and `w-58` are used without those spacing values in the captured Tailwind config. Live book widths were content-dependent (e.g. Deep Work 141.125 px and Meditations 169.625 px), rather than an intentional taper. Set explicit, deterministic widths in the app.
2. The generation prompt named 390 x 844, the selected canvas reported 390 x 766, and the source has a minimum 884 px body with a preview-specific fixed-height rewrite. Match the cabinet composition at a defined viewport; calculate responsive height instead of copying all three conflicting heights.
3. Volume heights of 32/36/40 px are below a 44 px touch target. Use non-overlapping usable targets and readable titles, even when this changes those exact pixel values.
4. The source disables zoom and has no reduced-motion handling. The application must remain usable with larger text and reduced motion.
5. The reference includes its own fixed bottom navigation. The app already has root tabs; do not add another Library-level tab bar. The current inner Library pill bar is a no-op and overlaps the shelf according to the recorded app review.
6. Contact shadows are represented by an additional 8 px block below each pile. App book bottoms must sit on the plank; position the contact shadow at that junction so the shadow does not create a floating gap.

## 5. First implementation requirements

| Requirement | Implementation rule |
| --- | --- |
| Scope | Horizontal stacked shelf plus its real interactions. Preserve the existing normal List presentation and persisted `library_viewMode`. Do not add Spines/Covers selectors in this first pass. |
| Data | Reuse `useLibraryBooks` and the existing `getUserLibrary()` result. Shelf and List consume the same `filteredBooks`; no sample volumes, duplicate placements, invented categories, or fixed stats. |
| Placement | Split filtered entries into contiguous halves, top favoring odd counts; chunk each tier into piles of at most four. Stable ID/title-derived appearance; every book remains represented exactly once. |
| Overflow | Any number of piles may be added. Calculate content width from actual pile count. A sparse tier does not manufacture overflow or fake books. |
| Scrolling | Two independent native horizontal tracks, matching this Stitch screen. Preserve momentum; use gentle settling rather than forced jumps during dragging. Provide visible previous/next controls when overflow exists for desktop/keyboard access. |
| Gesture safety | Scrolling cancels a pending tap/long press. Scroll gestures never open a book or stats sheet. Avoid a second gesture responder competing with the native scroll track. |
| Structure | Fixed continuous planks span the visible tier; all pile bottoms share that plank baseline, including the last incomplete pile. Keep lift/shadow room clear of clipping. |
| Size | Cabinet remains the page's visual anchor and occupies over half the reference phone viewport. Account for header, controls, root tabs, safe area, and vertical page scrolling on shorter screens. |
| Tap | Every real book opens `/(tabs)/library/${item.id}`. Equal titles must route to their own user-book IDs. Returning preserves the shelf/filter context and scroll position while the screen remains mounted. |
| Feedback | Short, subtle hover feedback on web and explicit press feedback on touch, affecting the active volume. Reset on release/cancel. Reduced motion retains actions without transform animation or haptic ticks. |
| Long press | The previously requested 450 ms book quick look is an expected shelf interaction. Open a dismissible modal/sheet; suppress the release tap; include Close and View details plus an accessible alternative to the hidden gesture. |
| Truthful quick look | Use already-loaded book fields: title, authors, optional cover, reading status, ownership, condition where applicable, lending availability, personal rating/review, and known page count. Missing optional values remain absent/unknown. |
| Unsupported analytics | Do not display completion percentage, current page, reading time, streaks, or session history: no corresponding app workflow was established in the source audit. `getUserLibrary()` does not return note/page counts, so do not claim a count without an already-available count result. |
| States | Empty library, empty filter, one book, partial pile, many books, missing authors/cover, long title, duplicate title, filter reorder, and storage-read failure. |
| Dependencies/backend | Reuse existing React Native/Reanimated/Haptics/Expo Image capabilities. No migration, database/storage mutation, new query for the quick look, or new dependency is required for this UI work unit. Font asset availability/licensing must be checked before bundling the reference typography. |

Two independent horizontal tracks deliberately differ from the previous SDD-05 Stage-1 C1 synchronized-spine track. The flat-volume layout replaces vertical spine posture in this work unit. This current user-directed horizontal reference is the owning exception; the old Stage-1 verification remains historical evidence, not proof of the new behavior.

## 6. Verification and exact next action

Inspection completed: captured authored source, measured live overflow and book dimensions, verified upper-tier keyboard scrolling, and checked one visible book tap. No application code/test files were changed, no app tests/build/type check were run, and no live library data or Supabase state was queried or mutated.

**Rendered application baseline (2026-10-02):** opened the already-running web export on `http://localhost:19006` in the existing browser profile. The export's `dist/index.html` and web bundle are dated 2026-10-01; Library source files are dated 2026-08-25. At the available 1280 × 720 viewport, the Library rendered seven entries. List/Shelf switching worked; Wishlist showed The Black Swan and a count of one; tapping Dune opened its detail route and returned to the shelf. Vertical page scrolling reached the bottom of the cabinet. This viewport did not establish mobile sizing or horizontal shelf scrolling. The shelf remains the vertical-spine version: four spines occupy a small left cluster on tier one, three on tier two, and most of the cabinet is empty. The first view crops the lower tier behind a floating inner Library bar. A second root tab bar appears beneath it and exposes four raw marketplace route names. The header icon renders as `?`; the light header contrasts with the dark page; static Notes 12 and Wishlist 148 tiles conflict with the visible Wishlist count of one, and a zero-progress Current Read tile appears with no current book. The Dune detail showed its content after a brief loading spinner. No books, notes, settings, or Supabase data were changed. The seven visible rows were not reconciled with the prior tracker snapshot of eleven; this check is presentation/interaction evidence, not a database count audit.

Documentation checks passed: Phase 9 continuity validator (195 requirement definitions; no duplicates or missing traceability; 76 Markdown files checked) and `git diff --check`. Existing marketplace document-size notices are advisory. Source capture and documentation changes remain uncommitted; nothing was staged, committed, pushed, deployed, or applied.

Next authorized action: implement the horizontal shelf component, deterministic pile grouping, actual tap/press/quick-look handlers, and Library home integration on `codex/library-cover-shelf`. Inspect changes against this contract and run focused meaningful tests for grouping, gesture cancellation, correct IDs, filter parity, and quick-look data truth; then render the app and compare at a defined phone viewport and a desktop width. The existing global TypeScript failures recorded in the tracker must be distinguished from new Library failures.

The visual target is the captured composition and palette. Exact parity is not yet demonstrated; it requires the application render, matching font assets, responsive sizing, and interaction checks.

## 7. Verified build identity and current Stitch comparison (2026-10-02)

The user asked to establish whether the browser had opened an older app. The current workspace is `C:/Users/LEGION/Desktop/Bookconnect4_library`, branch `codex/library-cover-shelf`. A fresh `npx expo export --platform web --clear --max-workers 1` completed successfully (2,320 modules; 5.39 MB entry bundle). Its entry filename and SHA-256 exactly match the previous export: `entry-e164b4a7cbbb7fbd33e7f605ee62b018.js`, SHA-256 `EB750D9FBAF2E4DCFB7DF1FFAD3DD1F3BFD31CFD6FB98F8A6E5B4BDBC37EAB28`. The previous server was no longer listening during this investigation. Starting `node serve19006.js` in this worktree reported the exact `Bookconnect4_library/dist` directory. HTTP readback proved that both the served HTML and entry JavaScript match the fresh local files. Therefore the vertical shelf is the current application implementation, rather than a mismatch caused by yesterday's export or another checkout. No horizontal application replacement has been built during this session.

The user's open Stitch preview was **Library - Working Reading Journey**, node `37d7eced4f94471087a286d52d2e6eaf`; the newly opened project canvas contains multiple shelf drafts and had no selected screen. This Journey draft differs from the refined Horizontal Stacks node `b64af6d9e5b140358fab35e66b30926f` inspected earlier. The earlier findings about absent tap/long-press handlers apply only to that refined node. Journey contains authored smooth/proximity scrolling, animation/wheel damping, pointer dragging, column arrows, book-detail view switching, a 550 ms long-press timer with drag suppression, and a quick-stats modal backed by a local sample `bookDatabase`. Keyboard activation of Next Column changed the indicator from column 1 to 2; Quick Stats opened Atomic Habits at a sample 65%; the modal was closed and the preview restored to column 1. These actions demonstrate prototype interactions, not live Library data integration. [Journey source](./stitch-reference/working-reading-journey.html) and [preview capture](./stitch-reference/stitch-journey-20261002.png) retain the exact observed comparison draft. This inspection does not change the earlier implementation contract's selected node or its independent-track decision.

At a verified 390 × 844 app viewport, the fresh application still rendered seven entries as four upright spines above three upright spines. The header/Add action clips horizontally, filters wrap, and the floating inner bar and nine root tabs obstruct the lower shelf. [Fresh application capture](./stitch-reference/app-verified-20261002.png) records this result. The viewport override was reset, the temporary comparison app tab was closed, and the user's existing local app tab was refreshed against the fresh server. No application source, dependency, test, migration, or live business data changed. No stage, commit, push, deployment, or database/storage mutation occurred. Next authorized action remains the horizontal application implementation and its rendered interaction verification under the first-work-unit contract; no additional marketplace authority is introduced.

## 8. Arrange compatibility and mandatory future handoff (2026-10-03)

The earlier inspection/next-action entries are historical checkpoints. Resume from the current [Library tracker](./TRACKER.md), then read [SDD-05 §§20–21](./SDD-05-library-reading-room.md#20-arrange-shelf-shared-order-separate-dragging-2026-10-03). The first vertical Arrange implementation supplies shared state/storage and separate vertical gestures; horizontal presentation/gestures remain pending.

- Consume the same canonical sequence of Library entry IDs as the vertical Shelf. Shared draft, one-step Undo, Save, and Cancel belong to one arrangement layer; do not introduce horizontal-only order storage or a second independent draft/history.
- Project that sequence through the existing planned contiguous tier split and chunks of at most four. Drop positions within/between piles map to the common semantic move operation. Do not persist pile/row coordinates or use a title as identity.
- Implement horizontal gesture handling, placement markers, hit testing, and automatic edge scrolling specifically for this layout. The two tier tracks remain independent: auto-scroll the active destination tier and use its offset when resolving a drop. Vertical shared-track geometry is not the horizontal gesture contract.
- Reuse the small order/state operations without building a universal drag engine. Switching shelf style uses the same order and, during a draft session, preserves that draft while clearing the active gesture/measurements.
- The first Arrange interface remains Arrange/Undo/Save/Cancel, with one-step Undo. The searchable destination selector is deferred; keyboard access, reduced motion, and save failure recovery remain required.
- Reuse `src/features/books/utils/shelfOrder.ts` and `src/features/books/hooks/useShelfArrangement.ts`: semantic `move(id, beforeId|null)`, account-scoped device-only key `library_shelfOrder:v1:<userId>`, shared one-step Undo/Save/Cancel. `useVerticalShelfDrag.ts` and `verticalShelfArrange.ts` are vertical-specific examples, not a horizontal geometry engine.
- SDD-05 §20.4 records All-books editing, new IDs appended after surviving saved IDs, membership-change draft cancellation, failed-save retry and read-error recovery. Preserve those policies when adding Horizontal Stacks. Section 5's no-migration/no-new-query boundary still applies; cross-device sync requires separate design and authority.

The future implementation must verify actual independent-tier drag/scroll behavior as well as shared order identity, no lost/duplicate entries, Undo/Cancel, and save failure recovery. Existing vertical tests and Stitch prototype observations are not acceptance evidence for this work. Exact next action for a horizontal session: read this section and the current Library tracker before the authorized horizontal work; preserve the arrangement boundary rather than silently creating a separate system.

## 9. Horizontal execution plan (2026-10-04)

### Confirmed context

- Source checkpoint: `e372945`, branch `codex/library-cover-shelf`. Existing notes/OCR/vault/dependency/service/migration changes remain outside this unit.
- Read current Home, Shelf, Spine, shared arrangement hook/order helpers, vertical drop/controller, typography, appearance, book chooser, Library contract and marketplace continuity routing. Home owns the arrangement hook and filters; List uses its own FlatList viewport. Preserve these boundaries.
- Actual authenticated app browser renders eight entry buttons, Arrange, all four filters, List/Shelf and the title chooser. This is a presentation observation, not a new database audit or fresh build identity verification.
- The user's other open Stitch tab is Club Management, project `12334872055044206539`. Opened and visually confirmed the documented horizontal Library reference `b64af6d9e5b140358fab35e66b30926f` in project `2331124625547392526`: light cabinet, two planks, flat colored books in tapered piles, next pile peeking at the right. Existing captured HTML supplies source details. No Stitch design was modified.
- Existing local EB Garamond/Manrope fonts and cloth/wood assets are available. Reference Playfair/Inter are not locally bundled. Use the established Library fonts for the first checkpoint and explicitly report this difference from Stitch.
- The current entry type exposes title, authors, cover, page count, reading status, ownership and lending availability. The library service selects the full row/join; optional rating/review/condition must be traced to existing row types before exposing them. No additional query is needed or planned.

### Checkpoint A — deterministic layout and integration

1. Add pure `horizontalShelfLayout.ts`: same contiguous half split (upper tier gets odd remainder), each tier chunked into piles of at most four. Canonical order reads top-to-bottom within a pile, then left-to-right across piles, then the lower tier. Every real entry ID appears once.
2. Compute complete layout rectangles from one geometry function used by rendering and later hit testing. Baseline pile width 256px, gap 24px, inset 16px; taper faces from narrower at top to wider at bottom. Keep all pile bottoms on the same plank, including partial piles. At narrow widths, cap pile width to available viewport while preserving a next-pile cue only when actual overflow exists.
3. Volume thickness uses known page count, clamped to a usable 44–52px face; missing/invalid pages use a fixed 46px fallback. Treat these as visual estimates rather than physical measurements. Avoid overlapping targets or negative margins. Title at left (15–16px), author at right where space permits; long/missing metadata remains usable through full labels and chooser.
4. Add `HorizontalBookVolume.tsx` and `LibraryHorizontalShelf.tsx`, with static cloth edges/contact shadows, continuous planks outside scroll content, and two independent horizontal tracks. Reuse appearance/material primitives without refactoring the working vertical renderer.
5. Add Shelf-only Vertical/Horizontal selector to Home; preserve List/Shelf and its existing key. A separate `library_shelfStyle:v1` preference defaults/falls back to vertical. Shared arrangement hook remains in Home. Style change clears transient gestures/selection/measurements but preserves shared draft/order. Disable style change while saving or dragging.
6. Cabinet target is roughly 500px at the reference phone viewport, with at least four usable faces per tier; calculate a minimum from stack/text geometry. On shorter screens let the page scroll instead of shrinking book targets. Match at defined phone/desktop sizes before claiming parity.

### Checkpoint B — browsing and quick look

1. Native momentum scrolling; no mandatory snap or custom wheel damping. Previous/Next controls appear for actual overflow, move one pile with animation (instant with reduced motion), and reflect track boundaries. Each tier retains its own offset while mounted; clamp after filter/membership changes.
2. Tap routes by Library entry ID. Hover/press gives a small lift and stronger shadow without opacity fading the title. Touch movement/scroll cancels tap and the 450ms quick-look timer; timer completion suppresses release navigation. Native gesture cancellation requires verification.
3. Add dismissible quick-look modal with Close/View details and an explicit accessible alternative to long press. Use loaded facts only; optional cover/metadata absent when unknown. No invented progress, reading-time/streak data, or note/page count. Verify focus entry/return, Escape/back and scroll cancellation.
4. Keep browsing and Arrange mutually exclusive: in Arrange, touch selects the book, quick look/detail opening is suppressed, and a separate selected-book drag performs moves. Reuse chooser and Earlier/Later alternatives.

### Checkpoint C — horizontal Arrange

1. Add `horizontalShelfArrange.ts` and `useHorizontalShelfDrag.ts`; reuse `move(id,beforeId)`, one-step Undo, Save/Cancel and account-scoped storage unchanged.
2. Resolve drop against destination tier, pile and book boundary using that tier's scroll offset. Compute insertion after removing the dragged ID, then constrain to the requested tier's final slots, preserving the independently corrected boundary rule. Marker must agree with projected final layout.
3. Drag overlay lives outside both scroll tracks. Source remains hidden during drag with no duplicate interactive book. Automatic edge scrolling affects only the active destination tier; update target after every scroll frame. Invalid drops and gesture cancellation leave the draft unchanged.
4. Preserve All-books editing, append/prune reconciliation, membership-change cancellation, truthful save failure recovery and read-error handling. Switching style retains draft; screen blur cancels it as today.

### Checkpoint D — verification and handoff

Existing user requests authorize checking the app. Implementation verification must cover pure grouping/sizing/drop boundaries (0/1/odd/partial/large libraries, duplicate titles, missing pages), scroll/long-press cancellation, correct routes, quick-look truth, style preference recovery, and shared Arrange behavior across styles. Run focused Library suites, export and TypeScript diagnostics, separating existing errors from new Library errors. Establish served/local bundle identity before browser acceptance. Use temporary fixtures for overflow instead of adding live books.

Compare app and reference at 390×844 plus 320/430px and desktop; check both tier scroll offsets, control limits, tap/quick look, selected drag across pile/tier boundaries, edge scrolling, Undo/Cancel and reload persistence. Restore any temporary saved-order preference. Native/assistive/performance results must be marked unverified unless actually exercised. Update owning contract, Library tracker and scoped continuity evidence after each checkpoint. No new dependency, backend/schema change, database/Storage write, commit, push or deployment is included.

**Planning closeout:** this session changes documentation only. No new source, tests, build or browser interaction acceptance is claimed. Next authorized action: implement Checkpoint A's pure layout and Shelf-style integration, then compare its rendered composition before Checkpoints B/C. The full unit remains incomplete until D; a visual checkpoint is not feature acceptance.

## 10. Checkpoint A implementation and visual review (2026-10-04)

The user authorized proceeding after the plan. Implemented `horizontalShelfLayout.ts`, `HorizontalBookVolume.tsx`, `LibraryHorizontalShelf.tsx`, `LibraryShelfStyleControl.tsx`, Home integration and a truthful Arrange hint. Two tiers independently scroll real data; chunks contain at most four entries. One geometry result supplies pile/volume rectangles for future drop testing. Page-based thickness is `round(clamp(42 + pages*0.015,44,52))`, 46px fallback; larger text scales height. Initial centered taper used 16px steps capped to 6%; the user's subsequent alignment refinement in §11 supersedes that placement. Appearance uses the established title palette, cloth assets and EB Garamond/Manrope. Author tags show the last token of the first nonempty author where width permits; accessible labels/chooser retain full authors.

At normal text size, each tier's track is 244px with a 20px continuous plank; cabinet height 528px. This is a deliberate increase from Stitch's 500px to accommodate four separate usable book faces and label clearance. Piles start 16px from the left and are 256px maximum, with 24px gaps; smaller viewports cap width. Every pile, including an incomplete one, ends exactly at the plank. Scrollbars are hidden because the browser's consuming scrollbar clipped bottom faces; next-pile visibility/caption signal overflow. No mandatory snapping, wheel controller or synthetic books.

`library_shelfStyle:v1` restores vertical/horizontal with vertical fallback for invalid/failed reads; late reads cannot override an explicit choice. Selector exists only in Shelf and is disabled while saving/dragging. Style switches remount geometry/selection while preserving the single Home-owned draft/order. Horizontal selection, chooser, Earlier/Later, shared Undo/Save/Cancel work; the hint does not promise horizontal drag yet. Long press/quick look, press-lift animation, explicit Previous/Next controls and horizontal drag/edge scrolling are not implemented by A. Existing vertical gestures and List behavior remain.

Fresh focused tests/build/bundle identity and live facts are recorded in [checkpoint evidence](./horizontal-layout-evidence-20261004/README.md). Live eight-book library has one pile per tier and therefore no overflow at tested widths. The isolated 17-book fixture verifies overflow without altering live entries; mocked fonts/images/theme mean it is not full app/native/performance evidence. Composition preserves the current app's time-of-day shell and adds orientation/Arrange controls, so it is not pixel-identical to the static Stitch shell. Shared root tab-route clutter remains outside this work unit.

Next checkpoint is B: explicit overflow controls, motion-safe hover/press and loaded-facts quick look with scroll cancellation; C follows with separate horizontal drag geometry. Complete feature acceptance remains pending B/C/D and native/assistive/performance verification. No commit/push/deploy/database/Storage change is authorized by this checkpoint.

## 11. Alignment refinement (2026-10-04)

The user accepted the layout and requested better alignment. Each pile now has a common left spine edge (`volume.x = pile.x`), so title starts share one rail. Width taper remains on the right edge only: 8px maximum per level, capped to 3% of pile width. Tier labels use the same shared inset constant. Author tags have a fixed 52px slot (28% maximum) with right alignment. Selection/focus uses a decorative inset outline instead of changing the book border width, keeping text positions stationary.

Only the geometry helper, volume and horizontal cabinet changed in source. Book heights, cabinet height, pile grouping, content widths, ID sequence, shared order/draft, preferences and routing remain unchanged. Existing geometry/Shelf integration suites PASS 47/47 in two suites; fresh web export and served/local identity PASS. Authenticated 320/390/430px measurements show every pile's four book edges at x=40 and title starts at x≈63.8, with zero plank gap. The viewport was reset and app left All/Shelf/Horizontal. No preference/order/data writes or publication occurred during this refinement. No fresh TypeScript/native/assistive/performance checks; prior baseline is historical. [Capture](./horizontal-layout-evidence-20261004/alignment-390.jpg), facts and raw verification logs are in the existing evidence folder. Checkpoint B remains next.

## 12. Browsing and horizontal Arrange implementation (2026-10-04)

The user explicitly authorized completing the remaining scope. B/C are implemented; D has automated and browser web evidence. Native/assistive/performance acceptance is not claimed.

### Browsing

- Independent Previous/Next buttons appear only for real overflow, have 44px targets, advance one pile and reflect boundaries. Native momentum remains; no mandatory snapping or wheel controller. Reduced motion makes control/chooser scrolling instant.
- Volume feedback lifts the decorative face 2px over 150ms with a stronger shadow. Targets stay stationary; labels stay opaque. Reduced motion removes transform animation and preserves actions/focus.
- The platform press responder waits 450ms for quick look. Movement over 8px, touch cancellation or track scrolling invalidates pending hold/tap; a completed hold consumes release. Arrange suppresses quick look/detail opening.
- `LibraryBookQuickLook` has Close, backdrop dismissal, Escape/native-back wiring and View details by Library-entry ID. Close receives web focus; the web Modal focus trap returns focus to the trigger. Native screen-reader focus remains unverified.
- Facts are loaded title/authors/optional cover, reading status, ownership, valid pages, recognized condition, lending availability, personal rating/review. Optional condition/rating/review are projected from existing loaded rows. Missing values remain absent/Not recorded. No query, progress percentage, duration, streak or invented notes count. The chooser offers a visible per-entry Quick look action.

### Separate horizontal gestures, shared order

`horizontalShelfArrange.ts` uses the destination tier's own offset to resolve pile/book boundaries. It removes the dragged ID before semantic insertion, bounds the final slot to the requested tier and projects the complete final layout for the marker. Marker and actual final book rectangle agree at the half-split boundary.

`useHorizontalShelfDrag.ts` owns measured coordinates, selected-book pan, opaque noninteractive overlay outside tracks, hidden source and animation-frame edge scrolling. Only the valid destination track advances, bounded by real overflow. Outside/plank drops and cancellation leave the draft unchanged. Membership, viewport/text-scale changes, blur/disable and stale measurement callbacks cancel safely. Home locks outer scrolling and style switching during drag; other books/empty space scroll normally.

Shared `shelfOrder`/`useShelfArrangement` and account-scoped device storage are unchanged: Earlier/Later, one-step Undo, Save/Cancel, read/save recovery, append/prune reconciliation, membership cancellation and drafts across style switching remain shared with Vertical.

### Verification and handoff

Focused Library run: **134 tests / 11 suites PASS**, including a real React Native Web press-responder fake-clock check at 449/450ms, cancellation/release suppression, quick-look truth/missing facts, reduced motion, controls, projected drops for 1/2/3/4/5/8/9/17/902 entries, destination-only frame scrolling and canceled/stale gestures. Existing shared/vertical regressions remain green. Initial failures were incorrect half-split expectation, a host/composite property assertion and nonexistent test path; corrected with logs retained. An introduced hook-test inference diagnostic was corrected; final TypeScript retains 36 existing errors outside Library, zero Library diagnostics. Fresh export, served-identity limitation and responsive facts are in the evidence README.

Authenticated checks: Dune loaded-facts panel, Escape/focus return, actual mouse drags both tier-boundary directions, Undo/Cancel. Account Save was not invoked. Isolated 17-entry fixture uses actual gestures/layout/shared state with mocked fonts/theme/images/icons/router: independent arrows, next-pile drag with upper-only scroll 0→111.2px, Save/reload. Its initially consuming outer scrollbar resized the viewport when locked, correctly canceling drag; the wrapper now hides it exactly like Home. Fixture storage is a synthetic key on port 19010, isolated from the account and reset at closeout.

Native touch momentum/gesture loss, physical reduced-motion settings, native back/assistive focus and representative large-library frame-rate performance remain NOT_RUN. The 902-entry test establishes ID/drop correctness only. Source/docs remain uncommitted; no dependency, schema/migration, books/database/Storage mutation or publication. Exact next action: user review of the completed horizontal web implementation; native acceptance remains a separate verification gate.

## 13. Horizontal physical-material refinement (2026-10-04)

This records the first material pass; section 14 records the subsequent refinement accepted for implementation after the user compared it with Vertical.

The user asked that the physical treatment developed for vertical spines be carried into the horizontal stacks. The existing horizontal volume and shelf boxes remain the source of layout and interaction geometry. `HorizontalBookVolume.tsx` adds cloth-face light falloff, a narrow inset cover lip, a raised binding ridge, a thin paper block with three page rules, and a deeper resting shadow. `LibraryHorizontalShelf.tsx` warms the interior wood, increases shared grain visibility, adds subtle inner cabinet rails and a floor contact shade, and gives each fixed plank a separate top plane, front face, two board joints, and underside. Decoration is pointer/accessibility inert and stays inside the existing book frame.

Web evidence: after a fresh Expo export (2,341 modules), the authenticated local app reloaded All/Shelf/Horizontal with the existing eight entries. The app was scrolled to inspect the lower tier and chooser/current-read areas; no book selection, reorder, or filter action occurred. One pile per tier was visible, so this screen did not exercise overflow scrolling. This is a visual checkpoint, not new automated/native/assistive/performance evidence. Shelf metrics, pile projection, independent scroll tracks, visible book bounds, drag/drop calculations, and saved ordering were not changed. The Horizontal style preference was set through the app and persisted. The horizontal component files were already untracked at this checkpoint; the separately authorized vertical commit contains only the four tracked vertical/material source files. No database change occurred.

## 14. Horizontal realism parity with the vertical cabinet (2026-10-04)

After comparing both actual layouts, the user authorized the missing physical cues. The horizontal cabinet now uses the same recessed walnut wall palette and grain strength as Vertical, with a 10px top cap, continuous 12px wooden side supports, inside-edge/ceiling/floor shading and textured plank faces. Supports are decorative overlays within the existing geometry; no border or padding changes the frame measurement, tier height, book bounds or drag coordinates. Tier labels and empty-state copy use light text on the dark wood.

The horizontal book face applies the vertical spine's five-stop convex light profile along its thickness axis. Cloth is rotated into the lying-book orientation instead of stretching the upright texture across the face. A stable ID/title seed selects raised end ribs and a 4px/7px paper edge; cover lips, a binding crease and stronger individual/contact-edge shadows give each volume depth. The shadow wrapper is separate from the clipped face. Title and author text retain opaque matching-color backgrounds, so decorative lighting and texture do not change the palette's title contrast. The existing aligned left rail, right taper, measured page-count sizing, ordering and interaction state machine remain authoritative.

Verification actually run: four existing horizontal geometry/arrangement/drag/press suites, **32/32 tests PASS**. TypeScript: **36 existing diagnostics outside Library, zero Library diagnostics**. Fresh Expo export generated `entry-4b1dc543240303ea96173d1793ed5f83.js`; served/local HTML and bundle match; authenticated browser observed that entry. Bundle SHA-256 `AC3570BD790800DCC006EAA14D362B01B64BFBDA671B7741A5F95D0FB5097424`.

Live browser checks covered the default 581px pane and 320px width, both tier surfaces, readable empty Reading state, Dune detail navigation/return, Arrange selection, actual mouse drag of Dune before the first upper book, Undo restoring the original sequence and Cancel. No Save was invoked. Default viewport was restored; the app remains All/Shelf/Horizontal with eight entries and the original saved order. [Final cabinet/book capture](./horizontal-layout-evidence-20261004/horizontal-realism-finish.jpg). This account has one pile per tier, so it did not exercise live overflow. Native rendering/gestures, assistive focus and representative large-library performance remain unverified.

Only the two existing horizontal presentation components and scoped documentation/evidence changed in this pass. Existing untracked horizontal files and unrelated user changes were preserved. No dependency, schema/migration, database/Storage write, credential, stage, commit, push or deployment. Exact next action: user visual acceptance of this horizontal material refinement. Phase 9/M46 status and mutation authority remain unchanged.

## 15. Keep hover and keyboard focus independent (2026-10-04)

The independent Luna Max review reproduced a caption-state mismatch: pointer leave cleared the shared active-book ID even while keyboard focus stayed on that book. `HorizontalBookVolume` now labels interaction changes by source (`hover` or `focus`); the shelf keeps separate IDs and resolves the visible caption with keyboard focus first, then hover. Leaving a hovered book can clear only the hover ID, and blur can clear only the focus ID. Starting a shelf scroll clears hover feedback while preserving actual keyboard focus. Membership and Arrange-mode resets clear both sources together. No title geometry, routing, drag, saved order, or data changes.

Luna Max independently reviewed the source and passed 68 tests across five focused horizontal/Library suites. In the app, Dune keyboard focus displayed the caption, focus movement updated it and leaving focus cleared it; book data/order were untouched. The exact mixed sequence (keyboard focus on A, pointer-only enter/leave on B) could not be reproduced with the available browser actions, which expose click/drag but no pointer-only movement. Separate source-state handling addresses the race, while that simultaneous input sequence remains unverified in-browser. Native screen-reader testing remains outside this web correction.

## 16. Independent Horizontal tier membership (2026-10-05)

The user approved a focused correction after the independent review found that the old cross-tier move only reordered a single list split into balanced halves. Horizontal Arrange now keeps explicit top/bottom membership: moving one book to another tier changes that book's membership only, while preserving the other books' memberships. The destination drop anchor reorders the shared Library-ID sequence so List and Vertical continue to use the same canonical order. Within each Horizontal tier, visible order is the shared sequence filtered by tier membership.

### Storage and reconciliation

- Current storage key: `library_shelfOrder:v2:<userId>`; legacy fallback: `library_shelfOrder:v1:<userId>`.
- Current payload: `{version:2,ids:[...],tiers:{top:[...],bottom:[...]}}`. The tier arrays partition the saved IDs exactly once; runtime layout uses IDs, not coordinates or titles.
- A legacy v1 order is read without mutation and gets the existing balanced split. The next successful Save writes v2. No database field, migration, network request, or cross-device sync is involved.
- New IDs append to the saved shared order and join the shorter tier, with ties assigned to the upper tier. Removed IDs are pruned. An in-progress draft still cancels when collection membership changes.
- Earlier/Later remains a shared-order action. Vertical keeps its existing order-based balanced rows; Horizontal restores the saved tier assignments when the user switches back.

### Interaction and recovery

`resolveHorizontalShelfDrop` uses the destination tier's actual membership, pile geometry and independent scroll offset. It supports an empty destination tier and previews the final book rectangle using the projected order plus tier assignments. A completed drag updates one draft snapshot; Undo restores both order and memberships, Cancel discards both, and Save writes the complete v2 arrangement. Failed Save retains the draft using the existing retry behavior.

Focused verification for this unit: **94 tests / 7 suites PASS**, covering unequal tier lengths, single-book transfer with unchanged neighbor membership, an empty destination, legacy v1 read-through, v2 read/write, Undo/Cancel and destination-tier geometry/scroll targeting. Fresh Expo web export PASS (2,341 modules; entry `entry-1da861284975272178982ae872ed1e22.js`). Global TypeScript still reports the existing 36 diagnostics outside Library; no Library source diagnostic was emitted. `git diff --check` PASS. The authenticated local browser rendered Horizontal/Arrange with 33 books and was returned to All/Shelf/Vertical after canceling an unsaved test draft. A live cross-tier drag attempt produced no drop marker or membership change, so browser transfer and reload persistence are **not** claimed verified. Native gesture, assistive-technology, and representative performance checks remain separate gates; the tracker records the next exact action.

## 17. Horizontal tier-transfer web acceptance and focused coverage (2026-10-05)

The dedicated Edge acceptance test `e2e/library-horizontal-arrange.spec.ts` uses a fresh browser context, mocked OTP/Supabase responses, and four synthetic books. It exercises the rendered gesture from upper to lower tier, confirms only the dragged book changes tiers, invokes Undo, repeats the transfer, saves the device-only preference, reloads, and confirms the saved membership and neighbor tiers. It passed **1/1**. No authenticated account, live database, or live storage was used.

The first attempt exposed test-harness port reuse: Library Playwright targeted `8081`, which is the other worktree's development port, and silently attached to the wrong screen. The Library static test server/config now use port `8084` and do not reuse an existing server. A fresh Expo web export passed with `--max-workers 1` (2,341 modules); the default Metro/Playwright parallel workers hit Windows `spawn EPERM` in the sandbox. The Edge test passed against the Library export on its own server.

Focused Jest coverage was rerun for **129 tests across 7 suites** and nine shelf/arrangement source files. Aggregate coverage is **92.79% statements, 87.14% branches, 91.75% functions, and 96.58% lines**. These percentages describe only the selected Horizontal shelf and shared arrange modules, not the full Library or repository. The lowest source-file results are `LibraryBookPicker.tsx` at 80% function coverage and `LibraryHorizontalShelf.tsx` at 76.92% function coverage. Remaining uncovered paths include chooser open/close, shelf overflow-arrow and Earlier/Later handlers, some edge-scroll guards/timing branches, hover/focus/context-menu feedback callbacks, malformed persisted input, and invalid projected-book fallback. The core cross-tier transfer/persistence path is covered by the isolated browser test.

Verification limits: the repository-wide TypeScript command still reports its existing 36 diagnostics in unrelated E2E/Phase 9 image-inventory files; none points to Library or the new acceptance spec. Native touch/gesture behavior, native screen-reader/focus behavior, non-Edge browsers, and large-library frame-rate/performance remain unverified. Session closeout passed `git diff --check` and the Phase 9 continuity validator (195 definitions, zero duplicates/missing traceability, regression probes PASS, 76 Markdown files / 55 required files); size notices remain advisory. No Library/database/storage data was changed, and no files were staged or committed.

## 18. Scoped commit and next action (2026-10-05)

The horizontal shelf implementation, its focused tests, isolated Edge transfer/save/reload test, corrected Library Playwright port, and horizontal layout evidence are committed locally. Search, OCR/vault, notes, marketplace, and other unrelated worktree changes were left outside this checkpoint. No database, Storage, provider, migration, or external service was changed; nothing was pushed or deployed.

**Exact next action:** user reviews the completed horizontal web behavior. Native touch/gesture, assistive-technology, non-Edge browser, and representative large-library performance checks remain separate acceptance gates.
