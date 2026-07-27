# SDD 05: Marketplace Discovery, Storefront, and Book Display

**Status:** `approved_baseline`
**Version:** 1.0
**Date:** 2026-07-19

**Implementation checkpoint (2026-07-22):** M07's 24-field public projection and three named discovery RPCs are live. Forward M10 restores anonymous execution only to those RPCs, sets the internal projection to `security_invoker=true`, and revokes direct view access; live checks show no private fields or underlying-table grants and the prior advisor error is resolved.

## 1. Decision

Make marketplace discovery bookstore-first while preserving edition-aware book matching. A book query returns every eligible bookstore carrying a matching edition, each store once. Selecting a bookstore opens its complete active public catalogue, with the searched book highlighted. Original-language metadata is displayed; approved aliases expand search only.

## 2. Current-to-target change

Current Phase 5 implementation groups book offers first and then displays store offers. Phase 9 target deliberately changes the primary presentation, not the safe data boundary:

- continue reading only `marketplace_book_listings` and `public_store_profiles` (or a new equally safe public projection/query boundary);
- aggregate matching listings into distinct store results;
- return all eligible stores through explicit pagination;
- preserve a book-offer detail comparison route where useful;
- make the public store page a complete catalogue rather than only a matching subset.

## 3. Marketplace home

Default home prioritizes:

- search by original title, author, ISBN, approved alias, or store name;
- nearby/eligible bookstores;
- store specialties/categories and fulfillment indicators;
- recently active/verified inventory where useful;
- unavailable-search/alert path.

Location remains contextual. Lack of location does not prevent title/store search; city/locality selection can substitute.

## 4. Book search response

For a title/author/ISBN/original-script/alias query:

1. Resolve matching public edition/listing identities.
2. Filter active/approved/moderation-safe listings from eligible active stores/localities.
3. Group by distinct `store_id`.
4. Rank stores deterministically.
5. Return all eligible store groups through pagination, never an arbitrary top-three cap.

One store result may contain:

- store name/logo/locality/distance;
- matching cover/title/authors/language;
- number of matching offers;
- lowest matching price;
- condition/damage summary;
- pickup/delivery availability;
- confirmation-before-payment message;
- link to the store catalogue with query context.

If the same store has multiple compatible inventory rows, group them visually as offers without merging inventory.

## 5. Storefront behavior

Selecting a store opens:

- public store name, description, logo/cover;
- public address/locality, hours, policies, pickup/delivery information;
- `title_count`: distinct active public editions/titles in the store;
- complete paginated active public catalogue;
- searched book pinned/highlighted when entered from a query;
- Clear search/browse all action.

Storefront never exposes owner contact not approved for public display, shelf/location, exact quantity, acquisition/cost data, internal notes, extraction state, raw media paths, request photos, or moderation/risk internals.

## 6. Public count definitions

| Count | Meaning |
| --- | --- |
| `bookstore_count` | Distinct eligible stores carrying a matched edition/book result. |
| `offer_count` | Distinct active public price/condition/damage offers. |
| `title_count` | Distinct active public editions/titles in one storefront. |

Exact physical quantity and reserved/sold bucket values remain private. Public availability stays friendly (`available`, `low_stock`, `confirmation_required`) and store confirmation remains required before payment.

## 7. Search fields and multilingual behavior

Search supports:

- ISBN-10/13 exact;
- original title/subtitle;
- original authors;
- approved alias text;
- publisher/category where product UI exposes it;
- language;
- store name and locality;
- condition, price, pickup/delivery filters.

Alias rules:

- alias hit resolves to the target listing/edition;
- display original authoritative title/authors and language;
- do not show uncertain/rejected aliases;
- alias does not group different editions or duplicate inventory;
- search telemetry may record that an alias matched, without exposing raw private provenance to the customer/store.

## 8. Ranking

Ranking is deterministic and versioned. Book matching precedes store ranking.

Suggested order:

1. exact ISBN;
2. exact original title + author;
3. exact approved alias;
4. strong original title/author relevance;
5. fuzzy relevance within safe threshold;
6. active availability/listing eligibility;
7. distance/locality where available;
8. pickup/delivery compatibility;
9. inventory freshness/confirmation history;
10. price and condition as bounded tie-breakers.

Sponsored ranking is excluded unless clearly labelled in a later approved feature. Internal reliability signals must not become an unexplained public score.

## 9. Card and detail display

### Search/store catalogue card

- canonical/provider cover URL when valid;
- approved owner actual-copy fallback when cover absent;
- placeholder otherwise;
- original title/authors;
- language;
- price;
- base condition and accessible explanation;
- damage badge;
- availability and fulfillment indicators.

### Book detail

- cover and approved public copy/damage gallery;
- title/subtitle/authors;
- description;
- language;
- publisher/date;
- edition/volume/format/pages/categories;
- ISBN-10/13 when appropriate;
- store identity, price, condition, damage note/types/photos;
- availability, pickup/delivery, confirmation requirement, return policy;
- Add to cart/request-photo capability.

Descriptions, notes, and aliases render as bounded plain text. Provider HTML/Markdown is sanitized/normalized before storage/display.

## 10. Cover fallback and media

Order:

1. validated provider/canonical cover;
2. owner-approved public actual-copy primary fallback;
3. product placeholder.

Damaged-book photos appear as evidence/gallery and do not replace the canonical cover unless explicitly approved as the primary fallback. Scan inputs and private customer-request photos never appear in marketplace responses.

## 11. Public eligibility

A store result/listing is visible only when:

- store is active, approved, setup-complete, selling-allowed, and eligible in pilot locality/feature policy;
- listing is active, moderation approved, quality ready, sellable, and quantity available > 0;
- price and condition are valid;
- damaged listings contain required approved public evidence;
- language/metadata fields meet public projection requirements;
- public media/URLs pass policy.

Eligibility must be evaluated through safe projections/controlled functions without exposing private `stores` or `store_inventory` to consumers.

## 12. Query and pagination behavior

Before projection/search migration design, one versioned bookstore-first query contract defines match-result identity, store-group identity, count semantics, public fields/privacy exclusions, alias-match indication, store-catalogue query context, cursor shape, ranking stages, and deterministic final tie-breaker.

- Explicit page size/range and stable tie-breaker.
- No missing stores caused by grouping after a too-small listing page. The query design must paginate store groups correctly, potentially through a controlled SQL/RPC/public projection rather than client-side grouping alone.
- Runtime validate all public rows.
- Escape/parameterize search input; input cannot alter PostgREST/SQL grammar.
- Stale in-flight results cannot overwrite a newer query.
- Empty query/home and no-result behavior are distinct.
- Search errors do not leak provider/database internals.
- The cursor binds query/filter/ranking version and the last stable store-group sort identity; changing context invalidates rather than reusing the cursor.

## 13. Marketplace preview from owner review

Before commit, the owner can see a non-authoritative preview of the future card/detail fields. Preview:

- uses staged sanitized values;
- clearly says Preview;
- performs no public write;
- shows missing/publication-blocking data;
- never generates customer-accessible URLs for private staging media.

## 14. Tests

- original title/author/ISBN/alias/store-name/language queries;
- each eligible matching store exactly once across pagination;
- multiple offers in one store and different-language editions;
- store catalogue complete title count and pinned searched book;
- exact quantity/private fields/request/scan media absent;
- cover/actual-copy/placeholder fallback;
- damaged badge/detail/photo eligibility;
- suspended/unverified/locality-disabled/moderation-blocked/unsellable exclusions;
- malicious query grammar and malformed projection data;
- accessibility, narrow widths, large text, and broken image fallback;
- existing confirmation/cart disclosures remain.
- pagination-boundary grouping does not omit or duplicate stores, including tied ranks and multiple offers per store.

## 15. Acceptance criteria

| ID | Criterion |
| --- | --- |
| MKT-01 | Marketplace home and book search present bookstores as the primary results. |
| MKT-02 | Every eligible matching store appears once through correct store-level pagination. |
| MKT-03 | Selecting a store shows its complete active public catalogue. |
| MKT-04 | The searched book is highlighted/pinned and can be cleared to browse all. |
| MKT-05 | Original-script and approved alias searches resolve to the same authoritative display. |
| MKT-06 | Search/card/detail show the agreed metadata, language, condition, damage, and fulfillment fields. |
| MKT-07 | Cover priority is canonical/provider, approved actual-copy fallback, placeholder. |
| MKT-08 | Scan/request media never enter public responses. |
| MKT-09 | Public descriptions/notes are bounded plain text. |
| MKT-10 | Only eligible safe projections are searchable/displayed. |
| MKT-11 | `bookstore_count`, `offer_count`, and `title_count` have distinct tested definitions. |
| MKT-12 | Exact physical quantity remains private. |
| MKT-13 | Multiple rows group visually without inventory merge. |
| MKT-14 | A versioned store-group query/cursor contract preserves deterministic ranking and complete pagination. |
| MKT-15 | Metadata-provider replacement cannot change public identity, eligibility, alias approval, search grouping, or marketplace DTO semantics without a separately approved public-contract version. |

## 16. Deferred

- dedicated external search engine;
- sponsored ranking;
- customer-visible reliability scores;
- advanced map-first discovery;
- full UI localization;
- automatic work-level grouping across uncertain editions;
- promotion/discount presentation engine.
