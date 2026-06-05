# DOC-3: Canonical Books, Metadata, and Inventory

**Product:** BookConnect
**Spec Suite:** Multi-Tenant Bookstore Marketplace
**Version:** 0.1
**Date:** 2026-05-19
**Status:** Planning draft
**Depends On:** DOC-0, DOC-1, DOC-2
**Owns:** Canonical book identity, metadata provider rules, store inventory, public listing projection, duplicate resolution, and inventory visibility.

---

## 1. Purpose

This document defines how books and store inventory are represented in the bookstore marketplace.

The consumer marketplace must not expose raw store inventory rows directly. Store inventory contains private operational fields such as shelf location, acquisition cost, internal notes, extraction confidence, and duplicate resolution details. Consumers should see a public marketplace listing projection grouped by canonical book identity.

---

## 2. Core Principle

Consumer search should answer:

```text
Which bookstores have this book available?
```

not:

```text
Which raw inventory rows happen to match this text?
```

The marketplace should group availability around canonical book/edition identity and then show store-specific offers.

---

## 3. Existing DB Reuse

The live DB has a `books` table with useful metadata fields:

- Google Books ID
- title/subtitle
- authors
- ISBN-10 / ISBN-13
- cover URL
- publisher
- published date
- page count
- categories
- ratings
- language
- retail price/currency

This can be reused as an initial metadata source, but the bookstore marketplace needs stricter identity modeling because:

- same title can have multiple editions
- Google Books IDs are provider IDs, not universal identity
- second-hand books may lack ISBN
- LLM extraction can produce uncertain names
- Open Library and other providers may disagree
- consumer marketplace grouping must avoid merging different editions incorrectly

---

## 4. Book Identity Model

### 4.1 Recommended Layers

```text
canonical_works
  Represents the intellectual work, such as "Atomic Habits".

canonical_editions
  Represents a specific edition/format/ISBN of a work.

book_metadata_sources
  Records metadata from Google Books, Open Library, ISBN APIs, or manual correction.

store_inventory
  Store-private owned stock item/quantity.

marketplace_book_listings
  Publicly searchable projection of sellable inventory.
```

### 4.2 Work vs Edition

The system should not force every book into a perfect work/edition hierarchy on day one, but the schema should leave room for it.

Examples:

- Same work, different editions: paperback, hardcover, international edition, translated edition.
- Same title, different work: books with identical titles by different authors.
- Same ISBN, multiple stores: same edition available at multiple bookstores.

MVP can begin with edition-level matching and add work-level grouping where confidence is high.

---

## 5. Metadata Authority Rules

### 5.1 Match Strength

| Match Type | Strength | Behavior |
|---|---|---|
| Exact ISBN-13 | Strongest | Auto-match to edition unless duplicate provider conflict exists. |
| ISBN-10 normalized to ISBN-13 | Strong | Auto-match if checksum valid. |
| Provider ID match | Medium | Useful for source trace, not universal identity. |
| Title + author exact normalized | Medium | Suggest match; verify if no ISBN. |
| Fuzzy title + author | Weak | Suggest only; owner/admin confirmation required. |
| Title only | Weakest | Never auto-merge. |

### 5.2 Provider Priority

Recommended enrichment order:

1. ISBN exact match against existing canonical editions.
2. Google Books API lookup.
3. Open Library lookup.
4. Additional ISBN/catalog provider if available.
5. Manual owner correction.

Provider data should be stored as source records, not blindly overwritten into canonical truth.

### 5.3 Manual Correction

Store Owner edits can correct listing-level data:

- price
- quantity
- condition
- public notes
- condition photos
- shelf/location

Canonical metadata corrections should require either:

- high-confidence provider data, or
- platform/admin review, or
- local override scoped to that listing only.

---

## 6. Store Inventory Model

`store_inventory` represents a store's private stock.

Recommended fields:

```text
store_inventory
  id
  store_id
  canonical_work_id nullable
  canonical_edition_id nullable
  source_book_id nullable
  title
  authors
  isbn_10
  isbn_13
  publisher
  published_date
  cover_url
  condition
  condition_notes
  quantity_total
  quantity_available
  quantity_reserved
  quantity_sold
  selling_price_inr
  acquisition_cost_inr private
  shelf_location private
  internal_notes private
  public_notes
  photos
  visibility_status
  listing_quality_status
  metadata_confidence
  extraction_session_id nullable
  entry_method
  created_at
  updated_at
```

### 6.1 Condition Values

Allowed condition values:

- `new`
- `like_new`
- `good`
- `fair`
- `damaged`

Condition descriptions:

| Condition | Meaning |
|---|---|
| `new` | Unused or store-new copy. |
| `like_new` | Minimal wear; no meaningful marks or damage. |
| `good` | Readable and clean; moderate wear acceptable. |
| `fair` | Clearly used; may have marks or worn cover but complete/readable. |
| `damaged` | Damaged but sellable only with clear disclosure and photos. |

### 6.2 Quantity Semantics

```text
quantity_total = quantity_available + quantity_reserved + quantity_sold + quantity_removed
```

Implementation can simplify at MVP, but it must track at least:

- available quantity
- reserved quantity during order request/payment windows
- sold quantity

Reservation semantics are owned by DOC-6.

---

## 7. Public Listing Projection

`marketplace_book_listings` is the consumer-facing projection of store inventory.

It should expose:

- listing ID
- store ID
- canonical book/edition ID
- public title
- public authors
- public cover
- ISBN if safe/useful
- condition
- public condition notes
- selling price
- available quantity bucket, not necessarily exact quantity
- fulfillment options
- store public location/area
- store distance computed from user location where available
- listing status

It should not expose:

- shelf location
- acquisition cost
- internal notes
- metadata confidence internals
- extraction prompt/output
- duplicate resolution history
- exact inventory audit trail

### 7.1 Availability Display

Consumer UI should use friendly availability states:

| State | Meaning |
|---|---|
| `available` | Store has available stock. |
| `low_stock` | Available, but quantity is low. |
| `confirmation_required` | Store must confirm before payment. |
| `unavailable` | Not sellable. |

Exact quantity can be hidden or shown per product decision. For used books, hiding exact quantity is acceptable because store confirmation is required before payment.

---

## 8. Visibility and Listing Status

Recommended inventory visibility:

| Status | Meaning |
|---|---|
| `draft` | Inventory exists but is not public. |
| `needs_review` | Missing required listing data or low confidence. |
| `published` | Publicly searchable and orderable. |
| `paused` | Temporarily hidden by store owner. |
| `out_of_stock` | Quantity unavailable. |
| `blocked` | Hidden by platform moderation/compliance. |

Only `published` rows should appear in consumer marketplace search.

---

## 9. Duplicate Resolution

Duplicates can occur when:

- the same book is scanned multiple times
- the same ISBN exists in inventory already
- LLM extracts the same title from multiple photos
- Google Books and Open Library identify similar editions differently
- stores manually add an existing book

Resolution rules:

1. Same store + same ISBN-13 + same condition can suggest quantity increment.
2. Same store + same ISBN-13 + different condition should create separate inventory rows or variants.
3. Same store + no ISBN + strong title/author match should prompt owner to merge or keep separate.
4. Different stores with same ISBN should not merge inventory; they become multiple public offers under same canonical edition.
5. Platform may merge canonical metadata, but not store inventory ownership.

---

## 10. Listing Quality Score

A listing quality score should be calculated for owner guidance, not necessarily shown to consumers at MVP.

Inputs:

- ISBN present
- title present
- author present
- cover image present
- condition selected
- price set
- quantity set
- public visibility enabled
- condition photo present for used/damaged high-value books
- metadata confidence
- piracy/counterfeit/moderation risk flags
- complaint history on listing/store
- recency of store confirmation

Suggested statuses:

- `ready`
- `missing_price`
- `missing_condition`
- `missing_metadata`
- `low_confidence_match`
- `needs_photo`
- `blocked`

This turns image extraction into a business workflow, not just data entry.

---

## 11. Optional Used-Book Photos

The customer may request images of used books before ordering. This is optional planning scope and can be implemented later.

Design implications:

- inventory can have condition photos
- order request can include `photo_requested`
- store can attach additional photos before confirming
- customer can decide whether to proceed after viewing photos

MVP should support storing photos in the model, but the full request-before-order image workflow can be deferred.

For `damaged` condition, public condition notes should be mandatory and condition photos should be strongly preferred. If dispute workflows rely on photos, uploaded photos must be retained according to evidence policy even if the listing is later unpublished.

---

## 12. Anti-Piracy, Counterfeit, and Prohibited Listings

Books have marketplace-specific trust risks.

The inventory/listing system must support moderation for:

- pirated or counterfeit copies
- unlawful or restricted material
- misleading edition/condition claims
- suspiciously low pricing
- repeated customer complaints
- copyright/trademark complaints around uploaded images

Moderation behavior:

- platform can hide or suspend a listing without deleting historical records
- store can be asked to correct listing metadata or condition evidence
- repeated or severe violations can trigger store risk review or suspension
- paid order history and dispute evidence must remain available to platform ops

Customer-facing search must not return suspended or blocked listings.

---

## 13. Search Index Requirements

Consumer marketplace search should support:

- exact ISBN
- title
- author
- publisher
- category
- store city/locality
- distance from user
- condition
- price range
- pickup/delivery availability

Ranking should consider:

- exact ISBN match
- title/author relevance
- nearby stores
- listing availability
- store open/available status
- store reliability score, internal at MVP
- price
- condition
- metadata confidence

Postgres can start with full-text/trigram indexes; a dedicated search service can be considered later if scale requires it.

---

## 14. Suggested Data Model

```text
canonical_works
  id
  title_normalized
  primary_title
  primary_authors
  language
  created_at
  updated_at

canonical_editions
  id
  work_id
  isbn_10
  isbn_13
  title
  subtitle
  authors
  publisher
  published_date
  language
  cover_url
  page_count
  categories
  created_at
  updated_at

book_metadata_sources
  id
  canonical_edition_id nullable
  provider
  provider_book_id
  raw_payload jsonb
  normalized_payload jsonb
  confidence
  fetched_at

store_inventory
  id
  store_id
  canonical_edition_id nullable
  source_book_id nullable
  title
  authors
  isbn_10
  isbn_13
  condition
  condition_notes
  quantity_available
  quantity_reserved
  selling_price_inr
  acquisition_cost_inr
  shelf_location
  internal_notes
  public_notes
  photos
  visibility_status
  listing_quality_status
  entry_method
  extraction_session_id nullable
  created_at
  updated_at

marketplace_book_listings
  id
  inventory_id
  store_id
  canonical_edition_id nullable
  public_title
  public_authors
  public_cover_url
  condition
  selling_price_inr
  availability_status
  fulfillment_options
  status
  moderation_status
  risk_flags
  published_at
  updated_at

listing_moderation_flags
  id
  listing_id
  store_id
  flag_type
  severity
  status
  notes private
  created_at
  updated_at
```

---

## 15. Security and Privacy Notes

- Consumer search reads `marketplace_book_listings`, not raw `store_inventory`.
- Store Owners can read/write only inventory for their own store.
- Platform operators can moderate listings through internal tools.
- Acquisition cost, shelf location, and internal notes are private.
- Image extraction raw payloads are private.
- Public listing images must use storage policies that do not allow broad bucket listing.
- Moderation notes and risk flags are private unless platform policy explicitly exposes a customer-facing explanation.

---

## 16. MVP Acceptance Criteria

| ID | Criterion |
|---|---|
| INV-01 | Store Owner can create inventory without publishing it. |
| INV-02 | Store Owner can publish only inventory with required public fields. |
| INV-03 | Consumer search reads public listing projection only. |
| INV-04 | Same ISBN across multiple stores groups under one consumer book result. |
| INV-05 | Same ISBN within one store suggests merge/increment flow. |
| INV-06 | Low-confidence metadata match requires owner confirmation. |
| INV-07 | Inventory supports `new`, `like_new`, `good`, `fair`, `damaged`. |
| INV-08 | Private fields are not exposed in public listing responses. |
| INV-09 | Suspended, blocked, counterfeit, or prohibited listings are excluded from consumer discovery. |

---

## 17. Deferred Items

- full work-level canonicalization for all books
- customer-facing exact quantity
- public reliability score
- dedicated external search engine
- automated canonical merge without review
- full image request workflow before order

---

## 18. Related Documents

- [README](./README.md)
- [DOC-0: Product Architecture](./DOC-0-product-architecture.md)
- [DOC-1: Identity, Security, and Compliance](./DOC-1-identity-security-compliance.md)
- [DOC-4: Image-to-LLM Inventory Workflow](./DOC-4-image-to-llm-inventory-workflow.md)
- [DOC-5: Consumer Marketplace and Discovery](./DOC-5-consumer-marketplace-discovery.md)
- [DOC-6: Cart, Order Request, and Payment](./DOC-6-cart-order-request-payment.md)
