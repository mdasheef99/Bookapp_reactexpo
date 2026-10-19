# SDD-07: Book Section UI/UX Overhaul

**Status:** APPROVED 2026-10-18 by the owner, with the recommended answers recorded as decisions D07-01–D07-08 (§9). Owner's words, relayed by the orchestrating session: "I approve the SDD-07 draft with your recommended answers to the 8 open questions. Record the decisions in SDD-07 and the tracker, then plan the foundation unit." Approval covers the approach, rules, scope and flow order. It does **not** authorize implementation, dependency installs, Stitch generation, migrations or commits. Later approvals (2026-10-18): the [foundation plan](./SDD-07-FOUNDATION-PLAN.md) and its 3 dev tools; Flow A Stitch generation; the Flow A direction and the DP-01 amendment (D07-09, D07-10), with the [FA-P1 prototype](./SDD-07-FLOW-A-PROTOTYPE.md) as the next unit. Flow A design FINALIZED 2026-10-18 under the owner's delegation (D07-11–D07-15, §10).
**Date:** 2026-10-18
**Worktree:** `Bookconnect4_library`, branch `codex/library-cover-shelf` (library only)
**Roadmap:** [LIBRARY-ROADMAP.md](./LIBRARY-ROADMAP.md) — SDD-07 is the main track; SDD-08/09/10 land on its screens.
**Supporting:** [Stitch scorecard](./SDD-07-STITCH-SCORECARD-20261018.md) · [Screen audit evidence](./evidence/library-screen-audit-2026-10-18/README.md)
**Migrations:** none. SDD-07 is UI only.

## 1. Scope

Six screens under `app/(tabs)/library/`:

| Route | Screen | One-sentence purpose |
|---|---|---|
| `index.tsx` | Home / shelf | Show the reader their books, as a shelf or a list, and get them to any book in one tap. |
| `search.tsx` | Search | Find a book in the catalogue and add it to the library, with honest provider data. |
| `[bookId].tsx` | Book Details | Show this book and what the reader has written about it, and let them add a note. |
| `notes.tsx` | Notes list | Show all the reader's notes for one book, newest first, filterable by category. |
| `note.tsx` | Note reader | Let the reader read one note comfortably, and edit or copy it. |
| `note-compose.tsx` | Composer | Let the reader write a note, or capture one from a photo (intake → crop → OCR review), and save it deliberately. Steps: `choose`, `write`, `intake`, `crop`, `review`, `no-text`, `failure`. |

Shared chrome in scope only where it touches these screens (headers, back behaviour, state components). The global tab bar is app-wide. Its contrast issue RA-W01 (tab labels 4.02:1 / 3.27:1) is tracked here as a dependency, but its fix needs a separate, scoped decision because the tab bar is shared with clubs.

## 2. Design approach (owner-approved 2026-10-18)

> **BookConnect's library should feel like a quiet, well-made reading room: it shows your books and thoughts beautifully, works without explanation, and never asks for your attention.**

| Role | Source | Used for |
|---|---|---|
| Main approach | **Calm Technology** (Amber Case) | Use the periphery; inform without demanding; the app works even when it is ignored |
| Visual hierarchy, spacing, colour | **Refactoring UI** (Wathan & Schoger) | Hierarchy by weight/colour before size; spacing scale; limited greys; fewer borders |
| Text | **Bringhurst, *The Elements of Typographic Style*, via Butterick's *Practical Typography*** | Body size, line height, measure, type scale, hierarchy through typography |
| Flows | **Krug, *Don't Make Me Think*** | Self-evident screens, obvious primary action, clear back destinations |
| Baseline | **WCAG 2.2 AA** | Contrast, target size, labels, reflow/zoom, focus |
| Platform behaviour | **Material 3** (Android) + **Apple HIG** (iOS) | Back/gesture behaviour, sheets, dialogs, haptics, safe areas |

**Explicitly not followed:**
- Engagement or habit design: streaks, badges, reminders, "you haven't read in N days", progress pressure.
- Trend styles: glassmorphism, neumorphism. The existing `GlassCard` is not used in redesigned book-section screens.
- Material You wallpaper-derived dynamic colour. The library keeps its own palette in all three time phases.

## 3. Design rules DP-01 to DP-07

Each rule has a pass/fail check, how it is checked, and when.

| Rule | Pass/fail check | How checked | When |
|---|---|---|---|
| **DP-01 Reader's content first** | In the first viewport of Book Details at 390×844, the cover and the reader's own content (status, latest notes) take up most of the area. **At most 4 focusable controls above the fold, counted from the top of the screen down to and including the primary action** (amended 2026-10-18, D07-10): a control is each focusable element, a radio/segmented group (e.g. the status selector) counts as 1, and Back counts. Collapsed secondary rows that come after the primary action may enter the fold on short pages, only if they are visually secondary: plain rows, no fills, no counts in containers. The review sits below the primary action, collapsed (D07-02). Catalogue metadata, community reviews and book options sit below the fold or collapsed. | Annotated 390×844 screenshot for each theme phase; focusable-element count from the accessibility tree, in document order up to and including the primary action (web `read_page` / Jest `getAllByRole`); check that rows after the primary are plain | Design review; acceptance |
| **DP-02 Typography carries the design** | Body text ≥ 16px. `caption` is the only style below 16px (≥ 14px, ≥ 4.5:1), used for metadata only (dates, page numbers, counts), never for note text, reviews, descriptions or button labels. Body line height 1.35–1.5 (Butterick ~120–145%; WCAG 1.4.12 allows user override to 1.5). Measure ≤ ~70 characters on wide screens. Colours, font sizes and margin/padding/gap values come from tokens. Hierarchy comes from the type scale and weight, not from boxes and borders. | Automated **ratchet** (FU-5b): lint flags colour literals, numeric `fontSize`/`lineHeight` and numeric `margin`/`padding`/`gap` in book-section files. Files a flow has redesigned are strict (zero allowed); elsewhere the count may not rise above the 2026-10 baseline (~95 sub-16px `fontSize` values today). Allow-list: token definition files (`LibraryAppearance.ts`, `LibraryTypography.tsx`), physical shelf materials and geometry (`BookSpine`, `LibraryShelf`, `LibraryHorizontalShelf`, `HorizontalBookVolume`, `bookClothTexture`, `cabinetWoodTexture`, `src/features/books/utils/shelfLayout.ts`), and `NOTE_TAG_CONFIG` until flow B replaces it. Design review for measure and line height. | Local verification run (`npm test` + `npm run lint:library`), run by the reviewer before each acceptance (there is no app CI); design review |
| **DP-03 One primary action per screen** | Exactly one primary-styled button is visible per screen state. Others are secondary, text, destructive or menu. In a dialog state, the confirm button is that state's one primary (a destructive confirm uses the destructive variant and counts as the primary). The composer `choose` step is the approved exception: Write and Scan get equal weight by decision. | Component test helper counts `BookButton` elements with `variant="primary"` per state (FU-5c) | Local verification run (Jest); design review |
| **DP-04 Calm, never nagging, no fabricated data** | Dismissible prompts appear once and remember dismissal. Passive surfaces (e.g. goal progress, today's note) are text-only, never interrupt, and use no push, badge, colour alert or deadline wording. No notification badges, unread counters or streaks: a count is allowed only as plain text, not in a filled, coloured, circular or corner-positioned container. Home filter-pill counts ("Reading 3") are allowed as plain text inside the pill label. No literal rating or review-count strings and no sample people in source or shipped fixtures; stars render only from a data field (e.g. real community reviews, Search provider ratings). Red (`error` token) only for real errors. Lending UI is removed (D07-08). | Automated: lint rule `no-fabricated-ratings` (literal strings only, FU-5b); component test that a prompt dismissal persists. Design review for count containers and red usage. | Local verification run; design review; acceptance |
| **DP-05 Honest states** | Each screen has a state matrix: loading, empty, populated, error, saving, saved, failed, offline (where it applies). Every state is designed, implemented and tested. Every save gives visible feedback on every platform, which fixes known issue **W01**: `Alert.alert` is a no-op on react-native-web, so "Review saved!" and other alerts are invisible on web. | State-matrix table per screen in each flow design; Jest test per state; browser capture per state | Design review; automated; acceptance |
| **DP-06 Accessible from the start** | WCAG 2.2 AA: text contrast ≥ 4.5:1, large text and UI-part boundaries ≥ 3:1 (1.4.11 — a control border that is its only identifier needs ≥ 3:1; today's library `border` token is 1.37–1.80:1, so F-1 splits it into `divider` and `controlBorder`), in all three phases. **Project target minimum 48dp** (stricter than WCAG 2.5.8's 24px; SDD-05 LIB-SR01's 44px for Search is raised to 48 when Search is redesigned). Every control has an accessible name/role. Focus not obscured by sticky footers (2.4.11). Dragging has a non-drag alternative (2.5.7; the shelf's Arrange is out of scope, recorded only). Usable at 200% text without clipping. TalkBack order follows visual order. Known open: **RA-W01** tab-bar contrast 4.02:1 / 3.27:1 (D07-01). | Automated: contrast test over a declared token-pair registry (every token must be registered with its role; FU-1a); axe scan on web per screen state (FU-5d); local accessible-name lint rule (FU-5b). Manual: TalkBack + 200% font on an Android device/emulator. | Local verification run; acceptance; user test |
| **DP-07 Continuity with the finished shelf** | Redesigned screens use the same tokens, fonts (EB Garamond + Manrope), motion conventions (reduced-motion guard) and cloth/wood materials as the SDD-04/05 shelf. The shelf itself is not redesigned. | Design review side-by-side with the shelf in all three phases; DP-02 token check | Design review; acceptance |

## 4. Current state

### 4.1 What SDD-05 "reading room" delivered (settled 2026-10-18)

"Reading room" was the **name of the SDD-05 shelf-refinement track and of its palette**, not a screen. No reading-room route or component was ever specified. SDD-05 §1 defines it as refining the SDD-04 shelf into a "reading room" interaction. The only code use of the phrase is the palette comment at `src/components/library/LibraryAppearance.ts:3` ("a reading-room palette"). The 2026-10-05 tracker entry "Search reliability and Reading Room presentation" applied that palette to Search.

What shipped (committed):
- `809e18e` — shelf/list home presentation and the phase palettes/fonts (`LibraryAppearance.ts`, `LibraryTypography.tsx`).
- `60ac8dd`, `e372945` — vertical shelf realism; **Arrange** (shared shelf order, vertical dragging, `useShelfArrangement` persisting order per user in AsyncStorage); shelf contact/board depth.
- `f8b171a` — vertical cloth/wood material follow-up (`BookSpine`, `LibraryShelf`, `cabinetWoodTexture`, `shelfLayout`).
- `3460035` — horizontal stacked shelf (`LibraryHorizontalShelf`, `HorizontalBookVolume`), tier membership/transfer, horizontal dragging, the shelf style control, and the **long-press quick look** (`LibraryBookQuickLook`, 450 ms; the F3 feature originally deferred in August).
- `1b743a1` — Search behaviour fixes. Search presentation (LIB-SR01–04) is recorded in SDD-05 §28.
- Also present: F4 silent brush feedback (`resolveSweptSpine` in `shelfLayout.ts`, used by `LibraryShelf.tsx`); the `[bookId]` fade transition (`_layout.tsx:14`).

Not delivered: F2 Approach B shared-element cover morph (needs a dev-build native dependency); native-device checks of the shelf (SDD-05 status line: "Native checks remain pending").

SDD-05 staleness noted, not edited here: its status line still says the horizontal files "remain uncommitted", although `3460035` committed them. It also has two sections numbered §28: "Horizontal tier membership" and "Search presentation". This SDD cites the latter as **SDD-05 §28 Search presentation**.

### 4.2 Screen audit (2026-10-18)

Evidence: [library-screen-audit-2026-10-18](./evidence/library-screen-audit-2026-10-18/README.md). A Haiku subagent captured 45 fixture states with Playwright at 390×844 (plus 1280 px desktop and three theme phases). All network traffic went to transport fixtures: fake auth, every non-GET aborted and asserted empty per test, so nothing reached the real database. It then checked the owner's real signed-in session in the browser pane read-only. Claude reviewed the flagged screenshots and reran the full capture: 45 passed, 0 non-GET writes. An independent Sonnet review then checked these findings against code; corrections below are from that review. → marks where each problem is fixed.

**Top problems, in priority order:**

1. **Three visual identities in one section (DP-07).**
   - Home/shelf: the library paper/ink palette with EB Garamond titles (`A01`, `G02-midnight-home`).
   - Book Details: the app-wide base `useTheme` colours with heavy sans titles — navy/indigo at midnight (`C01-fold`), orange on yellow at golden (`G02-golden-details`).
   - Notes reader/composer: the separate `useNoteColors` greens (`E01`, `F04`).
   The foundation unit (F-1) must therefore cover Book Details' base-theme use too, including its child components (`StatusSelector`, `OwnershipSelector`, `ConditionPicker`, `RatingInput`, `DeleteBookModal`, `VaultPagesList`). Only home and search load the library fonts today (`LibraryTypographyProvider` in `index.tsx:40`, `search.tsx:59`), so Book Details and notes never get EB Garamond/Manrope. → F-1, F-2
2. **Errors are reported as "Book not found."** A server error (`C06-fold`) and going offline (`G03-offline-after-book-click`) both show "Book not found. Go Back". Search shows the raw "Google Books API error: 500" (`B04-fold`). (DP-05) → F-4 states; flows A and D
3. **No-cover placeholder is a light block** on Book Details in dark phases (`C01-fold`, `C03-fold`, `C04-fold`). Home placeholders are muted. Cause: `[bookId].tsx:304` loads a remote `https://via.placeholder.com/150x220` image (a third-party host, broken offline) on an `#eee` background (`:633`). (DP-01/DP-05/DP-07) → F-1 `coverPlaceholder` token; flow A uses a local token-coloured placeholder
4. **Note reader: "Delete note" sits in the content area directly under the note text**, styled like the secondary Copy button, above the sticky footer with Edit (primary) and Copy (`E01`; `note.tsx:44,54`). Deletion is already confirmed by a "Delete this note?" dialog (`note.tsx:36`), but the destructive action is placed more prominently than Copy. (DP-03) → flow B
5. **No live word count or limit feedback in the composer.** 501 words can be typed with Save enabled (`F04`). The 500-word limit is enforced at save time: the 2026-10-18 release acceptance recorded 501-word validation PASS. (DP-05) → flow B
6. **Global tab bar at 390 px:** labels truncated ("Exch", "Mark", repeated "mark"), and icons render as fallback "⏷" glyphs on a white bar in every phase (`A01-fold`, all phone captures). App-wide, shared with clubs; related to RA-W01. Likely cause in `app/(tabs)/_layout.tsx`: only `marketplace/store/[storeId]` is hidden with `href: null` and no `tabBarIcon` is set, so the other marketplace routes surface as extra tabs with the default icon. SDD-05's earlier "shared navigation cleanup" unit was never done. → own app-wide unit (D07-01), to verify
7. **Spinner-only loading** on home, Book Details and notes (`A04`, `C05`, `D04`). Search already has a skeleton (`B05`). On real data the notes list showed a ~3–4 s full-screen spinner. (DP-05) → F-4 states; flows A, B, D
8. **Raw ownership enum and lending leftovers.** Home cards print the raw enum ("Lent_out", real data — `LibraryBookList.tsx:47`). Lending UI is still live although lending is removed from the roadmap:
   - an "Available for Lending" switch on Book Details (`[bookId].tsx:457-462`, `toggleLendingMutation` → `booksService.toggleLendingAvailability`);
   - an `available_for_lending` tag on home cards (`LibraryBookList.tsx:50`);
   - a "Lending" row in the quick look (`LibraryBookQuickLook.tsx:24`).
   (DP-04) → flows A and D under D07-08
9. Book Details shows a notes **count badge** in an accent circle (`C01-fold`). Under DP-04 this should become neutral text. → flow A
10. **Community reviews section** on Book Details (`[bookId].tsx:~493`, real data from the `get_public_book_reviews` RPC, stars from `review.rating`). Not fabricated, but it competes with the reader's own content. → flow A decides keep/move/collapse

**Reachable and fine:** empty states (home, Book Details zero notes, notes list), notes error with Retry, long titles (ellipsis on home, wrapping on details without clipping), category filters, discard dialog, edit mode, 500-word note reading, 200% CSS-zoom approximation without clipping.

**Not reachable on web (recorded, not faked):** on-device OCR. Web shows "Scanning text is unavailable in this browser", the crop step says "Automatic text cropping is unavailable here", and review / no-text / failure states were not reached (`F06`–`F08`). Also camera, haptics, TalkBack and OS large text. **Not captured:** saving/saved/failed save states, because the audit was write-free by rule. The 2026-10-18 release acceptance and the W01 finding (web `Alert` no-op) remain the evidence for save feedback.

### 4.3 Stitch designs

Summary of the [scorecard](./SDD-07-STITCH-SCORECARD-20261018.md):
- **Option B (B01–B16)** is the best reference. Its flow and state structure is honest and complete for notes and capture. Fix before reuse: B01's fabricated "4.6 ★ (128 reviews)", its lending row and its competing actions; sub-16px text (B04, B07, B11, B16); "Optical capture" wording (B07); stray labels on B10; inconsistent category editing (B05/B09 sheet vs B07 chips). It has no loading/offline/saved states, and its palette is a third, light-only colour set.
- **Personal Library** project: discard (P2P lending/marketplace concept, fabricated "4.8 … 2,145 reviews").
- **Editorial Reader UI**: not relevant (four clubs screens).
- **Passage Capture**: superseded; keep NR07 large-text/reduced-motion and the photo-prep screens as references only.

### 4.4 Code facts the design relies on

- **Notes** are `public.reading_notes`. `content` ≤ 500 words, enforced in the database. Optional `tag` is one of `quote | reflect | distill | apply | question`, shown as Quote / Thought / Takeaway / Action / Question, or no category (NULL). Optional `page_number` > 0. `version` column plus a revision trigger. Writes for all five categories and NULL were enabled 2026-10-18 (`1e4924a`).
- Notes are listed **per book only, newest first**. There is no cross-book view yet (SDD-10).
- **OCR** is on-device, English only, and fills the note body. The cloud `ocr-fallback` function is source only and not deployed.
- **Drafts** live in memory only. Leaving the composer after a confirmed discard loses them. Typed but un-blurred review text is not saved on navigation (accepted limitation in SDD-06).
- **Saved Pages** = `public.user_book_pages`. The UI only reads and deletes them (`VaultPagesList`, `userBookPagesService`). No current route writes them: `userBookPagesService.upsertPage` is called only from the unused legacy `NoteEditor.tsx`. Their future is an SDD-10 decision.
- **Themes:** three time-of-day phases from `src/hooks/useTheme.ts` (daylight 05–17, golden 17–20, midnight otherwise). The phase is checked every 5 minutes.
- **Fonts:** EB Garamond 500/600 (headings/serif) and Manrope 400/700 (body/labels), loaded by `LibraryTypography.tsx` from `assets/fonts/library/`.
- **Three colour systems in the book section today:**
  - Library: `LibraryAppearance.ts` (paper/ink per phase, with a contrast test, `LibraryAppearance.test.ts`, ≥ 4.5:1 for six pairs). Used by home/shelf and Search.
  - Base app theme: `THEME_COLORS` in `src/hooks/useTheme.ts`, rendered on Book Details (audit §4.2 #1).
  - Notes: `useNoteColors` in `src/components/notes/ManualNoteUi.tsx`. Hard-coded green hex (`#24543C`, `#13221C` …), only two variants (golden uses the daylight values), mixed with base `useTheme` colours, and **no contrast test**.
- **Enforcement missing:** no ESLint config file, no `eslint`/`eslint-plugin-jsx-a11y` dependency, no axe tooling in `package.json`.
- **Shelf order** lives in AsyncStorage per user (`useShelfArrangement`). SDD-10 shelves/tags must fit it.

## 5. Foundation unit (first, before any flow)

| Item | Done when |
|---|---|
| **F-1 Merge colour sets** | One book-section token set per phase (daylight, golden, midnight), replacing `useNoteColors` hard-coded hex and Book Details' (and its child components') direct use of the base `useTheme` colours (audit §4.2 #1). Contrast is tested over a **declared pair registry**: every token is registered with its role and pair, and an unregistered token fails the test. Text ≥ 4.5:1; control boundaries ≥ 3:1. The current `border` (1.37–1.80:1) becomes a decorative `divider` plus a new `controlBorder` ≥ 3:1. Golden gets its own values. Physical materials (cloth, wood, brass) stay literal and are allow-listed. |
| **F-2 Type scale** | Named text styles (display, title, heading, body, body-serif, label, caption). Body ≥ 16px; caption (≥ 14px) is the only style below 16px and is for metadata only. Body line heights 1.35–1.5. Lift `LibraryTypographyProvider` into `app/(tabs)/library/_layout.tsx` so all six routes load the fonts, keeping a defined system-font fallback while they load. |
| **F-3 Spacing/radius tokens** | One spacing scale (extends `LIBRARY_SPACING` 8/16/24) and the existing `LIBRARY_RADIUS` (`control` 12, `card` 14, `cabinet` 16); a `MIN_TARGET` = 48 constant. |
| **F-4 Shared components and states** | Screen header with named Back; primary/secondary/text/destructive button variants (DP-03 test hook), reconciling the existing `NoteButton` and `src/components/ui/Button.tsx`; state components for loading (skeletons), empty, server error vs offline vs not-found, saving, saved, failed (reusing `src/components/ui/OfflineBanner.tsx` where it fits). A cross-platform feedback component (toast/inline) that replaces `Alert.alert` for save feedback — fixes W01. |
| **F-5 Enforcement** | Add ESLint (book-section scope) with repo-local rules for raw values (DP-02 ratchet), accessible names (DP-06) and fabricated ratings (DP-04); the primary-button count helper (DP-03); and an axe scan on web (DP-06). `eslint-plugin-jsx-a11y` targets DOM JSX and `eslint-plugin-react-native-a11y` 3.5.1 only supports ESLint ≤ 8, so neither is used. Exact versions: [foundation plan §4](./SDD-07-FOUNDATION-PLAN.md#4-dev-dependencies-for-f-5-exact-list-for-owner-confirmation). |
| **F-6 Cleanup** | Remove unused legacy `NoteEditor.tsx`, `NotesList.tsx`, `TagSelector.tsx` (only referenced by `index.ts`, each other and old tests) and the unused `notesService` methods (`getNotesForBook`, `getNotesCount`, `createNote`, `updateNote`, `deleteNote` — no app consumers; `NoteCard`/types still use the module). Remove the `['notesCount', …]` invalidations in `useManualNotes.ts`, since no query produces that key. Update the affected tests. **Service methods stay:** deleting `NoteEditor.tsx` orphans `userBookPagesService.upsertPage` (the only Saved Pages write path; SDD-10 decides) and `ocrService.recognizePageViaCloud` (the undeployed cloud fallback). `recognizePageText` stays in use (`captureAdapter.ts:87`). List the orphans in the F-6 receipt. |

The SDD-06 doc lines that still said Question/NULL writes were gated (§2 Categories row, ¶73, ¶140 and the D06-03 ledger row) were corrected on 2026-10-18 as a docs-only change. Its remaining "gates remain false" lines (¶18, ¶467) are dated history and were left unchanged.

## 6. Flows

Each flow goes **designed → owner-approved → built → accepted**. The next flow is designed while the previous one is built. Every design is shown in all three phases (daylight, golden, midnight) at 390×844, plus 320 px and desktop width, with its state matrix.

| Flow | Screens | Main design questions |
|---|---|---|
| **A Book Details** | `[bookId]` | Move onto the library tokens/fonts; error vs not-found vs offline states; muted no-cover placeholder. Fold content (DP-01): cover, status, latest notes, one primary "Add note"; review below the fold, collapsed to a one-line summary (D07-02); Saved Pages hidden when empty, collapsed when present (D07-03); community reviews keep/move/collapse; remove the lending switch (D07-08); neutral notes count; what moves below the fold or into collapsed sections (catalogue info, ownership/condition, remove). |
| **B Notes** | `notes`, `note`, `note-compose` choose/write | Reading typography for note bodies; inline category chips everywhere (D07-04); save feedback (W01); live word count and the 500-word limit shown before Save; Delete note out of the prominent content position; discard wording already built as approved (D07-05). |
| **C Capture** | `note-compose` intake/crop/review/no-text/failure | Plain capture wording (no "Optical capture"); English-only OCR said plainly; native camera and web file-picker paths. |
| **D Remaining** | `index` (header, summary, filters, list cards — not the shelf itself), `search` | Decided by the audit: "Lent out" label and no lending tag/quick-look row (D07-08); list-card density; loading skeletons; Search error copy instead of raw provider errors. Search result honesty is already specified (SDD-05 §28 Search presentation). |

## 7. Reserved space for later features

Each design keeps an agreed, unused location so later features do not need another redesign. Nothing in these slots is built in SDD-07. **Reserved slots are placement holders only and are provisional:** each feature's behaviour (frequency, content, data) is decided in its own SDD, under DP-04 (passive, text-only, no nags).

| Feature | SDD | Reserved where |
|---|---|---|
| Export / share entry (CSV, Markdown, PDF) | SDD-08 | Book Details overflow/menu; Notes list header |
| Passage card from a Quote note | SDD-08 | Note reader secondary action (Quote notes only) |
| Reading history, yearly goal, reread indicator | SDD-09 | Book Details status area (reread count, dates); Home summary area (goal progress) |
| All-notes entry, note search | SDD-10 | Home header (entry); Notes list header (search field) |
| Today's note | SDD-10 | Home, below the shelf |
| Passage collections, custom shelves/tags | SDD-10 | Note reader (add Quote to collection); Book Details and Home filter row (tags) |

## 8. Approval gates

1. **This draft** — **approved 2026-10-18** (approach, rules, foundation unit scope, flow order; decisions D07-01–08).
2. **Foundation unit** — owner approves the [foundation plan](./SDD-07-FOUNDATION-PLAN.md), then the token values (shown as swatches with contrast numbers) and the exact dev-dependency list (F-5) before anything is installed.
3. **Flow A design** — Stitch exploration done in a new project (2026-10-18, [evidence](./evidence/flow-a-directions-2026-10-18/README.md)); **owner chose A1 Shelf card with A2 note passages (D07-09)**; the [FA-P1 Expo web prototype](./SDD-07-FLOW-A-PROTOTYPE.md) was built and the design **FINALIZED 2026-10-18 under the owner's delegation (D07-11, §10)**. Next: owner approval to commit the fu1a work, then the real Flow A build, then acceptance.
4. **Flows B, C, D** — same sequence each.
5. **No migrations** in SDD-07. Any change found to need one moves to SDD-08/09/10 and gets two approvals (create, apply).

## 9. Owner decisions (2026-10-18)

| ID | Question | Decision | Consequence |
|---|---|---|---|
| D07-01 | Tab bar contrast (RA-W01) | **Not in SDD-07's foundation.** It becomes its own small app-wide unit, coordinated with the clubs worktree because the tab bar is shared (workspace split rule). | That unit also owns the truncated labels at 390 px, the extra repeated "mark…" tabs and the "⏷" fallback icons. These look like routes without a `tabBarIcon` or not hidden with `href: null` (expo-router's default icon), i.e. likely a real bug, not a fixture artifact. Recorded as **to verify**; not fixed here. Review evidence (2026-10-18): `app/(tabs)/_layout.tsx` hides only `marketplace/store/[storeId]` with `href: null` and sets no `tabBarIcon`. **Unit spec:** [TB-1](./SDD-07-TAB-BAR-UNIT.md) — APPROVED 2026-10-18 (TB-D1–TB-D5 as recommended; the owner forwards the clubs heads-up). **BUILT, REVIEWED and PARKED 2026-10-19**, uncommitted on `sdd07/tab-bar`: 5 tabs, real icons, themed bar and Back history verified on web. Open: icon-only at 390/360 px because "Marketplace" doesn't fit (owner decision pending), plus commit approval. |
| D07-02 | Book Details review placement | Keep it on Book Details, **below the fold, collapsed to a one-line summary that expands.** | Flow A design. |
| D07-03 | Saved Pages on Book Details until SDD-10 decides | **Hidden when empty, collapsed when present.** | Flow A design; SDD-10 makes the long-term decision. |
| D07-04 | Category editing pattern | **Inline chips everywhere** (Option B B07 pattern); drop the "Change" sheet. | Flow B/C; affects `CategoryPicker` in `ManualNoteUi.tsx`. |
| D07-05 | Discard wording | **Approved:** "Discard note" for new notes, "Discard changes" for edits. | Already built this way (`note-compose.tsx:91-92`; SDD-06 records it). Flow B keeps it. Option B B12 still says "decision pending", but Option B is reference-only and is not edited (D07-07). |
| D07-06 | Lint/axe dev dependencies | **Approved in principle.** | The foundation plan lists exact packages and versions; the owner confirms that list before anything is installed. |
| D07-07 | How design directions are made | **Expo web prototypes on the real tokens** (what is approved is close to what ships). Stitch only for optional quick exploration, in a **new** Stitch project, never editing Option B (it stays a reference). | Any Stitch generation needs separate owner approval. |
| D07-08 | Ownership "Lent out" | **Keep it as a plain ownership fact with a proper label ("Lent out")**, no lending features. Not hidden, since real rows have that value. | Flow D fixes the raw enum at `LibraryBookList.tsx:47`; `OwnershipSelector` keeps `lent_out`. Applying "no lending features": flows A/D plan to remove the live lending leftovers — the Book Details "Available for Lending" switch, the home-card lending tag and the quick-look "Lending" row (§4.2 #8). The `available_for_lending` column is left as is (no migration). **Confirmed by the owner for the Flow A build (2026-10-20)** and built on `sdd07/flow-a`: the switch, the home "lendable" tag and the quick-look Lending row are gone; `booksService.toggleLendingAvailability` stays with no caller. |
| D07-09 | Flow A direction | **A1 Shelf card, using A2's unboxed serif note passages** instead of A1's boxed note cards. Fixes carried in: status segments 48px tall; "Remove from library" with a 48px target; exact token inks (no near-token literals); the muted no-cover placeholder (`coverPlaceholder`/`coverPlaceholderInk`) when a book has no cover. Owner's words (2026-10-18, relayed by the orchestrating session): "Go with A1 Shelf card, using A2's unboxed serif note passages, and amend DP-01 to count controls only down to the primary action. Build it as the Expo web prototype." | Built first as the fixture-only prototype [FA-P1](./SDD-07-FLOW-A-PROTOTYPE.md); the owner reviews it before the real Flow A build. Evidence: [Flow A directions](./evidence/flow-a-directions-2026-10-18/README.md). D07-08's lending removal was confirmed on 2026-10-20 and is built (see D07-08). |
| D07-10 | DP-01 on short pages | **DP-01 amended:** count focusable controls only down to and including the primary action. Collapsed secondary rows after it may enter the fold on short pages if visually secondary (plain rows, no fills, no counts in containers). | Same owner's words as D07-09. Option 2 of the Flow A README §3. §3 DP-01 updated; FA-P1 tests count controls in document order up to the primary. |
| D07-11 | Who finalizes the Flow A design | **Delegated by the owner to the orchestrating session.** Owner's words (2026-10-18): "ok look i leave it to your judgement ... please ensure you have understood the essence of the philosophy and proceed and finalyze the design". The orchestrator (Opus) made the round 2–4 calls in §10 against the essence checklist (Appendix A) and verified each one. | The Flow A design is **FINALIZED** (§10). The real build still needs its own approval and acceptance (§8). |
| D07-12 | Daylight `controlBorder` value | **Deviation from the approved FU-1a swatch:** daylight `controlBorder` `#948669` → `#8a7c60`. The selected status segment's only boundary was 2.86:1 against `bgSecondary` (fails WCAG 1.4.11); it is now 3.28:1 against `bgSecondary` and 4.02:1 against `bgCard`. Golden and midnight are unchanged. | Made under D07-11 for WCAG 1.4.11. `controlBorder`/`bgSecondary` is added to `BOOK_TOKEN_PAIRS`. Recorded so the swatch table is not taken as the final value. |
| D07-13 | Reading status wording | **"Want to read / Reading / Finished"** (the round 4 review asked for "Completed"; rejected). | **The real build renames "Completed" to "Finished" app-wide** (Book Details, home filters, search, `StatusSelector`) so one word names one state (K3). Display copy only; the `completed` value is unchanged. |
| D07-14 | Remove-from-library wording | The dialog names the book. Body: "Your notes, review and saved pages for this book will be deleted too. You can't undo this." Button: "Remove book". Remove is disabled offline. | The cascade was verified earlier in the database (read-only) and re-verified read-only on 2026-10-20 for the Flow A build (`reading_notes` and `user_book_pages` cascade; no delete triggers). The real build keeps this copy unless the cascade changes. **Residual:** a book with an exchange listing (`listings_user_book_id_fkey`, NO ACTION) cannot be removed; nothing is deleted and the raw error message is shown. The owner left friendlier copy out of Flow A (2026-10-20); exchange is outside library scope. |
| D07-15 | 9px overflow at 200% zoom, 390 px | **Assigned to the tab-bar unit (D07-01).** The overflow is the global tab bar: page `scrollWidth` 399 → 390 with the tab bar hidden. | Not a Flow A defect. Evidence: `round3/overflow/overflow-results.json`. **Closed on `sdd07/tab-bar` (TB-1, uncommitted, 2026-10-19):** `scrollWidth` 390 at zoom 2 on library home and Book Details ([evidence](./evidence/tb1-tab-bar-2026-10-18/README.md)). Final once TB-1 is committed. |
| D07-16 | Flow A real-build rules (2026-10-20) | **Owner decisions for the build:** lending removed (D07-08); rows expand inline (no sheets); collapsing the review row never loses typed text; ownership shows its true label ("Lent out", not an enum); offline disables every write (status, review, privacy, rating, ownership, condition, Add note, Remove, delete saved page); load errors are classified (offline / not found / server, via `classifyBookLoadError`); `DeleteBookModal` reworked to D07-14; Back-only header; no success toasts except "Review saved!"; the lint ratchet must end at or below 298 / 2 / 0. | Built on `sdd07/flow-a` (§10.8). |
| D07-17 | Row summaries at 320 px | **Lead decision under D07-11:** a `DetailRow` summary wraps to at most two lines (`ROW_SUMMARY_LINES = 2`) instead of one, after real data at 320 px cut "Owned · New" to an ellipsis. | Re-checked at 320 px and 200% text on real data: full text, no horizontal scroll. |

### 9.1 Original questions (kept for traceability)

1. **Tab bar contrast (RA-W01):** fix it inside SDD-07's foundation unit, even though the tab bar is shared with clubs, or as its own small app-wide unit?
2. **Book Details review:** keep the review on Book Details (above or below the fold), or move it to its own section/screen?
3. **Saved Pages on Book Details** until SDD-10 decides: keep the section as is, collapse it, or hide it when empty?
4. **Category editing pattern:** inline chips everywhere (like B07), or a "Change" sheet everywhere (like B05/B09)?
5. **Discard wording (B12, still pending):** "Discard note" for new notes vs "Discard changes" for edits — approve?
6. **Lint/axe dev dependencies (F-5):** approve adding ESLint + jsx-a11y + an axe runner as dev dependencies?
7. **Stitch:** generate flow A directions in a new Stitch project (separate approval), or adapt Option B B01 in place?
8. **Ownership "Lent out":** home list cards render the raw enum (`LibraryBookList.tsx:47` prints `item.ownership`, seen as "Lent_out" on real data); flow D will use the proper label either way. But `lent_out` is still a selectable ownership value (`OwnershipSelector.tsx:19`) while lending is removed from the roadmap. Keep it as a plain ownership fact, or hide it from the selector?

## 10. Flow A — finalized design (FA-P1 rounds 2–4)

**Status:** FINALIZED 2026-10-18 under D07-11. The design was the FA-P1 fixture prototype; the real screen is built on `sdd07/flow-a` (§10.8).
**Where it lives:** committed `17ad84f` on `sdd07/fu1a-fu3` (carried into `sdd07/wave3`); the Flow A commit deletes the prototype files:
- `app/(tabs)/library/dev-flow-a.tsx`
- `src/prototypes/flowA/**`
- the FU-1a + FU-3 token changes in `src/components/library/LibraryAppearance.ts` and its test.

**Spec:** [SDD-07-FLOW-A-PROTOTYPE.md](./SDD-07-FLOW-A-PROTOTYPE.md).
**Evidence:** [FA-P1 evidence](./evidence/fa-p1-prototype-2026-10-18/README.md); [round 2](./evidence/fa-p1-prototype-2026-10-18/round2/README.md); [round 3](./evidence/fa-p1-prototype-2026-10-18/round3/README.md); reviews in [`reviews/`](./evidence/fa-p1-prototype-2026-10-18/reviews/).
**Review method:** every round was judged against the essence checklist (Appendix A):
- C1–C8 Calm Technology;
- R1–R4 Refactoring UI;
- T1–T3 Bringhurst/Butterick;
- K1–K4 Krug;
- A1 WCAG 2.2 AA.

### 10.1 The design

A1 Shelf card with A2's unboxed serif note passages (D07-09), from top to bottom:
- Header: Back.
- Cover beside the title. The title is the `h1`.
- Status control (one radio group).
- "Your notes" (`h2`): the latest two notes as serif passages.
- One primary: Add note.
- Plain rows: All notes (a link), Your review, Saved pages (hidden when empty), Book information, Ownership & condition, Community reviews.
- A quiet "Remove from library".

DP-01 is counted down to the primary (D07-10).

### 10.2 Round 2 — Codex design review (F01–F13, all applied)

Review: [`reviews/round2-review-codex.md`](./evidence/fa-p1-prototype-2026-10-18/reviews/round2-review-codex.md).

- **Honest Remove copy** (D07-14). The dialog names the book and its description is attached to the dialog for screen readers.
- **Quiet offline state:** the line "Offline · Showing saved content.", not a banner. Status and Add note are disabled with "Changes need a connection."
- **Refresh failure keeps content:** "Couldn't refresh." plus Try again. The full-screen error is only for a first load with nothing cached.
- **Semantics:** headings (`h1` title, `h2` Your notes); All notes is a link; empty Community reviews is not interactive.
- **Typography:** all note passages in serif; speculative error sentences removed.
- **Layout and wording:** narrow-width cover 80×120; "Your review" / "No review yet."

### 10.3 Round 3 — layout from measured width

- Layout decisions use the **measured container width** (`onLayout`), not the window width.
- The title stacks below the cover when the space beside the cover is under 180 px (`MIN_TITLE_BLOCK_WIDTH`).
- The status control becomes a **vertical list** when its labels do not fit, or when the container is under 360 px.
- No mid-word breaks at any width or text size.

### 10.4 Round 4 — space-bunny final review (7 of 10 accepted)

Review: [`reviews/round4-review-space-bunny.md`](./evidence/fa-p1-prototype-2026-10-18/reviews/round4-review-space-bunny.md).

**Accepted:**
- F2: Remove is disabled offline.
- F3: daylight `controlBorder` darkened (D07-12).
- F5: Ownership & condition is non-interactive when expanding adds nothing; condition is read from data.
- F6: "Public"/"Private" appears only when a review exists; the empty row opens the editor (no disclosure).
- F7: the radio group is no longer `accessible`, so native screen readers expose each radio.
- F8: note dates in local time, with the year shown when it is not the current year.
- F10: saved pages shown as a "Page 42" caption plus a serif excerpt.

**Rejected, with reasons:**
- F1 "Completed" wording → keep "Finished"; the real build renames app-wide (D07-13).
- F4 show empty Saved pages → conflicts with D07-03 (hidden when empty).
- F9 community-reviews wording → the real build drives it from query state.

### 10.5 Final sign-off

Gemini 4 Argon, read-only: "Ready to finalize: YES", findings none ([`reviews/final-review-gemini-argon.md`](./evidence/fa-p1-prototype-2026-10-18/reviews/final-review-gemini-argon.md)).

### 10.6 Verification (run by the orchestrating session)

- **Jest:** `src/prototypes` + `src/components/library`, 369/369 pass in 12 suites.
- **TypeScript:** `tsc` shows the 36 known diagnostics outside Library and zero new.
- **FU-1a colour diff:** equals the approved patch, except the one `controlBorder` value and its test row (D07-12).
- **Browser, round 2:** 60 of 60 state × phase captures pass (round 1 was 57 of 57); keyboard checks K1–K7 and K9 pass.
- **Browser, round 3:** no mid-word breaks at 200% text in all three phases, including the long title. No overflow at 320/360/390/430 px. Keyboard 8/8.
- **Browser, round 3 overflow:** the 9 px overflow at 200%/390 px is the global tab bar (D07-15). A hidden width-measuring text in the status control sits outside the column but does not widen the page (`scrollWidth` 390 with the tab bar hidden).
- **Not re-captured:** the round 4 changes were checked by Jest only, not re-captured in a browser.
- **Database and storage mutations:** none.

### 10.7 Residual risk and next

**Residual risk:**
- The 200%-zoom overflow now belongs to the tab-bar unit (D07-01).
- The axe scan was not run (FU-5 tools not installed). *Closed 2026-10-20: 27/27 in the Flow A build (§10.8).*
- Native TalkBack/VoiceOver not tested.
- No real-user test.
- Round 4 not re-captured in a browser.

**Next authorized action:** the owner approves committing the `Bookconnect4_fu1a` work (FU-1a + FU-3 tokens and the FA-P1 prototype). Then comes the **real Flow A build** on `app/(tabs)/library/[bookId].tsx`, which:
- ports the finalized design onto real data;
- keeps the review blur-save fixes;
- applies D07-13 (rename "Completed" to "Finished" app-wide);
- has the owner confirm D07-08's lending-switch removal.

**Superseded 2026-10-20:** the prototype was committed (`17ad84f`) and the real Flow A build is done on `sdd07/flow-a`; see §10.8.

### 10.8 Real Flow A build (2026-10-20)

**Status:** BUILT, REVIEWED, FIXED and ACCEPTED in worktree `Bookconnect4_flowa`, branch `sdd07/flow-a` off `sdd07/wave3` (`f568288`). **Uncommitted**; the commit waits for owner approval and will also delete `src/prototypes/flowA/**` and `app/(tabs)/library/dev-flow-a.tsx`. Rules: D07-16, D07-17.
**Scope:** `app/(tabs)/library/[bookId].tsx` and its direct children, on real data, to the §10.1 design. New `src/components/library/bookDetails/` (`BookCover`, `NotePassages`, `DetailRow`, `ChoiceRadioGroup`, `classifyBookLoadError`, `bookDetailsTokens`) and `src/features/books/utils/libraryLabels.ts`; reworked `StatusSelector`, `OwnershipSelector`, `ConditionPicker`, `RatingInput` (radio groups with names, roving focus and arrow keys), `VaultPagesList`, `DeleteBookModal`; `BookScreenHeader` gained a Back-only form. "Completed" → "Finished" app-wide (D07-13). Lending removed (D07-08). 13 files moved to lint `STRICT_FILES`; ratchet 429 / 4 / 0 → **298 / 2 / 0**.
**How it was built:** three briefs (A: top of screen, states and status; B: rows, saved pages, Remove dialog; C: choice controls, labels, home/quick-look, strict lint) by Codex `gpt-6.1-sol` xhigh, each verified by the lead (diff read, Jest, `tsc`, lint, mutation checks: brief C 12/12, fix round 17/17 mutants killed).
**Review:** two independent full-scope read-only reviews in parallel, Gemini 4 Argon and DeepSeek v4.1 (owner's choice), both "PASS WITH FINDINGS"; worktree fingerprint unchanged. Ten confirmed findings R1–R10, all fixed in one Codex round: status flashed back after save; review blur saved while offline; Community reviews hid loaded data on a failed refetch and showed "None yet" offline; Remove/delete-page dialogs stayed actionable when going offline mid-dialog; privacy label used the caption style; `busy` not reaching the web DOM (`aria-busy`); `StatusSelector` lost its tab stop for an unknown value; initials empty for an all-stop-word title; Back/Escape closed the dialog mid-delete; inline error lines not announced (live regions). Two sub-claims rejected with reasons.
**Delete cascade** (read-only Supabase catalog check, project `ahntbtktjjmvfosgkmgn`, 2026-10-20): D07-14 copy is true; exchange-listing residual recorded at D07-14.

**Verification (lead):**
- Jest (library, notes, books, `src/test-utils`, `eslint-rules`): 65 suites / 1210 tests pass. Scoped `tsc` 0; whole-repo `tsc` 36 (= baseline); `lint:library` 329 problems (was 465): 1 error, which is the pre-existing `react/no-unescaped-entities` in `LibraryHeader.tsx`, and 328 warnings; no `book-section` errors. Ratchet test passes at 298 / 2 / 0.
- axe (`npm run e2e:library-a11y`, fixture data, 0 writes): 27/27 against the unchanged baseline, after updating the Book Details wait to the new "Your notes" heading. Not re-run after the D07-17 two-line change (Jest + browser check only).
- Real-data browser check (Expo web on 8083 with the real `.env`, owner logged in; Haiku drove a checklist on one owner-allowed book, *Animal Farm*). PASS:
  - home: true ownership labels, no "lendable", a "Finished" chip;
  - Book Details in all three phases at 390 px, daylight at 320/430 px and at 200% text: Back-only header, no horizontal scroll, cover/title, a three-option status radio group (stacked at 320 and 200%), one primary, the rows, Remove;
  - writes, each restored: status, ownership (Condition hides for Borrowed), review typed → collapse → "Review saved!" → text kept → cleared, privacy toggle;
  - Remove dialog copy, then Cancel only.

  SKIPPED: quick look (no long-press in the browser tools; Jest covers it). Not driven on real data: rating, condition, offline (Jest covers them). Golden phase looked close to daylight in screenshots (expected from the tokens, `#fbf2e4` vs `#faf6ee`). The 320 px ellipsis it flagged led to D07-17; the recheck at 320 px and 200% text shows the full "Owned · New" with no horizontal scroll.
- Database/storage: no migrations. The only writes were those owner-allowed test edits on *Animal Farm* (status, ownership, review, privacy), all restored to the original values and re-read afterwards.

**Residual risk:**
- Exchange-listing delete shows the raw error (D07-14).
- Axe `image-alt` ×1 on the home list (outside Flow A, still in the baseline).
- Tab bar truncated labels at 320 px (TB-1, D07-01).
- Native TalkBack/VoiceOver and Android/iOS devices not tested for the Flow A build.
- `booksService.toggleLendingAvailability` has no caller.

**Next authorized action:** the owner approves (or not) the Flow A commit on `sdd07/flow-a` (code in `Bookconnect4_flowa`, docs in `Bookconnect4_library`, prototype deleted, never `.spec/`). Push only on separate approval.

## Appendix A — Essence checklist (used for every Flow A review)

Copied from the orchestrating session's checklist (also at [`reviews/essence-checklist.md`](./evidence/fa-p1-prototype-2026-10-18/reviews/essence-checklist.md)).

Statement: a quiet, well-made reading room. It shows your books and thoughts beautifully, works without explanation, and never asks for your attention.

### Calm Technology (Amber Case) — main approach

- **C1 Smallest possible attention:** every element must earn its place; the reader should be able to glance and leave.
- **C2 Inform and create calm:** tell the reader what is true (saved / not saved / offline) without alarm, urgency or celebration.
- **C3 Use the periphery:** secondary information (counts, dates, ownership, options) sits quietly at the edge, never competing with the reader's own content.
- **C4 Amplify the human:** the reader's own words (notes, review) are the most prominent content after the book itself; the app's own voice stays minimal.
- **C5 Communicate without speaking:** state is shown by placement, weight and form, not by banners, badges, colour alarms or copy.
- **C6 Work even when it fails:** offline and error states keep the reader's content visible and say plainly what is and isn't possible.
- **C7 Minimum technology:** no decorative animation, no gimmicks, no features the screen doesn't need.
- **C8 Respect norms:** platform-native behaviour (Back, dialogs, focus, screen readers) and plain, kind language.

### Refactoring UI — visual hierarchy

- **R1** Hierarchy by weight and colour before size; de-emphasise secondary content rather than emphasising primary.
- **R2** Fewer borders; separate with space and subtle background shifts.
- **R3** A limited spacing and type scale used consistently; generous whitespace.
- **R4** Labels only where needed; data speaks for itself.

### Bringhurst / Butterick — text

- **T1** Body text comfortable: ≥16px, line height ~1.35–1.5, measure ≤ ~70 characters.
- **T2** Hierarchy through typography (serif display + humanist sans), not boxes.
- **T3** Typographic correctness: real quotes, sensible ellipses, no all-caps body labels.

### Krug — flows

- **K1** Self-evident: a first-time reader knows what the screen is and what to do without thinking.
- **K2** Obvious primary action; clear "where am I / how do I go back".
- **K3** Consistent words for the same thing across the app.
- **K4** Nothing that makes the reader wonder (ambiguous labels, hidden states, surprising taps).

### Baseline

- **A1** WCAG 2.2 AA: contrast, 48dp targets, names/roles, focus order, 200% text, no focus obscured.
