# Library Roadmap — after SDD-06

**Status:** scope agreed by the owner on 2026-10-18; this file records it. Planning only — nothing here authorizes implementation, migration creation or migration application.
**Date:** 2026-10-18
**Worktree:** `Bookconnect4_library`, branch `codex/library-cover-shelf` (library feature only; clubs live in `Bookconnect4_expo`)
**Supabase project:** `ahntbtktjjmvfosgkmgn` (shared with clubs and marketplace — check every tracker before any migration)
**Starting point:** SDD-01 to SDD-06 are done or superseded. Note saving was enabled and committed on 2026-10-18 (`1e4924a`, `52cac60`, not pushed). Native acceptance, the web `Alert` gap (W01) and the tab-bar contrast issue (RA-W01) are still open (see [TRACKER](./TRACKER.md)).

## 1. Tracks

| SDD | Track | Kind | Needs migration? | Status |
|---|---|---|---|---|
| [SDD-07](./SDD-07-book-section-ui-overhaul.md) | Book section UI/UX overhaul | Main track | No (UI only) | APPROVED 2026-10-18; [foundation plan](./SDD-07-FOUNDATION-PLAN.md) approved 2026-10-18; Flow A direction chosen (D07-09, A1 + A2 passages), DP-01 amended (D07-10); [FA-P1 prototype](./SDD-07-FLOW-A-PROTOTYPE.md) built; Flow A design FINALIZED 2026-10-18 (SDD-07 §10); foundation Wave 1 committed on `sdd07/fu1a-fu3` (not pushed); tab-bar unit [TB-1](./SDD-07-TAB-BAR-UNIT.md) (D07-01) built, reviewed and parked 2026-10-19 (uncommitted; "Marketplace" label decision and commit approval pending); next: Wave 2 (FU-1b, FU-1c) when the owner says go |
| SDD-08 | Export & share | Feature | No | Not started |
| SDD-09 | Reading history | Feature | Yes (event storage early; goal storage later — shape decided in SDD-09) | Not started |
| SDD-10 | Notes retrieval & organising | Feature | Yes (collections, shelves/tags) | Not started |

### SDD-07 — Book section UI/UX overhaul (main track)

Redesign the six Library screens (home/shelf, search, Book Details, notes list, note reader, note composer with capture/crop/OCR) against one approved design approach, rules DP-01 to DP-07, a merged token set and shared state components. Delivered flow by flow (A Book Details → B notes → C capture → D home/search), each designed, approved, built and accepted. The designs reserve space for SDD-08/09/10 so those features land on the new screens without another redesign.

### SDD-08 — Export & share

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
- **"Today's note" resurfacing** — one past note shown quietly; no notification.
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
| SDD-07 tab-bar unit TB-1 (D07-01) | Owner | **Approved 2026-10-18; built and reviewed, PARKED 2026-10-19** — waits for the "Marketplace" label decision and commit approval |
| Each SDD-07 flow design | Owner | Building that flow (Flow A: direction chosen 2026-10-18; the FA-P1 prototype is reviewed before the real build) |
| Each flow build | Owner acceptance | The next flow's build; that flow's feature slots |
| SDD-08 / 09 / 10 drafts | Owner | Their implementation |
| Each migration file | Owner | Creating the file only |
| Each migration application | Owner | Applying it to `ahntbtktjjmvfosgkmgn` |
