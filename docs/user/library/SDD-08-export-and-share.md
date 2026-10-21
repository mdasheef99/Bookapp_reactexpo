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

**Export choice dialog** (notes): a "Format" radio group (Markdown file / PDF), a "Scope" radio group (This book / All books, per D08-02), the line "Includes private notes. Notes still saving are not included.", one primary "Export" and a secondary "Cancel" (one primary per state). Escape or Back dismisses it. While an export is loading, Escape, Back and Cancel cancel the export and close the dialog (branch review, 2026-10-22).

Book Details gets **no** new overflow menu in SDD-08 (keeps DP-01: controls only down to the primary). Its reserved slot is left unused.

### 4.7 States and rules

- Every export is **read-only** and always reads fresh rows (the loaders above). Offline, the export actions are disabled with "Export needs a connection." (new copy, in the style of Flow A's "Changes need a connection."). The passage card is the exception: it uses the note already on screen, so it works offline.
- While building: the button shows busy (`aria-busy`). Only one export runs at a time.
- **Feedback per state.** There are no success toasts (D07-16). Each message is an inline, politely announced caption, following the precedent of "Copy text" in `app/(tabs)/library/note.tsx`:
  - web file saved: "Saved to your downloads.";
  - native share completed: no caption, because the system sheet is the feedback;
  - share or print dismissed: no message, not an error;
  - failed: "Couldn't export. Try again." with a Try again action. Raw errors are never shown.
- Privacy: exports contain private reviews and private notes, and leave the app only through an action the user starts. Nothing is uploaded or stored server-side. There are no analytics events. Native export files live only in the app-private cache. A successfully shared file is kept briefly, because Android apps may read it after the share sheet returns. The next export deletes export folders 10 minutes old or more (owner deviation D08-12, 2026-10-22). Failed or unavailable shares, and internal temp files, are deleted at once.
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
| D08-12 | Native temp-file retention (owner, 2026-10-22, after the branch review) | **Keep a successfully shared file; the next export deletes export folders 10 minutes old or more.** Reason: Android `shareAsync` resolves when a target is picked, and Gmail or Drive may read the file afterwards. Deviation from the original §4.7 "deleted after the share settles". | Delete at once (risk of empty attachments). |
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

### 12.2 Unit 2 pre-build live check (2026-10-21, read-only, Supabase MCP)

The project was verified as `https://ahntbtktjjmvfosgkmgn.supabase.co`. Only metadata was read: no row data or note contents.
- `reading_notes`:
  - RLS on;
  - the authenticated SELECT policy is `library_note_select_owned_book`, requiring `user_id = auth.uid()` AND the `user_book_id` to belong to the caller;
  - `authenticated` has SELECT; `anon` has none;
  - columns as in §3 plus `version` (NOT NULL) and `last_operation_id`;
  - `created_at` and `updated_at` are nullable.
- `user_books`: SELECT `auth.uid() = user_id`. `books`: publicly readable.
- **Deviation from D08-03's draft query shape:** `reading_notes` has two foreign keys to `user_books` (`reading_notes_user_book_id_fkey` and the composite `reading_notes_book_owner_fkey`), so the embed `user_books(book:books(...))` is ambiguous. Unit 2 instead pages `reading_notes` by `user_id` and joins titles and authors on the client from a paged `user_books` read. There is still no migration, and RLS is unchanged.
- The PostgREST max-rows value is not exposed to SQL, so the loaders always page (§4.1).

### 12.3 Unit 2: loaders, web delivery and entry points (2026-10-21)

**Status:** BUILT, REVIEWED, FIXED and VERIFIED. **Uncommitted** on `sdd08/export`.

**Files.** New:
- `src/features/books/export/`: `loaders.ts`, `deliver.ts` (native stub), `deliver.web.ts`, `useExportActions.ts`, and their tests;
- `src/components/library/export/`: `ExportNotesDialog.tsx`, `index.ts`, and a test.

Edited:
- `app/(tabs)/library/notes.tsx` (the "Export" entry);
- `app/(tabs)/library/index.tsx` and `src/components/library/LibraryHeader.tsx` (the "Export library" entry);
- `eslint-rules/book-section/config.js` and its config test (the dialog joins `STRICT_FILES`);
- added cases in the existing `index`, `LibraryHomeControls` and `FlowBBuild1` tests (additions only; one import line was extended).

Shared components are untouched.

**Design as built:**
- **Loaders:** every read is paged at 500 rows, with a stable order and a client re-filter. The all-notes export joins titles on the client (§12.2), and the per-book export pages `reading_notes` itself rather than reusing the unpaged gateway list.
- **Web Markdown/CSV:** downloaded through a `Blob` and an `<a download>`; the URL is revoked after 30 s.
- **Web PDF is two-step:** Export loads the data and prepares a hidden iframe. The dialog then shows "Your PDF is ready. Choose Print, then Save as PDF." with a single primary "Print", which calls `print()` synchronously from that press (§4.4). Busy covers only loading. The iframe is removed on `afterprint`, on a 60 s fallback after Print, and on Cancel, close or unmount.
- **Native:** the entries are hidden on native until Unit 3 (`exportDeliveryAvailable()` is false).

**Built by:** Codex `gpt-6.1-sol` xhigh, in three runs:
1. the initial build;
2. a fix for 7 new tests that failed under the lead's Jest run (a second hidden Modal from the feedback provider, native busy reported as `accessibilityState.busy`, and a missing provider in one test);
3. the review fixes. This run ended with a model-capacity error before writing its report, so the lead verified each fix in the code.

**Review:** Codex `gpt-6-luna` max, read-only (each review left the file hashes unchanged).
- **Round 1, PASS WITH FINDINGS.** Accepted and fixed: F1 (URL revoked too early), F2/F3 (print outside the click; busy held until `afterprint`), F4 (per-book export unpaged), F5 (dialog name not on the dialog role). Rejected: F6 (the docs edit is the lead's §12.2 record) and F7 (an import-only change to a test).
- **Confirmation round:** F1–F5 FIXED. One new LOW finding: Print was blocked by another screen's export. The lead fixed it by dropping that busy check, since a prepared PDF means this hook's load has finished.

**Verification (lead):**
- 77 suites / 1,490 tests PASS (`src/features/books`, `app/(tabs)/library`, `src/components/library`, `src/components/notes`, `eslint-rules`);
- `tsc --noEmit` 0;
- `lint:library` 0 errors, 118 warnings (unchanged).

**Mutation checks** (each restored, hash-verified), with the number of tests each made fail:
- one page only: 4;
- no client re-filter: 2;
- orphan notes kept: 1;
- no URL revoke: 4;
- offline allowed: 1;
- concurrent exports: 1;
- empty library exported: 2;
- revoke synchronous: 3;
- cancel keeps the iframe: 1;
- per-book not filtered by book: 3;
- no `afterprint` cleanup: 1;
- print deferred: 1;
- no ready state: 11.

**Web check** (Haiku, Expo web on port 8086, placeholder `.env` deleted afterwards, every Supabase request answered by fixtures; [evidence](./evidence/sdd08-u2-export-2026-10-21/README.md)):
- **CSV:** downloaded as `bookconnect-library-2026-10-21.csv`. Lead re-checked: it begins with the BOM `EF BB BF`, has CRLF and the header row, the formula title is written as `"'=Formula, ""Quoted"" Title"`, and the Devanagari title is intact. "Saved to your downloads." is shown.
- **Markdown:** downloaded; Quote lines are prefixed `> `.
- **PDF:** the ready state and Print appear; one stubbed `print()` call; the dialog closes; Cancel leaves no iframe.
- **Dialog:** role and name, keyboard order and Escape all pass.
- **Offline:** disabled with the caption, verified on `app.localhost`. `useNetworkStatus` deliberately exempts plain `localhost` previews, which is a harness note, not a defect.
- **Layout:** 320 px and zoom 2 at 390 px give no horizontal scroll on the library home or the notes list.
- **Network:** no writes to `reading_notes` or `user_books`. The only other host is the harness's cover fixture, answered locally.
- **Placement note:** at 390 px "Export library" wraps onto its own row under "Add a book" as a quiet text button, rather than sitting beside it (the lead viewed `shot-01-library-home-390.png`). It is accepted, because the row is designed to wrap, but recorded against §4.6's "beside" wording.

**Not verified:** a real browser's print dialog and Save as PDF (print was stubbed); Firefox and Safari download behaviour; native (Unit 3); axe.
**Database/storage mutations:** none. The only database contact was the read-only metadata check in §12.2.
**Next exact action:** the owner approves the Unit 2 commit. Then Unit 3 (native delivery) starts, with `npx expo install expo-sharing expo-print react-native-view-shot` (approved under D08-04) and an Android dev-build check.

### 12.4 Unit 3: native delivery (2026-10-21)

**Status:** BUILT, REVIEWED, FIXED and VERIFIED, including an Android emulator check. **Uncommitted** on `sdd08/export`. Unit 2 is committed as `c4b7614`.

**Installs** (approved under D08-04, run by the lead): `expo-print ~15.0.8` and `expo-sharing ~14.0.8`. `react-native-view-shot` waits for Unit 4.

**Files.** Edited:
- `src/features/books/export/deliver.ts`, which goes from the native stub to real delivery;
- `deliver.web.ts`, additions only: `pdfNeedsPrintStep()` returns true, and a `deliverPdfFile` stub throws;
- `useExportActions.ts`, for the native one-step PDF and the native feedback;
- `fileName.ts`, for the byte cap;
- `notesPrintHtml.ts`, for the `@page` margin;
- `package.json` and `package-lock.json`.

Tests: a new `deliver.native.test.ts`, plus added cases in `deliver.web.test.ts`, `useExportActions.test.tsx`, `fileName.test.ts` and `notesPrintHtml.test.ts`.

**Design as built:**
- **Delivery:** each delivery writes into its own `cacheDirectory/exports/<attemptId>/` and opens the system share sheet through `expo-sharing`, with the mime type, UTI and a dialog title. The file and its directory are deleted in `finally`, and a delete failure never masks the result.
- **Availability:** `Sharing.isAvailableAsync()` false, or a null `cacheDirectory`, raises `ExportUnavailableError`. The user sees "Sharing isn't available on this device."
- **Native PDF is one step:** `printToFileAsync`, then a move to the named file, then the share. It has no ready state or Print step. The render is capped at 60 s (`PDF_RENDER_TIMEOUT_MS`). A timeout shows "Couldn't export. Try again." and releases the single-flight lock, and a render that finishes late has its file deleted.
- **Captions:** after a native share there is none. A dismissed share sheet is not an error. Web feedback is unchanged.
- **File names:** the slug keeps the 60-code-point cap and is now also capped at 200 UTF-8 bytes on base+mark group boundaries, so a full name is at most 233 bytes. Existing ASCII, Latin, Devanagari and Kannada outputs are unchanged.
- **Print HTML:** gains `@page { margin: 18mm; }`. It applies to native PDFs and to web print.

**Built by:** Codex `gpt-6.1-sol` xhigh, in three runs: the build; fix round 1 (Luna F1 and F2); and fix round 2 (emulator findings G1 and G2). The lead changed fix round 1's byte budget from the briefed 150 to 200. At 150, existing Devanagari outputs would have changed, and 200 is still safe. The lead also replaced one old test that expected a 273-byte name (the defect itself) and rewrote the group-boundary test to use a mixed CJK+Devanagari title, so the byte cap really binds.

**Review:** Codex `gpt-6-luna` max, read-only; only its own output file changed and all source hashes held. Verdict: PASS WITH FINDINGS.
- Accepted F1 (MED): a fixed daily path could be overwritten or deleted while a share was still running, after an abort or unmount released the lock. Fixed with the per-attempt directory.
- Accepted F2 (MED): 60 four-byte characters exceeded the 255-byte native file-name limit. Fixed with the 200-byte cap.
- Rejected F3 (LOW): the manifest changes are the lead's approved installs, not builder scope.

**Verification (lead):**
- 78 suites / 1,542 tests PASS (`src/features/books`, `app/(tabs)/library`, `src/components/library`, `src/components/notes`, `eslint-rules`);
- `tsc --noEmit` 0;
- `lint:library` 0 errors, 118 warnings (unchanged).

**Mutation checks** (each restored, hash-verified), with the number of tests each made fail:
- no `isAvailableAsync` check: 3;
- text temp not deleted: 8;
- delete failure masks result: 7;
- PDF not moved: 2;
- no UTI: 3;
- native uses print step: 1;
- attempt directory not deleted: 10;
- non-unique attempt: 20;
- shared directory: 20;
- no byte cap: 4;
- group bytes undercount: 1;
- no timeout reject: 4;
- late file kept: 2;
- timer not cleared on success: 1;
- no page margin: 1.

**Android emulator check** ([evidence](./evidence/sdd08-u3-native-2026-10-21/README.md)): run by a Sonnet subagent and re-checked by the lead. Setup:
- a fresh API 36 x86_64 AVD and debug dev client `com.bookconnect.library.dev`;
- built with `:app:assembleDebug --offline`; APK SHA-256 `8d4ca6d8…8de1d`;
- local Metro on 8084, the dev-auth bypass, a placeholder `.env` (deleted), and Wi-Fi and data off;
- a temporary diagnostic route (removed) that called the real builders and `deliverTextFile`/`deliverPdfFile` with fixture data.

Results:
- **Hermes:** file names for English, Latin-accented, Hindi, Kannada and 61 × `𠮷` titles, and the `Asia/Kolkata` date, are identical to a Node reference. The date is `2026-10-04` and the CJK slug is 50 characters. Hermes `Intl` `timeZone` and `\p{…}` regexes work.
- **CSV:** the share sheet opened (Quick Share, Drive, Gmail). A copy taken while the sheet was open has the BOM `EF BB BF` and 3 CRLF with no bare LF; the lead re-checked the bytes. The formula title is prefixed with `'`, and Hindi and Kannada are intact. It resolved `shared`, and the attempt directory was gone afterwards.
- **Markdown:** UTF-8, with Hindi and Kannada intact and the Quote prefixed with `>`. It resolved `shared` and the directory was gone.
- **PDF:** the share sheet offered Quick Share, Print, Drive, Messages and Bluetooth. The lead viewed page 1: Devanagari and Kannada render as real script in Noto fonts, not tofu. The system Print target, which needs no sign-in, displayed the shared PDF.
- **Defect found (G1):** the first, cold PDF attempt hung. Logcat shows a WebView renderer crash, and `printToFileAsync` never settled. Fixed with the 60 s timeout above; the timeout was verified in Jest with fake timers, not on the device.
- **Defect found (G2):** the margins were very tight. Fixed with `@page`; not re-rendered on the device.
- **Two direct concurrent `deliverTextFile` calls:** the second share was rejected by Android ("Another share request is being processed now") and its directory was cleaned. That call bypassed the hook. In the app, the single-flight lock stops a second export, which is covered in Jest, so this is not a defect.

**Not verified:**
- the 60 s timeout and the `@page` margin on the device (JavaScript-only changes after the emulator run);
- a completed share to a real target, and whether a slow-reading target can still read the file after cleanup (every target except Print needs sign-in, a network or a peer);
- the real notes and library screens on native (the check used the route; entry rendering is covered by Jest);
- iOS;
- TalkBack.

**Residual risk:** a render that never settles leaves its unknown `cache/Print` file to OS cache eviction. The emulator run left one empty attempt directory and one `cache/Print` file from the hung attempt, before the fix; that AVD's data was wiped.

**Database/storage mutations:** none.

**Next exact action:** the owner approves the Unit 3 commit on `sdd08/export` (no merge, no push). Then Unit 4, the passage card, with `react-native-view-shot` (D08-04), hidden on web (D08-11).

### 12.5 Unit 4: passage card (2026-10-21)

**Status:** BUILT, REVIEWED, FIXED and VERIFIED, including an Android emulator check. **Uncommitted** on `sdd08/export`. Unit 3 is committed as `86be322`.

**Install** (approved under D08-04, run by the lead): `react-native-view-shot 4.0.3`, the SDK 54 pin.

**Files.** New:
- `src/features/books/export/`: `passageCard.ts` (the layout guess and `truncateToVisible`), `captureCard.ts`, and `captureCard.web.ts`, a stub with no view-shot import;
- `src/components/library/export/`: `PassageCard.tsx` and `PassageCardPreview.tsx`;
- tests for each.

Edited:
- `deliver.ts` and `deliver.web.ts`: `deliverImageFile`;
- `fileName.ts` and `types.ts`: the `quote-png` kind;
- `manualNotesGateway.ts`: `book()` now also returns `authors`;
- `app/(tabs)/library/note.tsx`: the entry;
- the book-section lint config and its test (both components join `STRICT_FILES`);
- `package.json` and `package-lock.json`;
- the reader tests: the `authors: []` fixtures and the capture mock.

**Design as built:**
- **Entry:** "Share as image" (accessible name "Share quote as image") in the note reader, on native Quote notes only. It is hidden on web (D08-11) and enabled offline.
- **Preview dialog:** "Share quote as image", with **Share image** as the primary and **Cancel**.
- **Fit:**
  - The card measures its own rendered lines (`onTextLayout`) on a hidden capture card.
  - It steps the size down 26/36 → 22/31 → 18/26.
  - At the floor it cuts at a word, adds "…", and measures again (at most 12 iterations).
  - If no layout event arrives, it settles on the guess after 2 s.
  - The caption "Shortened to fit the card." follows the fitted result.
- **Capture:** the hidden card is `1080 / PixelRatio` dp wide, so the PNG is exactly 1080×1350 with no upscaling. The visible card shows the same fit.
- **Share gating:** Share waits for the library fonts and the fit.
- **Lifecycle:** Cancel, unmount, or a change of quote, author or page cancels an in-flight capture and releases it.
- **Delivery:** through the Unit 3 per-attempt cache directory, as `image/png`. Every temp file, including the capture, is deleted on every path.
- **Errors:** "Sharing isn't available on this device." / "Couldn't share. Try again." (new copy).
- **Card content:**
  - fixed daylight palette;
  - the quote in EB Garamond;
  - the title;
  - `author · p. N`;
  - a small "BookConnect" wordmark (D08-07);
  - no user name.

**Built by:** Codex `gpt-6.1-sol` xhigh, in three runs: the build, fix round 1 and fix round 2. The lead added two tests and one fix: refit on a meta change, and the `fitKey` effect that cancels an in-flight capture when the card inputs change.

**Reviews:**
- **Codex `gpt-6-luna` max, round 1: FAIL.** Accepted F1 (HIGH: the character-count fit clipped silently), F2 (MED: blurry upscaled capture) and F3 (MED: view-shot reachable from the web bundle). Rejected F4 (the lead's install).
- **Luna confirmation: F1–F3 FIXED.** One new MED, a stale capture after the card inputs change, was fixed by the lead.
- **From here on, reviews use opencode (owner, 2026-10-21).**
  - The free models ran read-only in parallel, with the source hashes unchanged. GLM 5.3 flash and MiniMax 3.1 returned PASS WITH FINDINGS. DeepSeek v4.1 flash timed out without a verdict. Beam (trial) raised one false MED.
  - Accepted and fixed in round 2:
    - H1 (MED): no fallback if `onTextLayout` never fires;
    - H2 (LOW): "……" at the cut;
    - H3 (LOW): an old error kept after an input change;
    - H4 (LOW): busy stuck after a successful share on a dialog that stays mounted.
  - Not acted on: inflated Android line text (the retry corrects it), author de-duplication (only the first author is shown), an ellipsis when nothing was cut (unreachable in the loop), and an end-to-end preview test (covered by the card tests and the device check).
- **GLM confirmation of round 2: PASS.**

**Verification (lead):**
- 83 suites / 1,663 tests PASS (`src/features/books`, `app/(tabs)/library`, `src/components/library`, `src/components/notes`, `eslint-rules`);
- `tsc --noEmit` 0;
- `lint:library` 0 errors, 118 warnings (unchanged).

**Mutation checks** (each restored, hash-verified), with the number of tests each made fail:
- **Build:**
  - newline weight 1: 1;
  - split groups: 3;
  - no word-boundary cut: 2;
  - step boundary moved: 2;
  - source kept when unavailable: 10;
  - late result shared after Cancel: 1;
  - midnight palette: 1;
  - button enabled before fonts: 1;
  - shown on web: 1;
  - disabled offline: 1.
  - A redundant inner font guard behind the disabled button survived and is accepted as defence in depth.
- **Fix round 1:**
  - no step-down: 1;
  - no iteration bound: 1;
  - truncated not flagged: 4;
  - fit not keyed: 1 (after a lead-added test);
  - Share before the fit: 4;
  - capture width fixed: 2;
  - captures the visible card: 9;
  - caption from the guess: 1;
  - no input-change cancel: 1.
- **Fix round 2:**
  - no fit fallback: 4;
  - double ellipsis: 1;
  - stale error kept: 1;
  - busy stuck after share: 1.

**Android emulator check** ([evidence](./evidence/sdd08-u4-card-2026-10-21/README.md)): run by a Sonnet subagent and spot-checked by the lead.
- **Setup:**
  - a fresh API 36 x86_64 debug build (`--offline`; APK SHA-256 `6f9e7573…da97c`);
  - manifests restored byte-identical after prebuild;
  - local Metro, the dev-auth bypass, a placeholder `.env` (deleted), and Wi-Fi and data off;
  - a temporary route inside the library stack (removed) that opened the real preview with six fixtures: short English, long English, Hindi, long Kannada, long CJK without spaces, and 20 short lines.
- **Results:**
  - Share became enabled for all six, so `onTextLayout` fires on the off-screen card.
  - Every PNG is 1080×1350 and correctly named, including the Hindi, Kannada and CJK slugs.
  - The text is sharp and nothing is clipped. The lead viewed the long Kannada card: real script, cut with `…”`, the title and footer clear.
  - The "Shortened" caption appears exactly for the four PNGs that end in `…` (long English, Kannada, CJK, many lines). It is absent for short English and Hindi.
  - The preview and PNG line breaks match.
  - The attempt directory and the capture temp file are gone afterwards.
  - Cancel during a capture closes cleanly, with no share sheet or error.
- **Fonts:** Latin text uses EB Garamond. Devanagari, Kannada and CJK use the system script fonts, because EB Garamond has no glyphs for them.

**Not verified:**
- the 2 s fallback and the round-2 fixes on a device (JavaScript-only, after the emulator run);
- an immediate reopen tap during the dismiss animation (a later reopen worked);
- iOS;
- TalkBack. A reviewer note says native `Modal` does not forward `role`/`accessibilityLabel`, which affects this dialog and the Unit 2 export dialog alike.

**Residual (LOW, GLM):** Cancel during an in-flight delivery leaves `busy` set on a dialog that stays mounted. It is unreachable in the app, because the reader unmounts the preview on close.

**Database/storage mutations:** none.

**Next exact action:** the owner approves the Unit 4 commit on `sdd08/export` (no merge, no push). After that, SDD-08 has no build work left. Open done-criteria evidence: the library CSV opened in Google Sheets and Excel (owner action), and a real-browser web print. Then a decision on merging `sdd08/export` and `sdd07/tab-bar-main` to `main`.

### 12.6 Full-branch review and fixes (2026-10-22)

**Review:** PR-style, of the whole branch since `4a1daea` (about 4,100 lines: 1,188 production, 2,822 tests, 92 manifest and config). Run read-only by four free opencode models in parallel; the tree fingerprint was unchanged.
- **MiniMax 3.1:** MERGE AFTER FIXES. 6 findings, 5 accepted.
- **GLM 5.3:** MERGE. 1 accepted.
- **DeepSeek v4.1:** no final report. 2 accepted from its notes; 1 MED rejected, because the device check showed the preview and the PNG break lines identically.
- **Beam:** no output; it stalled on a rejected scratch-file write.
- Rejected: shared busy across screens (the intended single flight).

**Fixed** (Codex Sol; the lead verified):
1. the CSV `Published date` is now formula-guarded (it is free text from Google Books or manual entry);
2. **D08-12 native retention** (see §5 and §4.7);
3. web print: after `print()`, dispose leaves the iframe to `afterprint` or the 60 s fallback (Safari's `print()` does not block);
4. ISBN-10 with a lowercase `x` keeps its check digit;
5. the Markdown ordered-list escape is now `1\.`, applied only before whitespace (`3.14` is unchanged);
6. Escape, Back and Cancel cancel a busy export (§4.6);
7. the unused `src/features/books/export/index.ts` is deleted.

A follow-up also sweeps attempt folders dated more than 10 minutes in the future (clock moved back).

**Confirmation:** MiniMax, PASS on fixes 1 and 3–7. Its LOW note that a cancel followed by a reopen within milliseconds could close the new dialog is recorded as a residual.

**Mutation checks** (each restored, hash-verified), with the number of tests each made fail:
- date unguarded: 8;
- lowercase x dropped: 1;
- frame removed after print: 3;
- Back blocked while busy: 3;
- text deleted after success: 16;
- old folders kept: 8;
- no sweep: 10.
- The Markdown escape is asserted directly (`1\. item`, `12\) x`).

**Not verified:** a real Safari print; Android retention on a device (Jest only).

**Database/storage mutations:** none.

**Merge readiness (2026-10-22):** the fixes are committed as `5ed368b`. `origin/main` is still at the branch base `4a1daea`, so no sync was needed. **Full suite:** 432 suites / 5,519 tests pass; 1 suite and 4 tests are skipped, none added by this branch. `tsc --noEmit` 0; `lint:library` 0 errors. **Next exact action:** the owner decides on merging `sdd08/export` into `main`, and on any push.
