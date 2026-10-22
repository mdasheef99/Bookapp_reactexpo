# Library Roadmap — after SDD-06

**Status:** scope agreed by the owner on 2026-10-18; this file records it. Planning only — nothing here authorizes implementation, migration creation or migration application.
**Date:** 2026-10-18
**Worktree:** library work now lands on `main` via short branches from `main` (Flow D used worktree `Bookconnect4_flowd`); the `Bookconnect4_library` / `codex/library-cover-shelf` worktree is historical (library feature only; clubs live in `Bookconnect4_expo`)
**Supabase project:** `ahntbtktjjmvfosgkmgn` (shared with clubs and marketplace — check every tracker before any migration)
**Starting point:** SDD-01 to SDD-06 are done or superseded. Library work, including note saving, has been on `main` since 2026-10-20 (`library_main_integrated`). Still open after SDD-07: native screen readers, devices, 200% text and iOS are not tested, and the tab-bar contrast issue (RA-W01) stays open under the tab-bar item (see [TRACKER](./TRACKER.md)).

## 1. Tracks

| SDD | Track | Kind | Needs migration? | Status |
|---|---|---|---|---|
| [SDD-07](./SDD-07-book-section-ui-overhaul.md) | Book section UI/UX overhaul | Main track | No (UI only) | Flows A (Book Details), B (notes), C (capture) and D (home/search) plus follow-ups built, reviewed, verified and merged to `main` (Flow D 2026-10-21 as `e252513`; follow-ups 2026-10-21 as `29fd8b8`; records: SDD-07 §10, §11, §12, §13 and §13.7); next: the owner decides on a fresh tab-bar unit from `main` (icons, theme colours, contrast, 200% zoom; [TB-1](./SDD-07-TAB-BAR-UNIT.md) is superseded on `main`) — see [SDD-07](./SDD-07-book-section-ui-overhaul.md) and [TRACKER](./TRACKER.md) |
| [SDD-08](./SDD-08-export-and-share.md) | Export & share | Feature | No | Draft reviewed 2026-10-21; awaiting owner decisions D08-01–D08-11. Owner narrowed CSV to books only (notes → Markdown/PDF) |
| [SDD-09](./SDD-09-reading-history.md) | Reading history | Feature | Yes — one migration in Unit 1 (four tables, a trigger on `user_books`, back-fill) | Approved 2026-10-22 (lean list: 18 items, 5 units; four reviews; D09-05 simplified to no automatic undo). Next: Unit 1 migration file approval. Reading rhythm (opt-in streaks/reminders) moved to its own future SDD; "On this day" moved to SDD-10 |
| SDD-10 | Notes retrieval & organising | Feature | Yes (collections, shelves/tags) | Not started |

### SDD-07 — Book section UI/UX overhaul (main track)

Redesign the six Library screens (home/shelf, search, Book Details, notes list, note reader, note composer with capture/crop/OCR) against one approved design approach, rules DP-01 to DP-07, a merged token set and shared state components. Delivered flow by flow (A Book Details → B notes → C capture → D home/search), each designed, approved, built and accepted. The designs reserve space for SDD-08/09/10 so those features land on the new screens without another redesign.

Flows A→D are delivered and merged to `main` (see SDD-07 §10–§13.7).

### SDD-08 — Export & share

*Superseded in detail by [SDD-08](./SDD-08-export-and-share.md). Owner decision 2026-10-21: CSV is for books only; notes export as Markdown/PDF, not CSV.*

- **CSV export** of the library (books, status, ownership, dates, rating) and of notes.
- **Markdown notes export** — note body, category label, page (per-book vs all-books scope confirmed in SDD-08).
- **PDF export** (contents confirmed in SDD-08).
- **Standard passage cards** — an image card made from one **Quote**-category note (body + book title/author + optional page). Standard templates only; premium templates are removed (see §3).
- **Shared download/share/image layer** used by all of the above (web download, native share sheet, image rendering). Built once.
- Export logic (data → CSV/Markdown/PDF text) has no UI and may run alongside SDD-07. The entry points land on the redesigned screens.

### SDD-09 — Reading history

Ordered so history starts accumulating early:

1. **Reading-event recording** — a small, early migration (e.g. an append-only event row when status changes: started, finished, reread started) plus the client write. No UI. May run alongside SDD-07 once its migration is approved and applied.
2. **Yearly goal** — books-per-year target, owner-set.
3. **Reread tracking** — a second or later read of the same book.
4. **Full statistics and yearly summary** — built on the accumulated events.

Engagement mechanics stay out (no streaks, badges or reminders) — see SDD-07 DP-04.

### SDD-10 — Notes retrieval & organising

- **All-notes view** across books (today notes are listed per book only, newest first).
- **Note search** — start with a simple per-user text match; add full-text search only if measured to be necessary. Must work for non-English text (the OCR is English-only, but typed notes need not be).
- **"Today's note" resurfacing** — one past note shown quietly; no notification. "On this day" (a past finish, from SDD-09 history) joins it here (owner, 2026-10-22).
- **Passage collections** — collections of Quote notes. Needs a migration.
- **Custom shelves / tags for books** — needs a migration, and must fit the finished shelf, whose book order lives in AsyncStorage (`useShelfArrangement`, per user).
- **Decision on Saved Pages** (`user_book_pages`) — today the UI only reads and deletes them; no current route writes them. Keep, fold into notes, or retire.

## 2. Order and parallel work

1. SDD-07 is the main track: foundation unit, then flows A → B → C → D.
2. Alongside it, only no-UI work: SDD-08 export logic and SDD-09 event recording.
3. Feature UI (SDD-08/09/10 entry points and screens) lands on the new screens after the relevant SDD-07 flow is accepted.
4. **Every migration needs two separate approvals: one to create the file, one to apply it.** Re-verify the project id before each, and record each in the tracker with local filename, live version, effects and readback.

## 3. Not planned

### Deferred — recorded only, not planned in detail

- Barcode scan.
- Goodreads / StoryGraph import.
- The shared book matcher both need (ISBN → Google Books id → title/author match with user confirmation).

### Removed for now

- Lending ("Pass it on?" prompt and loan tracker).
- Shareable wishlist.
- Wishlist → local stores.
- Club book → library.
- Premium passage-card templates.

### Dropped — already done

- **Wishlist unification.** Wishlist is `user_books.ownership = 'wishlist'`. The legacy `user_wishlist` table has 0 live rows and no app code; the notify function was unified in migration `20260820033938_marketplace_wishlist_notify_unify.sql`.

## 4. Approval gates

| Gate | Who | Unlocks |
|---|---|---|
| Roadmap scope | Owner | Recorded here 2026-10-18 |
| SDD-07 draft | Owner | **Approved 2026-10-18** — foundation unit planning |
| SDD-07 foundation plan | Owner | **Approved 2026-10-18** (with the 3 dev tools) — building foundation units, one at a time |
| SDD-07 tab-bar unit TB-1 (D07-01) | Owner | **Approved 2026-10-18; built and parked 2026-10-19 on the old 9-tab layout.** Checked 2026-10-21: `main` already shows exactly five tabs (My Library, Exchange, Marketplace, Clubs, Profile), so its tab-count and label goal is met on `main` and the "Marketplace" label question is settled by `main`. Still open: tab icons, theme colours and label contrast (RA-W01), and a 200%-zoom check. The parked branch is not to be revived; a fresh small unit from `main` (app-wide, clubs heads-up) is the option (see [TB-1](./SDD-07-TAB-BAR-UNIT.md)). **2026-10-21: TB-2 built on `sdd07/tab-bar-main` from `main`** with labels Library / Exchange / Market (owner chose "Market") / Clubs / Profile, icons, theme colours, contrast and the 200% check. It passes on web and is **uncommitted, awaiting owner commit approval** (TB-1 §14) |
| Each SDD-07 flow design | Owner | All four flow designs (A–D) finalized and built; Flows A–D merged to `main` |
| Each flow build | Owner acceptance | The next flow's build; that flow's feature slots |
| SDD-08 / 09 / 10 drafts | Owner | Their implementation |
| Each migration file | Owner | Creating the file only |
| Each migration application | Owner | Applying it to `ahntbtktjjmvfosgkmgn` |
