# SDD-11 — Notes and books organising

**Status:** DESIGN DIRECTION APPROVED 2026-10-23 by the owner, with the lead defaults: "I approve SDD-10 for building and SDD-11's design direction, with the lead defaults. Commit the drafts on sdd10/spec and start SDD-10 Unit A." This approves what labels and collections do and how they look. It does not authorize a migration file, applying one, or building Units E/F: the database detail is checked again when each migration file is written (local Postgres tests, review, live Supabase checks), then needs the owner's two approvals (§9).
**Parent:** [Library roadmap](./LIBRARY-ROADMAP.md) §1 and [SDD-07](./SDD-07-book-section-ui-overhaul.md) §7 (reserved slots: note reader "add to collection"; Book Details and Home filter row for tags).
**Sibling:** [SDD-10 — Notes retrieval](./SDD-10-notes-retrieval.md) (app-only units). SDD-11 builds on SDD-10's swipe section, so its Unit F comes after SDD-10 Unit C.
**Supabase project:** `ahntbtktjjmvfosgkmgn` (shared with clubs and marketplace). **This SDD needs two migrations**, one per unit (E: labels, F: collections). Each needs two separate owner approvals: one to create the file, one to apply it. Before each, re-verify the project, the latest live migration, and the clubs and marketplace trackers for clashes. Read-only check 2026-10-23: no `public` table name contains `label`, `collection`, `tag` or `shelf`.

## 1. Goal

A reader can put their own labels on books ("Favourites", "Borrowed") and filter the library by them, and can gather notes from any book into named collections ("Lines about grief"), including straight from the swipe section with a double tap.

| Unit | What | Database |
|---|---|---|
| **E** | Labels for books | Migration 1: two tables |
| **F** | Note collections, double tap and collection chips in the swipe section | Migration 2: two tables |

Order: E → F (lead default; the owner may swap them). F needs SDD-10 Unit C on `main`.

## 2. Why

The shelf has only fixed filters (All, Reading, Finished, Wishlist) and notes can only be grouped by book or category. Readers want their own groupings, on their account so they sync across devices.

## 3. Current state (read-only evidence, `main` `91db311`, 2026-10-23)

- Home filters are fixed in `src/features/books/utils/libraryShelf.ts:25-40` and shown by `LibraryFilterBar`.
- No table or column for labels, tags, custom shelves or collections exists for books or notes. The only `tags` column is the exchange feature's (`20251228114030_002_p2p_exchange_system.sql:103`), unrelated.
- In code, the note origin `'collection'` (`manualNoteContract.ts:11`, `noteNavigation.ts:12`) means "opened from the notes list". **SDD-10 Unit C renames it to `'list'`** (with `noteKeys.collection` → `noteKeys.list`) as a no-behaviour-change first commit, so by Unit F the word is free and `'collection'` can be the origin for notes opened from a collection screen.
- Shelf order is stored on the device per user (`library_shelfOrder:v2:<userId>`, `src/features/books/hooks/useShelfArrangement.ts:7`).
- Notes (`reading_notes`) have owned-book RLS and column-limited grants (`20261017083830_library_manual_note_privilege_revision_correction.sql:233-255`). Deleting a book cascades to its notes (`20260820034004_reading_notes_fk_and_cleanup.sql:7-9`).

## 4. Design

### 4.1 Unit E — labels for books

**Behaviour**
- **Suggested labels** (D11-02): Favourites, To re-read, Borrowed, Gift, Signed copy, Classics. They are a constant in the app, not rows; a suggested label becomes a real label the first time it is used.
- **Limits** (D11-03): up to **25 labels per person** (suggested ones count once used); names 1–24 characters after trimming; names unique per person ignoring case; any number of labels per book.
- **Book Details:** a plain "Labels" row in the existing rows group (`topStyles.rows` in `[bookId].tsx`, with All notes and Book information), after the "Your reading" section — not between the primary action and that section (DP-01: plain secondary row, no fills, no counts in containers). It shows the book's labels as text, or "Add labels" when there are none. Tapping opens a sheet: your labels with ticks (tap to add or remove), unused suggestions, and "New label" (text field, limits shown). At 25 labels, "New label" and unused suggestions are disabled with "You have 25 labels. Rename or delete one to add another."
- **Manage labels** (**lead default** — needed so a full set can be freed): in the same sheet, a "Manage" text button opens rename and delete. Deleting a label asks for confirmation ("Delete "Borrowed"? It will be removed from 3 books.") and removes it from every book.
- **Library home filter:** a separate "Labels" button placed directly after the status filter row, **not inside it**: `LibraryFilterBar` is a status radio group (`accessibilityRole="radiogroup"`, `src/components/library/LibraryFilterBar.tsx:23,45`) and is not changed. The button opens a sheet listing your labels; picking one filters the shelf/list to books with that label; the button then reads the label's name with a clear (×) button. The label filter **combines** with the status filter (e.g. Reading + Borrowed) — **lead default**. While a label filter is on, the status chip counts are computed over the label-filtered books, so they match what the shelf shows. The button is hidden when you have no labels. With a label filter on and no matching books, the shelf shows "No Borrowed books" (not "Your library is empty") and "Show all books" clears **both** the status and label filters — in the list view, `LibraryEmptyState` and `onShowAll` (`src/components/library/LibraryBookList.tsx:41-47,84`, `index.tsx:192-194`) learn about the label filter. The shelf view has no empty state today (it just shows an empty shelf), so Unit E adds the same message and "Show all books" button below the filter row in shelf view when the filtered set is empty. Deleting the label that is being filtered clears the filter.
- **Shelf order and Arrange:** books inside a label keep the device's saved shelf order. Entering Arrange clears the label filter, exactly as it already resets the status filter to All (`index.tsx:178-180`), so the whole shelf is arranged; while Arrange is on, the Labels button is disabled like the status filter row — **lead default**.
- Every save gives visible feedback (`notifySaveSuccess`); failures show an error toast with "Try again" (DP-05).
- **One primary per sheet state (DP-03):** the labels sheet's primary is "Done" (also when the 25-label limit is reached); "New label" step: "Add label"; Manage list: "Done"; rename step: "Save name"; delete confirmation: the destructive "Delete".

**Data model (migration 1; proposed, not authorized)**
- `public.user_library_labels`: `id uuid pk`, `user_id uuid not null default auth.uid()` (owner, references `auth.users`, on delete cascade), `name text not null`, `created_at`, `updated_at`.
- **Name rule, one definition:** `CHECK (name = btrim(name) AND char_length(name) BETWEEN 1 AND 24)` (24 characters = 24 code points; the app counts the same way with `[...name].length` after trimming) and a **unique expression index** on (`user_id`, `lower(name)`). The database decides what "the same name" means: the app does not compare names itself, and maps any 23505 from creating or renaming a label to "You already have a label called "…"."
- `public.user_book_labels`: `user_id`, `user_book_id`, `label_id`, `created_at`. Primary key (`user_book_id`, `label_id`). **Only the composite foreign keys below** — no single-column `user_book_id` or `label_id` foreign keys — so a PostgREST embed has exactly one path (single plus composite keys to the same table make embeds ambiguous, as on `reading_notes`). This is how the SDD-09 tables are built (live check 2026-10-23: `user_book_reads` and `user_book_progress` have only their composite owner keys).
- **Same owner everywhere:** a row may only link a book and a label that both belong to `user_id`. Enforced with **composite foreign keys** only, the pattern `user_book_reads` uses: `user_library_labels` gets `UNIQUE (id, user_id)`; `user_book_labels (user_book_id, user_id)` references `user_books (id, user_id)` (the existing `user_books_id_owner_key`) and `(label_id, user_id)` references `user_library_labels (id, user_id)`, both on delete cascade and **on update restrict**, matching `reading_notes_book_owner_fkey`.
- **Indexes:** besides the primary key, `user_book_labels (label_id)` (filter by label, label delete) and `(user_id)`.
- **25-label limit:** a BEFORE INSERT trigger takes `pg_advisory_xact_lock(hashtextextended('library-label-cap:' || NEW.user_id::text, 0))` and then counts the user's labels — the repo's cap-lock pattern (`20260822234500_clubs_b02_creation_cap_race_fix.sql:52`). An advisory lock is needed because a row lock locks nothing when the user has no labels yet. The function is `SECURITY DEFINER SET search_path = ''` so the count sees every row of that user regardless of RLS, with `EXECUTE` revoked from `PUBLIC`, `anon` and `authenticated`.
- `user_id` on every new table defaults to `auth.uid()`; the client never sends it.
- **Row guard triggers**, two functions because the tables differ: for **entity tables** (labels, collections), BEFORE INSERT sets `created_at` and `updated_at` from the server clock; BEFORE UPDATE sets `updated_at` and refuses changes to `id`, `user_id` or `created_at`. For **link tables** (`user_book_labels`, `user_note_collection_items`, which have no `id` or `updated_at`), BEFORE INSERT sets `created_at` / `added_at`; there is no UPDATE grant on them, and a BEFORE UPDATE guard refuses any change anyway.
- **RLS** on both tables, `TO authenticated`, written with `(SELECT auth.uid())` (not bare `auth.uid()`, which triggers Supabase's `auth_rls_initplan` advisor): owner-only select, insert (`WITH CHECK (user_id = (SELECT auth.uid()))`), delete; update only on labels.
- **Functions:** every new trigger function is `SET search_path = ''` and has `EXECUTE` revoked from `PUBLIC`, `anon` and `authenticated` (live check 2026-10-23: the project's default privileges grant EXECUTE on new functions to `anon` and `authenticated`). The cap trigger first refuses a missing `user_id` (`IF NEW.user_id IS NULL`) before taking the lock, and raises SQLSTATE `23514` with message `library_label_limit` when the user already has 25; the client maps that to "You have 25 labels…".
- **Migration header:** `SET LOCAL lock_timeout = '5s'`, as in the SDD-09 migration.
- **Grants**, the two-layer pattern of `20261017083830_library_manual_note_privilege_revision_correction.sql:233-256`: `REVOKE ALL` on the table **and** on its columns from `PUBLIC`, `anon` and `authenticated` (Supabase grants new tables to both roles by default), then grant `authenticated` exactly: labels `SELECT`, `INSERT (name)`, `UPDATE (name)`, `DELETE`; link table `SELECT`, `INSERT (user_book_id, label_id)`, `DELETE`. `anon` gets nothing.
- **Client writes:** plain insert/delete/update — **never `upsert`** (column-limited UPDATE grants refuse PostgREST's `ON CONFLICT DO UPDATE`). A duplicate (23505) is treated as success **only for the link table** (`user_book_labels`: the book already has that label). On the labels table it is **not** success: it shows "You already have a label called "Borrowed"." and nothing is saved.
- Migration checked on local Postgres with tests (owner-only access, cross-user link refused, limit race, cascades, grants) before the owner sees the file.

### 4.2 Unit F — note collections

**Behaviour**
- Named groups of **any notes** from any book (D11-05). A note can be in several collections.
- **Limits** (D11-06): up to **25 collections per person**; names 1–40 characters, unique per person ignoring case; no limit on notes per collection.
- **Library home:** a "Collections" text link next to the SDD-10 Home tile (D11-07), hidden during Arrange like the tile. Shown whenever you have any notes, even before the first collection exists, so the feature can be found (lead default).
- **Collections screen** (`app/(tabs)/library/collections.tsx`): your collections, newest first, each with its name and "8 notes" as plain text; "New collection"; rename and delete per collection (delete asks for confirmation and removes only the grouping, never the notes).
- **States (DP-05)** for both collection screens and both sheets: loading; empty ("No collections yet." with "New collection"; a collection with no notes: "No notes in this collection yet."); error with "Try again"; not found (a deleted collection opened from history: "This collection no longer exists." with "Back to Collections"); offline (cached content shown, every write control disabled with "You're offline."); saving and failed per action (toast). Primaries: collections screen "New collection"; collection screen "Swipe through" when it has notes, none when empty ("Add notes from the note reader or the swipe section." as plain text).
- **A collection's screen** (`collection.tsx?collectionId=…`): its notes, newest added first, a "Swipe through" button, and remove-from-collection per note. Rows are a new library row component that wraps `NotePassageLink` (which takes only a note and has no book title or remove button, `src/components/notes/NotePassageLink.tsx:9-26`) and adds the book title and a "Remove" text button; the shared component is not changed. Data: the collection's item ids (paged, below), then notes and book titles by id with SDD-10's two-query `deckCard` loader and cache.
- **Opening a note** from a collection screen uses the origin `'collection'` (free after SDD-10's rename). `returnFromNote` gains a `collection` branch back to that collection screen, matched by route key like SDD-10's `swipe` branch; `NoteRouteContext` gains `collectionId`. Back labels: reader from a collection "Back to collection"; collection screen "Back to Collections"; collections screen "Back to Library".
- **"Swipe through"** opens `notes-swipe?scope=collection&collectionId=…`: the deck limited to that collection's notes, title = collection name. Back from the swipe section returns to the collection screen.
- **Note reader:** an "Add to collection" text button (the SDD-07 reserved slot).
- **Swipe section** (D11-08, D11-09):
  - **Double tap** on the card opens the collections sheet. To tell a single tap from a double tap, a single tap now waits about 250 ms before opening the full note. Composition: `Gesture.Exclusive(pan, doubleTap, singleTap)` with `doubleTap = Gesture.Tap().numberOfTaps(2).maxDelay(250)` placed **before** `singleTap` (the other order stops double tap from ever firing). JS work from the tap callbacks goes through `runOnJS` / `scheduleOnRN`.
  - **"Add to collection"** secondary button in the button row (fourth button; Next stays the one primary; the row wraps at 200% text). This is the only way for TalkBack users, because TalkBack itself uses double tap to press things. Also a TalkBack custom action on the card.
  - **Collections sheet:** your collections with a tick next to those holding this note; tap to add or remove; "New collection" at the top (create and add in one step). Confirmation toast ("Added to Lines about grief" / "Removed from Lines about grief") and a short pulse on the card (off with reduced motion). Haptic tick on add.
  - **Collection chips:** after the category chips, one chip per non-empty collection. Swipe up cycles categories, then collections, then back to All, skipping empty ones. Each remembers its position, as in SDD-10. Chip identity is a tagged value (`{ kind: 'all' }`, `{ kind: 'category', tag }`, `{ kind: 'collection', collectionId }`), so a collection named "Quote" or "All" never clashes with a category. When the swipe section is opened with `scope=collection`, collection chips are not shown (the deck is already one collection).
  - **Sheets** (labels and collections) render `BookFeedbackSlot` inside themselves so their toasts are visible over the Modal, and hide the screen behind from assistive tech (`aria-hidden`, `importantForAccessibility="no-hide-descendants"`, web `inert`) while open.
- Every save gives visible feedback; failures show an error toast with "Try again".
- **One primary per sheet state (DP-03):** the collections sheet's primary is "Done" (also at the 25 limit); "New collection" step: "Create and add"; rename step: "Save name"; delete confirmation: the destructive "Delete". On the collections screen the one primary is "New collection".
- **Cache:** creating, renaming or deleting a collection, and adding or removing a note, invalidate the collections keys **and** the SDD-10 deck prefix. Deleting a note and removing a book also invalidate the collections keys (their cascades change counts and contents).

**Data model (migration 2; proposed, not authorized)**
- `public.user_note_collections`: `id uuid pk`, `user_id` (owner, on delete cascade), `name text not null` (trimmed, 1–40, check), `created_at`, `updated_at`. Unique on (`user_id`, `lower(name)`).
- `public.user_note_collection_items`: `user_id`, `collection_id`, `note_id`, `added_at`. Primary key (`collection_id`, `note_id`). Only the composite foreign keys below (no single-column ones), for the same embed reason as `user_book_labels`.
- **Same owner:** `user_note_collections` gets `UNIQUE (id, user_id)`; `(collection_id, user_id)` references it. For the note side, a composite foreign key `(note_id, user_id)` → `reading_notes (id, user_id)` needs **a new `UNIQUE (id, user_id)` constraint on `reading_notes`** (it has none today; `id` is already its primary key, so this adds an index but changes no data). This is a change to an existing library table and is called out in the migration file for the owner's review. It is added in the same transaction as the new tables; it briefly locks `reading_notes` while the index builds (12 rows today). Both composite foreign keys use on delete cascade and on update restrict.
- **Indexes:** besides the primary key, `user_note_collection_items (note_id)` (note delete cascade, deck lookup) and `(user_id)`.
- Name rule (1–40 code points, trimmed, unique expression index on `lower(name)`), 25-collection limit trigger with its own advisory-lock key (`'library-collection-cap:'`), row guard trigger, RLS, two-layer grants (items: `SELECT`, `INSERT (collection_id, note_id)`, `DELETE`), no `upsert` (23505 is success only for the items table; on collections it shows "You already have a collection called …") and local Postgres tests, all as in Unit E.
- **Reading membership:** every read of `user_note_collection_items` (deck chips, counts, a collection's screen) pages like SDD-10's `deckIndex`: ordered by `added_at, note_id`, `.range()` per page, stop on the database page length — because a collection has no note limit and PostgREST caps each response at 1,000 rows.
- **Deleting** a note or a book (which deletes its notes) removes the note from every collection through the cascade. Deleting a collection never deletes notes.
- The SDD-10 deck index gains each note's collection ids (one extra owner-filtered query, cached), so collection chips filter in the app like categories.

### 4.3 Rules across both units

- Two migrations, each with two owner approvals, project re-verified before each step, recorded in the tracker ledger (local filename, md5, live version, effects, readback, advisors).
- External models never touch Supabase or migration application.
- Never `upsert`. Explicit owner filter on every query, plus RLS.
- SDD-07 DP-01 to DP-07 apply; counts only as plain text (DP-04).
- Shared components are not changed for library looks.

## 5. Decisions (owner, chat, 2026-10-23)

| ID | Decision |
|---|---|
| D11-01 | Labels for books are in scope, stored on the account (sync across devices). |
| D11-02 | Six suggested labels: Favourites, To re-read, Borrowed, Gift, Signed copy, Classics. |
| D11-03 | Up to 25 labels per person; names up to 24 characters; any number per book. |
| D11-04 | Collections are kept (not dropped). |
| D11-05 | Any note can go in a collection, not only Quotes. |
| D11-06 | Up to 25 collections; names up to 40 characters; no limit on notes per collection. |
| D11-07 | Collections are reached from a "Collections" link next to the Home swipe tile. |
| D11-08 | Double tap in the swipe section opens the collections sheet (add to an existing collection or a new, custom-named one). |
| D11-09 | Collections appear in the swipe chips after the categories, and swipe up cycles through them. |
| D11-10 | Both units need migrations and come after the app-only SDD-10 units. |

## 6. Files (expected; confirmed per unit)

- **E:** migration `supabase/migrations/<timestamp>_library_book_labels.sql` and local Postgres test; new `src/features/books/labels/` (contract, gateway, hooks, pure limit/name rules); Book Details labels row and sheet; `LibraryFilterBar` usage in `index.tsx` (wrap, don't change shared components); `libraryShelf.ts` (label filter).
- **F:** migration `<timestamp>_library_note_collections.sql` and test; new `src/features/books/collections/`; `collections.tsx`, `collection.tsx`, `_layout.tsx`; a library note-row wrapper; note reader button; `noteNavigation.ts` (`collection` branch); SDD-10 swipe files (double tap, fourth button, chips, `scope=collection`, deck index); `[bookId].tsx` and `useManualNotes.ts` (collections invalidation).
- **Both:** `e2e/fixtures/libraryFixture.ts`; `src/components/library/LibraryBookList.tsx` and the shelf branch of `index.tsx` (label-aware empty state in both views); `eslint-rules/book-section/__tests__/config.test.js` (pinned strict list); add `src/features/books/labels`, `src/features/books/collections` and the new screens to `lint:library` (`package.json`), `eslint.config.js` and `STRICT_FILES` (`eslint-rules/book-section/config.js`).

## 7. Tests

- **Postgres (local, before the owner sees each file):** owner-only read/write; cross-user link refused; limit of 25 holds under two concurrent inserts; name length and case-insensitive uniqueness; cascades on book, note, label and collection delete; `anon` has nothing; `user_id` cannot be updated; upsert shape is refused (documents why the client never upserts).
- **Jest:** gateways (owner filter, 23505 as success, error toasts); label filter combined with status filter (chip counts follow it); entering Arrange clears the label filter and the Labels button is disabled while arranging; empty result under a label filter shows, in both list and shelf view, "No Borrowed books" and "Show all books" clears both filters; deleting the active label clears the filter; cap error `23514` maps to the limit message; destructive confirmations have one `destructive` button and no `primary`; sheet tick states; limits reached; double tap vs single tap timing; "Add to collection" button and custom action do the same as double tap; chip cycle includes collections and skips empty ones.
- **Mutation check:** each new test fails when its fix is removed.
- **Web a11y suite:** `e2e/fixtures/libraryFixture.ts` answers the new label and collection tables and `in.(…)` filters, so `npm run e2e:library-a11y` has no unhandled reads.
- **Manual (Haiku, Android emulator + web):** add/remove labels, filter, rename/delete; collections create/add/remove/delete; double tap vs tap; TalkBack path via the button; 200% text; the lead views the key screenshots.

## 8. Done criteria (per unit)

Migration created and applied only with the owner's two approvals, with readback and advisors recorded; `tsc` 0; `lint:library` 0 errors; full `npx jest` passes; mutation checks; GLM + Luna reviews and a confirmation review; Haiku emulator/web checks with screenshots viewed by the lead; tracker entry; committed on the unit branch; merge/push only with the owner's OK.

## 9. Units and gates

| Step | Gate |
|---|---|
| This draft | Owner approval |
| Unit E migration file | Owner approval to create |
| Unit E migration application | Separate owner approval to apply |
| Unit E app build | After the migration is applied and read back |
| Unit F | Same three gates; starts after SDD-10 Unit C is on `main` |

## 10. Risks

- **Shared database:** a mistake affects clubs and marketplace; mitigated by local Postgres tests, two approvals and readback.
- **Device-only shelf order vs synced labels:** order differs between devices while labels match; accepted.
- **Single-tap delay:** opening the full note becomes ~250 ms slower once double tap exists.
- **Limit races:** solved by the locking trigger, tested.
- **Naming clash:** the old `'collection'` origin is renamed in SDD-10 Unit C; Unit F must not start before that is on `main`.

## 11. Out of scope

Labels or collections in export (SDD-08) — possible later; sharing collections with others; labels on notes; colours or icons for labels; ordering books or notes by hand inside a label or collection; deleting the Saved Pages table.

## 12. Review record

- **2026-10-23, GLM 5.3 flash (opencode, read-only, repo fingerprint unchanged):** APPROVE WITH FIXES, 15 findings across SDD-10/11. The lead checked them against the code; fixed: ambiguous `reading_notes → user_books` embed (two foreign keys), missing Back path for the `swipe` origin, sheet primaries (DP-03), Home tile in both views with a defined day seed, fixed gesture thresholds, Saved Pages gate citation, 1,000-row note limit recorded, Labels button outside the status radio group, 23505 only as success on link tables, composite same-owner keys plus a new `UNIQUE (id, user_id)` on `reading_notes`, indexes, collection cache invalidation, `noteKeys.collection` rename. A Luna run was stopped when the owner chose different reviewers.
- **Owner (2026-10-23):** the SDD review is to be done by Gemini 4 Argon (opencode) and Sonnet.
- **2026-10-23, Gemini 4 Argon (opencode-go, read-only, repo fingerprint unchanged; first run failed with a server error because a fresh data folder had no login) and Sonnet (Claude subagent, read-only):** both APPROVE WITH FIXES (Argon 17 findings, Sonnet 19). The lead checked them against the code. Fixed: deck return state and post-delete landing; origin rename moved to SDD-10 Unit C as a no-behaviour first commit (all call sites listed); `deckIndex` ordered by `created_at, id` with the export loader's paging; per-note card cache; deck invalidation on book removal; On this day titles from Library entries; chrome bars on opaque surfaces instead of on the book colour; gesture composition, worklet-to-JS rule, Modal root view, web text selection; keyboard gating; web announcements via `aria-live`; button row and chips in non-populated states; Home tile height and Arrange; search count denominator; lint scope; SDD-11 `scope=collection`, collection screen rows and Back, paged membership reads, collections cache, name rule as CHECK plus unique expression index, advisory-lock cap trigger, row guard trigger, two-layer grants, `on update restrict`, Labels row placement, Arrange clearing the label filter, chip counts, sheet primaries. Not changed: the Delete-book message (still true); "10 finished reads" (Argon compared it with SDD-09's earlier count of 5; the lead's live count today is 10).
- **2026-10-23, Gemini 4 Argon full review at `high` (its highest variant; opencode-go, read-only, repo fingerprint unchanged; prompt: scratchpad `argon-full-review.md`):** APPROVE WITH FIXES, 21 findings, and 10 earlier fixes judged incomplete or wrong. The lead checked the code claims and, on the owner's instruction, the database claims live through Supabase MCP (project `ahntbtktjjmvfosgkmgn` re-verified, read-only). All 21 accepted and fixed: wrong book-removal citation (now `deleteMutation`, `[bookId].tsx:245-250`, plus Search wishlist removal); `failOffset` axis lock replaced by a worklet shared-value lock; full `ManualNote` columns in `deckCard`; cache skip only for non-invalidated entries; reader Back matched by route key with deck state only in the fallback, and "Open book" Back stays Library (lead default); separate row-guard functions for entity and link tables; `cardShine` token instead of raw `rgba`; seeded-hash shuffle stable under deletes; background hidden from assistive tech while sheets are open; Home tile bounded by line counts; link tables with composite foreign keys only; label-aware empty state; §7 Arrange test text; collection screen states, primary, Back labels and `collectionId`; `Gesture.Exclusive(pan, doubleTap, singleTap)` order and tagged chip keys; `BookFeedbackSlot` in sheets; `(SELECT auth.uid())`, EXECUTE revokes, NULL guard, `23514`, `lock_timeout`; search control names and singular count; swipe fallbacks, title source, Previous disabled, position-line tokens; drag hint inside the card; On this day de-duplication and order; e2e fixture. Lead default changed as Argon suggested: empty swipe section with `scope=all` says "Go to library".
- **Live database check (Supabase MCP, read-only, 2026-10-23):** `reading_notes` has `reading_notes_user_book_id_fkey` and `reading_notes_book_owner_fkey` (on update restrict, on delete cascade) and no `(id, user_id)` unique key; `user_books_id_owner_key UNIQUE (id, user_id)` exists; `user_book_reads` / `user_book_progress` have only composite owner keys; `books.cover_url` exists; `reading_notes` RLS is owner-and-owned-book for all four commands; `authenticated` has SELECT and DELETE on `reading_notes` and column-limited INSERT/UPDATE; default privileges in `public` grant all table rights and EXECUTE to `anon` and `authenticated`; `user_book_pages` cascades from `user_books`; no `public` table name contains label/collection/tag/shelf. Noted, outside SDD-10/11: `user_books`, `books` and `user_book_pages` still grant `anon` full table rights, so only RLS protects them.
- **2026-10-23, narrow confirmation check of the Argon fixes (Sonnet, read-only):** all fixes correct against the code except two, both fixed: `returnToRoute` matches name, params **and** key (not key instead of params); the label-aware empty state must also be added to the shelf view, which has none today.
