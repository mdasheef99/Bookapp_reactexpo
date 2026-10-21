# SDD-08 — Library export and share

**Status:** APPROVED 2026-10-21. The owner accepted every recommendation for D08-01 to D08-11 (§5) and authorized implementation in the D08-09 unit order. The owner's words, answering "answer them, or take all my recommendations … start from `main`": "yes". The D08-04 installs are therefore approved, to be done in Unit 3. Each commit still needs the owner's OK, and a merge or push to `main` needs its own explicit OK. Reviewed: Sonnet, §11. Built on branch `sdd08/export` in worktree `Bookconnect4_sdd08`, which starts from `main` `4a1daea`.
**Parent:** [Library roadmap](./LIBRARY-ROADMAP.md) §1 (SDD-08 track) and [SDD-07](./SDD-07-book-section-ui-overhaul.md) §7 (reserved slots).
**Owner scope decision (2026-10-21):** CSV is for **books only** (the library list). Notes are exported as **Markdown** (and in the PDF), not as CSV. This narrows the roadmap line "CSV export of the library … and of notes".
**Supabase project:** `ahntbtktjjmvfosgkmgn`. This SDD needs **no migration** and no new table, function or policy. All exports read rows the signed-in user can already read.

## 1. Goal

A reader can take their own library and notes out of BookConnect in plain, portable formats, and share a single Quote as an image, without the app nagging or tracking it.

| Export | Format | Contents | Scope |
|---|---|---|---|
| Library list | CSV | One row per book in the user's library | Whole library |
| Notes | Markdown | Notes with category, page, date, under their book | One book, or all books (D08-02) |
| Notes and book record | PDF | Same content as the Markdown, laid out for reading/printing | One book, or all books (D08-02) |
| Passage card | PNG image | One Quote note + book title/author (+ page) | One note |

## 2. Why

- **Ownership of data.** Readers who track books want a copy outside the app (backup, leaving, archiving).
- **CSV for books** opens directly in Excel/Google Sheets and is the format Goodreads and StoryGraph use. Book data (title, author, status, dates, rating) is tabular, so CSV fits.
- **Markdown for notes**, not CSV: notes are long text with line breaks and quotes; Markdown keeps them readable in any editor or notes app (Obsidian, Notion, plain text).
- **PDF** is the readable, printable form of the same notes.
- **Passage card** is the one share-outward feature: a calm, standard image of a Quote, no templates or branding pull (premium templates are removed in the roadmap §3).

## 3. Current state (read-only evidence, `main` `4a1daea`)

**Library data.** `booksService.getUserLibrary(userId, options)` selects `user_books.*, book:books(*)` for the user, newest first (`src/features/books/services/booksService.ts:735-751`); hook `useLibraryBooks` (`src/features/books/hooks/useLibraryBooks.ts:20-26`).
- `user_books` (`supabase/migrations/20251228083154_001_initial_schema.sql:85-101`): `reading_status` (`want_to_read|reading|completed`), `ownership` (`owned|wishlist|borrowed|lent_out`), `condition`, `rating` 1–5, `review`, `review_is_public`, `available_for_lending`, `completed_at`, `created_at`, `updated_at`.
- `books` (same file :68-83): `title`, `authors text[]`, `isbn_10`, `isbn_13`, `publisher`, `published_date`, `page_count`, `categories`, `google_books_id`, `cover_url`. Manually added books may have only title and authors.
- Display labels: `src/features/books/utils/libraryLabels.ts:7-20` — Want to read / Reading / Finished; Owned / Lent out / Borrowed / Wishlist.
- The trimmed client shape `LibraryBookEntry` (`src/features/books/utils/libraryShelf.ts:3-17`) drops `created_at`, `completed_at`, ISBN and publisher, so export must map from the raw row, not from `LibraryBookEntry`.

**Notes.** Table `reading_notes`; client type `ManualNote` (`src/features/books/notes/manualNoteContract.ts:12-24`): `content`, `tag` (nullable), `page_number` (nullable), `created_at`, `updated_at`, `user_book_id`.
- Categories (`manualNoteContract.ts:3-9`): `quote`=Quote, `reflect`=Thought, `distill`=Takeaway, `apply`=Action, `question`=Question; `NULL` = no category. `question` is allowed by the live schema since `20261010221843_library_manual_note_persistence.sql:108`.
- Notes are listed **per book only** (`manualNotesGateway.list`, `src/features/books/notes/manualNotesGateway.ts:49-55`). **No all-notes query exists.**
- Each note is at most 500 words (`NOTE_WORD_LIMIT`, `src/features/books/utils/ocrWordCap.ts:1`).

**Saved Pages** (`user_book_pages`): read and delete only in the UI; their future is an open roadmap decision (keep, fold into notes or retire). **Excluded from SDD-08** (D08-06).

**Platform capability.**
- Targets: web, Android and iOS (`app.json`, `eas.json`). Web is actively used.
- Installed: `expo` ~54.0.36, `expo-file-system` ~19.0.23 (legacy API already used in `captureAdapter.ts`), React Native core `Share` (used in `useSearchBookActions.ts:64-67`), clipboard copy in `app/(tabs)/library/note.tsx:32-39`.
- **Not installed:** `expo-sharing`, `expo-print`, `react-native-view-shot`, `expo-media-library`.
- No CSV/Markdown/PDF code and no web download helper exist today.
- No i18n library; UI copy is English. Note text may contain any script (typed Hindi/Kannada/Malayalam is possible).

**Reserved slots** (SDD-07 §7, provisional): "Export / share entry (CSV, Markdown, PDF) — Book Details overflow/menu; Notes list header" and "Passage card from a Quote note — Note reader secondary action (Quote notes only)". There is **no** reserved slot for a whole-library export, and Book Details has **no** overflow menu today (`BookScreenHeader` is Back-only, `src/components/library/ui/BookScreenHeader.tsx:18-30`).

## 4. Design

### 4.1 Layers

1. **Pure builders (no UI, no I/O)** in `src/features/books/export/`:
   - `buildLibraryCsv(rows, options) → string`
   - `buildNotesMarkdown(books, notesByBook, options) → string`
   - `buildNotesPrintHtml(books, notesByBook, options) → string` (input to PDF)
   - `buildFileName(kind, scope, date) → string`
   Fully unit-tested; deterministic given a fixed date. This is the part the roadmap allows to run before any UI.
2. **Data loaders** (read-only):
   - **Library CSV:** a dedicated loader reads `user_books` with `book:books(*)` in `.range()` pages of 500, ordered `created_at desc, id`, until a short page returns. `getUserLibrary` has no range or limit (`booksService.ts:735-751`), and PostgREST caps a response at its max-rows setting (platform default 1000; the live value is not verified), so neither it nor the `useLibraryBooks` cache payload is reused.
   - **Notes, one book:** per-book `manualNotesGateway.list`.
   - **Notes, all books:** a new read (D08-03).
   - Pending or unsynced notes (the pending-submission memory) are **never** exported. Only confirmed saved rows are.
3. **Delivery layer** (`src/features/books/export/deliver.ts`), one API for every platform:
   - `deliverTextFile({ fileName, mimeType, text })`
   - `deliverPdf({ fileName, html })`
   - `deliverImage({ fileName, uri })`
   Web: `Blob` + object URL + temporary `<a download>`; PDF via the browser print dialog (D08-05). Native: write to the cache directory with `expo-file-system`, then open the system share sheet (D08-04).
4. **Entry points** in the library screens (§4.6).

### 4.2 Library CSV

- **Encoding:** UTF-8 **with BOM** (so Excel shows non-Latin titles correctly), CRLF line endings, RFC 4180 quoting (every field quoted when it contains `,` `"` CR or LF; `"` doubled).
- **Formula-injection guard:** any **text** field (title, authors, publisher, condition, review) that begins with `=`, `+`, `-`, `@`, TAB or CR is prefixed with `'` (OWASP CSV injection). It is never applied to Pages, Rating, ISBN or date columns, which are generated digits only. The prefix is a deliberate data change that a re-import does not undo. A leading space before `=` is not covered (low risk, accepted).
- **ISBNs** are written as digits only, without hyphens. Excel may reformat them (drop the ISBN-10 leading zero, or show ISBN-13 as `9.78E+12`). **D08-10** chooses whether to accept that or wrap them as `="…"`.
- **Labels** reuse `readingStatusLabel` / `ownershipLabel` / condition labels from `src/features/books/utils/libraryLabels.ts`, including their fallback for a `NULL` or unknown value. Labels are never duplicated.
- **Columns (in order):** Title; Authors (joined with `; `); ISBN-13; ISBN-10; Publisher; Published date; Pages; Status (display label); Ownership (display label); Condition; Rating (1–5 or empty); Review (D08-01); Review visibility (Public/Private, empty when no review); Date added (`created_at`, `YYYY-MM-DD`); Date finished (`completed_at`, `YYYY-MM-DD` or empty).
- Wishlist books **are included** with Ownership "Wishlist" (the user can filter them out in the spreadsheet).
- Not exported: internal ids, `google_books_id`, cover URLs, `available_for_lending` (lending is removed, D07-08).
- **Dates:** every builder takes an injected `timeZone` option (default: the device zone) and formats the stored `timestamptz` in that zone. CSV uses `YYYY-MM-DD`; Markdown/PDF use `D Mon YYYY` (English month names, matching the app's English UI). A `NULL` or invalid timestamp gives an empty field (CSV) or omits the date (Markdown).
- **Data edge cases:** a row whose `book` join is null is skipped and counted in the build result for tests. Empty or `NULL` `authors` gives an empty Authors field, and the Markdown/card author line is omitted. A `NULL` rating is empty. `published_date` is text and is copied as stored.
- Empty library: no file; the entry point says "Your library is empty." in place.
- File name: `bookconnect-library-YYYY-MM-DD.csv`.

### 4.3 Notes Markdown

```
# Notes — {Book title}
{Authors}

## Quote · p. 42 · 3 Oct 2026
> {note text, each line prefixed with "> "}

## Thought · 4 Oct 2026
{note text}
```

- One `#` section per book; all-books export orders books by title, then each book's notes oldest first (reading order). Per-book export uses the same order.
- Heading per note: category label (or "Note" when `tag` is `NULL`), `p. N` when a page exists, and the created date. "Edited {date}" is appended when `updated_at` is later than `created_at`.
- Quote notes render as a block quote. Every line is prefixed `> `, and blank lines inside the quote become `>`, so the quote does not end early. Other categories render as plain paragraphs.
- Note text is normalised CRLF/CR → LF, then written verbatim, with one exception: a line starting with a Markdown control sequence (`#`, `>`, `-`, `*`, `+`, `1.`, `` ``` ``) is escaped with `\`, so a note cannot break the structure. Inline Markdown inside note text (`*`, `_`, `[`) is left as typed, by design.
- Book titles and author lines in headings escape `\ * _ # [ ] \``.
- "Edited {date}" is appended only when both timestamps are valid and `updated_at` is later than `created_at`.
- UTF-8 without BOM, LF line endings. File name: `bookconnect-notes-{book-slug}-YYYY-MM-DD.md` or `bookconnect-notes-all-YYYY-MM-DD.md`.
- A book with no notes is omitted from all-books export; per-book export with zero notes shows "No notes to export yet." and makes no file.

### 4.4 PDF

- Same content and order as the Markdown, rendered from `buildNotesPrintHtml` with the library type scale (serif body for note text, readable 12pt minimum). Black on white, with page breaks avoided inside a note. No cover images (avoids remote fetches and licence questions).
- **Web:** write the HTML into a hidden same-origin `iframe` and call its `print()` from the user's click, without `window.open` (popup blockers fire after an `await`). The user chooses "Save as PDF" in the browser dialog. Page numbers are **not** required on web, because browser support for `@page` margin boxes is uneven. A dismissed print dialog is not an error.
- **Native:** `expo-print` `printToFileAsync`, then the share sheet (needs install, D08-04). Page numbers are optional. Non-Latin note text renders only if the system web view has the fonts, so native verification includes one Hindi and one Kannada note.
- HTML is built from escaped text only (no user HTML is interpreted).

### 4.5 Passage card

- Only for **Quote** notes (`tag = 'quote'`), from the note reader.
- Content: the quote text, book title, first author, and `p. N` when present. No app logo beyond a small "BookConnect" footer wordmark (D08-07), no user name.
- One standard template in the library daylight palette, fixed 1080×1350 (4:5). Long quotes shrink to a floor of the body size and are otherwise truncated with "…" — and the card shows a "Shortened" note in the preview so the user knows before sharing.
- Rendered as a React view and captured to PNG. On native this uses `react-native-view-shot` (install, D08-04). On web, the approach is **D08-11**. The library fonts (EB Garamond) must be loaded before capture, or the card renders in a fallback font. The preview waits for the fonts.
- Preview screen with **Share image** (primary) and **Cancel**. No auto-posting, no counts.

### 4.6 Entry points (provisional slots, SDD-07 §7)

| Entry | Where | Action |
|---|---|---|
| Export notes (this book) | Notes list header, a text button "Export" | Opens a small choice: Markdown file / PDF |
| Export all notes | Same choice, option "All books" (D08-02) | Markdown / PDF for every book with notes |
| Export library (CSV) | **D08-08**. Recommended: the Library home header (`src/components/library/LibraryHeader.tsx`, whose action row holds the "Add a book" primary at :61), as a quiet secondary text button "Export library". SDD-07 reserved no slot here, so this needs a Flow D layout check at 320/390 px and 200% text. Alternative: Profile → "Your data" | Downloads/shares the CSV |
| Passage card | Note reader, secondary text action "Share as image", Quote notes only | Opens the preview |

**Export choice dialog** (notes): a "Format" radio group (Markdown file / PDF), a "Scope" radio group (This book / All books, per D08-02), the line "Includes private notes. Notes still saving are not included.", one primary "Export" and a secondary "Cancel" (one primary per state). Escape or Back dismisses it.

Book Details gets **no** new overflow menu in SDD-08 (keeps DP-01: controls only down to the primary). Its reserved slot is left unused.

### 4.7 States and rules

- Every export is **read-only** and always reads fresh rows (the loaders above). Offline, the export actions are disabled with "Export needs a connection." (new copy, in the style of Flow A's "Changes need a connection."). The passage card is the exception: it uses the note already on screen, so it works offline.
- While building: the button shows busy (`aria-busy`). Only one export runs at a time.
- **Feedback per state.** There are no success toasts (D07-16). Each message is an inline, politely announced caption, following the precedent of "Copy text" in `app/(tabs)/library/note.tsx`:
  - web file saved: "Saved to your downloads.";
  - native share completed: no caption, because the system sheet is the feedback;
  - share or print dismissed: no message, not an error;
  - failed: "Couldn't export. Try again." with a Try again action. Raw errors are never shown.
- Privacy: exports contain private reviews and private notes, and leave the app only through an action the user starts. Nothing is uploaded or stored server-side. There are no analytics events. Native temporary files in the cache directory are deleted after the share or print promise settles.
- Accessibility: 48dp targets, accessible names ("Export notes for {title}", "Share quote as image"), live-region feedback, keyboard operable on web.

## 5. Decisions (recommendation first; all recommendations ACCEPTED by the owner, 2026-10-21)

| Id | Question | Recommendation | Alternative |
|---|---|---|---|
| D08-01 | Include review text in the library CSV? | **Yes**, with a Review visibility column (it's the user's own data). | Rating only. |
| D08-02 | Notes export scope | **Both:** "This book" from the notes list, plus "All books" in the same choice. | Per book only (simpler; all-books comes with SDD-10's all-notes view). |
| D08-03 | How to read all notes for "All books" | **One read-only query** in a new `manualNotesGateway.listAllForUser`. It selects `reading_notes` with embed `user_books(book:books(title,authors))`, filtered `.eq('user_id', actorId)` and re-filtered on the client like the per-book `list`. Pages of 500, ordered `created_at, id`. Local migrations show `user_id NOT NULL`, SELECT RLS `auth.uid() = user_id` and a user index (`20260212150120_create_reading_notes.sql:10,23-25`), so no migration is needed. This must be re-verified live before the build. | Loop `manualNotesGateway.list` per book (many requests). |
| D08-04 | New native dependencies | **Install `expo-sharing`, `expo-print`, `react-native-view-shot`** (Expo SDK 54 versions via `npx expo install`). Needs a dev-build/EAS rebuild for native. | No install, which means **no file export on native at all**. RN core `Share` sends text/URL only, and file sharing without `expo-sharing` needs yet another module. Exports would be web-only until approved. |
| D08-05 | PDF on web | **Browser print dialog** (no dependency). | A JS PDF library (larger bundle). |
| D08-06 | Saved Pages in exports | **Excluded** until the roadmap decides their future. | Include as an appendix in notes export. |
| D08-07 | Branding on passage card | **Small "BookConnect" footer wordmark** only. | No branding at all. |
| D08-08 | Where the library CSV entry goes | **Library home header**, quiet text button. | Profile → "Your data". |
| D08-10 | ISBNs in Excel | **Accept the limitation**: plain digits, documented. Google Sheets and re-import keep them. | Wrap as `="…"` (Excel-safe, but other tools see a formula). |
| D08-11 | Passage card on web | **Hide "Share as image" on web for the first release**. Ship native first, and add web later after a capture spike (e.g. `html-to-image`, a new dependency). | Build web now with a canvas re-implementation of the card. |
| D08-09 | Build order | **(1) builders + tests, (2) web delivery + notes/CSV entries, (3) native delivery after D08-04, (4) passage card.** Each a separate unit with its own review. | One unit. |

## 6. Files (expected; confirmed per unit)

| File | Change |
|---|---|
| `src/features/books/export/libraryCsv.ts` (+ test) | CSV builder |
| `src/features/books/export/notesMarkdown.ts` (+ test) | Markdown builder |
| `src/features/books/export/notesPrintHtml.ts` (+ test) | PDF HTML builder |
| `src/features/books/export/fileName.ts` (+ test) | Slugs, dates |
| `src/features/books/export/deliver.ts` / `deliver.web.ts` (+ tests) | Delivery layer |
| `src/features/books/export/useExport*.ts` (+ tests) | Hooks: loading, offline, busy, errors |
| `src/features/books/notes/manualNotesGateway.ts` | Add `listAllForUser` (only if D08-03 accepted) |
| `app/(tabs)/library/notes.tsx`, `note.tsx`, `index.tsx` (or Profile per D08-08) | Entry points |
| `src/components/library/export/PassageCard*.tsx` (+ test) | Card view and preview |
| `src/components/library/LibraryHeader.tsx` | Library CSV entry (only if D08-08 = home) |
| `package.json` | Only if D08-04 accepted |
| `scripts/` lint config (`STRICT_FILES`) | New `.tsx` files join the strict list; the library lint ratchet must not rise |

No shared components (`src/components/search`, `src/components/ui`) change (library-main rule).

## 7. Tests

| Test | Asserts |
|---|---|
| CSV builder | Header order; BOM; CRLF; quoting of `,` `"` newlines; formula-injection prefix for `= + - @` TAB CR on text columns only (never on Pages/Rating/ISBN/dates); authors joined; labels from `libraryLabels`, including the `NULL` fallback; empty optional fields; null `book` join skipped; non-Latin title round-trips (UTF-8). |
| CSV loader | A mocked 1,200-row library exports 1,200 data rows across `.range()` pages, with a stable order and no duplicates. |
| Markdown builder | Book order and note order; category label and "Note" for `NULL`; page and dates; "Edited" rule with null/invalid timestamps; Quote as block quote including multi-line and blank lines; CRLF normalised; escaping of leading `#`, `>`, `-`, `*`, `+`, `1.`, fences; title/author escaping; empty authors line omitted; empty book omitted. |
| Dates | `timeZone` injected: `UTC` and `Asia/Kolkata` (+05:30) cases around midnight. |
| All-notes loader | `user_id` filter plus client re-filter; pagination order stable; pending notes excluded. |
| Print HTML | Text is HTML-escaped (`<script>` in a note stays text); same order as Markdown. |
| File names | Slug of non-Latin and punctuation titles; date format; length cap. |
| Delivery (web) | Blob type and file name; object URL revoked. Delivery (native, mocked) writes then shares; cancel is not an error. |
| Hooks/entries | Offline disabled state and copy; busy; error with Try again; no toast; accessible names; passage action only on Quote notes. |
| Mutation checks | Each builder rule has a mutant that a test kills (lead verifies). |

## 8. Done criteria

| Criterion | Rule |
|---|---|
| Using a fixture library (non-Latin titles, commas, quotes, newlines, a title starting with `=`, a manual book without authors), the CSV opens in Google Sheets and Excel with correct columns and text. Evidence: screenshots of both | §4.2 |
| Notes Markdown and PDF match §4.3/§4.4 for one and all books. Evidence: the files themselves, plus a screenshot of the PDF | §4.3, §4.4 |
| Passage card only for Quote notes, previewed before share; hidden on web if D08-11 is accepted | §4.5 |
| Works on web. Native paths are verified on an Android dev build (evidence: a share-sheet screenshot and the opened file, including a Hindi/Kannada note in the PDF). iOS is recorded as not run unless available | Platforms |
| No server write, no migration, no analytics | §4.7 |
| WCAG: 48dp targets, names, live feedback, keyboard on web | DP-06 |
| Tests in §7 pass; lint ratchet not worse; tracker and roadmap updated | Session-close contract |

## 9. Risks

| Id | Risk | Mitigation |
|---|---|---|
| R1 | Native file share needs new native modules → a dev build/EAS rebuild; Expo Go may not cover all. | D08-04; verify on a dev build; web works without them. |
| R2 | CSV formula injection when opened in a spreadsheet. | §4.2 prefix rule + test. |
| R3 | Large libraries/notes: memory and time. | Paginated reads; build strings once; one export at a time. 500-word notes bound note size. |
| R4 | Excel mangles UTF-8 without BOM. | BOM on CSV only. |
| R5 | Passage card web rendering differs from native. | Spike before build; same layout values; visual check both. |
| R6 | Private reviews/notes leave the app. | Only by explicit user action; stated in the export choice copy ("Includes private notes."). |
| R7 | Roadmap said CSV also for notes. | Owner narrowed on 2026-10-21; roadmap line updated with this SDD. |
| R8 | PostgREST max-rows silently truncates a large export. | Paged loaders with a stable order (§4.1) + 1,200-row test. |
| R9 | Custom fonts missing at capture time / in the native print web view. | Wait for font load before capture; native Indic check (§4.4). |

## 11. Review record

**2026-10-21, Sonnet subagent, read-only. Verdict: APPROVE WITH FIXES (17 findings).** Applied: 1 (paged CSV loader), 2 (all-notes query shape, order and client re-filter), 3 (formula prefix on text only; ISBN → D08-10), 4 (per-state feedback; wrong D07-16 wording claim removed), 5 (web card → D08-11; font load), 6 (meaning of the D08-04 alternative), 7 (Markdown escaping, blank lines, CRLF), 8 (null/empty data cases), 9 (injected time zone), 10 (web print via iframe; no web page numbers; native Indic check), 12 (export dialog with one primary), 13 (label reuse; strict-lint files), 15 (evidence for the done criteria), 16 (pending notes excluded), 17 (temp files deleted). Partly rejected: 11. "Add a book" does exist (`LibraryHeader.tsx:61`), but the point that no slot is reserved there stands and is recorded under D08-08. Not changed: 14 (a line-range nit: 20-26 vs 20-27).

## 10. Out of scope

- Importing anything (Goodreads/StoryGraph import is deferred).
- Notes CSV (owner decision 2026-10-21).
- Saved Pages export (D08-06).
- Premium/multiple passage-card templates (removed in roadmap).
- All-notes view and note search (SDD-10).
- Reading history/stats in exports (SDD-09; columns can be added later).
- Any server-side export, email or scheduled backup.

## 12. Build record

### 12.1 Unit 1: pure builders (2026-10-21)

**Status:** BUILT, REVIEWED, FIXED and VERIFIED. **Uncommitted** on `sdd08/export` (`Bookconnect4_sdd08`).
**Files:** new `src/features/books/export/`, containing `types.ts`, `dates.ts`, `libraryCsv.ts`, `notesMarkdown.ts`, `notesPrintHtml.ts`, `fileName.ts`, `index.ts` and 5 test files. Also `eslint.config.js` and the `package.json` `lint:library` script, which add the export folder to the book-section lint (§6). No loaders, delivery, UI or dependencies; those come in Units 2–4.
**Built by:** Codex `gpt-6.1-sol` xhigh from `.spec/BRIEF-U1.md`. Its sandbox blocked Jest (`spawn EPERM`), so the lead ran all tests.
**Review:** Codex `gpt-6-luna` max, read-only. Round 1 returned FAIL with 6 findings, all confirmed by the lead and fixed in one Sol round (`.spec/BRIEF-U1-FIX1.md`):
1. the guard now covers the rendered Status/Ownership/Condition labels (an unknown raw value could start with `=`);
2. the slug keeps non-Latin combining marks (Devanagari vowel signs, nukta) and strips accents only after ASCII letters, with a cap that keeps mark groups whole;
3. a device-zone default test;
4. New York DST cases;
5. exact Markdown asserts;
6. a shared `bookHeading` helper.

The confirmation review returned PASS with no new findings, and file hashes were unchanged by the review.
**Verification (lead):**
- export tests: 5 suites / 136 tests PASS;
- `src/features/books` plus the lint-rule/ratchet suites: 35 suites / 725 tests PASS;
- `tsc --noEmit` 0 errors;
- `lint:library` 0 errors, 118 warnings, with 0 warnings in the export folder.

**Mutation checks** (each restored, hash-verified), with the number of tests each made fail:
- `-` removed from the guard: 1;
- BOM dropped: 22;
- CRLF changed to LF: 34;
- Quote blank line not `>`: 1;
- Status label unguarded: 10;
- Ownership label unguarded: 10;
- slug drops marks: 6;
- Latin accents kept: 2.

**Not verified:** Hermes runtime behaviour of `Intl` `timeZone` and `\p{...}` regexes. These run under Jest (Node) only, and are checked on device in Unit 3.
**Database/storage mutations:** none.
**Next exact action:** the owner approves the Unit 1 commit. Then Unit 2 (web delivery, loaders, notes and CSV entry points) starts with a read-only live check of the D08-03 `reading_notes` RLS and columns.
