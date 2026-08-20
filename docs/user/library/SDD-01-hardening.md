# SDD-01: Library Hardening — Cache, Wishlist Notify, Notes FK

**Status:** approved to implement
**Date:** 2026-08-20
**SOT:** `ahntbtktjjmvfosgkmgn` `Bookconnect_reactexpo` @ `main` `C:/Users/LEGION/Desktop/Bookconnect4_expo`
**Git:** `M src/features/books/services/booksSearchCache.ts`, `M src/features/books/services/booksService.ts` (staged hardening)
**Scope:** read-only hardening for `app/(tabs)/library/*`, `src/features/books/*`, `public.user_books`, `public.reading_notes`

## 1. Decision
Harden live Library before `OCR 500w` / `Saved Pages 4k/800` / shelf `getHighResCoverUrl` / `viewMode` / `useTheme` features.

## 2. SOT Evidence
- `user_books 11` `want_to_read 7 | completed 4` `reading 0` via `supabase_execute_sql`
- `reading_notes` `orphan 0` after cleanup (was 2: `70feeec0-be70-4493-ac63-63e26af41507`, `6fb3955c-4b24-41cd-a205-3f22646da252`)
- `pg_policies` `user_books` 4 policies `view|add|update|delete (auth.uid()=user_id)` - DELETE already exists live
- `pg_constraint` `reading_notes_user_book_id_fkey` `FOREIGN KEY (user_book_id) REFERENCES user_books(id) ON DELETE CASCADE` present
- `pg_get_functiondef notify_wishlist_matches` dedupes `user_books wishlist UNION user_wishlist` `DISTINCT ON uid`

## 3. Changes

**3.1 Cache key `src/features/books/services/booksSearchCache.ts:14`**
- Before: `getCacheKey(query)` -> `query.trim().toLowerCase()`
- After: `getCacheKey(query,filters,startIndex,maxResults)` -> `${base}|${JSON.stringify(filters)}|${startIndex}|${maxResults}`
- `getCachedSearchResults:18` / `setCachedSearchResults:34` now take `filters,startIndex,maxResults`
- `booksService.ts:369` `getCachedSearchResults(trimmed,filters,startIndex,maxResults)` / `410` `setCachedSearchResults(trimmed,items,filters,startIndex,maxResults)` - prevents Hindi vs English same query or page 0 vs 20 returning wrong `hasMore:false` `fromCache:true` - `JSON.stringify(filters)` is key-order sensitive, safe while `SearchFilters` is built at single call-site shape `genre/language/priceType`

**3.2 Wishlist notify `supabase/migrations marketplace_wishlist_notify_unify` (live)**
- `notify_wishlist_matches(p_listing_id)` and `route_wishlist_listing_match_notification()` now `SELECT DISTINCT ON (uid) FROM (SELECT ub.user_id,ub.id FROM user_books JOIN books wb ON wb.id=ub.book_id WHERE ub.ownership='wishlist' AND wb.google_books_id=listing_record.google_books_id UNION SELECT uw.user_id,uw.id FROM user_wishlist WHERE uw.google_books_id=...)`
- Deduped by `user_id`, so Library `useWishlist.ts:30` `ownership=wishlist` triggers same `wishlist.listing_matched` `notification_events` as legacy
- Payload note: `jsonb_build_object 'wishlist_id'` carries `src_id` - when deduped from Library it is `user_books.id`, not `user_wishlist.id`. Delivery keyed by `user_id` so no duplicate delivery, but payload field now references wrong table for Library rows - document for future rename to `source_wishlist_id`

**3.3 Notes FK `supabase/migrations reading_notes_fk_and_cleanup` (live)**
- Deleted 2 orphans, added `FOREIGN KEY (user_book_id) REFERENCES user_books(id) ON DELETE CASCADE`, `CHECK btrim(content)<>''`, `CHECK page_number IS NULL OR page_number>0`
- `src/features/books/services/notesService.ts:52` `getNotesForBook` still `order created_at desc`, `createNote:84` now fails on empty content / `page_number<=0` via DB

## 4. Verification
- `npx jest --runInBand src/features/books/services/__tests__/booksSearchCache.test.ts src/features/books/services/__tests__/booksService.test.ts src/features/books/services/__tests__/notesService.test.ts` 58 passed (10 cache + 36 service + 12 notes - was 56 before 2 new cache-key tests)
- `npx jest --runInBand --testPathPattern "library/__tests__"` 10 tests pass (index/search/[bookId]) — `app/(tabs)/library/__tests__/*` is 0 matches on Windows
- `npx tsc --noEmit` fails only pre-existing `e2e/store-view-wu4-resilience.spec.ts:29` + `supabase/functions/_shared/imageInventory/** allowImportingTsExtensions` - Library clean
- `npm run export:web` 2282 modules 5.33MB success
- `supabase list_tables` `user_books 11` `reading_notes 2` `books 14` after cleanup (2 live non-orphan `7b1cb34b…`, `df5206cb…`; §2 orphan 0 after deleting `70feeec0…`, `6fb3955c…`)

## 5. Out of Scope
No UI, no `user_book_pages`, no OCR, no shelf `getHighResCoverUrl`, no `viewMode`, no `useTheme` change

## 6. Next
Commit staged `M` diffs `booksSearchCache.ts` `booksService.ts` after this SDD, then `SDD-02 Notes core`, `SDD-03 OCR 500w + Saved Pages 4k/800`, `SDD-04 Shelf Stitch + viewMode + themes`
