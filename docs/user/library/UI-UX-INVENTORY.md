# Library UI/UX Inventory and Stitch Handoff

**Purpose:** Evidence-based map of the Library experience for the Stitch redesign. Distinguishes current app behavior, prototype-only decisions, and gaps. Read before designing more Library screens.

For the exhaustive source-traced control and route outcomes, see [INTERACTION-MAP.md](./INTERACTION-MAP.md).

**Reviewed:** 2026-10-03 (R1–R5 corrections; prior sections retain dated design evidence)  
**Worktree:** `Bookconnect4_library` / `codex/library-cover-shelf`  

**Current implementation authority:** the user subsequently selected the exact vertical screen `93ad8bd053b54ed4b3ec666d6093a291` in project `5737794884356081757` for replication in the existing Shelf. SDD-05 §11 and the Library tracker own this unit; it precedes the horizontal contract below.
**Latest aesthetics implementation:** the user approved the recommended SDD-05 §13 units 1–2 checkpoint. §14 records the implemented shared Library appearance, visible Shelf/List selection, Add/Search in both modes, filters/count before the collection, wrapping at narrow widths, and walnut cabinet grain/depth. List/card palette and typography match Shelf. Proportions/support and existing data/routes remain. Supporting-card layout, cover fallbacks, captions, shared navigation and other route styling remain later work.
**Independent-review corrections:** SDD-05 §16 owns the locally corrected List scroll structure, contrast-selected opaque spine labels, chip/collection predicate parity, book-height brush bounds and the accessible “Choose a book” dialog. Fresh evidence is in the Library tracker. Independent correction rereview and native-device acceptance remain open; this is not final acceptance.
**Entrance contrast follow-up:** the returned correction rereview found that ancestor opacity still reduced contrast during entrance. SDD-05 §17 now keeps the cabinet/labels opaque throughout a translation-only entrance, with a stationary first frame under reduced motion. Fresh authenticated verification is recorded separately from the earlier isolated fixtures.
**Scope:** Library routes, components, feature services, Library SDDs/tracker, and Stitch screen `Library - Book Details / Overview` (`e29e2b9ff5ba477f8eaa49107bce226b`) against shelf `37d7eced4f94471087a286d52d2e6eaf` in project `2331124625547392526`.

## 1. Product and navigation context

- Library is one of five app-level destinations: Library, Exchange, Marketplace, Clubs, Profile (`app/(tabs)/_layout.tsx`). Do not add a second app-level bottom bar inside Library.
- Library currently has a stack: home (`index`), catalogue search/add (`search`), per-book detail (`[bookId]`), and per-book Notes (`notes`). Notes takes a `userBookId` and `bookTitle`; it is not a global all-books notebook.
- The vertical Stitch prototype has an inner pill bar, but its earlier no-op app counterpart is removed from Home in this unit. App-level navigation remains available.
- Keep catalogue discovery distinct from searching a reader's existing collection. Current home Search/Add routes to catalogue search; local collection search is not present as a separate feature.

## 2. Existing feature groups and evidence

| Reader task | Current app behavior | Evidence and design implication |
|---|---|---|
| Browse collection | Authenticated user's books; visible Shelf/List buttons with persisted selection; All/Reading/Completed/Wishlist filters and filtered count before either collection; counts use the same predicates; filters wrap when narrow. List has one bounded FlatList containing its heading/controls and owning pull-to-refresh; loading/error/empty states and matching appearance remain. User mode changes preserve web focus. | `app/(tabs)/library/index.tsx`, `LibraryHeader`, `LibraryFilterBar`, `LibrarySummary`, `LibraryBookList`, `LibraryShelf`, `LibraryAppearance`. SDD-05 §14/16 acceptance and fresh evidence; native refresh/windowing remains NOT_RUN. |
| Browse tactile shelf | Two rows of upright cloth spines, saved-page widths 24–44px with a 32px fallback, independent 144–156px height, left wooden edge support, small 1–3px gaps and brass bookends on nonempty rows; shared overflow track, continuous fixed planks, hover/focus/brush feedback bounded to book height, pull-out/press motion, reduced-motion guards. Opaque labels have contrast-selected text. Nonempty Shelf provides “Choose a book” with full titles/authors and independent ≥64px rows for activation. Hover, keyboard focus, or press-in also fills the below-cabinet chooser control with the active spine's saved full title and available authors; spine release still opens the existing detail. | Current explicit vertical selection and proportion/support correction: `SDD-05-library-reading-room.md` §11–12/16/18; `LibraryBookPicker`. Widths stay stable through filtering/viewport changes; raw spines remain 24–44px targets without overlapping hitSlop. Chooser selection uses the existing detail ID, with Close/Back/Escape dismissal. Unit 3 keyboard caption and detail path checked in the running web app; native and separately driven hover checks remain NOT_RUN. Horizontal stacks remain subsequent work; no orientation selector or quick-look stats is added here. |
| Find and add | Google Books catalogue search, recent searches, sort by relevance/rating/date/title, genre/language/free-paid filters, pagination, offline cached results, add to library, wishlist toggle, manual title/author entry, external preview and share. | `app/(tabs)/library/search.tsx`, `src/components/search/*`, `booksService.ts`. This is catalogue discovery, not local-library search. |
| Manage one book | Detail screen; status (Want to Read/Reading/Completed); ownership (Owned/Borrowed/Lent Out/Wishlist); condition (New/Like New/Good/Fair/Poor) for Owned/Lent Out; lending availability only for Owned; personal star rating; editable review and public/private control; community reviews; book metadata; remove-from-library confirmation. | `app/(tabs)/library/[bookId].tsx`, `StatusSelector`, `OwnershipSelector`, `ConditionPicker`, `RatingInput`. Preserve conditional settings and privacy semantics. |
| Keep reading notes | Per-book recent three-note preview and count; full per-book Notes route; Quote/Reflect/Distill/Apply categories; category filters and counts; add/edit/delete; optional page number; editor save validation; private-by-owner access. | `SDD-02-notes.md`, `notesService.ts`, `notes.tsx`, `NoteEditor`, `NoteCard`. A private reading note is different from a review whose visibility can be public. |
| Save book pages | Per-book Saved Pages list with page number, excerpt, word count and update date; delete confirmation; capture text in Note Editor and save it to the vault. Constraints: max 800 words and 4000 characters. | `SDD-03-ocr-vault.md`, `VaultPagesList.tsx`, `userBookPagesService.ts`, `ocrWordCap.ts`. Design list, empty state, capture/editor, and page detail states. |
| Scan page text | Camera capture, language selection, OCR prefill into note editor, manual paste fallback, and save as note or page. Expo Go blocks native OCR; English on-device scan requires development build; non-English cloud fallback is not deployed/verified per tracker. | `NoteEditor.tsx`, `ocrService.ts`, `SDD-03-ocr-vault.md`, `TRACKER.md`. Treat scanning as a gated capability in prototypes and implementation planning; manual text entry remains usable. |

### Status versus wishlist terminology

`reading_status` and `ownership` are separate concepts. Want to Read is a reading status; Wishlist is an ownership/acquisition state. Keep them distinct in labels and data mapping. The home filter chips currently expose All, Reading, Completed, Wishlist, so Want to Read has a selector but no corresponding home filter. Decide whether it gets a dedicated filter before design lock; do not silently collapse the two concepts.

## 3. Data truth and prototype caveats

- The vertical unit removes hardcoded `65%`, `12 notes`, and `148 wishlist`. Current Read uses an actual reading entry without a progress percentage; total-library and wishlist tiles use actual collection counts. Current Read opens details when present; Wishlist selects the existing filter. Notes totals remain unavailable on Home.
- Current prototype `Atomic Habits` is acceptable as sample content, but note and saved-page counts `12` and `3`, rating `5.0`, reflection copy, acquisition date, and physical shelf placement are prototype values. Confirm each against the actual sample fixture/schema before carrying it into app code. Do not represent these as user data.
- The current app stores a rating and review, including a public/private choice. Stitch's Reader's Log visually combines a private note with a rating; redesign it to read as **My rating and review**, explicitly show privacy, and keep book notes in the Notes tab.
- The generated detail uses two repeated `Atomic Habits` headings. Use one title in the hero; let lower sections state their own purpose.
- The selected Stitch canvas generated a screen sized **390 × 1767**, while the request named **390 × 884**. Treat that as an overlong scroll-page artifact and refine the frame/layout before adopting it as the phone screen. The preview showed the hero and tabs with the Overview continuing below the fold; inspect the complete screen after resizing.
- Stitch confirmed that the shelf-to-details connection is pending. The Book Details screen was visually inspected; its tabs, Edit Book, save behavior, and return interaction have not been functionally verified.
- Edition publisher/date/pages/ISBN may come from book metadata when present. Show optional metadata only when available. Acquisition date and shelf/bay placement are not established by the reviewed detail UI contract; leave out unless a source field is confirmed.

## 4. Recommended screen information architecture

1. **Library Home:** heading, catalogue Add/Search entry, shelf/list switch, filters, and book collection. Keep the current target horizontal shelf as the visual focal point. Home has loading, error, empty-library, empty-filter, and many-books states.
2. **Book Details:** one book hero and local tabs `Overview | Notes | Saved Pages`. Overview contains optional metadata, personal rating/review and privacy, plus a clearly named Edit Book entry. Put status, ownership, applicable condition/lending settings and removal in the edit surface. Avoid duplicating the title or inventing reading-progress fields.
3. **Notes:** per-book category filters, note cards, page references, add/edit flow, empty category and no-notes states. Keep long press as a shortcut only; expose edit/delete actions accessibly.
4. **Saved Pages:** per-book page list, page detail/read view, empty state, add/paste/scan entry. Explain clipping at the limits when applicable; separate OCR-unavailable and permission errors from empty content.
5. **Find/Add Books:** existing catalogue flow with recent searches, filters/sort, results, offline-cache notice, no-result/manual-entry route, adding state, already-in-library/wishlist state, and success/error feedback.

Navigation graph: `Library Home → Book Details → Overview / Notes / Saved Pages`; `Notes → Editor`; `Saved Pages → Page detail / Capture`; `Library Home → Find/Add → Library Home`. Keep Quick Stats as a contextual sheet on a book, with a visible button alternative to long press. It is deferred in the Library Stage-1 contract, so schedule it as a later, separately scoped feature.

## 5. Stitch screen review and next design order

Generated Book Details is a useful visual draft, not yet an implementation specification. Keep the warm ivory/walnut/brass direction, compact book hero, and three local sections. Refine its 390 × 884 frame and title hierarchy; remove unverified ownership-history/shelf-placement claims; make review ownership/privacy clear; use clearly identified sample data. Then design in this order:

1. Refine Book Details Overview and the edit-book state against the fields above.
2. Create the Notes tab/full-list screen and Note Editor modal/dirty-dismiss state.
3. Create Saved Pages list, page reading state, and paste/capture states. Show OCR as available only in the appropriate build.
4. Connect the shelf spine and existing Current Read detail action to the Book Details screen; connect back and test links in Stitch Preview.
5. Refine Find/Add only if the current catalogue screen fails the target visual system; it already has a functional flow to preserve.
6. Add all important states and test narrow/wide text, missing cover, long titles, zero/one/many books, empty notes/pages, offline search, and error/retry screens.

Do not design separate Reading Session, Reading History, streaks, goals, or analytics screens as if they existed. The current `65%` is hardcoded and no session/progress-write workflow was established in this audit. Those are product proposals requiring their own data and scope decisions.

## 6. Evidence boundaries and next handoff

- Source inventory is code/documentation inspection; this pass did not re-run app tests or live Supabase reads and did not mutate data/schema. The required Phase 9 continuity/documentation validator passed (76 Markdown files, repository diff check PASS); its document-size advisories are pre-existing marketplace files.
- `TRACKER.md` last recorded (2026-09-29) a mocked web smoke pass and a failing full TypeScript run: unsupported `menu-book` Ionicons name plus existing E2E/import-extension errors. Those are the last documented results, not a fresh check in this design review.
- Existing workspace changes were present before this review; preserve them. No app code, migration, database/storage state, deployment, stage, commit, or push was performed for this inventory.
- **Next design work unit:** resize/refine `Library - Book Details / Overview` in Stitch to a 390 × 884 phone frame and correct the sample/data-boundary issues above; then design Notes. The app handoff written at inventory time is superseded by the newer Unit 3 implementation checkpoint in [the Library tracker](./TRACKER.md) and SDD-05 §18. After the user reviews that caption, the tracker asks whether to continue with Unit 4 or the separate Horizontal Stacks work.

## 7. Stitch prototype progress — 2026-10-02

The existing Stitch project [2331124625547392526](https://stitch.withgoogle.com/projects/2331124625547392526) now has a 22-screen Library prototype. The 17 earlier screens remain as drafts/experiments. Five refined alternatives were added:

| Refined screen | Purpose and current state |
|---|---|
| `Library Home — List (Refined)` | List mode with List/Shelf switch, status filters, book rows, and five app tabs. The generated version still repeats the Library label and Search action in its top and content bars; revise before treating it as final. |
| `Library Home — Shelf (Horizontal Stacks)` | Books lie flat in horizontal stacks on continuous walnut planks; the shelf occupies over half the viewport and shows a rightward browse cue. The resting state has no stats overlay. Category labels such as “Main Study”, “Essays & Discourse”, “Tier I/II”, “Archival Stacks”, and “Cabinet Overview” are generated mock copy and not app data. Long-press behavior remains unverified. |
| `Book Notes — List (Refined)` | Per-book notes with category chips, private labels, a visible Edit affordance, and Add note. Entry count and page numbers are sample values, not user data. |
| `Find Books — Results (Refined)` | Catalogue results with filter/sort controls and add/wishlist/preview actions. Results, the generated “7 editions” count, and edition metadata are illustrative and unverified. |
| `New Note — Editor Sheet (Refined)` | Editor modal with category chips, note body, optional page number, word count, Scan Page, and vault action. It still contains generated “Permanent Reading Vault / Archival Sync / Indexed” copy and a hard-coded page number; correct before implementation. |

The mismatched `Library Home — Shelf (Refined)` editor image was removed from the active prototype screen list; the horizontal-stack Shelf is the connected Shelf destination. Preview connections were checked by keyboard activation in Stitch: List ↔ Horizontal Stacks; home Search/Add Book → refined Search results; Search results Back → refined List; Search → existing Filter and Sort sheets; Notes Add note → refined editor. The editor content remains unapproved even though its route is connected. Other legacy screens and destructive/error/loading states were not all rechecked in Preview.

This is a Stitch-only design artifact. No application code, tests, database/storage records, migration, deployment, staging, or commit changed in this work. **Next design work unit:** correct the remaining duplicated List header and inaccurate Editor/Search/Notes sample content, then inspect the Details and Saved Pages screens and test their routes. The app implementation work unit remains the separate Library TypeScript/code gate in `TRACKER.md`.

## 8. Horizontal implementation reference (2026-10-02)

An earlier user-directed Library implementation handoff selected **Horizontal Stacks**. The current branch is `codex/library-cover-shelf`, and prior uncommitted work was carried intact. The selected horizontal screen is `b64af6d9e5b140358fab35e66b30926f`, not the earlier journey node `37d7eced4f94471087a286d52d2e6eaf` or the Front Covers proposal. The later approved vertical Unit 3 work is recorded in SDD-05 §18; Horizontal Stacks remains a separate pending implementation option.

The source inspection found two independent horizontal overflow tracks with mandatory snapping, hover-only feedback on top volumes, no authored book navigation/long press, static sample filtering, and a List/Shelf script that changes selected styles. Upper-tier keyboard scrolling was verified from 16 to 193.600006 px while the lower tier stayed at 16; one visible book tap produced no details. Source widths and frame-height inconsistencies require explicit responsive app geometry. Touch smoothness and app parity are not yet demonstrated.

Use [HORIZONTAL-SHELF-IMPLEMENTATION.md](./HORIZONTAL-SHELF-IMPLEMENTATION.md) and its captured source/screenshot for the first app work unit, including dynamic book placement, actual scroll/tap/press/quick-look handlers, data truth, and focused checks. The existing app source map remains unchanged; this session saved inspection/reference documents only.

## 9. Arrange feature and architecture (2026-10-03)

The user authorized implementing Arrange on the vertical Shelf after checkpoint `60ac8dd`. Current uncommitted source adds the shared order/storage layer and vertical interaction; [SDD-05 §§20–21](./SDD-05-library-reading-room.md#20-arrange-shelf-shared-order-separate-dragging-2026-10-03) owns the design and the [Library tracker](./TRACKER.md) owns verification.

The simplified feature uses Arrange/Undo/Save/Cancel, drag/drop placement feedback, and automatic scrolling to off-screen targets. One Library-ID sequence and draft/Undo/save state are shared by vertical and horizontal Shelf styles. Each style implements its own hit testing, drag feedback, and edge scrolling: vertical rows move together; horizontal tiers remain independent. Users change order; the app derives rows/piles and spacing. The searchable destination selector and extended undo history are deferred; keyboard access, reduced motion, and failed-save recovery remain acceptance requirements (LIB-ARR01–05).

Current vertical controls: Arrange shelf -> All-books draft; tap/chooser -> selected book; drag -> insertion; edge hold -> shared-track scroll; Earlier/Later -> keyboard movement; Undo -> one prior move; Save -> account-scoped device-only persistence and browse; Cancel -> discard. Filters, view switching and catalogue actions are disabled during the draft. Read/save failures have visible recovery. New entries append to a saved order; membership changes cancel editing. Horizontal presentation, cross-device synchronization, a searchable destination selector and extended Undo are pending/deferred. Future horizontal work must reuse the existing shared source from SDD-05 §21 and implement its own independent-tier gestures. Prior prototype/baseline tests cannot establish new Arrange acceptance; use the tracker evidence.
