# Library screen audit: capture evidence (2026-10-18)

Read-only QA capture of the Library screens on the Expo web dev server (`http://localhost:8083`, Edge via Playwright).

## How it was run

- Dev server: Browser-pane preview `library-web` (port 8083). Left running.
- Command (from repo root): `npx playwright test --config docs/user/library/evidence/library-screen-audit-2026-10-18/playwright.capture.config.ts`
- Result: **45 passed, 0 failed** (about 4.7 min, 1 worker).
- Fixtures: every `https://` request is intercepted. Supabase GET/HEAD reads come from per-test fixture rows. Login uses the fake OTP values from `e2e/library-vault-smoke.spec.ts`. Google Books and Open Library are faked (search only).
- Non-GET writes recorded: **0** (`write-audit.json`).
- Read-only POST RPCs answered by the harness: `get_public_book_reviews` (2 calls). Auth POSTs (`otp`, `verify`) are the fixture login and are listed separately in `write-audit.json`.
- Cover image bytes: `docs/user/library/correction-evidence-20261003/chooser-390.jpg`. That file is a screenshot of the user's own library, so covers in the captures show real titles from it. Not a stray overlay.
- Native-only states (camera capture, on-device OCR, auto-crop, haptics, TalkBack, OS large text) are NOT-REACHABLE-ON-WEB.

## Table

Verdicts: PASS (captured, looks correct), FLAG (captured, looks wrong), FAIL (could not capture), NOT-REACHABLE-ON-WEB. Files are in this folder. `-fold` is the first viewport only.

| ID | State | Verdict | Screenshot(s) | Notes |
|---|---|---|---|---|
| A01 | Home, populated, list mode | PASS | A01.png, A01-fold.png | Long titles/authors ellipsised. Bottom tab labels truncated at 390px (cross-cutting 1). |
| A02 | Home, shelf mode | PASS | A02.png, A02-fold.png | Spine titles truncated. |
| A03 | Home, empty library | PASS | A03.png, A03-fold.png | "Your library is empty" + hint. |
| A04 | Home, loading (8 s hold) | PASS | A04.png, A04-fold.png | Full-screen spinner only, no skeleton. |
| A05 | Home, error (500) | PASS | A05.png, A05-fold.png | "Could not load your library" + Try Again. |
| A06 | Home, long-title book | PASS | A06.png, A06-fold.png | Title and author truncated cleanly. |
| A07 | Home, desktop 1280x800 | PASS | A07.png, A07-fold.png | Centred ~600px column; tab labels full. |
| B01 | Search, initial | PASS | B01.png, B01-fold.png | "Find your next read" empty state. |
| B02 | Search, results | PASS | B02.png, B02-fold.png | "2 results", Add/heart/share present (not pressed). |
| B03 | Search, no results | PASS | B03.png, B03-fold.png | "No books found" + "Add it manually". |
| B04 | Search, provider error (500) | FLAG | B04.png, B04-fold.png | Shows raw "Google Books API error: 500" to users (copy). |
| B05 | Search, loading (provider held) | PASS | B05.png, B05-fold.png | Skeleton cards. |
| C01 | Book details, populated notes | FLAG | C01.png, C01-fold.png | No-cover placeholder is a bright white rectangle on dark theme. |
| C02 | Book details, zero notes | PASS | C02.png, C02-fold.png | "No notes yet" + Add note. |
| C03 | Book details, no cover | FLAG | C03.png, C03-fold.png | Same white placeholder. |
| C04 | Book details, long title | FLAG | C04.png, C04-fold.png | Title wraps to 7 lines, no clipping; same white placeholder. |
| C05 | Book details, loading (held) | PASS | C05.png, C05-fold.png | Full-screen spinner. |
| C06 | Book details, error (500) | FLAG | C06.png, C06-fold.png | Shows "Book not found. Go Back" for a server error. |
| C06b | Book details, not found (406) | PASS | C06b.png, C06b-fold.png | "Book not found. Go Back". |
| C07-1..4 | Sections expanded (My review, Book options, Community reviews, Book information) | PASS | C07-1-my-review.png ... C07-4-book-information.png | Each expands; Book information shows only ISBN. |
| C08 | Saved pages present | PASS | C08.png | "Page 1 · 100 words" card; Delete visible inline (not pressed). |
| C09 | Book details, desktop 1280x800 | PASS | C09.png, C09-fold.png | Layout fine. |
| D01 | Notes list, populated (7) | PASS | D01.png, D01-fold.png | Chips and cards render. |
| D02 | Notes list, empty | PASS | D02.png, D02-fold.png | "No notes yet" + Add your first note. |
| D03 | Notes list, chip filters | PASS | D03-quote.png, D03-thought.png, D03-question.png | Caption "Showing Quote notes..." updates. |
| D04 | Notes list, loading (held) | PASS | D04.png, D04-fold.png | Header + spinner, no skeleton. |
| D05 | Notes list, error (500) | PASS | D05.png, D05-fold.png | "Couldn't load your notes" + Retry. |
| E01 | Note reader, category + page | FLAG | E01.png | "Delete note" directly under the text, above Edit and Copy, same visual weight (UX risk). |
| E02 | Note reader, no category | PASS | E02.png | No category label shown. |
| E03 | Note reader, ~500-word note | PASS | E03.png | Text-verified; full text renders. |
| E04 | Note reader, not found | PASS | E04.png | "This note is missing or couldn't be opened. Try again". |
| F01 | Composer, choose step | PASS | F01.png | Category chips, Skip category, Write note, Scan text. |
| F02 | Composer, write step (empty) | PASS | F02.png | |
| F03 | Composer, typed text (not saved) | PASS | F03.png | |
| F04 | Composer, 501 words pasted (not saved) | FLAG | F04.png | No live word counter or limit message; 501 words accepted, Save note enabled. |
| F05 | Composer, discard dialog | PASS | F05.png | "Discard this note? Your note hasn't been saved." Keep editing / Discard note. |
| F06 | Composer, scan intake | PASS (UI) / NOT-REACHABLE-ON-WEB (OCR) | F06.png, F06-chooser.txt | "Scanning text is unavailable in this browser". Choose photo opened the file chooser. |
| F07 | Composer, crop step | NOT-REACHABLE-ON-WEB | F07-after-pick.png, F07-crop.png | "Automatic text cropping is unavailable here." |
| F08 | Composer, what follows scan | NOT-REACHABLE-ON-WEB | F08.png, F08-action.txt | Crop action not enabled; no review / no-text / failure state reached. |
| F09 | Composer, edit mode (not saved) | PASS | F09.png | Category: Quote; "Save changes" present, not clicked. |
| G01 | CSS zoom 200% approximation, details | PASS | G01-details-zoom200-approx.png | Cover image enlarges (it is the user's screenshot); text reflows. Not OS large text. |
| G01 | CSS zoom 200% approximation, composer | PASS | G01-composer-zoom200-approx.png | Labels and chips readable. |
| G02-daylight-* | Theme hour 12: home, details, composer | FLAG (verify) | G02-daylight-home.png, -details.png, -composer.png | Home looks cream. |
| G02-golden-* | Theme hour 18: home, details, composer | FLAG (verify) | G02-golden-home.png, -details.png, -composer.png | Home looks identical to daylight; golden mapping not confirmed. |
| G02-midnight-* | Theme hour 22: home, details, composer | PASS | G02-midnight-home.png, -details.png, -composer.png | Dark navy. |
| G03 | Offline after load, click a book | FLAG | G03-offline-after-book-click.png | Shows "Book not found. Go Back" instead of an offline message. |

## Cross-cutting visual problems

1. Bottom tab bar labels are truncated at phone width ("My Lib", "Exchan", "Mark"). Seen in A01 and Part B. Desktop widths are fine (A07, C09).
2. The book-details no-cover placeholder is a bright white block on dark themes (C01, C03, C04). The home placeholder is dark and muted.
3. Errors and offline states read as "Book not found" (C06, G03).
4. No word counter or limit feedback in the composer before Save (F04).
5. "Delete note" sits in the primary action stack of the note reader (E01).
6. Raw provider error text is shown to users (B04).
7. Loading is spinner-only full-screen on lists and details (A04, C05, D04); the Part B notes list showed about 3-4 s of spinner before content.

## Not established

- G02 golden-hour theme mapping: daylight and golden home captures look identical.
- Whether the composer enforces the 500-word limit at Save. Save was never clicked.

## Part B (real signed-in data, read-only, Browser pane)

Not a sign-in screen; the account shows "CM's Book Shelf" (33 books). Checked list, Clean Code details (sections expanded by header only), notes list, note reader, composer choose step (left via Back, nothing typed). Console: no errors, only dev warnings. An Expo dev-only overlay icon floats over the tab bar on details. The Shelf/List toggle was not changed to avoid altering a persisted preference.

## Writes

Non-GET writes: 0. See `write-audit.json`.

## Review by the orchestrating session (Claude, 2026-10-18)

- **Rerun verified:** the same command with `--reporter=list` gave **45 passed (4.9 min)**. `write-audit.json` then covered all 45 tests with **0 non-GET writes**. Every https request is intercepted (non-Supabase hosts aborted, Supabase answered by fixtures), so no request reached the real database. `results.json` in this folder is stale: it records only an earlier single-test G01 rerun.
- **Flags reviewed by eye:** C01-fold, E01, F04, G02-golden-details, G02-midnight-home.
  - Confirmed: white no-cover placeholder; Delete note above Edit/Copy; no live word count (save-time 500-word validation was verified on 2026-10-18 in the SDD-06 release acceptance).
  - G02 golden vs daylight: the captures differ (different hashes). The library golden palette is only subtly warmer than daylight.
- **Added finding (top priority):** the book section shows three visual identities. Home/Search use `useLibraryAppearance` + library typography. Book Details (`[bookId].tsx:55,70`) uses the base `useTheme` colours: navy/indigo at midnight, orange on yellow at golden, heavy sans titles. Notes screens use `useNoteColors` greens.
- **Added finding:** the global tab bar is white in every phase, and its icons render as fallback "⏷" glyphs.
- Summary and priorities: [SDD-07 §4.2](../../SDD-07-book-section-ui-overhaul.md).
