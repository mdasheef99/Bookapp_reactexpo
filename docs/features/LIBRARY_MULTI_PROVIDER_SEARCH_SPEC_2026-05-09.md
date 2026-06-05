# Library Multi-Provider Search Spec

**Date:** 2026-05-09
**Status:** Draft for approval before implementation
**Scope:** Personal Library search and add-to-library flow

## Goal

Make Library search more reliable by keeping Google Books and Open Library available in the same user flow.

Primary outcomes:

- keep Google Books as the default source when it responds successfully
- fall back to Open Library when Google Books fails, rate-limits, or returns no useful results for a query
- make the fallback visible in the UI without turning search into a confusing multi-source picker
- preserve current add-to-library, wishlist, duplicate detection, and manual-entry behavior

## Current state

Current search is tightly coupled to Google Books:

- `booksService.searchGoogleBooks()` builds a Google-only `volumes` query
- `booksService.searchGoogleBooksCached()` only handles Google Books plus stale cache fallback
- `booksService.getSearchSuggestions()` derives suggestions from Google Books only
- `app/(tabs)/library/search.tsx` renders `GoogleBook` results directly through `BookCard` and `SwipeableBookCard`
- duplicate detection is based on `google_books_id` in existing library rows

This means reliability is limited by one provider and the UI/result model is provider-specific.

## External API constraints

### Google Books

Source: Google Books API docs, `volumes` endpoint.

- search endpoint: `https://www.googleapis.com/books/v1/volumes?q=...`
- public requests should include an API key
- result shape is volume-oriented
- current app depends on `id`, `volumeInfo`, `saleInfo`, preview/info links, ISBNs, and image links

### Open Library

Sources: Open Library Search API and Covers API docs.

- search endpoint: `https://openlibrary.org/search.json`
- default result shape is work-oriented, not edition-oriented
- schema is useful but not fully guaranteed stable
- cover URLs can be built from ISBN or OLID via `https://covers.openlibrary.org/...`
- search supports pagination and requested fields

Important implication:

- we should not expose raw Open Library response shapes to the UI
- we should normalize provider results into one app-side search model

## Proposed design

### 1. Introduce a provider-neutral search model

Add a normalized result type for Library search, separate from raw `GoogleBook`.

Suggested shape:

- `provider`: `'google' | 'openLibrary'`
- `providerId`: provider-native identifier
- `title`
- `subtitle?`
- `authors`
- `description?`
- `coverUrl?`
- `publishedDate?`
- `pageCount?`
- `categories`
- `language?`
- `averageRating?`
- `ratingsCount?`
- `previewLink?`
- `infoLink?`
- `price?`
- `currencyCode?`
- `saleability?`
- `isbn10?`
- `isbn13?`
- `openLibraryEditionKey?`
- `openLibraryWorkKey?`
- `hasReadablePreview`

This model should be what the search screen and book cards consume.

### 2. Normalize both providers into one service path

Create one top-level search path that:

1. searches Google Books first
2. if Google succeeds with usable results, returns normalized Google-backed results
3. if Google fails with network error, 429, or non-OK response, tries Open Library
4. if Google returns zero items, optionally tries Open Library before showing empty state
5. tags the response with provider metadata so the UI can explain what the user is seeing

Suggested response metadata:

- `providerUsed`: `'google' | 'openLibrary'`
- `fallbackUsed`: boolean
- `fromCache`: boolean
- `items`
- `totalItems`
- `hasMore`

### 3. Preserve add-to-library semantics

`addToLibrary()` must continue to work regardless of result source.

That means the normalized search item must still provide enough metadata to:

- upsert a `books` row
- preserve ISBNs when available
- preserve cover URL when available
- preserve title and authors
- support duplicate detection even when `google_books_id` is absent

Required duplicate strategy:

- continue using `google_books_id` when the source is Google
- add a secondary lookup path for Open Library results using ISBN-13, then ISBN-10, then a conservative title/author fallback only if necessary

### 4. Frontend behavior

The search screen should stay simple:

- keep the current single search box
- do not add a provider picker in the first iteration
- show a compact notice when fallback results are being shown
- keep swipe/add/wishlist actions unchanged from the user’s perspective

Suggested fallback notice copy:

- `Showing results from Open Library while Google Books is unavailable.`

Possible no-results behavior:

- if both providers fail: provider-aware error message
- if both providers return no results: keep manual-entry CTA

### 5. Suggestions behavior

Suggestions should follow the same resilience pattern:

- Google Books suggestions first
- Open Library-backed suggestions on Google failure
- continue deduplicating titles/authors before rendering

## Testing plan

Tests must be written before implementation and should fail initially.

### Service tests

Add red tests for:

- `searchGoogleBooksCached()` falls back to Open Library when Google returns 429
- `searchGoogleBooksCached()` falls back to Open Library when Google request rejects
- normalized fallback result preserves title, authors, cover, and ISBN data needed for add-to-library
- `getSearchSuggestions()` falls back to Open Library suggestions when Google fails

### UI tests

Add red tests for:

- search screen shows a fallback-provider notice when results come from Open Library
- manual entry still appears when both providers return no results

## Out of scope for this pass

- user-selectable provider switching
- merging Google and Open Library results into one blended list
- background deduping across both sources in the same response
- barcode/OCR flows
- database migration changes unless duplicate detection truly requires them

## Approval gate

Implementation should start only after:

1. spec review
2. red tests added
3. explicit user approval
