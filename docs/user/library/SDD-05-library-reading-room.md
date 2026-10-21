# SDD-05: Library Reading Room — Stage 1 Shelf Refinement

**Status:** ACTIVE 2026-10-04 — vertical baseline/Arrange/contact depth committed at `e372945`; the vertical material follow-up is committed at `f8b171a`. Horizontal layout, browsing/quick look, dragging, and the horizontal material follow-up are implemented locally and web-reviewed; horizontal feature files remain uncommitted in the mixed worktree. Native checks remain pending. Google Books credential configuration is separate and deferred.
**Date:** 2026-08-22 (latest amendment 2026-10-04)
**SOT:** `ahntbtktjjmvfosgkmgn` `Bookconnect_reactexpo` (historical database evidence) | current worktree `Bookconnect4_library`, branch `codex/library-cover-shelf`
**Git checkpoints:** `809e18e` Library List/Shelf baseline; `60ac8dd` vertical realism; `e372945` Arrange/contact depth; `f8b171a` vertical physical-material follow-up. Earlier notes/vault/schema evidence and uncommitted workspace work are recorded in the Library tracker; no live schema read is implied by these UI commits.
**Historical Stage-1 scope:** `src/components/library/LibraryShelf.tsx:1` (split) · new `BookSpine.tsx` ~~· `QuickLookSheet.tsx`~~ (deferred with F3 — NOT in this stage's file set, §7 item 4) · `src/features/books/utils/libraryShelf.ts` + `shelfLayout.ts` · `app/(tabs)/library/_layout.tsx:9` (`[bookId]` transition only) · `app/(tabs)/library/index.tsx:25` (viewMode unchanged)

## 1. Decision

Refine the SDD-04 shelf into a **"reading room"** interaction while keeping walnut palette literal (theme-awareness stays deferred). Four features, gated:

- **F1 Natural shelf:** books stand with organic gaps/posture; all randomness derives from **stable seed = `entry.id` + title hash**, never array index (fixes reshuffle-on-filter defect in `LibraryShelf.tsx:297-306`). Spine color moves to title-only hash so colors persist across filter changes.
- **F2 Pull-out press (Approach A):** press lifts the book *out* — scale 1.15, deepened shadow, slight rotateY — then routes to `[bookId]`. True-3D engines rejected (perf/dep cost). Shared-element cover morph (**Approach B**) deferred behind **Dev Build gate**: requires `react-native-shared-element` native dep, incompatible with current Expo Go runtime.
- **F3 Long-press quick-look:** 450ms long-press opens bottom-sheet card (cover/title/rating/review excerpt/status/condition/lending/notes count) built **entirely from already-fetched `user_books.*` + `book:books(*)` join** (`booksService.getUserLibrary:611` returns full row; `libraryShelf.ts` type was needlessly narrow). Zero new queries; react-query key shared with detail screen.
- **F4 Brush feedback (last, descope-allowed):** finger sweep across spines gives per-spine lift/tick driven by **scroll-position math**, not competing pan gestures (shelf IS a horizontal ScrollView — gesture conflict by construction).

## 2. Current-state evidence

- Single horizontal spine row on `LinearGradient #3D2B1F→#1A110A` + ledge `#4A3424→#2A1C12`; brass border `rgba(184,134,11,0.3)` (`LibraryShelf.tsx:529,541,783`)
- Spines 34–44w × 132–156h index-cycled (:302), 28×36 cover thumb (:786), rotated −90° title width 110 (:805), author 8pt (:813); tap targets < 44px a11y minimum
- Motion present: entrance fade/rise 800ms (:452), staggered lean i*50ms bezier(0.34,1.56,0.64,1) (:334), pressIn lift −12/scale 1.05 + tak.mp3 vol 0.3 debounce 100ms + Haptic Light (:371–394), full `useReducedMotion` guard
- Hooks-in-try/catch wrappers (:327–330,445–447) exist solely to survive the Jest reanimated mock — to be removed by fixing the mock
- `_layout.tsx:9` pushes use `slide_from_right` — will fight F2 handoff; `[bookId]` route needs `animation:'fade'`
- Deps verified: `react-native-gesture-handler ~2.28.0` ✅, `react-native-worklets 0.5.1` ✅ (Reanimated 4), no shared-element/Skia/three ❌
- Haptic precedents: `search.tsx` uses `impactAsync Medium/Light` + `notificationAsync Success/Error`

## 3. Contracts

- **Layout:** F1 spacing jitter gap 2–8px seeded; ≤2 leaning pairs (−4…−6° tilt) per 12 books; one bookend when count ≥ 10; ~~single row retained unless Stitch variant says otherwise (open item §7)~~ **rows=2 — superseded by §3.1 amendment below**
- **Identity:** ~~cover-forward if cover_url exists (preferred default, pending Stitch confirmation)~~ **AMENDED 2026-08-24: classic text spines** — rotated title + author on seeded color; no spine cover art (user decision); `getHighResCoverUrl` remains used elsewhere but not on spines
- **Pull-out:** pressIn → scale 1.15 + translateY −18 + shadowOpacity 0.55 + rotateY 6° over 220ms bezier(0.34,1.56,0.64,1); navigate on release; reduced-motion → immediate route, no transform
- **Navigation:** `<Stack.Screen name="[bookId]" options={{animation:'fade'}}>` in `_layout.tsx`; all other routes keep `slide_from_right`
- **QuickLook:** `onLongPress` delayLongPress 450ms + `Haptics.impactAsync(Medium)`; Modal bottom sheet, backdrop close, primary CTA routes to `[bookId]`; data sourced from `useQuery(['library'])` cache entry only
- **Sound:** existing tak.mp3 unchanged for F2; ~~F4 requires approved extra assets (pitch variants) — none added without sign-off~~ **AMENDED 2026-08-24: F4 builds silent (§7 item 2) — zero audio assets in Stage 1; C3 forbids `playTak` on sweep**
- **A11y:** every book has a non-overlapping activation path of at least 44×44px. The §16 title chooser provides this alongside the narrow physical spines; expanded overlapping spine hit regions are removed. The deferred QuickLook sheet must get `accessibilityViewIsModal`; all existing labels are preserved.
- No DB/schema/RLS changes; no new npm deps in Stage 1 (B-gate excepted, post-Dev-Build)

## 3.1 Stage-1 continuation contracts (amendment 2026-08-24 — TDD-ready)

These contracts implement the user decisions recorded in §7. Red-first tests are written against THESE bullets.

**C1 Two-row shelf (rows=2):**
- One shared horizontal `ScrollView` (existing `testID="library-shelf-scroll"`) containing two vertically stacked shelf boards; both rows scroll together with the single gesture.
- Distribution: contiguous halves — first ⌈n/2⌉ books (filtered order) form the TOP row, remainder form the BOTTOM row. Deterministic and unit-testable: 0 → no boards (empty state); 1 → single book top row, bottom row renders empty ledge; odd counts favor top.
- Bottom row keeps existing ledge below; an inner ledge divider (same `shelfLedge` gradient) separates rows. Row min-height unchanged (180).
- Posture/bookend math runs per row on that row's slice (`computeShelfPosture` unchanged; bookend rule applies to each row's last item when that row ≥10).
- Entrance stagger continues across the combined sequence (top row indices then bottom row) so motion reads as one shelf.

**C2 Classic text spines (supersedes hybrid render):**
- Remove the spine cover `<Image>` block and `spineCover` style entirely from `BookSpine`; no cover art renders on any spine regardless of `cover_url`.
- Spine = seeded genre color + brass border + rotated title (primary) + rotated author (secondary), styles otherwise unchanged (11pt title / 8pt author, width 110/80).
- Width/jitter/posture tables untouched. `getHighResCoverUrl` import removed from `BookSpine` (still used elsewhere).

**C3 F4 brush feedback — silent mechanics:**
- Extract a pure function `resolveSweptSpine({ scrollX, touchX, touchY, rowGeometry, bookLayouts }) → spineId | null` into `shelfLayout.ts` — unit-testable without gestures.
- While a touch moves across the shelf, the spine under the mapped point gets a temporary lift (scale 1.06, translateY −6, 120ms in/out via shared values); only ONE spine lifted at a time.
- Haptic: Light impact when the active spineId CHANGES, rate-limited to one tick per 80ms. No sound assets added; `playTak` is NOT called by F4.
- Reduced motion: transforms skipped entirely AND haptic ticks disabled (consistent with pressIn guard).
- Gesture safety: implemented from the existing ScrollView's `scrollEventThrottle` + onTouchMove position mapping; NO new pan responder, no new dependencies.



## 4. Design source (Stitch)

To be recorded here verbatim (HTML/classes) once user selects winning variant — same evidence pattern as SDD-04 §4. Prompt skeleton issued 2026-08-22 covers: walnut palette pins, organic gaps/leaning pairs/bookend, one mid-pull book, states requested (empty/sparse/30-book overflow/pressed). Variants to compare: cover-forward vs text spines; 1 vs 2 rows.
**Amendment 2026-08-24:** variant selection is RESOLVED without Stitch HTML (§7): rows=2, classic text spines. Stitch capture becomes optional historical reference only; §3.1 contracts are authoritative.

## 5. Component split

`LibraryShelf.tsx` (843 lines) splits: `LibraryHeader.tsx`, `LibrarySummary.tsx`, `LibraryFilterBar.tsx`, `LibraryBookList.tsx` (+rows/states), `BookSpine.tsx`, ~~`QuickLookSheet.tsx`~~ (**deferred with F3**, §7 item 4 — not in Stage 1 file set); barrel `index.ts` re-exports unchanged. Pure helpers (seeded jitter, spine metrics, color hash) move to `src/features/books/utils/shelfLayout.ts`.

## 6. Tests

Preserve: testIDs `library-shelf`, `library-shelf-scroll`, `library-shelf-spine-{id}`, `library-view-toggle`; viewMode AsyncStorage persistence; tak/Haptics-on-pressIn contract (`__tests__/LibraryShelf.test.tsx`).
Update: reanimated mock made real enough to delete try/catch wrappers; new cases — seed stability across reorder/filter, reduced-motion skips transforms, `[bookId]` fade option asserted in layout test.
**Amendment 2026-08-24:** quick-look test cases deferred with F3 (§7 item 4). Continuation adds red-first cases for §3.1: C1 row-distribution table (0/1/odd/40 books), C2 no-cover render + absent `spineCover`, C3 `resolveSweptSpine` pure mapping (incl. touch outside rows → null, spine-change haptic rate limit, reduced-motion disable).

## 7. Open items (block implementation start)

1. Stitch variant selection — **RESOLVED 2026-08-24 (user decisions, relayed via clubs desk): rows = 2** locked for Stage 1; **spine identity = CLASSIC TEXT SPINES** — no cover art on spines; rotated title (+ author) on seeded genre color only. Current hybrid (cover thumb + text) is superseded; `BookSpine` cover `<Image>` block is to be removed as the first task of the Stage 1 continuation.
2. F4 sound assets approval — **RESOLVED 2026-08-24 (user decision): build silent.** Gesture mechanics (scroll-position-driven sweep ticks) authorized now with no audio assets added; sound attachment must be possible later without rework. Descope clause superseded.
3. Confirm Stage 1 excludes unified-palette work (README names SDD-05 as "unified palette proposal"; this doc scopes Stage 1 = shelf mechanics/interaction only, palette cohesion → Stage 2)
4. F3 long-press QuickLook — **DEFERRED 2026-08-24 (user decision)** to a later unit/Stage 2; §3 QuickLook contract preserved unchanged for when it is un-deferred.

## 8. Verification plan

Tooling: `npx jest --runInBand --testPathPattern "library/__tests__"` · `npx tsc --noEmit` · `npm run export:web` bundle-size delta vs 5.36MB baseline · extend `flows/library-smoke.yaml` to exercise shelf toggle + spine press (~~quick-look~~ deferred with F3) · visual pass on `emulator-5554`. No migration, no Supabase mutation, no deploy in this stage.

### 8.1 Session gates (contractual — user runs these against the implementer)

**Gate 0 — before any code (per session):**
- Quote SDD §3 + §3.1 contracts verbatim; list files to create/modify vs out-of-bounds; state which §6 Jest assertions survive unchanged and which updates are authorized.

**Per work unit:**
- Paste `git status --short`; justify any path outside §Scope.
- Run the full documented jest pattern; **paste raw output, never a paraphrase or summary**.
- Walk the diff against §3 hunk-by-hunk: each change names its contract bullet.
- Red-first for new behavior (seed stability, QuickLook CTA): failing test shown before implementation.
- State what was consciously NOT implemented from the SDD and why.

**Adversarial (at least once per feature):**
- "Hostile PR review of your own diff — find three §3 violations."
- Trace edge cases through the seeded layout math: 0 / 1 / 40 books, duplicate titles, null cover + null authors, filter reorder.
- Reduced-motion path demonstrated (code walk acceptable in Jest, emulator preferred).
- Low-end perf diagnosis of F2 pull-out from code alone (what to instrument).

**Close gate:**
- Re-read TRACKER.md; list what became stale; reconcile before ending.
- Prove zero migrations/deploys/new deps (package.json diff empty unless gated).
- Provide one-command rollback description (`git` ref that restores pre-stage behavior).
- Report staged/committed/pushed status explicitly — default is nothing.

## 9. Out of scope

Theme-aware shelf palette (Stage 2), bento zones (SDD-06), Approach B shared-element (post Dev Build session), OCR fallback deployment (TRACKER's separate authorized next action), clubs tree paths.

## 10. Current horizontal-shelf work unit (2026-10-02)

**2026-10-04 resume:** after committed vertical checkpoint `e372945`, the user selected horizontal work with context/plan first. [Horizontal execution plan §9](./HORIZONTAL-SHELF-IMPLEMENTATION.md#9-horizontal-execution-plan-2026-10-04) owns the planned two-tier pile geometry, Shelf-only Vertical/Horizontal preference, loaded-facts quick look, separate horizontal gestures and verification checkpoints. Existing vertical and List presentations remain available; shared order/draft/Save/Undo/Cancel stays in Home. The plan is documented, not yet implemented. §10's earlier replacement-only wording is superseded by this presentation choice.

The user requested implementation on a different branch, then narrowed the first work unit to the horizontal stacked shelf and requested inspection of its Stitch code and discussed interactions. Branch `codex/library-cover-shelf` was created with existing uncommitted Library work preserved. No app implementation was made during the reference inspection.

The selected current reference is **Library Home — Shelf (Horizontal Stacks)**, screen `b64af6d9e5b140358fab35e66b30926f` in project `2331124625547392526`. [HORIZONTAL-SHELF-IMPLEMENTATION.md](./HORIZONTAL-SHELF-IMPLEMENTATION.md) owns the inspected source, source defects, current requirements, verification limits, and exact next action; [captured HTML](./stitch-reference/horizontal-stacks.html) supplies the visual reference.

This work unit changes the presentation to flat horizontal volumes in data-driven piles on two continuous planks, with independently scrolling tiers matching that screen. It therefore supersedes the vertical-spine posture and shared-track layout for the new horizontal presentation; the August Stage-1 contracts and results above remain historical. Normal List mode, filtered data identity, existing book-detail routing, reduced-motion behavior, and the no-migration/no-new-dependency boundary remain requirements.

The first work unit also plans the previously requested long-press quick look using already-loaded book facts. The old F3 deferral above records the August work-unit boundary; it is not evidence that the current horizontal prototype supplies that behavior. The inspected source has no book-tap or long-press handler. No completion percentage, time/streak analytics, or unavailable note count is authorized as a substitute for real data. Full current acceptance criteria are in the horizontal contract. No Spines/Covers subview selector is included in this first work unit.

## 11. Confirmed vertical Stitch replica (2026-10-02)

The user explicitly requested replicating the existing vertical shelf from [this exact preview](https://stitch.withgoogle.com/preview/5737794884356081757?node-id=93ad8bd053b54ed4b3ec666d6093a291) and reconfirmed the URL. This supersedes the horizontal-first sequencing in §10. [Captured authored markup](./stitch-reference/vertical-spines.html) is the visual authority for this unit. The rendered reference is 390×1057; its cabinet is 342×438 at x=24/y=132, with 32px top inset, a 160px first book band, 12px shelf faces, and 64px exposed wood between tiers. Its spines are 32–44px wide and 125–160px tall, with EB Garamond 14–16.5px titles and Manrope surrounding copy.

Acceptance: two upright, bottom-aligned book rows; continuous wood and shelf faces across the viewport; muted reference colors; legible rotated serif titles, cloth material and edge lighting; shared horizontal overflow; actual filtered entries exactly once; existing entry-ID routing and List preference persistence; preserved F2 press and reduced-motion guards; no floating neutral books. The first sizing refinement widened seeded 32–44px spines up to 1.75× without changing height. The user rejected those proportions, then approved the investigated page-count sizing correction and requested realistic support at one edge with small gaps. The multiplier is now removed: widths are 24–44px from saved pages with a 32px fallback, heights are 144–156px, and both rows start at the left cabinet side with a brass bookend at the free end. §12 owns these current dimensions and support rules. Long rows retain natural horizontal overflow. Rendered titles remain 14–16.5px.

Library header and page spacing may be adapted to fit the shelf on a phone. Filter/count and List actions remain available; duplicate inactive inner navigation is removed from the Shelf page. Reference sample numbers (65%, 12 notes, 148 wishlist) are not data requirements: use available actual facts, and omit unsupported progress/note totals. Bundle the reference fonts with OFL notices through existing expo-font; no package installation, query/schema changes or service writes are required. Scope: Shelf/BookSpine, their layout helpers, LibraryHeader/FilterBar/BentoGrid, Library home, a local typography provider and visual assets. Preserve all unrelated dirty files.

Verification: existing focused Library/layout tests, Library type diagnostics, fresh web export, rendered mobile/desktop comparison, filter/List/detail interactions, empty/sparse/overflow geometry and motion guards. Record actual evidence and limits in TRACKER. This visual-only unit does not add quick-look or horizontal presentation. A pre-edit source snapshot is preserved at `%TEMP%/BookConnect-vertical-shelf-baseline-20261002`; use those exact files to roll back this unit without discarding the user's earlier uncommitted implementation.

## 12. Search metadata and spine proportions investigation (2026-10-02)

The user requested findings before applying the sizing correction. The investigation below was reported first; the user then approved implementation and requested realistic edge support and gaps. The correction and rendered verification are now complete as recorded below.

### Verified data path

- Library Search (`app/(tabs)/library/search.tsx`) calls `searchGoogleBooksCached`: fresh Google cache first, Google Books public volumes search next, stale Google cache on rate-limit failure, then Open Library fallback. The full Google result objects are cached, so available `volumeInfo.pageCount` survives caching.
- `booksService.buildBookRecordPayload` maps `volumeInfo.pageCount` to `books.page_count` when adding a new catalogue book. Existing book records are returned without metadata enrichment. Manual addition accepts only title/author, and the current Open Library search field list/mapping omits page-count metadata.
- `getUserLibrary` already fetches `book:books(*)`. Its runtime book records include saved page count. The investigation found that `LibraryBookEntry.book` declared only title/authors/cover; the correction adds optional `page_count` to that local type and consumes the existing join without another query or schema change.
- Supabase MCP re-verified `Bookconnect_reactexpo` / `ahntbtktjjmvfosgkmgn` as `ACTIVE_HEALTHY`. A bounded read-only query confirmed `public.books.page_count` is a nullable integer. The inspected dimension-related column names returned only `page_count`, with no physical height/width/thickness fields.
- The seven-book Library associated with the previously opened Dune detail entry contains five valid page counts: 63, 248, 252, 331, and 430. Two are NULL, including the Open Library Dune entry. No other user's library was queried, and no database/storage writes were made.
- [Google's Volume resource](https://developers.google.com/books/docs/v1/reference/volumes) defines total `pageCount` plus physical `dimensions.height`, `.width`, and `.thickness` in centimetres. Our GoogleBook type and saved-book payload do not capture physical dimensions. Page count is a visual thickness estimate because paper/binding/edition can change actual thickness; physical metadata enrichment is a separate future task.

### Approved correction — implemented

Remove row-fill width multiplication. Compute each book's width independently from a finite positive saved page count; retain the same dimensions through filter changes and viewport changes. The implemented rule is `round(clamp(24, 44, 20 + 0.04 * page_count))` in logical pixels, with a fixed **32px** fallback for missing, zero, negative, or invalid values. Example widths: 100 pages = 24px, 300 = 32px, 500 = 40px, 600+ = 44px. These are bounded visual dimensions, not physical centimetre conversion.

Keep height independent of page count: near **150px**, with small deterministic variation within **144–156px**, fitting the existing 160px row band. Preserve bottom alignment, current title size/truncation, press/hover/focus motion, and accessible activation. A sparse shelf keeps natural empty space; an overflowing shelf scrolls. `BookSpine` and `getShelfTrackLayout` use the same metric function so rendering and brush hit testing agree.

### Edge support and realistic spacing — implemented

- Each row starts **12px** inside the frame, directly against the inner face of the left wooden cabinet side. Rows are no longer centered. Fixed wood sides and continuous shelf faces stay visible while the shared book track scrolls.
- Deterministic **1–3px** gaps between books create small shadow seams. The last spine has no trailing gap, so it meets the upright bookend. Smaller contact shadows replace the wider diffuse spine shadow.
- Each nonempty row ends with a decorative **20px-wide, 76px-high brass L-shaped bookend**, bottom-aligned on its board. Empty rows have no bookend. These supports ignore pointer events and are hidden from accessibility navigation.
- Layout width reserves the bookend and 16px end space, so the final book and its support remain reachable on an overflowing track. The exact book widths, offsets, and gaps are shared by rendering and brush mapping; filters reset scroll/brush state.
- These current upright proportions, spacing, and supports supersede the historical Stage-1 gap/lean/bookend rules for this user-selected vertical presentation. Provider enrichment, new metadata queries, schema changes, horizontal stacks, and long-press quick look are outside this correction.

### Implementation verification

- Red-first layout check: 6 failing / 14 passing tests before implementation. Final focused Library run: **42 tests / 5 suites PASS**; [raw output](./stitch-reference/spine-correction-jest-20261002.txt). Checks cover positive/missing/invalid page counts, filter/viewport stability, gaps, 0/1/40 entries, brush mapping, rendered widths, nonempty-row supports, routing and existing reduced-motion/press contracts. Decorative support assertions use `includeHiddenElements` because they are intentionally excluded from accessibility navigation.
- Fresh Expo web export with one Metro worker: **PASS**, 2,326 modules, 5.39 MB entry. HTTP readback at `localhost:19006` matched this worktree's new HTML and entry bundle `entry-7e3ae7ee106698fcff13e7cd65972706.js`; SHA-256 `1620CB82F031147A4ECDE1782E1BDDB9CEF867AA1BCD7F425381EB4D64804053`.
- Refreshed live browser checked at **390×844** and **1280×720**. The same seven entries measured widths **32, 32, 30, 30, 33, 24, 37px**, with heights **144, 148, 154, 154, 152, 150, 144px** at both sizes. All books and bookends rest on their corresponding board. The single Wishlist book remains 37×144px against the same left support; Reading has no books or stray bookends. All/List/Shelf switching, Dune detail navigation and return were checked. Browser viewport override was reset and the user tab is left on All/Shelf.
- Visual evidence: [phone shelf](./stitch-reference/app-supported-spines-20261002.jpg), [one-book shelf](./stitch-reference/app-supported-single-book-20261002.jpg), [desktop shelf](./stitch-reference/app-supported-spines-desktop-20261002.jpg).
- `npx tsc --noEmit`: **36 existing errors outside Library; zero Library errors**. Native-device haptics/gesture quality and live overflow were not checked; 40-book reachability has pure-layout test evidence. Existing extra marketplace root tabs remain outside this unit.

Correction scope: Library type/layout/spine/shelf code, focused tests, documentation, and local rendered evidence. No new dependency, provider enrichment, database/storage read or write, migration, stage, commit, push, or deployment occurred in this correction.

Investigation scope: code trace, official Google/Open Library documentation, exact-project metadata reads, and Library documentation only. No app code, provider search/add request, build, code test, dependency, migration, database/storage mutation, staging, commit, push, or deployment occurred in this investigation.

## 13. Overall aesthetics review and proposed plan (2026-10-02)

**Authority:** this section was initially a proposal requested after analysis. The user's subsequent “ok proceed with the implementation please” authorizes the recommended first checkpoint: units 1 and 2. The completed §12 proportions/support correction is the geometry baseline. Units 3–6 and the horizontal contract remain subsequent work. No migration, database/storage write, dependency change, stage, commit, push or deployment is authorized by this checkpoint.

### Current rendered evidence

Reviewed the existing app at `localhost:19006/library`, its current components, the Library inventory/interaction map, and the captured vertical reference. Initial HTTP readback found the local preview server stopped. Its open page showed fallback typography and missing icons; restarting the existing `serve19006.js` process and refreshing restored the intended fonts and header icons. This was preview recovery, with no source change or fresh export. The served entry remains `entry-7e3ae7ee106698fcff13e7cd65972706.js`.

At 390×844, reviewed Shelf, content below the cabinet, and List. The browser still displays seven books. Saved [Shelf evidence](./stitch-reference/aesthetics-shelf-review-20261002.jpg) and [List evidence](./stitch-reference/aesthetics-list-review-20261002.jpg). The original Shelf/All preference and default viewport were restored afterwards.

| Area | Evidence / judgment |
|---|---|
| Cabinet material | Correct support, natural thickness and board alignment are present. The back panels are flat brown, the exposed wood bands are flat beige, and the strong diffuse outer shadow makes the cabinet dominate the volumes. Refining material and consistent light direction would add realism. |
| Collection controls | In Shelf mode, filters follow the 440px cabinet plus 48px margin. Wishlist is off to the right at phone width with little indication that the chip row scrolls. The view switch is an icon with no visible mode label. |
| Header | The serif heading is a good foundation. The centered italic subtitle adds another text style and consumes space without clarifying the collection state. Add Book is visible only in List; Shelf uses a magnifier for the same catalogue flow. |
| Spine identity | Widths and heights should remain as approved. Long titles truncate within the available spine length; there is no visual full-title/author caption during hover or focus. The existing accessibility labels contain those facts. |
| Supporting cards | With Reading=0, a disabled 179px-minimum Current Read card still occupies a large area. Two further 116px-minimum tiles repeat total/Wishlist counts already available elsewhere. The information hierarchy can be more compact. |
| List consistency | At the inspected time, List uses the global midnight navy/purple theme and lime badges; Shelf remains hardcoded cream/walnut. The subtitle's fixed dark color has poor contrast in List. Rows use glass styling and system text instead of the same Library typography throughout. Several cover areas are blank or generic. |
| Navigation | Nine root tabs are visible, including four internal marketplace route names. Labels are squeezed and the default repeated arrow icons look unfinished. `app/(tabs)/_layout.tsx` declares five intended destinations and hides only the Store detail route. This is a shared-navigation issue. |

### Proposed visual direction

A calm personal reading room: paper and ink surfaces, walnut cabinetry, muted cloth volumes, restrained brass, serif titles and clear sans-serif controls. Use one light direction and a small spacing/radius/shadow scale. Define coordinated Library variants for the existing daylight/golden/midnight phases so switching presentation does not replace the visual language.

### Prioritized implementation units — proposed

| Order | Unit | Planned scope and acceptance |
|---|---|---|
| 1 | Palette, header and collection controls | Introduce shared Library color/type/spacing tokens; apply to both Home modes. Use a compact title/action header with clear Add/Search semantics, a visible Shelf/List selector, and filters/count before the collection. Fit all four filters at ordinary phone width where possible; provide a visible overflow cue at narrower widths. Preserve labels and generous activation areas. |
| 2 | Cabinet and volume material | Replace broad flat beige treatment with restrained wood grain and related walnut tones; add subtle plank bevels, inner corner shading and contact shadows; reduce the diffuse outer shadow. Align cabinet/spine/brass lighting. Retain the two rows, full-width boards, left support, free-end bookends, page-based widths and approximately 150px height. The cabinet remains the main visual anchor and occupies more than half the 390×844 reference viewport. |
| 3 | Book readability and feedback | Refine cloth/edge/binding details without changing data identity. Keep spine titles at a readable size; add a small full-title/author caption for the hovered, focused or pressed book using loaded facts. Preserve tap-to-details and the current press/reduced-motion contracts. Caption details are proposed and need implementation review. |
| 4 | Supporting information and List | With a current read, show a compact continuation card with its existing cover/title/author and detail destination. With no current read, show a smaller helpful prompt. Reduce duplicate summary tiles. Give List the same typography/palette, consistent cover proportions, a local missing-cover fallback, quieter cards and restrained status/ownership badges. Preserve refresh and all existing fields/routes. |
| 5 | Shared navigation cleanup | Hide the four internal marketplace destinations from the tab bar while preserving their routes. Render the five intended labels with distinct icons, theme-aware contrast and safe-area spacing. This patch owns the shared root tab layout, so it should be reviewed separately from Library-only styling and must preserve other destinations. |
| 6 | Responsive, accessibility and state pass | Review 320/390/430px phone widths and a desktop width, long titles, absent covers/authors, sparse/empty/overflow collections, loading and errors, keyboard focus, reduced motion and larger text. Reachable filters, readable contrast, correct details, stable proportions and unobstructed bottom navigation are acceptance criteria. |

Proposed page order: **heading/actions → visible Shelf/List choice → filters/count → collection → current reading/compact summary → app navigation**. Use the same surrounding structure for both presentation modes.

Recommended first implementation checkpoint: units 1 and 2, with a fresh app capture for review before expanding the polish pass. The shared navigation cleanup has high visual impact but is a separate shared-file change. This proposal does not add progress/streak analytics, provider enrichment, new queries/schema/dependencies, extra orientation selectors, or a long-press statistics sheet. The horizontal interaction contract remains separate. Search, Details, Notes and Saved Pages can adopt the agreed Library styling in later route-specific units using the existing interaction map.

### Verification and handoff

This session performed source/rendered review, restored the stopped local preview, and saved the plan/evidence. No implementation test, type check or new export was run; §12 test/build results belong to the previous implementation unit. No app source, package, migration, business data or Storage was changed, and no direct database audit, provider write, stage, commit, push or deployment occurred. Documentation continuity validator PASS (195 definitions, zero duplicates/missing traceability, 76 Markdown files); `git diff --check` PASS, staged diff empty. Exact next action: present this plan and select the next implementation checkpoint through the user's response.

## 14. First aesthetics checkpoint implemented (2026-10-02)

**Authority/scope:** the user approved the recommended §13 checkpoint with “ok proceed with the implementation please.” Units 1 and 2 are implemented locally on `codex/library-cover-shelf`. The §11–12 vertical identity/proportions/support rules remain the baseline. Units 3–6 and Horizontal Stacks remain subsequent work; this checkpoint adds no orientation selector or quick-look sheet.

### Acceptance and source traceability

| ID | Implemented acceptance | Source / evidence |
|---|---|---|
| LIB-AP01 | Shelf and List share paper/ink/warm-charcoal Library surfaces, existing Garamond/Manrope fonts, spacing and radii. The existing daylight/golden/midnight phase chooses the Library palette. All tested normal text/selection/badge pairs meet 4.5:1 contrast. | `LibraryAppearance.ts`, typography provider, Header/FilterBar/Summary/BookList/BentoGrid; `LibraryAppearance.test.ts` tests all three phases. Global theme/navigation and other routes are unchanged. |
| LIB-AP02 | Visible Shelf and List buttons expose their selected state. Choosing the active view is a no-op. Default List and the existing `library_viewMode` preference remain. Search and `+ Add Book` are reachable in both normal Home views and open the existing catalogue route. | `LibraryHeader.tsx`, Home `handleViewModeChange`, `LibraryShelf.test.tsx`; live List reload, keyboard Enter selection, Add/Search routes. Error header still hides Add Book and retains Search/view choice. |
| LIB-AP03 | Actual All/Reading/Completed/Wishlist counts and a compact filtered-count row appear before either collection. Activation areas are at least 44px high. Filters fit one row at 390px and wrap at 320px. | `LibraryFilterBar.tsx`, `LibrarySummary.tsx`, `library-collection-controls` in Home; focused order/count tests and measured browser rectangles. Wrapping replaces the proposed narrow-width overflow cue because no filter is hidden or horizontally clipped. |
| LIB-AP04 | The cabinet uses local SVG grain, related walnut tones, ceiling/corner/contact shading, plank highlights and a softer outer shadow. Both full-width boards, fixed wood sides, brass supports and the shared horizontal track remain. | `cabinetWoodTexture.ts`, `LibraryShelf.tsx`; decorative material/frame test and phone/desktop captures. The frame remains 440px high, over half of the 390×844 reference viewport. |
| LIB-AP05 | Loaded page-based widths, seed-based heights, gaps, row split/order, book IDs and all press/hover/focus/brush/reduced-motion contracts remain. Decorative material adds no input/accessibility stops. | `BookSpine.tsx` and layout utility unchanged in this checkpoint; layout/motion/navigation regressions PASS. Seven live volumes remain 32/32/30/30/33/24/37px wide and 144/148/154/154/152/150/144px high on phone and desktop. |

List row fields, cover sizing and source, refresh and routing are retained; the row surface/type/badge palette now matches Shelf. Bento card layout, counts and destinations are retained while their colors match the same phase. Missing covers and the large empty Current Read layout remain later work.

### Verification actually run

- Saved a pre-edit snapshot/hash manifest at `%TEMP%/BookConnect-library-aesthetics-pass1-20261002-214957`; earlier workspace edits are preserved.
- RED before app edits: new control/material assertions failed **3 tests, 11 passed**; the new appearance suite also failed collection because its implementation module did not exist. [Raw RED](./stitch-reference/aesthetics-pass1-red-20261002.txt).
- First combined run: **46 passed, 1 failed** due to a test matcher unavailable in the installed test library. Replaced it with the existing supported property matcher; no production behavior was changed for that failure. Final explicit-path run: **47 tests / 6 suites PASS**. [Final Jest](./stitch-reference/aesthetics-pass1-jest-20261002.txt), [first attempt](./stitch-reference/aesthetics-pass1-first-jest-20261002.txt). Existing Search `act(...)` and Node `punycode` warnings remain.
- Fresh `npx expo export --platform web --max-workers 1` **PASS**, 2,328 modules / 5.4MB entry. [Build log](./stitch-reference/aesthetics-pass1-export-20261002.txt). HTTP HTML matched this worktree's export; served JS matches `entry-f576fb2498810ca45bbe5541399c1df9.js`, SHA-256 `D43E182114936D7582D530ECC29180F67B0E66645139D3A0D5A5F8058D7D4435`. [Readback/package proof](./stitch-reference/aesthetics-pass1-preview-proof-20261002.json).
- `npx tsc --noEmit`: **36 existing errors outside Library, zero Library errors**, after export completed. [Type diagnostics](./stitch-reference/aesthetics-pass1-tsc-20261002.txt). This is not a clean full-repository type check.
- Fresh authenticated app review at 320×844, 390×844 and 1280×720: filters/count before collection, no Home horizontal overflow at 320px, matching Shelf/List page colors, saved List after reload, keyboard Shelf selection, Wishlist's supported 37×144px book, Reading empty shelf without bookends, All restoration, correct Dune detail/return, and both catalogue entry routes. Catalogue displayed its existing offline state; no search text or Add/save action was submitted.
- Captures: [Shelf phone](./stitch-reference/aesthetics-pass1-shelf-390-20261002.jpg), [List phone](./stitch-reference/aesthetics-pass1-list-390-20261002.jpg), [one-book shelf](./stitch-reference/aesthetics-pass1-single-390-20261002.jpg), [desktop](./stitch-reference/aesthetics-pass1-shelf-desktop-20261002.jpg). Restored default viewport and All/Shelf on the existing user tab.

### Boundaries and next checkpoint

No database/business-data/Storage writes, direct database audit, provider enrichment, migration, new dependency, package/lockfile change, stage, commit, push or deployment. Only the existing local export was rebuilt/served; Library view preference changed during UI checks. Native touch/haptics, live overflowing collections and rendered daylight/golden variants were not verified in this web session; overflow geometry and reduced-motion contracts have focused automated coverage. The three palette variants have automated text contrast coverage.

Nine shared root tabs, missing-cover fallbacks, compact Current Read/summary layout, full-title captions and styling of Search/Details/Notes remain the known later units. The user can scroll vertically to see the cabinet/cards in shorter windows. Marketplace Phase 9/M46 status, active work unit and mutation authority are unchanged.

Exact next authorized action: review the units 1–2 app capture as the planned checkpoint; select the next Library polish unit through the user's response. No further unit is marked complete by this checkpoint. Continuity/diff closeout is recorded in the Library tracker.

## 15. Independent review qualification (2026-10-03)

[Independent review](./INDEPENDENT-REVIEW-20261003.md) verifies §11–14 against current source and browser. Width/height/order/support/cabinet/data/routes/persistence are substantiated. LIB-AP03 is not universally count-correct: Reading/Completed chip predicates include wishlist/status combinations excluded by the collection. LIB-AP05 retains matching x geometry but brush y geometry uses the whole row rather than each book height. Shared UI palette contrast tests do not cover spine colors; four base spine pairs miss the ordinary-text target. List's outer vertical ScrollView creates a windowing/refresh risk, and native hitSlop does not prove 44px web activation coverage. These qualify prior completion claims without changing the approved product requirements.

The review changes no behavior/acceptance/schema or Phase 9 authority. R1–R5 evidence and recommended corrections are owned by the review; native and large-library runtime gaps remain explicit. Exact next action is review of findings and selection of a bounded correction scope. Horizontal stacks, full-title captions, cover/compact-card work, quick look and shared navigation remain pending.

## 16. Independent-review corrections (2026-10-03)

The user returned the independent review to the ongoing authorized Library implementation. This correction unit addresses R1–R5 before further design polish. The independent report remains a historical review of the previous tree; this section owns the corrected behavior and acceptance. It introduces no database/query/schema/provider/dependency changes. The §12 cabinet dimensions, physical page-based widths, heights, ordering, support, gaps and detail IDs remain.

| ID / finding | Corrected acceptance | Source / regression coverage |
| --- | --- | --- |
| LIB-RC01 / R1 | List has one bounded vertical FlatList, with heading/mode/actions/filters/count inside `ListHeaderComponent`. Its RefreshControl refetches the same Library query. Shelf retains its separate vertical ScrollView. User-initiated web mode changes focus the selected mode button after remounting the header. | Home, `LibraryBookList.tsx`, `LibraryHeader.tsx`; Home tests for ancestor structure, bounded style, refresh callback and updated counts. |
| LIB-RC02 / R2 | Each title uses whichever of ink `#080604` / paper `#fffdf8` gives the higher measured contrast. All 14 cloth colors pass 4.5:1. The label region uses an opaque matching base color above texture/gradient, and title opacity is 1. No entrance ancestor opacity may dilute this pair; §17 replaces the Shelf fade with translation alone. Spine material outside that region and stable color selection remain. | `spineTextColor`, `BookSpine.tsx`, `LibraryShelf.tsx`; 14 palette assertions, opaque-region component assertion and paused entrance progress coverage. This measures foreground/background pairs, not every antialiased raster pixel. |
| LIB-RC03 / R3 | Every chip count is the length of its own `filterLibraryBooks` result. Wishlist entries carrying reading/completed statuses are excluded from those status chips as they are from the collections. | `libraryShelf.ts`; mixed ownership/status, null ownership and ownership-transition fixtures. No persisted statuses are rewritten. |
| LIB-RC04 / R4 | Each shared book layout carries height from the same `spineMetrics` call as rendering. Brush mapping rejects points above `row.y + row.height - book.height`, at/right of the spine edge, in gaps and below the row. | `shelfLayout.ts`; top/bottom short/tall boundaries, exact edges, nonzero horizontal offsets and rendered metric parity. Bounds describe neutral book geometry; native tactile quality is not certified by pure tests. |
| LIB-RC05 / R5 | Nonempty Shelf exposes a 44px-high “Choose a book” button below the cabinet. A bounded modal FlatList gives the same filtered entries independent full-width buttons of at least 64px height, full title and available authors. Selection closes and routes by existing entry ID; Close and Back/Escape dismiss. A filter/data change closes stale contents. The existing Modal supplies web focus trapping/return; its dialog is named and its native panel sets `accessibilityViewIsModal`. | `LibraryBookPicker.tsx`; chooser/empty/filter/cancel/duplicate-title/correct-ID tests and Home integration. Physical spine targets remain 24–44px wide, with no overlapping hitSlop; the chooser supplies the ≥44px alternative on both platforms. |

The chooser is an accessible book activation alternative, without statistics, editing, new queries or new routes. Quick look and horizontal stacks/orientation selectors remain pending. The full-title caption is implemented in §18. Supporting cards, missing covers and shared navigation remain later units. The normative accessibility line above is updated to describe the actual non-overlapping alternative instead of the disproven hitSlop claim.

### Evidence and remaining acceptance gate

Correction evidence is kept together in [correction-evidence-20261003](./correction-evidence-20261003/). The source snapshot at `%TEMP%/BookConnect-library-review-corrections-20261003-005106` preserves the pre-correction tree. [Library tracker](./TRACKER.md) records the fresh checks; none are inferred from the independent review's results.

Fresh correction verification: **72 tests / 8 suites PASS**, final Expo web export **PASS**, HTTP HTML/JS matches the new local export, and full TypeScript retains **36 unchanged errors outside Library / zero Library errors**. Final-bundle browser checks cover 320/390/430px phones and 1280px desktop, both modes/all filters, persistence, selected-mode focus, named chooser focus trapping/dismissal/return and exact detail routing. Chooser rows measure at least 74.8px high without overlap. An isolated 1,000-book simulated collection reaches its final book with a limited mounted List window (observed peak 73 rows). It uses mocked presentation assets and no auth/service/live data; it establishes web bounded rendering, not native performance. The temporary fixture tab/server is closed; the user's real All/Shelf and default viewport are restored.

Final acceptance still requires independent correction rereview and the outstanding native-device checks for large List windowing/refresh, gesture cancellation, touch selection, sound/haptics and reduced motion. Web fixtures do not certify native performance. Exact next action after the correction evidence closes: rereview R1–R5 against this section and the fresh app captures before selecting another Library polish unit. This supersedes §15's correction-selection handoff.

## 17. R2 entrance-contrast correction (2026-10-03)

The returned [correction rereview](./CORRECTIONS-REVIEW-20261003.md) identified a P3 defect: the 800 ms ancestor opacity fade diluted the passing title/background pair while the Shelf entered. That report remains historical evidence of the pre-fix source and its unavailable authenticated tab. This bounded fix remains within the ongoing authorized Library correction scope and adds no new feature, query, route, dependency or database behavior.

Acceptance/source traceability continues under LIB-RC02: `LibraryShelf.tsx` has no animated opacity. The entire cabinet and label region remain at opacity 1 from their first frame; the existing 20px-to-0 entrance translation retains its 800 ms easing. With reduced motion, the initial shared translation is 0 and no entrance animation is scheduled. Shelf proportions/material/support/order and all existing activation/hover/brush contracts remain.

`LibraryShelf.test.tsx` captures the animated-style callback with entrance progress paused at 0, 0.5, 0.75 and 1, asserting full opacity alongside the preserved translation. A fifth regression asserts a stationary, opaque first reduced-motion frame. RED against the preceding source: 4 failed / 1 passed (16 unrelated cases skipped). Fresh full-suite/build/type/browser results are owned by the [Library tracker](./TRACKER.md) and [fade correction evidence](./fade-correction-evidence-20261003/).

The existing authenticated `localhost:19006/library` tab is now exposed; initial observation shows All/List with eight entries, Reading 0, Completed 1 and Wishlist 1. Preserve this user-selected mode/filter/default viewport after the read-only checks. No entry is added or changed by this unit. Native touch/refresh/performance/assistive-technology checks remain NOT_RUN. Exact next action after verification: rereview this P3 correction with the fresh authenticated evidence before selecting another polish unit.

Fresh verification is complete: **77 tests / 8 suites PASS**, web export/served identity PASS, and **36 unchanged TypeScript errors outside Library**. Sixteen real DOM readings during entrance kept effective opacity 1 while translation moved from 19.6224px to zero. The authenticated fresh app was checked in both modes at 320/390/430px and desktop, with all filters at 390px, chooser keyboard/focus/dismissal at all widths, persisted List reload and exact Dune detail/return. Live computed Science of Dune contrast is 5.80:1. Original All/List/default viewport/top scroll are restored. Detailed results and limits are recorded in the Library tracker; the historical review's unavailable-tab limitation is now supplemented by this session's actual authenticated evidence, without claiming native acceptance.

## 18. Unit 3 — spine readability and contextual caption (2026-10-03)

**Authority and boundary:** after deferring the independent P3 rereview, the user approved proceeding with the planned §13 Unit 3. This implementation is limited to the existing vertical Shelf. It does not add the horizontal presentation, orientation control, statistics/quick-look sheet, new route, query, saved data, or dependency. The independent review and correction reports remain historical records; their verdict is not changed by this implementation.

**Acceptance:** saved spine titles are slightly larger (smallest width uses 15px) with restrained right/bottom edge definition. When a spine is hovered, keyboard-focused, or pressed, the chooser control immediately below the cabinet presents that book's complete saved title and any saved authors, with a Browse affordance. The caption uses only loaded library data, wraps long titles, and omits an absent author. The control continues to open the existing title chooser; releasing the spine still opens its existing `userBookId` details route. Reduced motion suppresses the existing transform/haptic feedback but does not hide this informational caption. Active interaction is cleared when the entry leaves the filtered collection.

**Source and regression coverage:** `BookSpine.tsx` retains per-input hover/focus/press state and notifies `LibraryShelf.tsx`; the Shelf tracks active IDs and renders `LibraryBookPicker.tsx` directly below its cabinet. The Home page renders that integrated pair in the same collection position. BookSpine press, title/author (including no-author), dismissal, detail callback, chooser accessibility/action, and page integration are covered by focused Jest tests.

**Verification:** fresh Expo web export succeeded (2,329 modules). Focused Shelf, chooser, and Home integration run: **34/34 tests across 3 suites PASS**. The authenticated web app at `localhost:19006/library` rendered eight existing books; keyboard focus showed the full “The Black Swan” and saved-author caption, and tapping that spine reached `/library/eebf0401-d243-423b-83e4-41aa5d287d70`; browser Back returned to All/Shelf. No book data was modified. Full `npx tsc --noEmit` remains at **36 diagnostics outside Library**, none in Library; see the tracker for categories. Existing Node `punycode` deprecation warning appeared during Jest.

**Limits and handoff:** hover is connected in source but was not separately driven through the browser control API; native rendering/press/reduced-motion, screen-reader announcement behavior, and large-library performance are NOT_RUN for this unit. This web checkpoint does not establish final acceptance. The previous §17 independent-rereview next action was deferred by the user. Exact next Library action: review the live Unit 3 caption, then select Unit 4 (supporting information/List) or the separately specified Horizontal Stacks work. Phase 9/M46, DOC-13/ACTIVE, migration authority, and global next action remain unchanged; no database, storage, or external-service mutation occurred.

## 19. Approved vertical shelf realism (2026-10-03)

The user approved slimmer shelf boards, grounded contact shadows and rounded spine shading. This supersedes earlier unchanged-tier-proportion statements for this pass: the 440px cabinet and saved book metrics remain, while the top/bottom rows become 192px high at 28/238px and board tops move to 220/430px. The middle board is 18px overall and the bottom face 10px. Each row ends exactly at its board top. Board top lighting, underside shading, subdued wall grain, tighter spine/bookend shadows, a binding crease and foot shading create depth. Spine titles retain their opaque matching background and full opacity; routes, chooser, filtering and interaction targets are unchanged.

The existing Shelf geometry regression asserts cabinet height and both row/board alignments. Focused Shelf/chooser/layout Jest passes 63 tests across 3 suites; fresh web export passes. Authenticated browser inspections cover 320/390px and desktop, with no page horizontal overflow. Detailed evidence, native limitations and exact next action are owned by the Library tracker. Full TypeScript was not rerun for this styling-only pass. No data/service/schema/dependency mutation or publication occurred.

**Commit checkpoint:** the user accepted the realism result and requested its commit. `60ac8dd` (`refine(library): improve vertical shelf realism`) contains only `BookSpine.tsx`, `LibraryShelf.tsx`, and the existing Shelf regression test. Documentation/evidence and earlier unrelated work remain outside that commit; nothing was pushed.

## 20. Arrange shelf: shared order, separate dragging (2026-10-03)

**Initial design checkpoint and authority:** the user asked to preserve the simplified Arrange design and its vertical/horizontal architecture for future sessions. The initial documentation update added no Arrange implementation; source checkpoint was `60ac8dd`. The later explicit implementation request and resulting code are recorded in §21. Architecture recording alone does not authorize migration creation/application or external writes.

### 20.1 Current code and agreed scope

At checkpoint `60ac8dd`, `booksService.getUserLibrary()` ordered entries by `created_at` descending. Home passed the filtered entries to `LibraryShelf`; `splitShelfRows()` assigned the first `ceil(n / 2)` entries to the upper row and the rest to the lower row. The horizontal ScrollView scrolled these rows together; touch-move mapping supplied brush feedback. No manual order was used at that checkpoint. §21 adds a presentation-layer order over the unchanged service query.

The simplified planned interface has **Arrange, Undo, Save, and Cancel**. Dragging shows an insertion marker and can reach off-screen books by automatic edge scrolling. Undo reverses one completed move; Save ends the session and clears its undo history. The app computes row placement and spacing. Searchable “Move before/after…” destinations and extended undo history are deferred. Keyboard access, readable targets, reduced-motion support, and failed-save recovery remain requirements of the small interface.

### 20.2 Shared arrangement state

Use one canonical sequence of **Library entry IDs (`user_books.id`)** shared by the vertical and horizontal Shelf presentations. Titles, Google Books IDs, rendered indexes, pixel coordinates, row numbers, and pile numbers are not arrangement identity. Equal titles remain separate entries.

The shared layer owns the starting order, draft order, one-step undo snapshot, dirty/saving/error state, and the Save/Cancel transition. It accepts semantic moves such as `move(entryId, beforeEntryId)`; a null destination means the end. Remove the moving ID before finding the destination, then insert it once. Validate membership and preserve all other IDs and their relative order; an unchanged or invalid move must not overwrite Undo. A canceled drag does not alter the draft. Store the Undo snapshot once per completed drop, not on every pointer or scroll update.

Enter initializes the draft from the current accepted order. Undo restores the immediately preceding completed move and consumes that snapshot. Cancel discards the draft. Save submits the draft through one storage boundary; failure retains the draft for retry, while success establishes the accepted order and exits Arrange. Prevent competing Save/Cancel transitions while a save is unresolved. Dragging itself performs no durable writes.

The common code does not measure book rectangles, respond to pointer gestures, or choose which scroller to move. Implement the first layout's interaction directly; reuse these small order/state operations when integrating the second layout. A universal drag engine and a configurable layout-adapter framework are outside the initial design.

### 20.3 Layout-specific interaction and projection

| Concern | Vertical Shelf | Horizontal Stacks |
| --- | --- | --- |
| Projection of one order | Existing contiguous two-row split; upright spines | Contiguous two-tier split, then piles of at most four, per the horizontal contract |
| Drop target | Insertion gaps between narrow spines | Insertion positions within/between piles, translated back into the canonical sequence |
| Automatic edge scroll | Move the existing shared track; both rows scroll together | Move the active destination tier's independent track; crossing tiers uses that tier's own offset |
| Geometry | Per-spine widths/heights and current shared scroll offset | Pile bounds, book-layer bounds, and separate tier offsets |

Each layout converts a successful drop into the same semantic move. Neither stores a second independent arrangement. Changing Shelf style projects the same order into the new geometry; automatic splitting/grouping can change which row/pile contains a book. Arrangement changes sequence, not a freely positioned physical cabinet slot.

Before pickup, normal horizontal scrolling remains available in Arrange. During an active drag, keep the selected book in an overlay under the pointer/finger, show a drop marker, and scroll progressively near either edge, clamped to actual overflow. Include the current scroll offset when resolving targets; cancel cleanly on gesture loss or leaving the screen. In Arrange, suppress the normal book-detail/quick-look activation and brush feedback that would compete with moving a book; exiting restores normal browsing. Reduced motion preserves placement cues and actions without lift/reflow animation. Provide an equivalent keyboard move path and usable, non-overlapping controls for narrow spines.

A future style switch must preserve the shared draft and Undo state while clearing any active gesture and stale measurements. It does not implicitly Save. Layout-local scroll state stays outside the saved arrangement.

### 20.4 Persistence boundary and initial choices

The first implementation uses account-scoped, device-only AsyncStorage: `library_shelfOrder:v1:<userId>`, containing `{version:1, ids:[<user_books.id>, ...]}`. It survives reopening on the same device/browser; cross-device synchronization is deferred. The existing `library_viewMode` remains a separate preference. A read-only Supabase MCP check verified `Bookconnect_reactexpo` / `ahntbtktjjmvfosgkmgn` and found no manual-order column on `public.user_books` or preference table in the inspected schema. No migration is created or applied; server synchronization would require a separate verified design and authority.

Arrange starts on **All books**. Filters, List/Shelf changes and catalogue actions are disabled until Save/Cancel, so an edited filtered subset cannot overwrite the full collection. In browse mode, filters preserve the saved relative order. Before the first saved arrangement, source newest-added-first order is used; afterwards, surviving saved IDs keep their positions and new IDs append in source order. Deleted/duplicate IDs are pruned. An addition/removal during editing cancels the draft with a visible message. If a write was already in flight, its submitted snapshot finishes, then reconciliation includes current membership; no stale IDs are rendered or new IDs dropped. Independent List sorting is outside this decision.

The display-only horizontal work unit keeps its existing no-migration/no-new-query boundary. Adding durable Arrange to it is a separate implementation/persistence scope; the design link alone does not enlarge that authority.

### 20.5 Traceability and future verification

| ID | Design requirement | Current evidence / remaining scope |
| --- | --- | --- |
| LIB-ARR01 | Shared unique Library-ID order and order-preserving layout projections | Pure order tests and equal-title Home integration PASS; 80-ID fixture drop/Undo preserves membership; horizontal projection pending |
| LIB-ARR02 | Draft, one-step Undo, Cancel, and successful/failed Save | Hook transitions/failure retry and authenticated Undo/Cancel/Save/reload PASS; completed drops commit once |
| LIB-ARR03 | Separate drag geometry with off-screen reach | Actual vertical cross-row drag and off-screen edge insertion PASS; both rows share one track; horizontal/native gestures pending |
| LIB-ARR04 | Safe mode/input transitions and accessible movement | Web keyboard/chooser/44px controls/disabled competing actions PASS; canceled/outside drops and frame stop covered; native assistive/reduced-motion interaction pending |
| LIB-ARR05 | Durable order without filter/membership loss | Account-scoped device storage and read-only schema evidence recorded; reload, prune/append, membership cancellation and stale-account recovery PASS; sync deferred |

This section's original documentation checkpoint ran no Arrange verification. Current implementation evidence is recorded in §21 and the Library tracker. The horizontal design must read §§20–21 before implementing its order or dragging.

## 21. First vertical Arrange implementation (2026-10-03)

**Authority:** the user requested proceeding with the implementation after the shared architecture handoff and explicitly confirmed saving on this device first. This authorizes the simplified vertical Arrange feature. No new database, migration, horizontal presentation, dependency, commit, push or deployment authority is inferred.

**Shared source:** [shelfOrder.ts](../../../src/features/books/utils/shelfOrder.ts) owns canonical reconciliation, semantic insertion and one-step Undo. [useShelfArrangement.ts](../../../src/features/books/hooks/useShelfArrangement.ts) owns account-scoped loading, draft/accepted state, Save/Cancel, retry, and membership reconciliation. Invalid/unchanged moves preserve Undo. Save failure keeps the draft and Undo for retry while membership remains unchanged. If membership already canceled the draft under §20.4, a failed in-flight write reports the cancellation and offers starting again; it does not claim the canceled moves remain or restore stale membership. Read failure/corrupt data blocks editing and offers Try again. Stale account reads/writes cannot establish state for another account. Durable writes occur only on Save.

**Vertical interaction:** [useVerticalShelfDrag.ts](../../../src/components/library/useVerticalShelfDrag.ts) and [verticalShelfArrange.ts](../../../src/features/books/utils/verticalShelfArrange.ts) own measured frame coordinates, tier/gap selection and bounded progressive edge scrolling. Tap a spine (or select from the existing full-width chooser) to select it, then drag that selected spine. Other books and empty shelf space remain available for ordinary horizontal scrolling. During drag, the source occupies its original gap, an opaque book follows the pointer, a marker indicates insertion, and the outer page/shared track stop manual scrolling. A completed valid drop updates the draft once; a canceled/out-of-cabinet drop does not. Both rows scroll together. Normal details, brush, lift and sound/haptic feedback are suppressed during Arrange and restored on exit.

**Accessible movement:** [LibraryArrangeControls.tsx](../../../src/components/library/LibraryArrangeControls.tsx) supplies Arrange/Undo/Save/Cancel, readable feedback and Earlier/Later controls for the selected book. Controls are at least 44px tall. The existing title chooser reaches off-screen books without precise spine activation; Earlier/Later moves through the full canonical collection, including row boundaries. Placement and drag follow the pointer without decorative motion; reduced motion also disables animated chooser scrolling.

**Verification checkpoint:** **100 tests / 11 suites PASS**, including shared ordering, state/storage, drag lifecycle, chooser and Home integration. Fresh web export and served SHA-256 identity PASS; TypeScript has **36 unchanged diagnostics outside Library and zero in Library**. Authenticated checks cover cross-row drag, one-step Undo, keyboard moves, Cancel, Save/reload, All-books entry from Wishlist, disabled competing actions, and chooser selection without Details navigation. Controls measure 44px high without page overflow at 320/430px and desktop. An isolated 80-book web fixture auto-scrolled to an initially off-screen destination and retained all IDs through drop/Undo; its themes/fonts/images were stubbed, gestures/state were actual source. Frame tests cover stopping scroll on invalid coordinates; browser before/after offsets alone do not establish behavior during a held outside pointer.

Detailed evidence and limitations are in the [Library tracker](./TRACKER.md) and [Arrange evidence README](./arrange-evidence-20261003/README.md). The fixture tab/server is closed; the real All/Shelf tab and original order are restored. Local preference writes occurred through Save during verification; no book data or Supabase Database/Storage changed. This implementation is uncommitted. Native touch/gesture loss, assistive technology, reduced-motion interaction and large-library performance remain NOT_RUN. Horizontal dragging is pending and must reuse the existing shared order/storage layer with its own pile/tier geometry. Exact next action: review the live vertical Arrange checkpoint with the user before authorizing Horizontal Stacks or another feature.

### 21.1 Bounded independent-review corrections (2026-10-04)

The user authorized only confirmation and correction of the two Arrange findings, then stopping. Both were reproduced before source changes: projected-tier and membership/save-overlap regressions failed (5 failing, 16 passing). LIB-ARR03 now resolves the visible gap after removal of the dragged ID and bounds the final insertion index to the indicated tier's contiguous slots. At the split boundary, another book may move to the other tier as required by the unchanged automatic projection; the dropped book finishes in the marked tier. Library-ID order, row counts and storage format remain unchanged.

LIB-ARR02/05 retain §20.4 membership cancellation and correct only the failed-save message when that cancellation has already removed the draft. A fresh arrangement includes current membership; unchanged-membership failures still retain draft/Undo and permit Save retry. Tests apply semantic moves and the actual two-row split for 2/5/6 entries, cover both boundary directions, preserve ID membership, and exercise failed pending Save after simultaneous addition/removal followed by a fresh successful Save. Focused source/integration checks: **54/54 tests across 5 suites PASS**. Build/type/continuity outcomes and the explicit stop handoff are recorded in the Library tracker; no new browser/native proof is inferred.

## 22. Shelf contact and board-depth refinement (2026-10-04)

The user approved implementation after a focused plan prioritizing individual book contact and board depth. LibraryShelf adds a noninteractive, accessibility-hidden 3px footprint beneath each book, sized from the existing layout width. It stays anchored to the board as the spine lifts, fades during browse interaction, and is hidden with the source during drag; the floating drag preview contains no footprint. The top-plane lighting is 4px within the existing board dimensions, front-edge highlight and underside falloff are stronger, and the under-board wall shadow fades across 18px. Existing cloth/grain, opaque labels, book metrics, cabinet/row geometry, ID order and gesture/storage behavior are preserved.

Verification: existing Shelf/drag suites **26/26 tests across 2 suites PASS**, fresh web export PASS, and authenticated app loaded `entry-bbb219bcfc8b2d6b26db027cff288cf3.js`. Browser inspection shows the unchanged 440px cabinet and eight saved entries. Actual mouse drops moved the last upper-tier book to the lower-tier start and back to the upper-tier end; Cancel restored the saved order without Save. [Capture](./realism-depth-evidence-20261004/shelf-depth.jpg) and exact handoff are owned by the Library tracker. Full TypeScript, native, assistive technology and performance checks were not rerun for this visual unit. No database/storage/preference write, dependency, migration or publication action occurred.

## 23. Horizontal layout checkpoint A (2026-10-04)

Authority: the user requested planning first, authorized A and subsequently requested completing the scope. A/B/C are implemented locally; [Horizontal contract §12](./HORIZONTAL-SHELF-IMPLEMENTATION.md#12-browsing-and-horizontal-arrange-implementation-2026-10-04) owns current web evidence and remaining native/assistive/performance gates. Preserve vertical Shelf, List and the shared Home-owned order/draft.

| Requirement | Implemented behavior | Source and verification |
| --- | --- | --- |
| LIB-HS01 | Shelf-only Vertical/Horizontal choice, vertical fallback, persisted `library_shelfStyle:v1`; stale read does not override explicit selection. Disabled during saving/dragging. | Home, `LibraryShelfStyleControl.tsx`; preference/fallback/race tests and live reload. |
| LIB-HS02 | Initial/legacy tier split is balanced; after Horizontal Arrange, each book keeps its saved top/bottom membership independently, with at most four per pile. Within each tier, canonical ID order remains left-to-right. | `horizontalShelfLayout.ts`; default and unequal-tier layout tests, duplicate titles. |
| LIB-HS03 | Two independent tracks, complete pile rectangles, 16px inset/24px gaps/max 256px pile; common left book/title rail, subtle right taper (8px maximum per level, capped to 3% of pile width); partial pile bottoms touch continuous planks outside scroll tracks. | `horizontalShelfLayout.ts`, `LibraryHorizontalShelf.tsx`; layout tests and measured live/17-entry fixture contacts/offsets; alignment refinement measured at 320/390/430px. |
| LIB-HS04 | Page-estimated 44–52px faces, fixed 46px fallback; larger text expands layout; 528px default cabinet. Contrast-selected opaque text and existing cloth/fonts. | Layout/volume components; metrics tests, 320/390/430px and desktop web rectangles. Native text/accessibility remain unverified. |
| LIB-HS05 | Real ID tap routing, full metadata labels/chooser, visible abbreviated author tags where width permits; shared filter data. | `HorizontalBookVolume.tsx`; component/Home tests, live Dune/Wishlist checks. |
| LIB-HS06 | Shared draft survives style switching; Earlier/Later updates canonical order; Undo snapshots both canonical order and Horizontal tier membership; Save/Cancel and reconciliation cover both. | Home/shared hook, `LibraryArrangeControls.tsx`; hook tests cover v1 upgrade, tier transfer, Undo and v2 Save. |
| LIB-HS07 | Independent 44px overflow controls/boundaries, native scrolling and motion-safe feedback. Hover and focus are independent sources; keyboard focus takes caption priority and pointer exit cannot clear it. | Cabinet/volume; control/cancellation/reduced-motion tests, isolated independent-track checks; Luna Max source review and 68 focused tests pass. Exact simultaneous pointer-hover/focus sequence remains unverified in-browser. |
| LIB-HS08 | 450ms quick look, canceled movement/scroll, consumed release, chooser alternative, truthful loaded facts, Close/Escape/back/View details. | Quick-look/volume/chooser; press-responder timer/data tests, authenticated modal/focus. Native gestures/back/assistive focus unverified. |
| LIB-HS09 | Horizontal tier/pile hit testing, final-layout marker, pan/overlay, destination-only edge scrolling and independent per-book tier transfer. The dragged book changes tier; other books retain membership. | `horizontalShelfArrange.ts`, `useHorizontalShelfDrag.ts`, Home; geometry/state tests assert single-book transfer and destination-tier placement. |

Scrollbars remain hidden because consuming web scrollbars clipped resting faces. Next-pile visibility, caption and explicit controls signal overflow. Full title/author are available in caption/chooser/quick look. Horizontal contract §10 records material/font/touch-size deviations; §12 records B/C source and web evidence. Native/assistive/performance gates remain pending. Exact logs, identity and captures are in [checkpoint evidence](./horizontal-layout-evidence-20261004/README.md) and Library tracker.

Cohesion assessment: this SDD now exceeds 400 lines and remains one Library Home acceptance/history document. The independently growing horizontal execution contract already holds its detailed plan and source comparison; further arbitrary splitting would fragment current shared-order authority.

## 28. Horizontal tier membership and transfer (2026-10-05)

The user approved changing Horizontal cross-tier drag so that only the dragged book transfers between tiers. This supersedes §23's original even-half behavior for Horizontal Arrange. The vertical shelf keeps its existing balanced row projection and shared canonical order.

- The shared `order` remains the source for List and Vertical. Horizontal stores a separate tier membership map as top/bottom Library-entry ID arrays. Horizontal displays each tier by filtering the shared order through that membership, so within-tier ordering remains deterministic and other views keep the shared sequence.
- First use and legacy v1 order-only storage initialize tiers with the existing balanced split. The first Save writes arrangement format v2 with the shared `ids` and `tiers`; reads prefer `library_shelfOrder:v2:<userId>` and fall back to `library_shelfOrder:v1:<userId>`. No existing v1 data is rewritten until the user saves. No server sync, query, schema, migration, or database change is introduced.
- A Horizontal drag to another tier changes only the dragged ID's tier membership. Its shared order is inserted at the requested destination anchor; all other tier memberships remain unchanged. Drops into an empty tier are valid. Unequal tier lengths are supported, and each tier keeps its own horizontal overflow/scroll track.
- New IDs retain the existing saved-order append policy and are assigned to the shorter tier (ties go to the upper tier). Removed IDs are pruned during reconciliation. Membership changes during an active draft continue to cancel the draft with the existing message.
- Earlier/Later still changes the shared order. Vertical rendering continues to split that sequence as before; Horizontal retains its per-ID tier membership when switching back. One-step Undo restores both the order and tier assignments; Cancel discards both; Save persists both together on this device.

The independent review correctly identified that the previous shared-order-only implementation could not provide stable tier membership: moving one book across the calculated boundary also moved a neighboring book. This change replaces that behavior with the explicit Horizontal tier contract above. Focused source tests pass. The authenticated browser rendered Arrange, but the cross-tier drag attempt did not move a book; live transfer and reload persistence are not yet accepted. The full evidence and exact follow-up are in the Library tracker and [Horizontal contract §16](./HORIZONTAL-SHELF-IMPLEMENTATION.md#16-independent-horizontal-tier-membership-2026-10-05).

**Alignment follow-up:** the user accepted A and requested improved alignment. Book/title left edges are shared per pile; widths vary at the right edge only. Author labels use a consistent right-aligned slot; focus/selection outlines are decorative and do not reflow text. [Horizontal contract §11](./HORIZONTAL-SHELF-IMPLEMENTATION.md#11-alignment-refinement-2026-10-04) records the exact source scope and fresh verification. This visual refinement adds no browsing/dragging feature.

## 24. Vertical book and cabinet material follow-up (2026-10-04)

The user requested a more realistic vertical book and cabinet appearance. This follow-up supersedes §12's earlier narrow height band and upright-only posture while preserving its page-count width rule, saved order, row projection, interactions and 440px cabinet geometry.

- `spineMetrics` retains `round(clamp(24, 44, 20 + 0.04 * page_count))` and the 32px unknown-page fallback. Height stays independent of page count but now varies deterministically from **144–168px**, still within the 192px row.
- `computeShelfPosture` is now used by vertical row rendering. A row of four or more gets one adjacent pair with a **2–3°** lean; larger rows scale to at most two pairs per dozen. Posture follows row order, not persisted identity, and is removed while arranging.
- `BookSpine` adds a stronger convex light profile, selective shallow page-edge detail and selective raised binding ribs. The matching-color opaque title region, contrast calculation, hit bounds, spine width and selection/press behavior remain unchanged.
- The shared cabinet SVG has irregular, low-contrast wood growth lines. The vertical cabinet adds a top cap, subtle board-to-side joints and inner-edge shading, with a less card-like frame radius. Shelf, row and board positions, support/bookend placement and scroll calculations do not change. The shared texture also applies to horizontal shelf surfaces.

Verification: Shelf/layout Jest **72/72 PASS**; fresh web export PASS, **2,341 modules**. The authenticated app initially opened in Vertical; Horizontal was selected and left active for review. All eight existing entries rendered in each style. Full TypeScript still reports the historical 36 diagnostics outside Library (the E2E fixture type mismatch and `.ts` import-extension diagnostics); this unit added no Library diagnostic. This does not verify native rendering, native gesture feel, screen-reader behavior or large-library performance. The cabinet and vertical book details were reviewed in the live browser; no screenshot file was added.

### Google Books Search availability investigation

`booksService.ts` calls the public Google Books volumes endpoint without an API key or OAuth token, and no Google Books credential/configuration is present in the app environment. The fallback catch drops Google's failure details and searches Open Library instead. A live “Dune” query displayed the Open Library fallback banner; Open Library results loaded. A missing request credential is therefore the likely Google Books cause, but the exact HTTP/network response cannot be established while the error is suppressed. Google's [API authentication guidance](https://developers.google.com/books/docs/v1/using) requires public API requests to identify the client with an API key or OAuth token; the [volumes.list reference](https://developers.google.com/books/docs/v1/reference/volumes/list) documents the endpoint in use. No Google credential, provider record, database, Storage, migration or external service was changed.

Exact next Library action: configure Google Books through a restricted credential path, then run a live query and preserve only a sanitized provider error classification when fallback occurs. Marketplace Phase 9/M46 and its authority are unchanged. This SDD remains cohesive as the current Library Home contract and history document; its growing Horizontal contract remains separate by semantic responsibility.

## 25. Horizontal book and cabinet material follow-up (2026-10-04)

The user clarified that the vertical physical treatment should carry into the horizontal presentation. Horizontal volumes retain their existing measured width/height, pile taper, title/author slots, accessibility names and Pressable/drag bounds. Their cloth face now has a clearer soft light falloff, inset hard-cover lip, raised binding ridge, paper fore-edge with page rules, and a stronger resting shadow. The horizontal cabinet now uses a warmer grained interior with subtle side rails and a floor contact shade; its plank has a lit top plane, layered face, board joints and darker underside. These are presentation details inside existing layout boxes; they do not change pile geometry, scrolling, book order, quick look, dragging, or saved preferences.

Verification: fresh Expo web export PASS (**2,341 modules**). Reloaded the authenticated `localhost:19006/library` app and confirmed all eight existing book entries in Horizontal; inspected both upper and lower shelf material in the live browser. One entry per tier pile was visible, so this account view did not exercise horizontal overflow. Automated tests were not rerun for this style-only iteration; prior horizontal behavior evidence remains historical. No book/order/data state, database/Storage, Google credentials, migrations, dependencies, or external state changed. The view-style preference was set to Horizontal through the app and persisted. The vertical source-only work is committed as `f8b171a`; horizontal shelf component files were already untracked before this refinement and remain outside that commit to preserve the larger uncommitted horizontal implementation. Native rendering, touch, assistive technology and representative large-library performance remain unverified.

Exact next Library action: user review of the Horizontal shelf finish in the current local app. Google Books credential setup remains a separate future action; no credential was created or stored. Marketplace Phase 9/M46, DOC-13/ACTIVE and database-mutation authority are unchanged.

## 26. Horizontal realism parity checkpoint (2026-10-04)

The user approved carrying the visual cues missing from Horizontal into its actual renderer. `LibraryHorizontalShelf.tsx` now matches Vertical's recessed walnut palette, visible shared grain, cabinet side supports/top cap and plank treatment. `HorizontalBookVolume.tsx` adds oriented cloth, convex thickness lighting, seeded shallow binding ribs/paper-edge widths, asymmetric cover corners and stronger layer/contact edges. Opaque title/author backgrounds preserve settled palette contrast. Decorative additions have no input behavior; the measured face rectangles, common left rail/right taper, page-count estimates, independent tracks and shared Arrange order remain unchanged. LIB-HS03/04 presentation traceability now includes Horizontal contract section 14 and its source/capture evidence; LIB-HS05/06/09 remain covered by the browser detail/drag/Undo/Cancel regression checks.

Verification: 32 tests across four existing horizontal geometry/arrangement/drag/press suites PASS; TypeScript retains 36 diagnostics outside Library and zero Library diagnostics. Fresh exported entry `entry-4b1dc543240303ea96173d1793ed5f83.js` matches local/served HTML and bundle and is observed in the authenticated browser. SHA-256 `AC3570BD790800DCC006EAA14D362B01B64BFBDA671B7741A5F95D0FB5097424`. Browser checks: default pane and 320px, both tiers, empty Reading filter, correct Dune detail/return, actual upper-pile reorder followed by Undo/Cancel. Original account order retained; no Save. [Final visual evidence](./horizontal-layout-evidence-20261004/horizontal-realism-finish.jpg).

No live overflow was present with eight books; native/assistive/performance acceptance is not established. Temporary viewport reset, All/Shelf/Horizontal restored. No database/Storage/provider/credential/migration/dependency changes or staging/commit/push/deployment. Source/doc changes remain uncommitted, including the pre-existing untracked horizontal implementation. Next authorized action: user visual acceptance of the horizontal refinement. Phase 9/M46 and global handoff are unchanged. This SDD remains cohesive as the Library Home contract; detailed Horizontal behavior/evidence stays in its separate semantic contract.

## 27. Preserve focused caption during pointer exit (2026-10-04)

A bounded correction separates pointer hover from keyboard focus in the Horizontal caption state. Keyboard focus has precedence when choosing the active book; hover-out clears only the hovered entry, blur clears only the focused entry, and arrangement/membership resets clear both. The source fix is in `HorizontalBookVolume.tsx` and `LibraryHorizontalShelf.tsx`. Luna Max passed 68 focused tests across five suites and live-tested keyboard focus/blur. The browser did not support pointer-only movement to reproduce simultaneous focus and hover; that specific live sequence remains unverified. This does not change tap routing, the 450ms Quick look, title slots, or shelf layout.

## 28. Search presentation and catalogue record disclosure (2026-10-05)

LIB-SR01: Search uses Library appearance/typography and a centered responsive frame; controls and actions provide 44px minimum targets. Loading, fallback, empty/error and manual-entry surfaces share paper/ink styling. Result labels stay opaque during entry.
LIB-SR02: Cached pages preserve items, total, pagination and provider/filter metadata. Explicit submit after debounce saves successful recents without duplicate network search; pending submission saves after completion.
LIB-SR03: Record details toggles available publisher, publication date, pages, language and ISBN fields. For Open Library fallback with a supported language filter, use a returned nested edition whose language matches that filter and map its available title, subtitle, publisher, date, language, ISBN, cover, page count and info link together. If no matching edition is returned, retain only a work-level title/author when the work language confirms the filter; suppress aggregate ISBN, cover, first-publication year, publisher, and page count. Use the work URL, not an arbitrary edition key. Exclude the work when neither a matching edition nor confirming work language is returned. Advance pagination by provider rows consumed, even when some rows are omitted. Catalogue records remain separate; cross-provider identity and a full edition picker are not included. No new schema is introduced.
LIB-SR04: Newest First compares parsed publication-date values across supported ISO, year/month, English-text and unambiguous day-first formats; missing/unreadable dates follow dated items. Title A–Z and Highest Rated retain their existing local ordering. Sorting applies to the results loaded into the current Search list, not the entire remote catalogue before pagination.

Source: Library search route, search components, booksSearchCache/booksService and `src/features/books/utils/searchResults.ts`. Acceptance evidence and limitations: Library TRACKER Search checkpoint. Open Library live fallback and a matching French edition were verified; live Google success, write actions, native input and full assistive-technology acceptance remain unverified.

### Search QA and date-order correction (2026-10-05)

The prior work-level mismatch was reproduced with a French filter: the result disclosure combined French language with an English-edition ISBN. Search now requests nested edition metadata and uses a language-matching nested edition for the card and disclosure when the provider returns editions. The live Dune/French result now reports French, publisher Robert Laffont, publication date 1 October 2020, ISBN-13 `9782221249482`, and the matching cover. A follow-up guard now retains only work-level title/author text when no nested edition is returned and the work language confirms the filter; it suppresses aggregate ISBN, cover, first-publication year, publisher, and page count, and advances the provider offset past omitted records. The original screenshot `search-reading-room-20261005.jpg` is retained as pre-correction reproduction evidence; it is not the corrected state.

The same QA found Newest First comparing provider date strings lexicographically: a 1981 item appeared ahead of a 1989 item. `searchResults.ts` now parses provider date formats and leaves unreadable dates last; regression cases cover the observed order, day-first dates, missing dates, and relevance-order identity. Live browser verification in the final exported bundle showed 2003 before 1989 before 1988.

Open Library fallback was verified through title, author and ISBN searches; supported French filtering; explicit “price unavailable” messaging; record details; title and newest sorting; short-query guidance; no-results/manual-entry cancellation; recent-search handling; pagination; and 320/390px width checks. At 320 and 390 CSS pixels the document scroll width equaled the viewport. A global bottom navigation bar still exposes several truncated/internal route labels at narrow widths; it was not changed in this Search-only checkpoint. Browser QA activated no Add/Wishlist/Share actions and made no library-row writes. See the Library tracker for exact test counts, coverage, build identity, residual risks and closeout.

## 2026-10-06 — Bounded Search continuation and filter contract

Search continuation pages use the provider chosen by the first successful page, preserving that provider's cursor and totals. A Google continuation failure is surfaced; it cannot silently append Open Library records. Open Library continuations do not retry Google. New first-page searches, refreshes and filter changes may select a provider anew. Explicitly submitted queries shorter than three characters requery on filter apply/remove; unsubmitted short queries keep typing guidance. Open Library fallback and unsupported-filter notices are visible for empty results as well as populated results. This corrects confirmed review defects without adding catalogue features. Acceptance is covered by the 2026-10-06 regression evidence in TRACKER.md; real Google success/native/assistive-technology validation remains unverified.