# DOC-11: Demand Signals, Bookclubs, and Places

**Product:** BookConnect
**Spec Suite:** Multi-Tenant Bookstore Marketplace
**Version:** 0.1
**Date:** 2026-05-19
**Status:** Planning draft
**Depends On:** DOC-0, DOC-1, DOC-3, DOC-5, DOC-8, DOC-10
**Owns:** Unavailable-book demand capture, customer alerts, store demand insights, bookclub hosting interest, bookstore/place association, and book-friendly places discovery.

---

## 1. Purpose

This document defines the marketplace growth layer around demand signals and places.

The core marketplace helps customers find books that stores already uploaded. The demand layer helps BookConnect learn what customers want when no store currently has the book, and helps bookstores understand what to stock next.

The places layer connects bookstores with bookclubs, cafes, libraries, parks, and other book-friendly places without turning the Store Owner console into full bookclub management.

---

## 2. Product Thesis

The asymmetric advantage is not only "bookstores can sell online."

The stronger loop is:

```text
Customers search for books
  -> unavailable searches become demand signals
  -> stores learn what nearby readers want
  -> stores source/upload those books
  -> customers are alerted
  -> orders create revenue
  -> bookstores become stronger local book hubs
```

This connects inventory, marketplace search, local discovery, and bookclubs into one system.

---

## 3. Demand Signal Types

| Signal | Source | Store Visibility |
|---|---|---|
| Search with no results | Customer marketplace search. | Aggregated only. |
| Search with results but no order | Customer marketplace search. | Aggregated only. |
| Customer availability alert | Customer asks to be notified. | Aggregated unless customer sends explicit request. |
| Book availability request | Customer sends store-specific request. | Visible to target store. |
| Bookclub reading interest | Bookclub nominations or reading activity. | Aggregated by area/category where permitted. |
| Wishlist/save | Customer saves wanted book. | Aggregated only. |

Stores should not receive customer identity for passive demand signals.

---

## 4. Unavailable Search Flow

When a customer searches for a book with no available store listing:

1. show useful empty result state
2. capture normalized query as demand signal
3. offer "notify me when available"
4. optionally show nearby bookstores that may accept requests
5. optionally allow customer to send a store-specific availability request

The empty state should not feel like a dead end. It should become a demand-generation moment.

---

## 5. Customer Alerts

Customer can create an alert for:

- exact ISBN
- title plus author
- canonical work
- canonical edition
- category near a location

Alert matching occurs when:

- a new listing is published
- an existing listing becomes available again
- a store confirms they can source the book
- a bookclub/place event creates relevant availability in the future

Alert notification must deep link to the marketplace result, not directly reserve inventory.

---

## 6. Store Demand Dashboard

Store owners should see demand that helps them stock intelligently.

MVP store demand insights:

- top searched unavailable books near store
- alerts created for books/categories near store
- requested books sent directly to store
- customer demand by category
- recently fulfilled demand signals

Privacy rules:

- aggregate passive demand signals
- apply minimum count threshold before display
- do not show exact customer identity unless customer sent a direct request
- do not expose cross-store competitive analytics
- rate-limit repeated demand signals from the same user/device/query
- suppress abusive, spammy, or policy-violating request text from store dashboards

Demand insights should suggest opportunity, not guarantee demand.

---

## 7. Store-Specific Book Requests

Customer may ask a specific store whether it can source or upload a book.

Request fields:

- target store
- book title
- author
- ISBN if available
- customer note
- preferred condition
- pickup/delivery preference

Store response options:

- available now
- can source soon
- cannot source
- request more details

If store later publishes a matching listing, customer can be notified.

This is separate from paid order requests. It is a pre-commerce demand workflow.

Abuse prevention:

- customer request rate limits per store and per query
- duplicate request coalescing
- moderation for abusive or personal-data-heavy request messages
- platform ability to block a customer from sending sourcing requests after abuse
- store ability to report abusive requests to platform support

---

## 8. Bookclub Hosting Interest

Stores can mark whether they are interested in associating with bookclubs.

Store owner settings:

- interested in hosting bookclubs
- can host in-store
- can partner with nearby cafe/library/park
- preferred event capacity
- available days/times
- genres or communities of interest
- contact path through BookConnect

This does not mean the store manages bookclubs from the Store Owner console in MVP. It only captures interest and makes the store discoverable as a potential bookclub partner.

---

## 9. Book-Friendly Places

The consumer app can show book-friendly places near the user:

- bookstores
- cafes
- libraries
- parks
- reading rooms
- event venues

Place association types:

| Type | Meaning |
|---|---|
| `store_location` | The bookstore itself. |
| `partner_cafe` | Cafe associated with store/bookclub activity. |
| `library` | Library suitable for reading/bookclub activity. |
| `park` | Public reading/bookclub-friendly place. |
| `venue` | General event venue. |

Existing database concepts such as `venues`, `book_clubs`, and `club_venues` may be reused later, but marketplace store/place association should be scoped and reviewed before connecting to full bookclub data.

---

## 10. Consumer Place Discovery

Consumer-facing place discovery should support:

- nearby book-friendly places
- store-associated places
- bookclub-friendly filters
- opening hours where available
- map/list view
- links to store storefront where relevant
- links to bookclub features where relevant

MVP can start as a list/map of bookstores and associated places. Full events and bookclub operations can come later.

---

## 11. Matching Logic

Demand-to-listing matching should use canonical book identity where possible.

Priority:

1. ISBN match
2. canonical edition match
3. canonical work match
4. normalized title plus author
5. normalized title only with manual review or low-confidence label

A customer alert should not fire on weak title-only matches unless the result is clearly presented as a possible match.

---

## 12. Data Model

```text
book_demand_signals
  id
  user_id nullable
  signal_type
  query_text
  normalized_query
  canonical_work_id nullable
  canonical_edition_id nullable
  isbn_10 nullable
  isbn_13 nullable
  location_context nullable
  source
  dedupe_key
  moderation_status
  created_at

customer_book_alerts
  id
  user_id
  canonical_work_id nullable
  canonical_edition_id nullable
  query_text
  preferred_condition nullable
  preferred_location nullable
  max_distance_km nullable
  status
  last_matched_at nullable
  created_at
  updated_at

store_book_sourcing_requests
  id
  user_id
  store_id
  query_text
  canonical_work_id nullable
  canonical_edition_id nullable
  preferred_condition nullable
  customer_note nullable
  status
  store_response nullable
  moderation_status
  dedupe_key
  created_at
  updated_at

store_bookclub_preferences
  id
  store_id
  interested
  can_host_in_store
  can_partner_with_places
  capacity nullable
  preferred_days nullable
  preferred_genres nullable
  notes private
  created_at
  updated_at

book_friendly_places
  id
  name
  place_type
  address
  geo_point
  public_description nullable
  created_by nullable
  verification_status
  created_at
  updated_at

store_place_associations
  id
  store_id
  place_id
  association_type
  status
  notes private
  created_at
  updated_at
```

---

## 13. Security and Privacy

- Passive demand signals are aggregated before store display.
- Store dashboards must not expose individual customer identity for searches, alerts, or wishlists.
- Direct store requests may show customer display/contact details only as required for response.
- Location context should be coarse unless precise location is needed and consented.
- Bookclub data must not leak cross-club or cross-store private information.
- Store/place associations require platform moderation if public.
- Customer alerts must be user-owned and removable.
- Store-specific requests must be rate-limited and moderated before exposing harmful content to stores.
- Demand dashboards must use aggregation thresholds so a store cannot infer a single customer's search behavior.

---

## 14. MVP Acceptance Criteria

| ID | Criterion |
|---|---|
| DEM-01 | Unavailable marketplace searches create demand signals. |
| DEM-02 | Customer can create an alert for a wanted book. |
| DEM-03 | New matching listing can trigger customer alert. |
| DEM-04 | Store owner can see aggregated demand insights without customer identity leakage. |
| DEM-05 | Customer can send a store-specific sourcing request. |
| DEM-06 | Store can respond to store-specific sourcing request. |
| DEM-07 | Store can mark interest in hosting or partnering with bookclubs. |
| DEM-08 | Consumer app can show bookstore/place associations in a lightweight book-friendly places surface. |
| DEM-09 | Demand signals and sourcing requests are rate-limited, deduplicated, and moderated for abuse. |

---

## 15. Deferred Items

- full bookclub management in Store Owner console
- event ticketing
- venue booking workflow
- customer-visible demand counts
- automated store sourcing recommendations
- predictive procurement
- paid promotion based on demand signals
- cross-store competitive dashboards

---

## 16. Related Documents

- [DOC-3: Canonical Books, Metadata, and Inventory](./DOC-3-canonical-books-metadata-inventory.md)
- [DOC-5: Consumer Marketplace and Discovery](./DOC-5-consumer-marketplace-discovery.md)
- [DOC-8: Store Owner Console](./DOC-8-store-owner-console.md)
- [DOC-10: Notifications, Events, and Realtime](./DOC-10-notifications-events-realtime.md)
