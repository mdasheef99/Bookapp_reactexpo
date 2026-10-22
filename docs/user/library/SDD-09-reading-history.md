# SDD-09 — Reading history

**Status:** APPROVED 2026-10-22. The owner accepted every recommendation D09-01 to D09-17 (§5), with D09-05 changed to **no automatic undo** (the lead's simplification): "ok go with your recommendation , i accept you decisoins let go with them, i hope you have also kept simplicity in mind while making them". This approves the design only: the Unit 1 migration file and its application each still need their own approval, and each commit needs the owner's OK.
**Parent:** [Library roadmap](./LIBRARY-ROADMAP.md) §1 (SDD-09 track) and [SDD-07](./SDD-07-book-section-ui-overhaul.md) §7 (reserved slots: Book Details status area for dates and reread count; Home summary area for goal progress).
**Owner scope decision (chat, 2026-10-22):** build the **lean list** of 18 items in 5 units (§1). Moved out: the opt-in reading rhythm (streaks, targets, reminders) to its own future SDD, and "On this day" to SDD-10. Removed for complexity: long-press quick action, shelf bookmark ribbon, draggable scrubber, audiobook minutes, partial dates, rating per read, mood chips, undo bar, offline saving, year-card cover strip, format per read (§11).
**Branch / worktree:** `sdd09/reading-history` in `Bookconnect4_sdd09`, from `main` `5946e68`.
**Supabase project:** `ahntbtktjjmvfosgkmgn` (shared with clubs and marketplace). This SDD needs **one migration** (Unit 1): four new tables; an AFTER trigger on `user_books` (`library_record_reading_history`); a BEFORE trigger on `user_book_reads` that sets `updated_at`; the RPCs `library_start_reread` and `library_reopen_read`; RLS, grants and a one-time back-fill. `user_books` columns, constraints and status values stay unchanged. Every migration needs two separate owner approvals (create the file; apply it), a project re-check before each, and a check of the clubs and library trackers first (AGENTS.md workspace split).

## 1. Goal

A reader can see when they read each book, how far they are in the books they're reading, the story of each read, and their year — calmly, with no streaks, badges or reminders (DP-04). History starts recording as early as possible, because history that was never recorded can't be rebuilt.

| Id | Feature | Unit | Origin |
|---|---|---|---|
| H-01 | One record per read: read number, start, end, outcome (reading / finished / did not finish) | 1 | Roadmap; owner yes |
| H-02 | Progress updates (page or %) stored per read | 1 | Owner yes |
| H-03 | Storage for the next-read choice and the yearly goal | 1 | Lean list |
| H-04 | Edit and back-fill dates (exact date or "I don't remember") | 2 | Lean list |
| H-05 | "Start reading" in Quick Look and on Book Details | 2 | Owner idea |
| H-06 | Reading outline on the shelf for books being read | 2 | Owner idea |
| H-07 | "Read again" for rereads; read count and dates in the reserved slot | 2 | Roadmap |
| H-08 | CSV history columns | 2 | Owner yes |
| H-09 | Page or % input with a display-only page-edge bar; editable total pages | 3 | Owner yes (aesthetic UI) |
| H-10 | "You're on p. 142?" offered after saving a note with a page | 3 | Lean list |
| H-11 | Pace bars and a calm estimate | 3 | Owner yes |
| H-12 | Continue-reading card on Home | 3 | Lean list |
| H-13 | Timeline per book, per read | 4 | Owner yes |
| H-14 | Finish moment: rating and a one-line reflection | 4 | Lean list |
| H-15 | Your next read | 4 | Owner yes |
| H-16 | Yearly goal | 5 | Roadmap |
| H-17 | Compact stats with "Leave out of my stats" | 5 | Roadmap; lean list |
| H-18 | Year-in-review card (native share) | 5 | Lean list |

## 2. Why

- **Today the app forgets when you read.** `user_books` holds only the current status. Changing "Reading" to "Finished" overwrites it; only `completed_at` survives, and it is not shown anywhere and not cleared when the status goes back (4 live `want_to_read` rows still carry one).
- **Every later feature needs dated reads:** rereads, progress, the timeline, the goal, stats and the year card.
- **Progress makes "Reading" alive.** Home already has a "Current Read" card with an unused progress bar (`LibraryBentoGrid.tsx:8,28-35`); nothing feeds it.
- **Notes already know the page** (`reading_notes.page_number`), so progress can often be updated with one tap.

## 3. Current state (read-only evidence, `main` `5946e68`, 2026-10-22)

**Database (Supabase MCP, read-only, project URL verified as `ahntbtktjjmvfosgkmgn`):**
- `user_books`: `reading_status` text, default `want_to_read`, CHECK `want_to_read | reading | completed`; `rating` 1–5; `review`; `review_is_public`; `completed_at`; `created_at`; `updated_at`; UNIQUE `(user_id, book_id)` and UNIQUE `(id, user_id)`; `user_id` → `auth.users` ON DELETE CASCADE. **No triggers.** RLS: owner-only select/insert/update/delete (`auth.uid() = user_id`).
- `books.page_count` integer, nullable (Google `pageCount`; manual adds leave it empty, `booksService.ts:708-713`).
- `reading_notes`: `user_book_id`, `user_id`, `content`, `tag` (`quote | reflect | distill | apply | question`), `page_number` (> 0), `created_at`, `updated_at`, `version`; composite FK `(user_book_id, user_id)` → `user_books(id, user_id)` ON DELETE CASCADE; trigger `reading_notes_manage_revision`; RLS owner-only with an owned-book check. SDD-09 copies this pattern.
- **Drift noted:** the live `user_books` DELETE policy ("Users can delete their books") is not in the repo's `006_rls_policies_core_tables.sql` (which creates only select/insert/update). The live policy is what D09-08's cascade relies on; Unit 1 records the drift and does not change it.
- **Clubs also writes reading status.** `set_club_current_book_reading_status(p_club_id, p_status)` (SECURITY DEFINER, migration `20260311143000_015_club_current_book_status_contract.sql`) upserts `user_books` with the status and `completed_at = now()` for `completed`. Clubs keeps its own chapter progress in `member_reading_progress` / `reading_schedules`.
- Live rows: 38 `user_books` across 3 users — `completed` 4 (2 with `completed_at`), `reading` 1, `want_to_read` 33. Latest migration `20261017083830_library_manual_note_privilege_revision_correction`.

**Code (Haiku inventory, spot-checked by the lead):**
- Status writers: `booksService.updateReadingStatus` (`booksService.ts:790-802`, sets `completed_at` on `completed`) from Book Details `StatusSelector` (`[bookId].tsx:219-233, 371`; labels Want to read / Reading / Finished); `addToLibrary` (`:647-694`) from search and wishlist; `addManualBookToLibrary` (`:696-733`); the clubs RPC above. No other writes.
- Book Details has `RatingInput` (`:407-411`) and a review field; no date display; no SDD-09 slot code (the slot is a design placement only).
- Quick Look (`LibraryBookQuickLook.tsx`) opens by long-press on the horizontal shelf only (`HorizontalBookVolume.tsx:55`); buttons Close and View details. The vertical shelf has no Quick Look.
- Home (`app/(tabs)/library/index.tsx`): header, filters (All / Reading / Finished / Wishlist), "N books" summary, shelf, then `LibraryBentoGrid` (Current Read card, count, Wishlist).
- Shelf outlines are hard-coded (`HorizontalBookVolume.tsx:96,123` `#c5a059`; `LibraryShelf.tsx:304` `#e9c279`); three appearances `daylight | golden | midnight` in `LibraryAppearance.ts`.
- CSV columns (`libraryCsv.ts:5-8`) end with Date added, Date finished (from `completed_at`).
- Library has a toast (`ui/BookFeedback.tsx`) and uses `expo-haptics`; `@react-native-community/datetimepicker` 8.4.4 is installed (used only by clubs; no web date input exists). No chart or SVG library. No offline write layer in the library.
- DB tests for the library run with `node --test` against Postgres (`supabase/tests/library/manualNotePersistence.postgres.test.mjs`, README `:10`).

## 4. Design

### 4.1 Data model (Unit 1 migration; proposed, not authorized)

Four new tables, all owner-only, all following the `reading_notes` pattern (composite FK to `user_books(id, user_id)`, ON DELETE CASCADE, RLS for `authenticated`). Identity and state columns are NOT NULL.

**`user_book_reads`** — one row per read.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_book_id`, `user_id` | uuid NOT NULL | composite FK → `user_books(id, user_id)` ON DELETE CASCADE |
| `read_number` | int NOT NULL | 1, 2, … per book; UNIQUE `(user_book_id, read_number)`; a new read is `max + 1` |
| `outcome` | text NOT NULL | CHECK `reading | finished | did_not_finish` |
| `started_at`, `ended_at` | timestamptz null | automatic instants; null = unknown |
| `started_on`, `ended_on` | date null | the reader's own date choice (Edit dates); when set it wins over the instant |
| `start_unknown`, `end_unknown` | boolean NOT NULL default false | the reader chose "I don't remember"; wins over both the picked date and the instant |
| `total_pages` | int null | your edition; copied from `books.page_count` only when it is > 0, else null; CHECK > 0 |
| `counts_in_stats` | boolean NOT NULL | default true; a new read copies it from the previous read |
| `created_at`, `updated_at` | timestamptz NOT NULL | |

CHECKs: `outcome = 'reading'` ⇒ `ended_at`, `ended_on` are null and `end_unknown` is false; `started_at <= ended_at` and `started_on <= ended_on` when both are set. UNIQUE `(id, user_id)` (target of the progress FK). Partial UNIQUE index: at most one `outcome = 'reading'` row per `user_book_id`. **An "open read" means `outcome = 'reading'`** everywhere in this SDD — never `ended_at IS NULL`.

**`user_book_progress`** — append-only entries: `id`, `read_id` + `user_id` NOT NULL (composite FK → `user_book_reads(id, user_id)`, cascade), `page` int null (≥ 0), `percent` smallint null (0–100), CHECK exactly one of them, `recorded_at` timestamptz NOT NULL default `now()`. Current progress = latest entry. A page above `total_pages` is accepted; the reader can raise the total.

**`user_reading_goals`** — `user_id` (→ `auth.users` ON DELETE CASCADE), `year` smallint (2000–2100), `target_books` smallint (1–999), `updated_at`; PK `(user_id, year)`.

**`user_reading_settings`** — `user_id` PK (→ `auth.users` ON DELETE CASCADE), `next_read_user_book_id` uuid null with FK `(next_read_user_book_id, user_id)` → `user_books(id, user_id)` ON DELETE SET NULL (`next_read_user_book_id`) (column-list form; live Postgres is 17.6, checked 2026-10-22), `updated_at`.

**Time (D09-07):** automatic events store the instant (`now()`); the client shows it as a calendar day in the device's time zone. A date the reader picks is stored as a plain **date** (`started_on` / `ended_on`, the local calendar day), so it never moves with time zones. The effective day of a read edge = unknown if its `*_unknown` flag is set, else the picked date if set, else the instant's local day, else unknown. Cross-kind order (a picked date against an instant) can't be checked in the database without the reader's time zone, so the edit sheet validates effective days before saving, and display never shows a start after its end (it shows the end only). Validation compares effective days (start ≤ end, no day after today). On web the date comes from the input's own year/month/day. Stats and "this year" are computed on the client in local time.

**Grants:** `REVOKE ALL` on all four tables and both functions from `PUBLIC`, `anon` and `authenticated` first (table and column level; the trap fixed in `20261017083830`), then grant to `authenticated` only: reads `select`, `update` of `started_on`, `ended_on`, `start_unknown`, `end_unknown`, `total_pages`, `counts_in_stats` (column-level), and `delete` of reads that are **not open** (RLS `outcome <> 'reading'`; an open read is ended with "Stop reading" first, so a book can never stay "Reading" without a read). `outcome`, `read_number` and the instants change only in the database. Progress: `select`, `insert` (RLS: only into an **open** read of your own), `delete`. Goals and settings: owner CRUD. `EXECUTE` on `library_start_reread` and `library_reopen_read` to `authenticated` only; the trigger function gets no client execute grant.

### 4.2 Recording rules (trigger `library_record_reading_history`)

`AFTER INSERT OR UPDATE OF reading_status ON user_books`, SECURITY DEFINER with `SET search_path = ''` and schema-qualified names, `user_id` taken from the `user_books` row (server-derived; rows with a null `user_id` are skipped, since `user_books.user_id` is nullable). Wishlist rows are treated like any other row. It runs for **every writer**, including the clubs RPC, so no clubs code changes (D09-02).

The trigger acts only when the status really changes (`OLD.reading_status IS DISTINCT FROM NEW.reading_status`); the clubs upsert re-sending the same status does nothing. A null status is treated as `want_to_read`. An insert as `want_to_read` creates nothing. **No automatic undo (D09-05):** the trigger only records; it never reopens or deletes a read by itself. A wrong tap is fixed by hand in Edit dates ("Not finished yet", "Remove this read").

**End time per event:** a finish uses `NEW.completed_at` only when this statement changed it (`OLD.completed_at IS DISTINCT FROM NEW.completed_at`), else `now()`; a stop uses `now()`; any non-null value is clamped to `greatest(started_at, least(value, now()))`. An insert as `completed` without `completed_at` keeps `ended_at` null (unknown).

| Event | Rule |
|---|---|
| Insert as `reading` | Read #1, outcome reading, `started_at = now()`. |
| Insert as `completed` | Read #1, finished, `started_at` null, `ended_at` = clamped `completed_at`, or null. |
| → `reading`, open read exists | Nothing. |
| → `reading`, no open read | New read (n + 1), `started_at = now()`. |
| → `completed`, open read | Finish it (end time per event). |
| → `completed`, latest read is finished | Nothing (a status restore; never adds a read). |
| → `completed`, latest read did not finish | Turn it into finished (end time per event). |
| → `completed`, no reads | New finished read, `started_at` null, end time per event. |
| `reading` → `want_to_read`, no open read | Nothing. |
| `reading` → `want_to_read`, open read | Outcome `did_not_finish`, `ended_at = now()` (D09-04). |
| `completed` → `want_to_read` | Nothing; history stays. |
| `user_books` row deleted | Reads, progress and the next-read link go with it (cascade; D09-08). |

Whenever the trigger sets or clears an automatic end (finish, stop, reopen), it also clears `ended_on` and `end_unknown`, so a stale picked end never survives an outcome change. On **every** status change to `reading` or `completed` (whatever branch runs, including the "open read exists" no-op hit by `library_start_reread`), it clears `user_reading_settings.next_read_user_book_id` for that book. "No start" in the rules below means `started_at` and `started_on` are both null.

`library_start_reread(p_user_book_id)` (SECURITY DEFINER, `search_path = ''`) **locks the owned `user_books` row first** (`SELECT … FOR UPDATE` with the owner check), so it serializes with any status writer; refuses when an open read exists; inserts read n + 1 (open); then sets the status to `reading` (the trigger sees the open read and does nothing). Every "Start reading" or "Read again" on a finished book uses it. Tests run two concurrent sessions (reread vs a status update) and expect no deadlock and never two open reads.

`library_reopen_read(p_read_id)` (SECURITY DEFINER, `search_path = ''`) locks the owned `user_books` row first, accepts only the latest read of that book when it is finished or did-not-finish and no read is open, sets it back to reading (ends and end flags cleared), then sets the book status to `reading` (the trigger sees the open read and does nothing).

**Back-fill (same migration, D09-03):** each existing `reading` row gets an open read with unknown start; each `completed` row gets a finished read with `ended_at = completed_at` (null when missing). Expected live effect: 5 reads. `want_to_read` rows get nothing.

`completed_at` stays as it is (legacy; still written by its current writers). The reads table is the source for every SDD-09 surface.

### 4.3 Dates, rereads and the reading look (Unit 2)

- **Reserved slot under the status control (Book Details):** plain text, for example "Started 2 Oct · p. 142 of 320", "Finished 20 Oct · read 2 times", "Stopped 12 Oct". Tap "Edit dates" opens a sheet listing each read with Start and End (date picker or "I don't remember"), "Remove this read" for reads that are not open and not the latest read of a book whose status is Finished (so a Finished book always keeps a finished read; to remove that one, change the status first). The End field is disabled for an open read. "Not finished yet" on the latest read when it is finished or stopped and no read is open calls `library_reopen_read`. Fixing a wrong tap: Finished by mistake → "Not finished yet"; Reading or Stop by mistake → "Remove this read" after the status is right.
- **Finish without a start:** when a book becomes Finished with no start, the slot shows a one-time inline line: "No reading dates yet. [Add dates] [Not sure]". Add dates opens the edit sheet for that read (start and end). "Not sure" sets both edges to unknown. Ignored = keeps what the trigger stored. Dismissal is remembered (DP-04; see "Remembered dismissals" in §4.8).
- **Date picker:** native uses the installed `@react-native-community/datetimepicker`; web uses a small library-owned `<input type="date">` wrapper (new; no dependency). No future dates; start ≤ end.
- **"Start reading":** a button in Quick Look (horizontal shelf only — the default shelf style is vertical, which has no Quick Look) and, on Book Details, the existing "Reading" option of `StatusSelector`. No new gesture (long-press already opens Quick Look; press-and-drag arranges).
- **Reading outline:** books with an open read get an accent outline on both shelves, from a new `readingOutline` token per appearance (daylight, golden, midnight), not the hard-coded selection colours. Not colour-only: the volume's accessibility label gains "Reading". Selection/focus outlines keep priority.
- **"Read again":** shown on Book Details for finished books; calls `library_start_reread`.
- **"Stop reading":** on Book Details while reading; sets the status to Want to read, which records "did not finish" (§4.2).

### 4.4 CSV history columns (Unit 2)

Append to the SDD-08 library CSV (`libraryCsv.ts`): **Started** and **Finished** (latest read, ISO date in local time, empty when unknown), **Times read** (finished reads), **Last outcome** (Reading / Finished / Did not finish / empty). "Date finished" (from `completed_at`) is replaced by the read-based Finished column (D09-12). Generated values, so no formula guard (SDD-08 rule). The loader gains one paged read of `user_book_reads`.

### 4.5 Progress (Unit 3)

- **Update sheet** (from Book Details and the Home card): "Page [142] of 320" with −10, +10, +25 buttons and a number field (0 allowed; −10 stops at 0); "Change total pages" edits `total_pages` for this read. Books with no total use **% mode** (0–100, +5/+10). When a total is added later, earlier % entries are read as pages (`round(percent × total ÷ 100)`) for display and pace; when the total is removed, the sheet switches to % and page entries are shown as pages only. Saving inserts one progress entry; a light haptic tick on native.
- **Page-edge bar:** a display-only bar drawn like a book's page edges (plain views, no new library), hidden from screen readers; the text "142 of 320 pages, 44%" carries the meaning.
- **From notes (H-10):** after a note with `page_number` is saved for a book with an open read, and the page is beyond the current progress, the note screen shows an inline "You're on p. 142? [Update] [Not now]". One tap inserts the entry. "Not now" turns the prompt off for the rest of that read (remembered, DP-04). No prompt otherwise.
- **Pace bars and estimate (H-11):** up to 14 thin bars of pages per day (plain views). The estimate "About 6 days at your recent pace" shows only with ≥ 3 entries on ≥ 2 different days in the last 14 days and a known total; pace = pages gained in the window ÷ calendar days from the first in-window entry's day to today (minimum 1; lead decision 2026-10-22, so a stalled reader sees an honest, slower pace); hidden above 365 days. No deadline wording (DP-04).
- **Pace guards:** a zero or negative gain (progress moved back) shows no estimate and draws empty bars.
- **Continue-reading card (H-12):** Home's default view is the list (`index.tsx:56`), and `LibraryBentoGrid` renders only in shelf view. So the card is a small library-owned `ContinueReadingCard` placed under the controls in **both** views (the bento "Current Read" card in shelf view reuses it). It shows the most recently updated open read (title, "p. 142 of 320", its progress bar) and an "Update" button. With no open read and a next read set, it shows "Next up: {title}" with "Start reading". Otherwise unchanged.

### 4.6 The story of a read (Unit 4)

- **Timeline (H-13):** a "Your reading" section on Book Details: for each read (newest first, selector when > 1), "Started 2 Oct" → the notes created in that period (date, category, first line; up to 5, then "All notes") → "Finished 20 Oct" or "Stopped 12 Oct". Notes are assigned to reads by date; notes outside every read appear under "Other notes". Progress entries are not shown. No notes-table change.
- **Finish moment (H-14):** when a read becomes finished on Book Details, an inline panel (not a modal): "Finished. Your 12th book this year." (plain text; the count only when the end date is known and the read counts) and "One thought on this book?" which saves a normal note with tag `reflect` (shown as Thought). Dismissible; once per read (remembered, §4.8). The panel has no stars of its own: the rating is shown under the cover and changed through Edit (SDD-07 §14.2b, D07-23/D07-24). A short fade respecting reduced motion.
- **Your next read (H-15):** "Make this my next read" on Book Details for books not being read and not finished (any ownership, wishlist included). One at a time; choosing another says "Replaces {title}". The choice clears itself when that book is started or finished (trigger, §4.2). Starting a wishlist book does not change its ownership (D09-17). After a finish, the panel shows "Next up: {title} [Start reading]".

### 4.7 Goal, stats and year card (Unit 5)

- **Yearly goal (H-16):** set from the stats screen. Home summary area shows plain text "14 of 24 books in 2026" (DP-04: text only, no ring, no colour, no "behind"). No goal = a quiet text link "Reading stats" in the same place, so the stats screen (where the goal is set) is always reachable.
- **Counting rule (rereads):** books finished, the goal and "Your Nth book this year" count **distinct books** with a finished read ending in that year (a reread in the same year counts once; in a later year it counts in that year). Pages, finish rate and average days count **reads**.
- **Stats (H-17):** one screen, reached from the Home goal text and the Book Details timeline: This year / All time; books finished, pages read (sum of `total_pages` of finished reads; unknown excluded with a note), finish rate (finished ÷ (finished + did not finish)), average days per book (finished reads with both effective days; days = end day − start day + 1, in calendar days), and a 12-bar chart of **finished reads per month** (plain views; a book finished twice in one year appears in both months, so the bars can add up to more than the yearly book count — the text summary says so). Reads with an unknown end day are left out of the monthly bars and the yearly counts but included in all-time totals; did-not-finish reads count only in the finish rate. Book Details toggle "Leave out of my stats" is offered only once a book has at least one read; it sets `counts_in_stats` on all reads of that book, and later reads copy it. A left-out read is excluded from **every** number: books finished, pages, finish rate (both sides), average days, the monthly bars, the goal count, "Your Nth book this year" and the year card. It still appears in its timeline, Book Details dates and the CSV.
- **Year card (H-18):** a text-led PNG via the SDD-08 capture and share layer (`captureCardPng` in `export/captureCard.ts`, `deliverImageFile`): year, books finished, pages, one quote (default the newest Quote note of the year; the reader can pick another), small BookConnect footer (D08-07 style). "Your 2026 so far" until the year ends. Native only; hidden on web like the passage card (D08-11).

### 4.8 Rules across all units

- **DP-04:** no streaks, badges, reminders or notifications. The goal is plain text. The shelf outline and the progress bars are neutral status visuals, never alert colours (D09-11).
- **Accessibility (DP-06):** every bar has a text equivalent; the update sheet uses labelled buttons and a number field; the outline adds "Reading" to the accessible name; dialogs/sheets have names; 200% text must not clip; reduced motion respected.
- **Privacy:** all four tables are owner-only; nothing is visible to clubs, the marketplace or other users. History leaves the app only through the user's own CSV export or year card, with a preview first.
- **Remembered dismissals:** the finish-date choice, the note prompt and the finish panel are remembered per user and per read in AsyncStorage (as the shelf arrangement is), so they never repeat on that device after a remount or restart; another device may show one once.
- **Errors:** online only. A failed save shows the library toast with Retry; nothing is queued.
- **Web:** everything except the year card works on web.

## 5. Decisions (all recommendations ACCEPTED by the owner, 2026-10-22; D09-05 as simplified)

| Id | Question | Recommendation | Alternative |
|---|---|---|---|
| D09-01 | Where history lives | **Four new tables; `user_books` unchanged** (no new columns or status values), so clubs and marketplace code and types are untouched. | Add columns to `user_books`. |
| D09-02 | How reads are recorded | **A trigger on `user_books`**, because the clubs RPC also changes status and the library must not edit clubs code. | One library RPC for status changes (misses clubs writes); client writes (can drift). |
| D09-03 | Existing books | **Back-fill in the migration** (5 reads expected live). | Create reads lazily on first change. |
| D09-04 | "Did not finish" | **An outcome on the read only.** "Stop reading" returns the book to Want to read; Book Details shows "Stopped …". | A fourth status value (changes the shared CHECK, the clubs RPC check and every status switch). |
| D09-05 | Wrong taps | **No automatic undo** (owner, 2026-10-22, simplification): the trigger only records; fixes go through Edit dates. | A 10-minute automatic undo (the most complex rules; half of all review findings). |
| D09-06 | Finish with no recorded start | **Keep the writer's date** (on an update: `completed_at` if this statement set it, else now; on an insert: `completed_at`, else unknown) and offer "Finished today? / Pick a date / Not sure" inline once. | Always unknown until the reader adds a date. |
| D09-07 | Dates | **Automatic instants plus separate picked `date` columns**; the picked date wins. Picked dates never move with time zones. | Store picked dates as instants (local noon or day edges), which shift after travel. |
| D09-08 | Removing a book | **Removes its reading history** (cascade); the remove confirmation adds "and its reading history". | Keep history after removal (orphans, more rules). |
| D09-09 | Total pages | **Per read, defaulting to the book's page count, editable.** | Use `books.page_count` only (shared catalogue, often a different edition). |
| D09-10 | Next read | **One per user, any book not being read or finished**, in `user_reading_settings`. | Wishlist books only. |
| D09-11 | DP-04 reading of bars and outline | **Allowed as neutral status visuals**; the goal stays text only. | Text only everywhere (no progress bar, no outline). |
| D09-12 | CSV "Date finished" | **Replace it with read-based Started / Finished / Times read / Last outcome.** | Keep the old column too. |
| D09-13 | Web date input | **A small library-owned `<input type="date">` wrapper.** | Native only; web shows dates read-only. |
| D09-14 | Timeline content | **Reads and notes only**; progress entries not shown. | Show progress milestones. |
| D09-15 | Year card on web | **Hidden, as the passage card.** | Build web capture later with the passage card. |
| D09-17 | Starting a wishlist book | **Ownership stays as it is**; the Home card and Book Details show the read. (The Home "Reading" filter's handling of wishlist rows is left as today.) | "Start reading" also moves the book to Owned. |
| D09-16 | Build order | **Units 1 → 5 (§9)**, each reviewed and approved on its own; Unit 1 first so history starts. | One unit. |

## 6. Files (expected; confirmed per unit)

- **Unit 1:** `supabase/migrations/<timestamp>_library_reading_history.sql` (only after file approval); `supabase/tests/library/readingHistory.postgres.test.mjs`; `src/features/books/history/` (types, `readingHistoryGateway.ts` with read queries, query keys).
- **Unit 2:** `[bookId].tsx` (slot, Stop reading, Read again, remove-confirmation copy); `src/components/library/history/` (`ReadingDatesSlot`, `EditDatesSheet`, `LibraryDateInput` + `.web`); `LibraryBookQuickLook.tsx`; `HorizontalBookVolume.tsx`, `LibraryShelf.tsx`, `LibraryAppearance.ts` (outline token); `src/features/books/export/{libraryCsv,loaders,types}.ts`.
- **Unit 3:** `ProgressSheet`, `PageEdgeBar`, `PaceBars`; `note-compose.tsx` (inline prompt); `ContinueReadingCard`, `LibraryBentoGrid.tsx`, `index.tsx`; pace and estimate pure functions.
- **Unit 4:** `ReadingTimeline`, `FinishPanel`; next-read gateway functions; `[bookId].tsx`.
- **Unit 5:** stats screen route under `app/(tabs)/library/`; stats pure functions; `YearCard` + preview reusing `captureCard`/`deliverImageFile`.
- Never touched: shared `src/components/search`, `src/components/ui`, clubs code, `user_books` columns.

## 7. Tests

- **Unit 1 (Postgres, `node --test`):** every row of the §4.2 table, including the clubs RPC path; no automatic reopen or delete by any status change; `library_reopen_read`; `completed_at` used only when the statement changed it; non-positive `page_count` copied as null; deleting an open read refused; `library_start_reread`; back-fill counts; RLS — another user can't read, insert, update or delete any of the four tables; column grants (no client update of `outcome`/`read_number`); cascade on book removal; one open read per book; CHECKs. Migration readback and `get_advisors` (security) after application. The library Postgres baseline (`supabase/tests/library/manualNoteBaseline.sql`, README `:13`) is extended with minimal `book_clubs` / `club_members` tables and the clubs RPC so its path is tested.
- **Pure functions (Jest):** calendar-day conversion across time zones and 31 Dec 23:30; picked dates win over instants; zero-page and %→page conversion; pace and estimate thresholds; stats (finish rate, average days, excluded reads, unknown pages); CSV columns; note-to-read assignment.
- **Components (Jest):** slot texts; edit sheet validation (no future, start ≤ end); finish choice shown once; outline label; progress sheet buttons and % mode; note prompt only when beyond progress; Home card states; finish panel once per read; remembered dismissals survive a remount and an app restart; goal text; stats text summary.
- Mutation checks on the key rules, as in SDD-08. Web check and Android emulator check per unit (Haiku, read-only).

## 8. Done criteria

- Every H-item in its unit works on web and Android as specified, except the year card on web (hidden).
- Status changes from Book Details and the clubs RPC produce the §4.2 history; adds from search, manual add and wishlist (which insert as Want to read) record nothing, as specified; a clubs upsert repeating the same status records nothing.
- No clubs, marketplace, shared-component or `user_books` schema change.
- `lint:library` scope gains `src/features/books/history` and `src/components/library/history`.
- Full Jest, `tsc` 0, `lint:library` 0 errors, the library Postgres tests and axe pass; migration recorded with filename, live version, effects and readback.
- DP-04 and DP-06 checks recorded; not-verified items (iOS, TalkBack, devices) listed honestly.

## 9. Units and gates

| Unit | Contents | Gates |
|---|---|---|
| 1 Recording | Migration (4 tables, trigger, `library_start_reread`, RLS, grants, back-fill), DB tests, read gateway. No UI. | SDD approval → migration **file** approval → migration **application** approval → commit OK |
| 2 Dates and rereads | H-04 to H-08 | Commit OK |
| 3 Progress | H-09 to H-12 | Commit OK |
| 4 Story of a read | H-13 to H-15 | Commit OK |
| 5 Goal and year | H-16 to H-18 | Commit OK |

Each unit: Codex Sol builds in this worktree from a `.spec/` brief; an opencode reviewer reads it (read-only); the lead verifies; merge or push to `main` needs its own OK. External models never touch Supabase or migrations; the lead writes and applies the migration.

## 10. Risks

| Risk | Mitigation |
|---|---|
| Trigger on a shared table slows or breaks other writers (clubs RPC) | Small row-level trigger; Postgres tests run the clubs RPC path; clubs heads-up before applying. |
| Wrong taps leave a junk read | Fixed by hand in Edit dates ("Not finished yet", "Remove this read"); simpler and safer than automatic undo (D09-05). |
| Bulk "Finished" for old books inflates this year | D09-06 inline choice; dates editable; "Leave out of my stats". |
| `completed_at` and reads disagree | Reads are the only SDD-09 source; CSV switches to reads (D09-12). |
| Two progress systems (library pages, clubs chapters) | Kept separate; recorded as an open question for a later clubs link. |
| Native testing gap grows (iOS, TalkBack, devices) | Real-device pass recommended before Unit 3. |

## 10a. Open questions (not blocking Unit 1)

- Whether a later SDD should link library progress with clubs' chapter progress.
- Placement of the stats entry beyond the Home goal text and Book Details.

## 11. Out of scope

- **Own future SDD:** reading rhythm — opt-in, off by default, honest one-line note when turned on, forgiving (weekly target default, rest days, "paused" not "lost"), reminders that back off; needs a DP-04 amendment then.
- **Moved to SDD-10:** "On this day".
- **Removed for complexity (owner, 2026-10-22):** long-press quick action, shelf bookmark ribbon, draggable scrubber, audiobook minutes, partial dates, rating per read, mood chips, undo bar, offline saving, year-card cover strip, format per read.
- **Later:** home-screen widget, reading-session timer, clubs progress link, Goodreads import (the read records can accept imports).

## 12. Review record

**2026-10-22 — MiniMax 3.1 (opencode, `max`, read-only; worktree fingerprint unchanged):** APPROVE WITH FIXES, 11 findings. The lead checked each against the code and live database:
- **Applied:** UNIQUE `(id, user_id)` on reads (HIGH); "Read again" inserts first, then sets the status, and refuses with an open read (HIGH); → Finished never adds a second read after a status restore, a stopped read becomes finished, `coalesce(completed_at, now())` (MED); `REVOKE ALL` then column grants, `anon` excluded (MED); "Leave out of my stats" defined for every number (MED); continue-reading card in both Home views, since the default is the list (MED, verified `index.tsx:56`); clubs RPC in the Postgres baseline (MED); `lint:library` scope, `captureCardPng` name, pace guards, null `user_id` skip, `search_path = ''` (LOW).
- **Applied as a documented limit, not a redesign:** local noon can show a day off after a 12 h+ time-zone move (MED); separate date columns can't be filled by the trigger.
- **Rejected:** "reopen within 24 h erases a finished or stopped read" (HIGH) — that is the intended mis-tap repair; rereads go through "Read again". "No live DELETE policy on `user_books`" (MED) — the live policy exists (MCP, 2026-10-22); recorded as repo drift in §3.

**2026-10-22 — Deep review.** Gemini Argon (owner's first choice) failed to start ("Upstream request failed: Endpoint is unavailable"); DeepSeek v4.1 flash (opencode, `max`, read-only, fingerprint unchanged) ran instead: APPROVE WITH FIXES, 13 findings. The lead checked each against this doc and the code (`libraryShelf.ts:40` excludes wishlist rows from the Reading filter; the add flows default to `want_to_read`, `booksService.ts:647,696`, `useWishlist.ts:71`):
- **Applied (12):** a "Reading stats" link when no goal is set, so stats and the goal are reachable (HIGH); day-granularity picked dates (start 00:01, end 23:59 clamped to now), day-based validation and local web dates — local noon broke start ≤ end on the same day (HIGH); Finished → Want to read within 24 h repairs the mis-tap (HIGH); "open read" defined as `outcome = 'reading'` (HIGH); next-read choice cleared when that book starts or finishes, plus D09-17 for wishlist ownership (MED); explicit no-op for Stop with no open read (MED); clamped automatic end times (MED); distinct-book counting for goal/"Nth book"/year, reads for pages and rates (MED); `auth.users` cascade on goals and settings (MED); `max + 1` read numbers (LOW); "Not now" on the note prompt (LOW); §8 wording on add flows (LOW).
- **Applied in part (1):** reopening a finished read — every "Start reading" on a finished book now uses `library_start_reread`, so only a direct Book Details status change within 24 h reopens (kept as mis-tap repair).

**2026-10-22 — GPT 6.1 Sol (Codex `xhigh`, read-only, fingerprint unchanged; owner's request):** REWORK, 13 findings, all checked by the lead (code claims verified: `[bookId].tsx:313` ignores re-selecting the current status; `booksService.ts:393` copies Google's `pageCount` unvalidated). All 13 applied; they supersede parts of the two reviews above:
- **Mis-tap window** is now 10 minutes on a database-set `outcome_changed_at`, not 24 h on editable dates, so a genuine finish (including from clubs) is never reopened later and edited dates can't change eligibility (HIGH + MED; D09-05 changed).
- **`library_start_reread` locks the `user_books` row first**, with a concurrency test (HIGH).
- **Page counts ≤ 0 copied as null** (HIGH).
- **End time chosen per event**, `completed_at` used only when the statement changed it, intentional nulls kept (MED).
- **Picked dates are separate `date` columns** that win over instants — replaces local noon and the 00:01/23:59 rule (MED; D09-07 changed).
- **Open reads can't be deleted** (RLS), so a book never stays "Reading" without a read; "Not finished yet" added (MED).
- NOT NULL identity/state columns and `outcome = 'reading'` ⇒ no end (MED); zero pages allowed and %↔page conversion defined (MED); monthly bars count finished reads, duration in calendar days, unknown-date and did-not-finish inclusion defined (MED); remembered dismissals in AsyncStorage per user and read (MED); "Leave out of my stats" only once a book has a read (MED); `PUBLIC` revoked and function execute grants explicit (LOW).

**2026-10-22 — Sonnet consistency pass (read-only, owner's request):** APPROVE WITH FIXES, 13 findings, all applied after the lead checked them against the text: `start_unknown` / `end_unknown` flags so "I don't remember" works on automatic dates (HIGH); the discard rule tests `created_at`, progress and picked start, so a reopened older read is never deleted (MED); "no start" = both start fields null (MED); automatic end changes clear a stale picked end, and cross-kind date order is validated in the edit sheet (MED, documented limit); the latest finished read of a Finished book can't be removed, so status and reads stay in sync (MED); next-read cleared on every change to Reading/Finished, independent of branch (MED); D09-06 wording; the "finish without a start" prompt reworded; "Not finished yet" returns to Reading; End disabled for open reads; header lists every database object; back-filled reads outside the mis-tap window; progress only into an open read (LOW).

**2026-10-22 — Owner approval and simplification.** After four reviews kept finding edge cases, mostly in the automatic undo, the lead proposed dropping it; the owner accepted every recommendation with that change. Removed: the 10-minute reopen, discard and finish-repair rules and the `outcome_changed_at` column. Added: `library_reopen_read` for "Not finished yet". Remaining risk is checked by Unit 1's Postgres tests, one per §4.2 rule, rather than more document reviews.

**2026-10-22 — Unit 1 migration file drafted and checked locally (not applied).** File `supabase/migrations/20261022160000_library_reading_history.sql`, created on the owner's request. Checked with `supabase/tests/library/readingHistory.postgres.test.mjs` on a disposable local PostgreSQL 17.6 (baseline `readingHistoryBaseline.sql`, projected from the live catalog including the clubs status RPC): **22/22 pass** — every §4.2 rule, both RPCs, the clubs path, RLS, column grants, cascades, back-fill, and a two-connection "Read again" vs status-change race (serialized, no deadlock, never two open reads). The first run found three faults, all fixed: (1) the delete policy queried its own table and recursed, so the "latest read of a Finished book" check moved into a small definer helper `library_read_is_kept` that answers only for the caller's books; (2) the back-fill gave a Finished book with no finish date an end of "now" (`LEAST` ignores NULL), now kept unknown; (3) a test-ordering fault in the harness. No Supabase project was touched.

**2026-10-22 — Migration reviews and application.** GLM APPROVE; MiniMax APPROVE WITH FIXES (14; confirmed ones fixed, two kept as documented limits in the file header); DeepSeek ended without a report. Local tests 30/30. Applied to `ahntbtktjjmvfosgkmgn` by the owner in the SQL editor (session MCP is read-only); readback and security advisor clean apart from the expected definer-function notes. Recorded in the TRACKER ledger.

**2026-10-22 — Units 2–5 built (not committed; browser check pending).** Each unit: Muse Spark 1.3 `xhigh` built from a `.spec/` brief; MiniMax 3.1 and GLM 5.3 flash reviewed read-only (fingerprint checked); one or two Muse fix rounds; the lead re-ran Jest/tsc/lint and planted mutations. Notable lead decisions and finds: pace definition (§4.5); local-day helpers take an explicit IANA zone because `process.env.TZ` has no effect on the Windows build machine; the note prompt appears only right after a save (`justSaved` route param); **writes to `user_reading_settings` and `user_reading_goals` never use `upsert`** — PostgREST's `ON CONFLICT DO UPDATE SET` lists every payload column and would need UPDATE on `user_id`/`year`, which the grants refuse (proven by a new Postgres test, 31/31); writes are update → insert → retry on 23505. Totals after Unit 5: scoped Jest 108 suites / 1894 tests, tsc 0, `lint:library` 0 errors. Not yet verified: web and Android checks (Haiku), iOS, screen readers on devices.

**2026-10-22 — Web browser check (Haiku) passed for Units 2–5.** One product fault found and fixed: same-day note assignment now uses instants for automatic starts, so a thought written right after finishing stays with that read. Android/iOS device checks remain open.
