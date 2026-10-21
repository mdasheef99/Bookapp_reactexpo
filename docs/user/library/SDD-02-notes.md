# SDD-02: Library Notes Core — Current Behavior + Contracts

**2026-10-09 target overlay:** This file preserves existing notes behavior/evidence. [SDD-06 revision 0.2](./SDD-06-after-book-entry-ui.md) owns the proposed after-book-entry lifecycle and connected-prototype plan. Optional categories, no default selection, read-before-edit and shared OCR/manual composition are target behavior, not already implemented. [Category rollout](./NOTE-CATEGORY-ROLLOUT.md) and the [fresh read-only receipt](./evidence/sdd06-review-2026-10-09/README.md) confirm the current live four-value, non-null category gate. No note-count, runtime, storage or release acceptance is changed by this overlay.

**Status:** approved — docs only (no migration, no DB apply)
**Date:** 2026-08-20
**SOT:** `ahntbtktjjmvfosgkmgn` `Bookconnect_reactexpo` @ `main` `15243d8` `C:/Users/LEGION/Desktop/Bookconnect4_expo`
**Git base:** `15243d8 docs(library): SDD-01 hardening cache, wishlist unify, notes FK + tests + migrations`
**Scope:** `app/(tabs)/library/notes.tsx:23`, `app/(tabs)/library/[bookId].tsx:48` notes preview, `src/features/books/services/notesService.ts`, `src/components/notes/*`, `public.reading_notes` + `public.user_books` — read-only capture, no schema change

## 1. Decision
Freeze and document live Notes core as-is after SDD-01 hardening. No new table, no RLS change, no `user_book_pages`, no OCR. SDD-03 will own OCR 500w + Saved Pages vault; SDD-04 will own shelf stitch/viewMode/themes.

## 2. SOT Evidence (live `ahntbtktjjmvfosgkmgn` via Supabase MCP)

**Counts:** `user_books 11 | reading_notes 2 | books 14 | wishlist 1` via `jsonb_build_object(...,wishlist where ownership='wishlist')`; `reading_status want_to_read 7 | completed 4`; orphan `0` via `LEFT JOIN reading_notes.user_book_id NOT IN user_books` — was `2` (`70feeec0…`, `6fb3955c…`) before `20260820034004_reading_notes_fk_and_cleanup.sql:3` delete.

**`public.reading_notes` constraints (`pg_constraint`):**
- `reading_notes_user_book_id_fkey FOREIGN KEY (user_book_id) REFERENCES user_books(id) ON DELETE CASCADE:9`
- `reading_notes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE`
- `reading_notes_pkey PRIMARY KEY (id)`
- `reading_notes_tag_check CHECK (tag IN ('quote','reflect','distill','apply'))`
- `reading_notes_content_not_empty CHECK (btrim(content) <> ''):13`
- `reading_notes_page_number_positive CHECK (page_number IS NULL OR page_number > 0):14`

**`public.reading_notes` RLS (`pg_policies` 4):** `SELECT "Users can view own notes" (auth.uid()=user_id) | INSERT "Users can insert own notes" with_check (auth.uid()=user_id) | UPDATE "Users can update own notes" (auth.uid()=user_id) | DELETE "Users can delete own notes" (auth.uid()=user_id)` — owner-only, no anon.

**`public.user_books` cascade:** FK `ON DELETE CASCADE` ensures note cleanup when `removeFromLibrary` deletes `user_books` row; `notesService.deleteNote` is note-level only.

**Code SOT:**
- `src/features/books/services/notesService.ts:16` `NOTE_TAG_CONFIG` 4 tags `quote#0D9488|reflect#7C3AED|distill#D97706|apply#059669` with `label|icon|color|bgColor|description`
- `notesService.ts:52` `getNotesForBook(userBookId, tagFilter?)` -> `supabase.from('reading_notes').select('*').eq('user_book_id',...).order('created_at',{ascending:false})` + optional `eq('tag',…)`; `71` `getNotesCount` exact head count; `84` `createNote(userId,userBookId,content,tag,pageNumber?)` insert `page_number ?? null`; `110` `updateNote(noteId,{content?,tag?,page_number?})` adds `updated_at ISO`; `135` `deleteNote(noteId)` `delete().eq('id',…)`
- `app/(tabs)/library/[bookId].tsx:93` `useQuery ['notes',bookId] -> notesService.getNotesForBook(bookId!)` preview `recentNotes = notes.slice(0,3):101` + `notesCount badge:100`; `104` `saveNoteMutation` create vs update branch on `editingNote`, `121` `deleteNoteMutation`; both `invalidateQueries ['notes',bookId]`; `NoteCard` + `NoteEditor` modal.
- `app/(tabs)/library/notes.tsx:23` full screen: `useQuery ['notes',userBookId]:47`, `activeTagFilter:32` client filter, `saveMutation:59` + `deleteMutation:77` invalidate `['notes',userBookId]` + `['notesCount',userBookId]`, `TagSelector allowDeselect compact:153`, `FlatList NoteCard:187`, `FAB add:209`, `NoteEditor:218`, `statsBar tagCounts:107`, back to `[bookId]` via `navigateBackOrFallback:34`.
- `src/components/notes/NoteCard.tsx:13` `onPress->onEdit`, `onLongPress Alert Edit/Delete:17`, tag badge `NOTE_TAG_CONFIG[tag].bgColor`, timestamp `en-IN`, quote italic `+ left border 3 tagConfig.color:68`, `numberOfLines 6`, optional `Page {page_number}:98`.
- `src/components/notes/NoteEditor.tsx:30` modal slide `visible/editingNote/bookTitle`, `content/tag/pageNumber` state, `useEffect prefill:40`, auto-focus `300ms:55`, `handleSave:59 trimmed content check + parseInt(pageNumber)`, `TagSelector:143`, content placeholder per tag, quote italic left border, `pageInput number-pad maxLength 5:204`, save disabled when `!trimmed || isSaving:80`.
- `src/components/notes/TagSelector.tsx:18` `TAGS ['quote','reflect','distill','apply']`, `allowDeselect` null toggle `onChange(null)`, `compact` sizing, selected `bgColor=config.color`.
- `src/components/notes/NotesList.tsx:21` reusable list with `maxItems/hideFilter`, internal `activeTagFilter`, `TagSelector allowDeselect compact:56`, `FlatList displayNotes.slice(maxItems)` `scrollEnabled:false`, empty state per filter.

## 3. Contracts + Invariants

1. Notes are `user_books`-scoped, owner-private via RLS `auth.uid()=user_id`; no public read.
2. `content NOT EMPTY` + `tag IN 4` + `page_number NULL OR >0` enforced DB; client trims before save.
3. `ON DELETE CASCADE` on both FKs — deleting `user_books` row auto-deletes its notes; orphan 0 invariant holds.
4. Ordering `created_at DESC` canonical; tag filter may be server (`getNotesForBook tagFilter`) or client (`notes.tsx filteredNotes`, `[bookId]` preview client not filtered).
5. `updated_at` set on every `updateNote` to ISO now.
6. No pagination — full fetch per `user_book_id`; list capped in UI (`slice 0,3` preview, `maxItems` prop).
7. No OCR / no pages vault / no shelf logic in this SDD.

## 4. UX Flow

`[bookId] My Notes section -> Add a note / NoteCard tap->NoteEditor (reflect default) -> save -> invalidate ['notes',bookId]`; `View All -> /library/notes?userBookId&bookTitle` full list with tag chips + per-tag counts + FAB. Long-press NoteCard -> Edit/Delete confirm. Detail preview shows 3 newest, badge total.

## 5. Verification

- `npx jest --runInBand --testPathPattern "notesService"`: **12 passed** (`NOTE_TAG_CONFIG 1 + getNotesForBook 4 + getNotesCount 2 + createNote 2 + updateNote 1 + deleteNote 2`) via `src/features/books/services/__tests__/notesService.test.ts:28` mock `supabase.from` chain `select|insert|update|delete|eq|order|single`.
- `npx tsc --noEmit`: fails only pre-existing `e2e/store-view-wu4-resilience.spec.ts:29` + `supabase/functions/_shared/imageInventory/** TS5097 allowImportingTsExtensions` — **Library/notes files clean** (`Select-String library|notes` 0 hits).
- `supabase_execute_sql orphan 0` + `list_tables 11/2/14` re-verified at SDD-02 start; no migration applied in this SDD.

## 6. Out of Scope

No migration, no `user_book_pages`, no OCR 500w, no Saved Pages 4k/800, no `getHighResCoverUrl` shelf stitch, no `viewMode`, no `useTheme` change, no payment/marketplace change, no `CODEBASE_INTELLIGENCE` write.

## 7. Next

SDD-03 `OCR 500w -> Note` + `Saved Pages vault (user_book_pages private RLS)`; SDD-04 `Shelf Stitch 2-shelf + getHighResCoverUrl:112 + viewMode shelf/list + 3 themes daylight/golden/midnight + Reading zones bento`. Both will reference this SDD's FK/RLS invariants.

## 2026-10-07 — Approved five-category notes direction

User approved Quote, Thought, Takeaway, Action and Question. Shared app labels now map quote/reflect/distill/apply to Quote/Thought/Takeaway/Action; stored values and default reflect (Thought) preserved. Writing prompts remain optional. Exact-project Supabase MCP verified Bookconnect_reactexpo/ahntbtktjjmvfosgkmgn ACTIVE_HEALTHY; metadata-only readback confirmed reading_notes_tag_check allows only the original four. Question remains designed/pending storage enablement, never silently mapped to reflect or exposed as savable yet. No note contents read or database writes. Concrete migration creation/application/compatibility/verification plan: docs/user/library/NOTE-CATEGORY-ROLLOUT.md. No migration created/applied. Topic tags and answered/done states remain later proposals. Full capture UI approval and Android correction acceptance remain pending independently.

Active scoped unit library_note_labels_complete_question_schema_pending. Exact next action: obtain explicit authorization to create and verify the narrow question constraint-expansion migration plan; application requires separate approval. Marketplace Phase9 Unit7C/M46 and DOC13/ACTIVE unchanged. Existing mixed changes preserved; no stage/commit/push/deploy, database/Storage/provider mutation. Stitch category refinement requested under user-approved design scope; completion evidence recorded at closeout.
