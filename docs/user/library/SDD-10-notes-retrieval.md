# SDD-10 — Notes retrieval

**Status:** APPROVED 2026-10-23 by the owner, with the lead defaults: "I approve SDD-10 for building and SDD-11's design direction, with the lead defaults. Commit the drafts on sdd10/spec and start SDD-10 Unit A." Drafted the same day from the owner's chat decisions D10-01 to D10-14 (§5) and reviewed four times (§12). Approval covers building the units in order; each commit, merge and push still needs the owner's OK as in §8–§9.
**Parent:** [Library roadmap](./LIBRARY-ROADMAP.md) §1 (SDD-10 track) and [SDD-07](./SDD-07-book-section-ui-overhaul.md) §7 (reserved slots: Home below the shelf; Notes list header for search).
**Sibling:** [SDD-11 — Notes and books organising](./SDD-11-organising.md) holds everything that needs a migration (labels for books, note collections). The owner split the work in two on 2026-10-23: this SDD changes the app only.
**Branch / worktree:** spec on `sdd10/spec` in `Bookconnect4_sdd10`, from `main` `91db311`. Each unit gets its own short branch from `origin/main` (`sdd10/<unit>`).
**Supabase project:** `ahntbtktjjmvfosgkmgn` (shared with clubs and marketplace). **This SDD needs no migration and no database write.** It only reads tables that exist today (`reading_notes`, `user_books`, `books`, `user_book_reads`).

## 1. Goal

A reader can find a note inside a book by typing a few words, and can go through their notes one card at a time in a calm, good-looking swipe section. Library home quietly mentions a book they finished on this date in an earlier year. Saved Pages, which nobody can create any more, disappears from Book Details.

| Unit | What | Database |
|---|---|---|
| **A** | Search box on a book's notes screen | None |
| **B** | Hide Saved Pages on Book Details | None |
| **C** | Swipe section ("Your notes"), in three steps C1–C3 | None (reads only) |
| **D** | "On this day" line on Library home | None (reads only) |

Order: A → B → C → D (D10-13).

## 2. Why

Notes are the reader's own words, but today they can only be found by opening the right book and scrolling. Old notes are written and forgotten. The swipe section gives a reason to come back to them without streaks, counters or reminders (SDD-07 DP-04).

## 3. Current state (read-only evidence, `main` `91db311`, 2026-10-23)

- **Notes** live in `public.reading_notes` (`content`, `tag`, `page_number`, `user_book_id`, `user_id`, `created_at`, `updated_at`; `tag` is nullable, values `quote`, `reflect` = "Thought", `distill` = "Takeaway", `apply` = "Action", `question` — `src/features/books/notes/manualNoteContract.ts:3-9`).
- A book's notes are loaded by `manualNotesGateway.list` (`src/features/books/notes/manualNotesGateway.ts:52-59`): a book-guard query (`this.book()`) then one owner- and book-filtered notes query, newest first, **no limit** (so PostgREST's 1,000-row cap applies silently).
- `reading_notes` has **two foreign keys to `user_books`** (`user_book_id` alone, and `(user_book_id, user_id)` → `user_books_id_owner_key`; `20261010221843_library_manual_note_persistence.sql:112-117`). An unqualified PostgREST embed of `user_books` from `reading_notes` therefore fails as ambiguous; the export loader avoids embedding for this reason (`src/features/books/export/loaders.ts:149`). The notes screen `app/(tabs)/library/notes.tsx:32-36` filters by category in the app.
- **No text search exists** on notes anywhere in the app.
- Cross-book note reads exist only for Quote notes (`readingHistoryGateway.quotesForUser`, `src/features/books/history/readingHistoryGateway.ts:618-640`) and for export (`src/features/books/export/loaders.ts:148-150`, paged).
- **Saved Pages** (`public.user_book_pages`) are shown on Book Details in the "saved" row (`app/(tabs)/library/[bookId].tsx:751-761`, gated by `showSavedPages`; data from `useVaultPages` at `:184`) through `VaultPagesList`. `userBookPagesService.upsertPage` has no caller, so the app cannot create a page. Live: **1 page from 1 user** (read-only count, 2026-10-23).
- **Finish dates** live in `user_book_reads` (SDD-09): `outcome`, `ended_on` / `ended_at`, `end_unknown`, `counts_in_stats`. `effectiveReadDates` (`src/features/books/history/readingHistoryContract.ts:95-100`) gives the finish day. Live: 10 finished reads.
- Book covers: `books.cover_url` (`supabase/migrations/20251228083154_001_initial_schema.sql:74`; `LibraryBookEntry`, `src/features/books/utils/libraryShelf.ts:14`).
- Date helpers to reuse: `todayDay(timeZone, now)` (`src/features/books/history/estimateDay.ts:76`) and `effectiveReadDates(read, timeZone)`. Spine text colour: `spineTextColor` (`shelfLayout.ts:38`). `spineColorFromTitle` returns one of a fixed list of colours (`shelfLayout.ts:3-35`).
- The note origin `'collection'` means "opened from a book's notes list" and is used in `manualNoteContract.ts:11`, `noteNavigation.ts:12`, `notes.tsx:37,76`, `note-compose.tsx:160-161` (new notes are always given this origin), `ReadingTimeline.tsx:88`, `[bookId].tsx:179`, and the query key `noteKeys.collection` (`useManualNotes.ts:47,56,74`).
- Removing a book: `deleteMutation` (`[bookId].tsx:245-250`) invalidates only `['library']` and then goes Back; removing a wishlist book from Search (`src/features/books/hooks/useSearchBookActions.ts:87,95`) is the other removal path. Book Details' Back always replaces to Library (`[bookId].tsx:151-153` → `navigateBackOrFallback`, `src/lib/navigation.ts:9-12`), never back through history.
- `returnToRoute` (`noteNavigation.ts:36-47`) goes back only to an earlier stack entry whose route name and params match the ones passed **and**, when a route key is given, whose key equals it; otherwise it replaces with the fallback. The `swipe` branch therefore passes the name `notes-swipe`, empty params and the stored route key.
- Sheets: the app-wide toast is hidden while a slot is mounted; a Modal sheet must render `BookFeedbackSlot` inside itself for toasts to be visible (`src/components/library/ui/BookFeedback.tsx:60-75`). Background content is hidden from assistive tech while a dialog is open with `aria-hidden` plus web `inert` (`[bookId].tsx:131-132,551`); `expectSinglePrimary` ignores hidden primaries (`src/test-utils/bookSection.ts:46-54`).
- DP-02 strict files reject raw colour literals, including `rgba(...)` (`eslint-rules/book-section/no-raw-style-values.js:32`); the strict list is pinned by `eslint-rules/book-section/__tests__/config.test.js:73`.
- Already installed: `react-native-gesture-handler` 2.28, `react-native-reanimated` 4.1, `expo-haptics`, `expo-linear-gradient`. Serif font `fonts.serif` (EB Garamond) is used by `BookSpine` and `PassageCard`. Book colour: `spineColorFromTitle` (`src/features/books/utils/shelfLayout.ts:31`). Save toasts: `notifySaveSuccess`. Reduced-motion check: `AccessibilityInfo.isReduceMotionEnabled` (pattern in `src/components/library/history/FinishPanel.tsx:59,108`).

## 4. Design

### 4.1 Unit A — search inside a book's notes

- A search field on `notes.tsx`. Header order, top to bottom: offline line, search field, count line, category chips, then the "Swipe through" (Unit C) and Export text buttons. All new controls are secondary or text (DP-03 unchanged). Label "Search this book's notes"; placeholder "Search notes". The field and "Swipe through" are hidden when the book has no notes.
- Matching happens **in the app**, on the notes already loaded for that book (D10-01). No new query. Known limit, accepted: `list` has no paging, so a single book with more than 1,000 notes would be searched only over the newest 1,000 (as the list itself shows today). Recorded, not fixed here.
- A note matches when its `content` contains the typed text, ignoring upper/lower case. Both sides are normalised with `normalize('NFKC')` and `toLocaleLowerCase()`, so it works in any language and script. No accent folding (`é` does not match `e`) — **lead default**, kept simple.
- Leading and trailing spaces are ignored. An empty field means "no search".
- Search and the category chip combine: both must match.
- Count line (plain caption text, DP-04): while searching, "2 of 4 notes" ("1 of 1 note" when the total is one), where the second number is the notes in the current category (or the whole book when no chip is active); otherwise the existing "12 notes". The existing "Showing Quote notes." message stays.
- No match: "No notes match "word"." with a text button "Clear search". The category chip stays as chosen. (The in-field × is named "Clear search text", so the two controls have different names.)
- The typed text stays while the screen is open; it is not saved.
- A clear (×) button inside the field, 48dp target, label "Clear search text".

### 4.2 Unit B — hide Saved Pages

- Remove the `showSavedPages` row and its `useVaultPages` query from Book Details (`[bookId].tsx:184`, `:751-761`). Nothing else on Book Details moves.
- **Keep** `VaultPagesList.tsx`, `userBookPagesService.ts`, their tests and the table, so the feature can come back later (D10-02). The table and its one page are not touched.
- Update SDD-07 D07-03 ("hidden when empty, collapsed when present") as superseded by D10-02.
- Update the Book Details tests and fixtures that expect the row. The Delete-book message (`DeleteBookModal.tsx:31`, "…saved pages and reading history…") **stays as it is**: deleting a book still deletes any saved pages, so the sentence is still true.

### 4.3 Unit C — the swipe section ("Your notes")

**C1 — mockups (optional, owner's choice).** Two or three Stitch mockups of the swipe screen and the Home tile, for the owner to pick from before C2. If the owner skips C1, C2 follows this section as written.

#### Ways in (D10-03)

1. **Home tile.** Directly under the Continue-reading card on Library home, **in both the shelf and the list view** (the same two places `ContinueReadingCard` renders, `app/(tabs)/library/index.tsx`): a small stack of two or three tilted cards with one real note on top, showing its first two lines, the book title and "Your notes · 12 notes" (plain text). Tapping it opens the swipe section with all notes. The tile note is picked from `noteKeys.deckIndex(all)` with a seed made from the device's local date (`YYYY-MM-DD` in the device zone, via the SDD-09 explicit-zone helpers), so it stays the same all day and changes at local midnight; its text comes from one `deckCards` request for that id — **lead default**. This daily seed is separate from the swipe section's per-visit shuffle. The tile is hidden when the reader has no notes, and while its data is loading or failed (it is a passive surface; no error state on Home). Its size is bounded by line counts, not a fixed height: note text `numberOfLines={2}`, book title and count `numberOfLines={1}`, `minHeight: MIN_TARGET` — so it stays small at 100% and grows without clipping at 200%. While Arrange is on (`arrangement.active`), the tile, the "On this day" line and (SDD-11) the Collections link are hidden, so nothing navigates away from an unsaved arrangement. Each of these Home items has its own loading rule; none depends on another's data.
2. **From a book.** A text button "Swipe through" in the header of that book's notes screen opens the swipe section with only that book's notes.

#### Screen

New route `app/(tabs)/library/notes-swipe.tsx`, params `scope` (`all` | `book`) and `userBookId` (when `scope=book`). The scope is parsed in one place so SDD-11 can add `scope=collection` with `collectionId` without reshaping the screen; an unknown scope falls back to `all`.
- **Title:** "Your notes" for `all`; for `book`, the book title from `manualNotesGateway.book()` (already cached by the notes screen), so it shows even when the book has no notes.
- **Back / swipe down / Android back** go back through history when the previous screen is there; otherwise the fallback is `/(tabs)/library` for `scope=all` and `/(tabs)/library/notes?userBookId=…` for `scope=book`. Registered in `_layout.tsx` with `gestureEnabled: false` (so the iOS back-swipe does not fight the card swipe) and `animation: 'fade'`.

Top to bottom:
1. **Top bar:** back arrow, the title ("Your notes" or the book title), and an "Order" text button.
2. **Position line:** a thin line that fills as you move through the stack: `controlBorder` track, `accent` fill (≥ 3:1 on its bar), hidden from screen readers like `PageEdgeBar`. No number on screen (DP-04); screen readers get the number from the card (§4.3 Accessibility).
3. **Category chips:** All, Quote, Thought, Takeaway, Action, Question. Categories with no notes in this scope are hidden. The row scrolls sideways when it does not fit (needed at 200% text, and later for SDD-11 collections).
4. **Card stack.**
5. **Button row:** Previous · Read full note · Next. **Next** is the screen's one primary button (DP-03). Previous is disabled on the first card. At 200% text the row wraps onto two lines rather than clipping. SDD-11 adds "Add to collection" to this row; the row's layout must allow a fourth button.

#### Cards

- Paper-like surface (the library card token), opaque, so note text is always read against the card, never against the coloured background.
- **Note text** in `fonts.serif`, body size or larger (DP-02). Cut off with an ellipsis when it does not fit the card; "Read full note" shows the rest.
- **Quote** notes have a large, faint quotation mark behind the text (decorative, hidden from screen readers, contrast irrelevant).
- **Category and page** as caption text ("Quote · p. 42"). Notes with no category show only the page; notes with no page show only the category.
- **Footer:** small cover thumbnail (the book's cover image; a cloth-colour block when there is none), book title, author(s).
- **Spine strip:** a thin strip down the card's left edge in the book's colour (`spineColorFromTitle`).

#### Stack look and feel (D10-09: all ten items)

1. **Index-card stack:** the two cards behind the top card show a little at fixed small angles (about −3° and +2°), slightly smaller, with soft shadows.
2. **Book-colour background:** the area around the card stack cross-fades to the current book's colour over ~250 ms when the book changes. The top bar, chip row, position line and button row sit on **opaque theme surfaces** (`colors.bgPrimary` / `colors.bgCard` bars), not on the book colour, because the existing header, chip and text-button components are transparent and would fail contrast on some colours (e.g. the accent token on a dark blue spine is about 1.2:1). So only the card (opaque) and decorative space touch the book colour. A test checks that nothing with text or a control boundary is drawn directly on any `spineColorFromTitle` colour, and the position line has ≥ 3:1 against its bar in all three phases. No raw colour values: all from tokens (the new files are on the DP-02 strict list).
3. **Serif text and quotation mark** (above).
4. **Cover thumbnail** (above).
5. **Drag hint:** while dragging, a faint "Next →" (dragging left) or "← Back" (dragging right) fades in **inside the card**, near its edge, in proportion to the drag distance — never on the book-colour background. Hidden from screen readers.
6. **Shine:** as the card tilts during a drag, a soft light band (a `LinearGradient` overlay) moves across it with the drag. Its colours come from a **new per-phase translucent token `cardShine`** in `LibraryAppearance.ts` (raw `rgba` is not allowed in strict files), registered as decorative in the token-pair test, with a test that `textPrimary` and `textSecondary` on `cardShine` composited over `bgCard` stay ≥ 4.5:1.
7. **Haptic tick:** a light impact when a card leaves (`Haptics.impactAsync(Light)`, errors ignored, native only).
8. **First-visit hint:** on the very first visit, the top card wiggles once (a short left-right nudge). Remembered on the device per user (`library_noteSwipeHint:v1:<userId>`); never shown again.
9. **Position line** (above).
10. **Reduced motion:** when the phone's "remove animations" setting is on, cards change with a short cross-fade instead of flying, and the tilt, shine, wiggle and background fade are off. Swipes still work.

#### Gestures (D10-05, D10-06)

| Gesture | Does | Button / key equivalent |
|---|---|---|
| Swipe left | Next note: the card flies off left, the card behind grows into place | Next; → key on web |
| Swipe right | Previous note: the previous card slides back onto the top from the left | Previous; ← key on web |
| Swipe up | Next category (wraps back to All; empty categories skipped). The whole stack slides up and a new stack comes in | Tap a chip; ↑ key on web |
| Swipe down | Leave the swipe section (same as Back) | Back arrow; Esc on web; Android back |
| Tap the card | Open the full note in a sheet | Read full note; Enter on web |

- The card follows the finger and tilts with the horizontal drag (up to 12° at full width). A swipe counts when the card is dragged past **30% of the card width** (horizontal) or **20% of the screen height** (vertical), or released faster than **800 px/s** in that direction; otherwise it springs back.
- A drag locks to one direction once it has moved **10 px**: whichever of horizontal or vertical movement is larger wins, so a slightly diagonal swipe never does two things. A fling counts only when its velocity points the same way as the drag.
- These numbers live in one constants file and are what the tests check; the emulator check may tune them for feel, and any change is recorded in the tracker.
- Swipe right on the first card, and swipe left on the end card, spring back.
- In SDD-10 a single tap opens the full note immediately. SDD-11 adds double tap and the short single-tap delay that comes with it.
- There is no gesture for the previous category (down is "leave"); tapping a chip, or the ↑ key going round, is the way back (owner's gesture set, D10-05).

#### Gesture composition (Android, iOS, web)

- The card has one `Gesture.Pan()` and one `Gesture.Tap()` composed with `Gesture.Exclusive(pan, tap)`, so a drag never also counts as a tap. Pan uses `.minDistance(10)`; the axis lock is kept in a shared value set in the `onUpdate` worklet (`|translationX| >= |translationY|` → horizontal), and movement on the other axis is ignored from then on. Gesture config (offsets) is static and is never changed from a worklet.
- Pan callbacks run as UI-thread worklets. Anything that touches React state, navigation, haptics or announcements is called through `runOnJS` (Reanimated 4: `scheduleOnRN`). Calling them directly from a worklet crashes natively. (The existing shelf drag uses `.runOnJS(true)`, `src/components/library/useVerticalShelfDrag.ts:78`; the card uses worklets for smooth animation instead.)
- The chip row's horizontal scroll and the card's pan never overlap on screen. The full-note sheet's scroll is not under the card, so they do not compete.
- If the sheet or the Order menu is a React Native `Modal`, its content is wrapped in its own `GestureHandlerRootView` (Android needs this for gestures inside a Modal). The app root already has one (`app/_layout.tsx`).
- Web: the card sets `userSelect: 'none'` and `touchAction: 'none'` so a mouse drag does not select text or scroll the page.

#### Full-note sheet

- Slides up over the stack. Shows the whole note (scrollable), category, page, book title and author, and two buttons: **"Open note"**, the sheet state's one primary (DP-03), which opens the existing note reader with the new origin `swipe`; and "Open book" (secondary text button, Book Details).
- **Back from the reader:** `returnFromNote` (`src/features/books/notes/noteNavigation.ts:52-55`) today sends every origin except `book` to the notes list. Add a `swipe` branch that returns to the mounted `notes-swipe` entry **matched by its route key** (stored in `NoteRouteContext`), so `router.back()` / `dismiss` is used and the deck keeps its live state. The deck state (`scope`, `userBookId`, `category`, `order`, `seed`, `noteId`) is used **only in the fallback href**, for when the swipe screen is no longer on the stack (e.g. after a web reload). The reader's back label for `swipe` reads "Back to your notes".
- **"Open book"** opens Book Details normally. Its Back goes to Library, as it does from everywhere today (`[bookId].tsx:151-153`); changing Book Details' Back is out of scope — **lead default**.
- **After an edit in the reader:** that card's `deckCard` entry is updated from the saved note (or removed so it refetches); the deck stays where it was.
- **After a delete in the reader:** the deck index is refetched and the stack lands on the card that followed the deleted one (or the end card if it was the last; or the empty state if no notes remain).
- **Origin rename (first commit of Unit C, no behaviour change):** `'collection'` becomes `'list'` and `noteKeys.collection` becomes `noteKeys.list` at every site listed in §3 and in their tests, before `'swipe'` is added. This frees the word "collection" for SDD-11. The composer's rule that new notes get the list origin (`note-compose.tsx:160-161`) is kept, so a note created from the swipe empty state opens in the reader with Back to that book's notes.
- Swipe down on the sheet, its close button, or Android back closes **only the sheet** and returns to the same card.
- The card itself never scrolls; only the sheet does.

#### Order (D10-07)

- "Order" opens a small menu: **Shuffle** (default), **Newest first**, **Oldest first**. The choice is remembered on the device per user (`library_noteSwipeOrder:v1:<userId>`).
- Shuffle uses a new random seed each time the section is opened; the order stays fixed during the visit so Previous always works. The shuffle sorts notes by a seeded hash of `(seed, note.id)`, tie-broken by `id` — not Fisher–Yates — so deleting or adding a note never reorders the others.
- Newest/Oldest use `created_at`, then `id`, so the order is always the same.
- Changing the order starts the stack again from the first card.

#### Positions and the end

- Each category (and All) remembers its position during the visit. Switching away and back returns to the same card. Positions are not saved after leaving.
- After the last card comes an end card: "That's all for now." with a primary button "Start again" (back to the first card, same order). On the end card only Previous stays in the button row (Next and Read full note are hidden), so Start again is the one primary.
- In the loading, empty and error states the chips, Order button, position line and button row are hidden; only that state's own message and button show.
- **No notes** in this scope: "Your notes will show up here." and a primary button: "Add a note" (opens the composer for that book) when `scope=book`; "Go to library" (Library home) when `scope=all`, since a note needs a book.

#### Data

- New gateway function `manualNotesGateway.deckIndex(actorId, scope, signal)`: returns the small rows needed to build the stack — note `id`, `tag`, `created_at`, `user_book_id`, `user_id` — for all the reader's notes (or one book's), owner-filtered. It pages exactly like the export loader's `readPages` (`src/features/books/export/loaders.ts:86-104`): `.order('created_at').order('id')` so pages never overlap or skip rows, `.range()` per page, and stop when the **database** page is shorter than the page size (never the client-filtered length). PostgREST returns at most 1,000 rows per request.
- Ordering, shuffling and category filtering are done in the app on that index (pure functions, §6).
- Card details are loaded **by id, in batches of 20**, for the current card and the next few in the current order, and cached by React Query, in **two owner-filtered queries without embedding `user_books` from `reading_notes`** (see §3: two foreign keys make the embed ambiguous): (1) `reading_notes` with the full `ManualNote` columns (`id, user_id, user_book_id, content, tag, page_number, created_at, updated_at`, plus any version columns the type needs) for the batch ids, so SDD-11's collection rows can reuse it; (2) `user_books` `id, user_id, book:books(title, authors, cover_url)`; both results kept only where `user_id === actorId` for the distinct `user_book_id`s (the same `user_books → books` embed `manualNotesGateway.book()` already uses). The builder confirms the column grants against the live schema (read-only) before writing it.
- **Cache per note, fetched in batches:** each batch result is written into one cache entry per note (`deckCard(actorId, noteId)`), so changing the order or category reuses cards already loaded instead of refetching. An id counts as cached only when its entry exists **and** is not invalidated (`getQueryState(key)?.isInvalidated` is false); only those are skipped. An in-flight batch is aborted when the reader leaves the screen.
- Query keys share one prefix, `['library-note-deck', actorId, …]` (`deckIndex`, `deckCard`), so one prefix invalidation clears them all.
- **Invalidation:** note create, edit and delete (`useNoteOperations`, `useNoteRefresh`, `useNoteRemovalRefresh` in `useManualNotes.ts`) invalidate the deck prefix and update or remove the affected `deckCard` entry. **Removing a book** — `deleteMutation.onSuccess` (`[bookId].tsx:247-250`) and the Search wishlist removal (`useSearchBookActions.ts:95`) — invalidates the deck prefix too (its notes are deleted with it).
- Offline: whatever is cached is shown with the existing "Offline · Showing saved content." line. Nothing cached: the offline state with "Try again".

#### States (DP-05)

Loading (stack outline with a quiet loading line) · empty (above) · populated · end card · error ("Couldn't load your notes." + "Try again") · offline (above). Detail batch failure for one card: that card shows "Couldn't load this note." with "Try again"; the stack still moves.

#### Accessibility (DP-06)

- Every gesture has a button (table above); dragging is never the only way (WCAG 2.5.7).
- The top card is one accessible element: "Note 3 of 12. Quote. From Hooked by Nir Eyal. Page 42." followed by the text shown on the card. It offers TalkBack custom actions: Next, Previous, Next category, Read full note.
- While the full-note sheet or the Order menu is open, the screen behind is hidden from assistive tech (`aria-hidden`, `importantForAccessibility="no-hide-descendants"`, and `inert` on web — the Book Details pattern), so only the sheet's controls and its one primary are reachable. Sheets that show toasts render `BookFeedbackSlot` inside themselves.
- Moving to another card or category is announced once: `AccessibilityInfo.announceForAccessibility` on native, and a polite `aria-live` region on web (where that call does nothing), the same split the save toasts use.
- The cards behind the top card, the quotation mark, the shine and the drag hint are hidden from screen readers.
- All controls ≥ 48dp. At 200% text: the card text is cut off (never overlaps), the chip row scrolls, the button row wraps, and the sheet scrolls.
- Web: mouse drag works through gesture-handler. Arrow keys, Enter and Esc act on the stack only when no sheet or menu is open and keyboard focus is not on a text field or button (Enter on a focused button presses only that button). With the sheet open, Esc closes the sheet.

#### Build rules

- Only the top card and the two behind it are drawn.
- Cards are siblings in one fixed container and are never moved between parent views or conditionally wrapped. Moving a native view to a new parent is what caused the earlier Android "child already has a parent" crash.
- Animations run on the UI thread (Reanimated shared values); the JS thread only learns the result (next / previous / category / cancel).
- No new package.

**Steps:** C1 (mockups, optional) → **C2** stack, left/right, buttons, full-note sheet, end and empty states, look and feel, Home tile and "Swipe through" entry → **C3** swipe-up categories, chips, per-category positions, Order menu.

### 4.4 Unit D — "On this day"

- One line on Library home under the Home tile: "On this day in 2025 you finished *Hooked*." Tapping it opens Book Details.
- A read matches when its `outcome` is `finished`, its finish day (`effectiveReadDates(read, zone)`) has today's month and day, and its year is earlier than this year. "Today" is `todayDay(zone, now)` with the device's zone.
- Reads with an unknown end date never match. Reads left out of stats (`counts_in_stats = false`) never match — **lead default** (the reader chose to hide them). Did-not-finish reads never match.
- 29 February finishes show on 28 February in non-leap years — **lead default**.
- Several matches: deduplicated by book and year (a reread finished the same day counts once); ordered by year (newest first), then `ended_at` (newest first, unknown last), then `id`. One line for the first match, then "and 1 more" / "and 2 more" as a text button that expands the list in place.
- No match: nothing is shown (D10-12). Passive, text only, no dismiss needed (DP-04).
- Data: the existing SDD-09 reads query (`readsForUser`, `readingHistoryGateway.ts:404-428`), which has no book titles. Titles come from the Library entries Home already loads (`useLibraryBooks`), matched by `user_book_id`; a read whose book is not in the entries is skipped. The line shows only when both are loaded. No new query. `readsForUser` is unpaged, so only the first 1,000 reads count — accepted as a known limit, like the notes list.

### 4.5 Rules across all units

- No database writes, no migrations, no new packages.
- Shared components (`src/components/search`, `src/components/ui`) are not changed for library looks; wrap or pass props.
- Tokens only (DP-02 ratchet: new files are strict). New files and folders are added to `lint:library` (`package.json`), the book-section list in `eslint.config.js` and `STRICT_FILES` (`eslint-rules/book-section/config.js`).
- Never `upsert`; nothing here writes anyway.
- Dates use explicit IANA zones in code and tests (`process.env.TZ` has no effect on this Windows machine).

## 5. Decisions (owner, chat, 2026-10-23)

| ID | Decision |
|---|---|
| D10-01 | Search is per book, on the book's notes screen, over note text, combined with the category filter. No cross-book search. |
| D10-02 | Saved Pages: hidden from Book Details only. The table, its one page and the service stay; deleting them is a possible later migration. |
| D10-03 | Ways into the swipe section: a card-stack tile on Library home, and a "Swipe through" button on each book's notes screen. |
| D10-04 | Swipe only moves through notes: nothing is kept, removed or scored. |
| D10-05 | Swipe left = next, swipe right = previous, swipe up = next category, swipe down = leave the swipe section. |
| D10-06 | Tap = full note in a sheet; swipe down on the sheet closes only the sheet. |
| D10-07 | Order is the reader's choice: Shuffle (default), Newest first, Oldest first. |
| D10-08 | Every card shows the book title and author at the bottom. |
| D10-09 | All ten look-and-feel items, including the shine and the full background colour fade. |
| D10-10 | A separate all-notes list is dropped; the swipe section is the cross-book view. |
| D10-11 | "Today's note" on Library home is dropped; the Home tile replaces it. |
| D10-12 | "On this day" is kept: exact date, nothing shown when there is no match. |
| D10-13 | Unit order A → B → C → D. |
| D10-14 | Labels and collections move to SDD-11. Double tap, "Add to collection" and collection chips arrive with SDD-11. |

## 6. Files (expected; confirmed per unit)

- **A:** `app/(tabs)/library/notes.tsx`; new `src/features/books/notes/noteSearch.ts` (pure matcher) and tests.
- **B:** `app/(tabs)/library/[bookId].tsx`; its tests; SDD-07 D07-03 note.
- **C:** new `app/(tabs)/library/notes-swipe.tsx`; `_layout.tsx`; new `src/features/books/notes/noteDeck.ts` (pure: order, shuffle with seed, category filter, skip empty, cycle, positions); `manualNotesGateway.ts` (`deckIndex`, `deckCards`); `manualNoteContract.ts` (keys, origin `swipe`); `useManualNotes.ts` (invalidation); new `src/components/library/notes-swipe/` (card, stack, sheet, Home tile, chips row); `app/(tabs)/library/index.tsx` (tile); `notes.tsx` ("Swipe through"); `noteNavigation.ts` (`swipe` branch, deck return state); `note.tsx` (back label); `[bookId].tsx` (deck invalidation on book removal); origin rename sites (`note-compose.tsx`, `ReadingTimeline.tsx`, `[bookId].tsx`, `notes.tsx` and their tests); `package.json`, `eslint.config.js`, `eslint-rules/book-section/config.js` and its pinned-list test `eslint-rules/book-section/__tests__/config.test.js` (lint scope); `LibraryAppearance.ts` and `LibraryAppearance.test.ts` (`cardShine` token); `e2e/fixtures/libraryFixture.ts` (answer the new deck queries, including `in.(…)` id filters, so `npm run e2e:library-a11y` has no unhandled reads).
- **D:** new `src/features/books/history/onThisDay.ts` (pure matcher); a small Home line component; `index.tsx`.

## 7. Tests

- **Pure logic (Jest):** search matcher (case, NFKC, non-Latin scripts, spaces, empty); deck order (seeded shuffle is stable and differs between seeds, newest/oldest with `id` tie-break); category filter and skip-empty; up-cycle wraps; per-category positions; On this day (explicit zones, year boundary, 29 Feb, unknown dates, left-out reads, DNF, several matches).
- **Gateway:** `deckIndex` orders by `created_at, id`, pages past 1,000 rows without gaps or repeats, stops on the database page length, and filters by owner; `deckCards` makes no `reading_notes → user_books` embed, fetches only requested ids and only owner rows, and skips ids already cached.
- **Navigation and cache:** Back from the reader returns to the same deck card; after a delete it lands on the next card / end card / empty state; book removal and note mutations invalidate the deck prefix; the origin rename changes no behaviour (existing navigation tests pass unchanged apart from the name).
- **Keyboard (web):** keys do nothing while a sheet or menu is open or a button/field has focus.
- **Components:** every button and custom action does what its gesture does; one primary per state (`expectSinglePrimary`); every state in §4.3 renders; reduced motion turns off tilt, shine, wiggle and fade; hidden decorative elements; accessible names; Saved Pages row absent.
- **Contrast:** no text or control boundary sits directly on a `spineColorFromTitle` colour; position line ≥ 3:1 against its bar; card text ≥ 4.5:1 with the shine at full strength; all three phases.
- **Mutation check:** each new test fails when its fix is removed.
- **Manual (Haiku, Android emulator + web):** swipe each direction, fling vs slow drag, spring-back, Android back with and without the sheet, 200% text, reduced motion, first-visit hint once only, offline, long notes. The lead views the key screenshots.

## 8. Done criteria (per unit)

`npx tsc --noEmit -p .` 0 errors; `npm run lint:library` 0 errors; the **full** `npx jest` passes; mutation checks done; GLM + Luna reviews with confirmed findings fixed and a confirmation review; Haiku emulator (and web) checklist passed and key screenshots viewed by the lead (scrolling, controls look like controls, 200% text); tracker entry; committed on the unit branch. Merge and push only with the owner's explicit OK.

## 9. Units and gates

| Step | Gate |
|---|---|
| This draft | Owner approval |
| Each unit (A, B, C1, C2, C3, D) | Built and verified as §8; owner OK to commit on its branch; separate owner OK to merge/push |

## 10. Risks

- **Gesture clashes:** Android's edge back-gesture can take a swipe that starts at the screen edge; the card area keeps a margin from the edges and is checked on the emulator.
- **Native crash class:** re-parenting animated views crashes Fabric and is invisible to Jest; the build rule in §4.3 and an emulator check guard it.
- **Colour fade readability:** the full background fade is safe only because everything on it has its own surface; the contrast test must cover every book colour.
- **Shine looking cheap:** tuned on the emulator; the owner sees it in the C2 screenshots.
- **Shuffle and Previous:** the order is fixed per visit, so Previous is always defined.
- **Large libraries:** only the small index is loaded in full; details load in batches.
- **On this day accuracy:** SDD-09 does not record a change to `completed_at` alone, so some finish dates may be stale.

## 11. Out of scope

Cross-book search; all-notes list; Today's note; notifications of any kind; labels and collections (SDD-11); deleting Saved Pages; note editing from the swipe section; streaks, counters or "notes reviewed" stats.

## 12. Review record

- **2026-10-23, GLM 5.3 flash (opencode, read-only, repo fingerprint unchanged):** APPROVE WITH FIXES, 15 findings across SDD-10/11. The lead checked them against the code; fixed: ambiguous `reading_notes → user_books` embed (two foreign keys), missing Back path for the `swipe` origin, sheet primaries (DP-03), Home tile in both views with a defined day seed, fixed gesture thresholds, Saved Pages gate citation, 1,000-row note limit recorded, Labels button outside the status radio group, 23505 only as success on link tables, composite same-owner keys plus a new `UNIQUE (id, user_id)` on `reading_notes`, indexes, collection cache invalidation, `noteKeys.collection` rename. A Luna run was stopped when the owner chose different reviewers.
- **Owner (2026-10-23):** the SDD review is to be done by Gemini 4 Argon (opencode) and Sonnet.
- **2026-10-23, Gemini 4 Argon (opencode-go, read-only, repo fingerprint unchanged; first run failed with a server error because a fresh data folder had no login) and Sonnet (Claude subagent, read-only):** both APPROVE WITH FIXES (Argon 17 findings, Sonnet 19). The lead checked them against the code. Fixed: deck return state and post-delete landing; origin rename moved to SDD-10 Unit C as a no-behaviour first commit (all call sites listed); `deckIndex` ordered by `created_at, id` with the export loader's paging; per-note card cache; deck invalidation on book removal; On this day titles from Library entries; chrome bars on opaque surfaces instead of on the book colour; gesture composition, worklet-to-JS rule, Modal root view, web text selection; keyboard gating; web announcements via `aria-live`; button row and chips in non-populated states; Home tile height and Arrange; search count denominator; lint scope; SDD-11 `scope=collection`, collection screen rows and Back, paged membership reads, collections cache, name rule as CHECK plus unique expression index, advisory-lock cap trigger, row guard trigger, two-layer grants, `on update restrict`, Labels row placement, Arrange clearing the label filter, chip counts, sheet primaries. Not changed: the Delete-book message (still true); "10 finished reads" (Argon compared it with SDD-09's earlier count of 5; the lead's live count today is 10).
- **2026-10-23, Gemini 4 Argon full review at `high` (its highest variant; opencode-go, read-only, repo fingerprint unchanged; prompt: scratchpad `argon-full-review.md`):** APPROVE WITH FIXES, 21 findings, and 10 earlier fixes judged incomplete or wrong. The lead checked the code claims and, on the owner's instruction, the database claims live through Supabase MCP (project `ahntbtktjjmvfosgkmgn` re-verified, read-only). All 21 accepted and fixed: wrong book-removal citation (now `deleteMutation`, `[bookId].tsx:245-250`, plus Search wishlist removal); `failOffset` axis lock replaced by a worklet shared-value lock; full `ManualNote` columns in `deckCard`; cache skip only for non-invalidated entries; reader Back matched by route key with deck state only in the fallback, and "Open book" Back stays Library (lead default); separate row-guard functions for entity and link tables; `cardShine` token instead of raw `rgba`; seeded-hash shuffle stable under deletes; background hidden from assistive tech while sheets are open; Home tile bounded by line counts; link tables with composite foreign keys only; label-aware empty state; §7 Arrange test text; collection screen states, primary, Back labels and `collectionId`; `Gesture.Exclusive(pan, doubleTap, singleTap)` order and tagged chip keys; `BookFeedbackSlot` in sheets; `(SELECT auth.uid())`, EXECUTE revokes, NULL guard, `23514`, `lock_timeout`; search control names and singular count; swipe fallbacks, title source, Previous disabled, position-line tokens; drag hint inside the card; On this day de-duplication and order; e2e fixture. Lead default changed as Argon suggested: empty swipe section with `scope=all` says "Go to library".
- **Live database check (Supabase MCP, read-only, 2026-10-23):** `reading_notes` has `reading_notes_user_book_id_fkey` and `reading_notes_book_owner_fkey` (on update restrict, on delete cascade) and no `(id, user_id)` unique key; `user_books_id_owner_key UNIQUE (id, user_id)` exists; `user_book_reads` / `user_book_progress` have only composite owner keys; `books.cover_url` exists; `reading_notes` RLS is owner-and-owned-book for all four commands; `authenticated` has SELECT and DELETE on `reading_notes` and column-limited INSERT/UPDATE; default privileges in `public` grant all table rights and EXECUTE to `anon` and `authenticated`; `user_book_pages` cascades from `user_books`; no `public` table name contains label/collection/tag/shelf. Noted, outside SDD-10/11: `user_books`, `books` and `user_book_pages` still grant `anon` full table rights, so only RLS protects them.
- **2026-10-23, narrow confirmation check of the Argon fixes (Sonnet, read-only):** all fixes correct against the code except two, both fixed: `returnToRoute` matches name, params **and** key (not key instead of params); the label-aware empty state must also be added to the shelf view, which has none today.
