# Horizontal Shelf: source inspection and implementation contract

**Date:** 2026-10-02  
**Status:** Stitch reference inspected; horizontal implementation remains pending. The user-selected vertical replica and approved page-count/edge-support correction are implemented and checked in the running app (SDD-05 §11–12).  
**Latest sequencing (2026-10-03):** the vertical Shelf baseline is committed as `809e18e` and realism as `60ac8dd` (SDD-05 §19). The user subsequently authorized vertical Arrange implementation under §§20–21, included in the scoped local commit containing this handoff. Horizontal presentation remains pending. Read the shared Arrange architecture and first implementation in those sections, then section 8 below, before implementing horizontal ordering or dragging.
**Worktree/branch:** `Bookconnect4_library` / `codex/library-cover-shelf`.  
**Horizontal scope:** implement the horizontal stacked shelf in the subsequent unit. The user's later explicit request puts the confirmed vertical replica first. Spines/Covers presentation choices are outside this horizontal unit. Existing uncommitted Library work is preserved.

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
