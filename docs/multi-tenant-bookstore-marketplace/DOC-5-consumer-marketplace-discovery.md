# DOC-5: Consumer Marketplace and Discovery

**Product:** BookConnect
**Spec Suite:** Multi-Tenant Bookstore Marketplace
**Version:** 0.3
**Date:** 2026-07-19
**Status:** Planning draft
**Depends On:** DOC-0, DOC-1, DOC-2, DOC-3
**Owns:** Consumer-facing bookstore discovery, book search, store availability comparison, public store pages, marketplace entry points, search ranking, and listing visibility.

---

## 1. Purpose

This document defines how customers discover books and bookstores in the existing BookConnect consumer app.

The consumer marketplace is not a separate app. It is a new consumer section inside the current BookConnect app where users can search for books uploaded by verified bookstores, compare availability across stores, and start a single-store cart flow.

The discovery layer must make one thing clear: listed stock is visible because the store has uploaded inventory, but the order is not final until the store confirms availability.

---

## 2. Product Positioning

The marketplace should feel like:

- search across local bookstore inventory
- discover stores near the user
- compare price, condition, distance, pickup availability, and delivery availability
- place direct orders through BookConnect
- support independent bookstores without making them operate a full ecommerce stack

It should not feel like:

- a peer-to-peer borrowing exchange
- a generic ecommerce catalog owned by BookConnect
- a platform-wide warehouse inventory system
- a bookclub-only feature

---

## 3. Consumer Entry Points

Recommended entry points:

| Entry Point | Behavior |
|---|---|
| Marketplace tab or section | Primary bookstore marketplace home. |
| Global app search | Shows bookstore results alongside existing app results, clearly grouped. |
| Book detail page | Shows nearby stores with available copies of that edition or related editions. |
| Store profile page | Shows public store identity, hours, location, policies, and available books. |
| Nearby map/list | Shows bookstores and book-friendly places near the user. |
| Unavailable search result | Allows user to create an availability alert or request. |

MVP should include the Marketplace section, marketplace search, store profile pages, and book detail availability. Nearby book-friendly places can be lightweight in MVP and expanded through DOC-11.

The Profile section may also expose a Store Owner Console / Apply as Bookstore entry for signed-in users. That entry is an account/product-surface switch, not a consumer marketplace discovery feature, and it must route through the Store Owner gate defined in DOC-1 and DOC-8.

---

## 4. Discovery Surfaces

### 4.1 Marketplace Home

The marketplace home should include:

- search bar for title, author, ISBN, or store name
- bookstore-first nearby/eligible store results
- recently added books
- popular categories
- pickup-friendly stores
- delivery-eligible stores
- empty-state path for unavailable books

### 4.2 Search Results

Search results should support two primary result types:

| Result Type | Meaning |
|---|---|
| Book-matched bookstore | A distinct eligible bookstore carrying a matched book/edition, with matching-offer summary. |
| Store-name result | A verified bookstore matching the store-name or location intent. |

Canonical book/edition matching resolves a title/author/ISBN/original-script/approved-alias query, but the primary presentation is bookstore-first. Return every eligible matching store once through correct store-level pagination, not an arbitrary top-three subset.

### 4.3 Public Storefront

Each verified active store should have a public storefront with:

- store name
- address or approximate location
- opening hours
- pickup availability
- delivery availability
- return policy summary
- confirmation speed expectation
- active listings
- store categories or specialties
- optional bookclub/place hosting interest

The storefront must not expose private shelf location, internal inventory notes, acquisition cost, or owner contact details not approved for public display.

When opened from a book search, the storefront highlights/pins the matched book and still provides its complete active public catalogue and distinct public title count. The customer can clear the search to browse all books.

---

## 5. Book Availability Display

For a book result, the customer should see store-level availability options:

| Field | Public Behavior |
|---|---|
| Store name | Visible. |
| Distance | Visible if user location is available. |
| Price | Visible. |
| Condition | Visible using standard condition values. |
| Quantity | Do not over-emphasize exact count for used books; show available/limited instead. |
| Pickup | Visible when enabled by store. |
| Delivery | Visible when enabled and serviceable. |
| Confirmation requirement | Always visible before checkout. |
| Return policy | Visible before payment. |

Recommended customer copy:

```text
Availability is confirmed by the bookstore before payment.
```

This avoids taking payment for stale used-book inventory while still allowing direct ordering.

---

## 6. Search Modes

Search should support:

- exact ISBN
- original-script title
- original-script author
- title plus author
- approved transliteration/translation/common-spelling aliases
- language
- category
- store name
- nearby stores
- condition filter
- price range
- pickup/delivery filter

MVP search priority:

1. exact ISBN match
2. exact canonical edition match
3. strong title plus author match
4. title-only match
5. fuzzy title match
6. store name match

Search must use the canonical book model from DOC-3 to resolve editions without merging store inventory. An alias hit displays the original authoritative title/author. Different-language editions remain separate.

---

## 7. Ranking Rules

Ranking should optimize for customer usefulness, not only commercial outcomes.

Recommended ranking factors:

- exactness of book match
- available published listings
- store open status or next opening time
- pickup availability
- delivery serviceability
- distance from customer
- price
- condition quality
- recency of inventory confirmation
- store verification status
- historical cancellation/confirmation rate, initially internal only

Customer-visible reliability scores are deferred from MVP. The system may still use reliability internally for ranking once enough data exists.

Paid boosts or sponsored ranking must not be introduced without a clear sponsored label.

---

## 8. Location Behavior

Location is important but should not block discovery.

If user location is available:

- show nearby stores first
- estimate pickup distance
- check delivery serviceability
- allow map/list toggle if map UI is available

If user location is unavailable:

- allow city/locality search
- show popular stores or stores matching the query
- ask for location only when needed for distance or delivery quote

Location permission should be contextual, not requested at app launch.

---

## 9. Single-Store Cart Boundary

MVP uses one cart tied to one store.

When a customer adds an item from Store B while the cart contains Store A items:

1. show a confirmation prompt
2. explain that the current cart will be replaced
3. clear Store A cart only after customer confirms
4. add Store B item to the new cart

The discovery UI should reduce accidental cross-store cart replacement by grouping options clearly by store.

Multi-store cart is deferred because it requires split confirmation, split delivery, split payment, and split settlement.

---

## 10. Used-Book Images and Condition Confidence

Customer-visible behavior:

- show a validated metadata/provider cover first
- use an approved public actual-copy image as fallback when the cover is absent, then a placeholder
- show approved public damage/copy photos as a gallery/evidence
- label damage separately from the five base conditions and show the required public damage note
- allow a customer to request 1-3 new private current-copy photos for an unpaid request item
- once requested, the item cannot be confirmed/payment-ready until the store provides the photos and the customer accepts them; if the store cannot provide them, the item is unavailable for that request

Scan inputs and private request photos never appear in public discovery.

### 10.1 Count Definitions

- `bookstore_count`: distinct eligible stores carrying the matched edition.
- `offer_count`: distinct public price/condition/damage offers.
- `title_count`: distinct active public editions/titles in one storefront.

Exact physical inventory quantity remains private.

---

## 11. Store Eligibility for Discovery

A store appears in consumer discovery only when:

- verification status is `approved`
- store status is `active`
- subscription allows public listing
- store has at least one active published listing, or has a public profile enabled
- store has not been suspended by platform operations

A listing appears in consumer discovery only when:

- listing status is `active`
- available quantity is greater than zero
- linked store is discoverable
- price is present and valid
- condition is valid
- book is not blocked by moderation

---

## 12. Consumer-Facing Marketplace Disclosures

Before a customer submits an order request or pays, the consumer app must show enough marketplace information to support trust and India e-commerce compliance review.

Required customer-visible information:

- seller/store name
- store location or service area as appropriate
- fulfillment mode: pickup or delivery
- return/refund/cancellation policy
- delivery policy and estimated fees/timing
- condition and public condition notes for used books
- clear statement that BookConnect facilitates the marketplace and the bookstore sells/fulfills the books
- customer support/grievance path through BookConnect
- confirmation-before-payment explanation

The UI must avoid dark patterns around cart replacement, delivery fees, partial availability, returns, or payment timing.

---

## 13. Data Model

```text
marketplace_book_listings
  id
  store_id
  store_inventory_id
  canonical_work_id
  canonical_edition_id
  title
  authors
  isbn_10
  isbn_13
  cover_url
  condition
  public_condition_notes
  price_minor
  available_quantity
  listing_status
  pickup_available
  delivery_available
  metadata_quality_score
  listing_quality_score
  last_inventory_confirmed_at
  created_at
  updated_at

marketplace_search_events
  id
  user_id nullable
  query
  normalized_query
  result_count
  selected_listing_id nullable
  selected_store_id nullable
  location_context nullable
  created_at

customer_book_alerts
  id
  user_id
  canonical_work_id nullable
  canonical_edition_id nullable
  query_text
  preferred_location nullable
  max_distance_km nullable
  status
  created_at
  updated_at
```

`marketplace_search_events` should be treated as product analytics and must not store unnecessary personal data.

---

## 14. Security and Privacy

- Public listing queries must only return active listings from discoverable stores.
- Store private inventory fields must not be exposed in consumer APIs.
- Shelf/location is private to store operators.
- Acquisition cost is private.
- Internal store verification documents are never exposed.
- Customer search logs must not include precise location unless needed and consented.
- Consumer location permission must be contextual.
- Store owner contact details are hidden unless explicitly part of the public store profile.
- Customer-facing disclosures must not expose private seller documents, payout information, or internal risk/moderation notes.

---

## 15. MVP Acceptance Criteria

| ID | Criterion |
|---|---|
| DISC-01 | Customer can search marketplace books by title, author, and ISBN. |
| DISC-02 | Search groups copies of the same book across bookstores using canonical metadata. |
| DISC-03 | Customer can see which stores have a book available, including price, condition, pickup, and delivery eligibility. |
| DISC-04 | Public pages clearly state that bookstore confirmation happens before payment. |
| DISC-05 | Adding from a second store prompts cart replacement before changing the cart. |
| DISC-06 | Private inventory fields are not exposed in consumer discovery responses. |
| DISC-07 | Suspended or unverified stores do not appear in marketplace discovery. |
| DISC-08 | Location permission is requested only when needed for nearby or delivery behavior. |
| DISC-09 | Customer sees seller/store, policy, support/grievance, and confirmation-before-payment disclosures before payment. |
| DISC-10 | Book search returns every eligible matching bookstore once and selecting it opens the complete active public catalogue. |
| DISC-11 | Original-script and approved alias searches preserve authoritative original-language display. |
| DISC-12 | Bookstore, offer, and title counts have distinct definitions; exact physical quantity remains private. |
| DISC-13 | Scan and private request media are absent from public responses. |

---

## 16. Deferred Items

- multi-store cart
- customer-visible reliability scores
- sponsored ranking
- advanced map-first browsing
- automated customer negotiation with stores
- social discovery around store followers
- full bookclub/store community showcase
- minors/school-user-specific marketplace flows for pilot

---

## 17. Related Documents

- [DOC-0: Product Architecture](./DOC-0-product-architecture.md)
- [DOC-3: Canonical Books, Metadata, and Inventory](./DOC-3-canonical-books-metadata-inventory.md)
- [DOC-6: Cart, Order Request, and Payment](./DOC-6-cart-order-request-payment.md)
- [DOC-7: Fulfillment and Delivery](./DOC-7-fulfillment-delivery.md)
- [DOC-11: Demand Signals, Bookclubs, and Places](./DOC-11-demand-signals-bookclubs-places.md)
- [DOC-16: Pilot and Unit Economics](./DOC-16-pilot-and-unit-economics.md)
