# DOC-0: Product Architecture

**Product:** BookConnect
**Spec Suite:** Multi-Tenant Bookstore Marketplace
**Version:** 0.2
**Date:** 2026-05-22
**Status:** Planning draft
**Depends On:** README
**Owns:** Marketplace model, product surfaces, core loop, domain boundaries, MVP structure.

---

## 1. Purpose

This document defines the top-level product architecture for the BookConnect multi-tenant bookstore marketplace.

The marketplace is not an extension of the existing peer-to-peer exchange model. It is a separate multi-tenant commerce system in which verified bookstores sell inventory through BookConnect, customers discover and order books inside the consumer app, and BookConnect facilitates payment, delivery, platform operations, and weekly settlement.

This document is the parent specification for all other documents in this folder.

---

## 2. Product Thesis

BookConnect should become a local bookstore marketplace with a professional Store Owner surface.

The unique wedge is inventory digitization for small and second-hand bookstores:

- stores often have valuable offline inventory that is not searchable
- manual cataloging is slow
- image-to-LLM extraction can rapidly identify book titles from shelf/spine/cover photos
- metadata enrichment turns raw scanned books into searchable marketplace listings
- consumer search creates demand and orders
- orders and subscriptions make the store owner tooling commercially valuable

The product should be planned around this loop:

```text
Bookstore joins BookConnect
  -> store is verified
  -> owner digitizes inventory
  -> inventory maps to canonical books and public listings
  -> consumers search and order from local stores
  -> store confirms availability
  -> customer pays
  -> pickup or delivery is fulfilled
  -> store receives weekly settlement
  -> BookConnect earns subscription and commission revenue
```

---

## 3. Product Surfaces

### 3.1 Consumer App Surface

The consumer marketplace lives inside the existing BookConnect mobile app as a new section. It is not a separate consumer app.

Consumer capabilities:

- search books across verified bookstore inventory
- see all nearby stores that have a book available
- compare price, condition, availability, store location, and fulfillment options
- view public bookstore profiles
- add books from one store to cart
- place an order request
- pay after store confirmation
- choose pickup or delivery where available
- receive order, payment, and delivery notifications
- subscribe to availability alerts for unavailable books

### 3.2 Store Owner Product Surface

The Store Owner surface is separate from the consumer tabs and has its own access gate, onboarding states, dashboard, and operational navigation.

Store Owner entry points:

| Entry Point | User State | Behavior |
|---|---|---|
| Login / first-run auth screen | New or unauthenticated user | Show a clear Store Owner option that routes to store-owner login/signup intent and then the Store Owner gate. |
| Profile section | Existing signed-in consumer | Show a Store Owner Console / Apply as Bookstore option that routes to the Store Owner gate. |
| Deep link / notification | Existing signed-in user | Route through the Store Owner gate before rendering any Store Owner screen. |

The entry point selection is only navigation intent. It must not grant seller access. The same Supabase user account can be both a consumer and a Store Owner, but Store Owner access is always resolved from verified ownership/onboarding records.

Store Owner capabilities:

- apply to become a seller
- manage store profile, location, hours, pickup/delivery settings, return policy
- view subscription plan, entitlements, OCR quota, and upgrade prompts
- digitize inventory through image-to-LLM extraction
- add books manually
- manage inventory, quantities, prices, conditions, and visibility
- manage order requests and partial availability
- prepare orders for pickup or delivery
- manage basic storefront marketing controls
- view basic performance and reliability indicators

### 3.3 Platform Operations Surface

BookConnect needs an internal operations/admin surface. This is separate from Store Owner access.

Platform operations capabilities:

- review and approve seller applications
- verify seller documents and payout accounts
- suspend stores or listings
- operate customer support and dispute intake
- manage disputes, refunds, delivery failures, and support tickets
- override order states where policy allows
- manage subscription plans and entitlements
- monitor marketplace health, fraud, and reliability
- manage delivery provider integrations and exceptions

---

## 4. Roles

| Role | Description | Primary Surface |
|---|---|---|
| Consumer | Searches and orders books from bookstores. | Consumer app |
| Store Owner | Owns and operates a verified bookstore on BookConnect. | Store Owner surface |
| Store Staff | Future delegated operator for store tasks. Deferred from MVP. | Future Store Staff surface |
| Platform Operator | BookConnect internal operations user. | Platform operations surface |
| Delivery Partner | Third-party logistics provider, accessed through backend integration. | Backend only |

Store Staff / manager delegation is deferred. The MVP Store Owner surface only supports the verified owner/operator.

---

## 5. Marketplace Domain Separation

### 5.1 Existing Domain

The live Supabase schema currently supports:

- consumer profiles and personal libraries
- P2P book listings
- P2P transactions
- venues and clubs
- club discussions and events

These are useful adjacent systems, but they do not model bookstore commerce.

### 5.2 New Store Marketplace Domain

The bookstore marketplace requires new domain entities:

- stores
- store owner/admin membership
- seller verification
- store subscription and entitlements
- store inventory
- marketplace public listing projection
- order request and partial availability
- payment intent/order
- third-party delivery shipment
- settlement ledger
- platform support/dispute records
- image extraction sessions

### 5.3 Do Not Reuse P2P Commerce Tables Directly

The current `listings` and `transactions` tables should not be reused for bookstore commerce.

Reasons:

- P2P uses borrower/lender semantics; bookstore commerce uses customer/seller/platform semantics.
- P2P listing ownership is tied to a user profile; bookstore inventory is tied to a store tenant.
- P2P transaction statuses do not model store confirmation, payment after confirmation, partial availability, settlement, delivery exceptions, or store payouts.
- P2P RLS policies are user-centric; bookstore policies must be store/tenant-centric.

Existing P2P services can inform design patterns, but bookstore marketplace tables and services must be separate.

---

## 6. Core Domain Map

```text
Identity and Tenant
  stores
  store_administrators
  store_verification_requests

Subscription and Entitlements
  store_subscription_plans
  store_subscriptions
  store_entitlements
  store_usage_counters

Book and Inventory
  canonical_books
  canonical_book_editions
  book_metadata_sources
  store_inventory
  marketplace_book_listings

Inventory Digitization
  image_extraction_sessions
  image_extraction_candidates
  metadata_enrichment_attempts
  duplicate_resolution_events

Marketplace Discovery
  public store profiles
  book search index
  availability alerts
  unavailable search demand signals

Commerce
  carts
  order_requests
  order_request_items
  store_orders
  store_order_items
  payments
  refunds

Fulfillment
  delivery_quotes
  delivery_shipments
  delivery_status_events
  pickup_events

Finance
  platform_commissions
  store_settlements
  settlement_line_items
  seller_payout_accounts

Operations
  support_cases
  dispute_events
  moderation_reviews
  audit_logs

Finance and Strategy
  finance_ledger_entries
  settlement_batches
  seller_statements
  pilot_metrics
  unit_economics_snapshots
```

Exact table names may change during implementation planning, but the domain boundaries should not.

---

## 7. Marketplace Core Loop

### 7.1 Supply Creation

Store owners create supply by:

- completing seller onboarding
- adding store location and hours
- scanning book images
- manually adding books
- confirming price, condition, quantity, and visibility

### 7.2 Supply Normalization

Each inventory item is matched to canonical book data:

- exact ISBN-13 match if available
- ISBN-10 normalized to ISBN-13 if possible
- provider IDs recorded as source references
- fuzzy title/author match used only for suggestions
- ambiguous matches require owner/admin confirmation

### 7.3 Public Discovery

Consumer search should show canonical book results first, with store availability nested under each result.

Example:

```text
Atomic Habits
  Available at:
    Store A - good - Rs. 240 - 2.1 km - delivery/pickup
    Store B - like_new - Rs. 310 - 5.8 km - pickup
```

The consumer should not see raw store inventory internals like shelf location, store acquisition cost, OCR confidence, internal notes, or duplicate resolution metadata.

### 7.4 Commerce

The MVP order flow is:

```text
single-store cart
  -> order request
  -> store confirms full or partial availability
  -> customer accepts confirmed items and pays
  -> store prepares order
  -> pickup or delivery fulfillment
  -> delivered/completed
  -> weekly settlement
```

Store confirmation before payment is a core product decision because used-book inventory can become stale through offline sales.

---

## 8. MVP Scope

### 8.1 MVP Must Include

- Store Owner onboarding and verification request
- store profile, address, geolocation, hours, pickup/delivery settings
- subscription and entitlement foundation
- image-to-LLM inventory workflow
- manual book entry
- inventory CRUD and public visibility controls
- canonical book/edition matching
- consumer marketplace search
- store availability display
- single-store cart
- order request with partial availability
- store confirmation before payment
- customer payment after confirmation
- pickup option
- delivery-ready architecture and provider adapter
- Store Owner order management
- weekly settlement ledger foundation
- commerce state-machine transition service
- customer support and dispute path operated by BookConnect
- live payment support only after finance/legal/provider gates pass
- internal platform operations hooks for support

### 8.2 MVP Should Defer

- multi-store cart
- COD
- automated multi-provider delivery optimization
- store manager delegation
- community showcase
- advanced analytics and exports
- customer-visible reliability score
- full bookclub management from Store Owner console
- enterprise multi-branch tooling
- minors/school-user-specific flows for pilot

---

## 9. Store Confirmation Model

Store confirmation is required before payment capture.

Rationale:

- second-hand bookstore inventory may sell offline
- quantity can become stale
- edition/condition may need human confirmation
- payment-first flow creates avoidable refunds and support load

MVP behavior:

- confirmation timer runs during store open hours only
- target confirmation window is 6 hours to 1 business day
- faster confirmation improves internal store reliability score
- store may confirm all items, confirm some items, or reject all items
- customer pays only for confirmed items
- unconfirmed or rejected items can feed demand signals and availability alerts

Future option:

- payment authorization hold before store confirmation, then capture after confirmation

This is deferred until payment provider support and refund/capture behavior are fully validated.

---

## 10. Subscription and Commission Model

BookConnect monetization is hybrid:

- subscription for bookstore management tools, inventory limits, OCR quotas, analytics, and storefront controls
- small commission on completed book orders

Initial pilot monetization should be lower-friction:

- Founding Store Program for early Bangalore stores
- free or discounted subscription trial for 3 to 6 months
- limited free image-to-LLM credits
- commission on completed paid orders
- paid subscription upgrade only after stores see operational value

The Store Owner can see and manage their own plan and limits. They cannot access platform-wide subscription management.

Platform operators manage:

- plan definitions
- pricing
- commission rules
- billing disputes
- manual overrides
- store suspension for non-payment

---

## 11. Delivery Model

BookConnect facilitates delivery through third-party partners.

MVP principles:

- pickup is always supported when the store enables it
- delivery serviceability and estimated quote are checked before payment
- final delivery assignment happens after payment and store readiness
- delivery integrations must use provider adapters
- delivery provider webhooks are processed server-side
- delivery exceptions must be modeled explicitly

Delivery partners are replaceable infrastructure, not part of core domain logic.

---

## 12. Bookclub and Place Association

The marketplace should preserve a lightweight path into the broader BookConnect bookclub/place ecosystem.

MVP or early post-MVP capabilities:

- store can mark interest in hosting bookclubs
- store can associate with cafe/library/park/venue
- consumer app can show book-friendly places near the user
- platform can later connect stores to bookclub workflows

Full Store Owner community showcase and club management are deferred.

---

## 13. Architecture Principles

1. Store tenant boundaries must be explicit in data models, RLS, services, and UI.
2. Store Owner and consumer flows should share data through controlled public projections, not raw private inventory.
3. Privileged commerce actions should use backend-controlled transitions, not direct unrestricted client updates.
4. Payment and delivery provider details should be isolated behind adapters.
5. Store confirmation before payment is the default risk-control mechanism.
6. Public listing quality matters: condition, price, metadata confidence, and photos shape trust.
7. Existing P2P tables may inform patterns, but should not become the bookstore marketplace schema.
8. Internal operations tooling is required for any real marketplace, even if minimal at MVP.
9. Payments, refunds, commission, delivery adjustments, and store settlement must be ledger-first.
10. Marketplace policies must be configurable, not hardcoded into UI screens or mobile clients.
11. Feature flags and locality/store allowlists are required for staged rollout.
12. India compliance, tax, payment-aggregator, and delivery-aggregator assumptions require legal/accounting/provider review before payment launch.
13. Bookstores are seller of record unless legal/accounting/provider review changes the model.
14. BookConnect operates customer support, dispute intake, refund review, and platform escalation.
15. Bangalore pilot is locality-gated; minors/school users are not targeted in pilot.

---

## 14. Cross-Cutting Operating Guardrails

The following systems must be designed before broad feature implementation:

| Guardrail | Why It Matters |
|---|---|
| Policy engine | Confirmation windows, payment expiry, delivery minimums, commission rates, quotas, return windows, and suspension thresholds will change over time. |
| Ledger-first finance | Weekly settlement, refunds, delivery fee adjustments, commission reversals, tax/TCS fields, and manual adjustments cannot be reliably reconstructed from simple payment status fields. |
| Delivery provider adapter | Shiprocket, Shipmozo, NimbusPost, or any later provider will expose different APIs and states; BookConnect needs normalized shipment states. |
| Feature flags | Store onboarding, payments, delivery, image extraction, alerts, and locality rollout must be controlled independently. |
| Trust metrics | Store confirmation speed, unavailable-after-upload rate, seller cancellations, delivery exceptions, and refund rates must be collected internally from day one. |
| Evidence retention | Order snapshots, return policy snapshots, payment webhooks, delivery webhooks, condition photos, and dispute evidence must be retained according to policy. |
| Platform ops tooling | Store approval, suspension, refunds, delivery exceptions, disputes, and settlements require internal tooling before payment launch. |
| Commerce state machines | Order requests, payments, refunds, delivery, and settlement need actor-guarded transitions before feature coding. |
| Pilot economics | Store adoption, liquidity, support load, and unit economics must be measured before broad rollout. |

---

## 15. Open Implementation Risks

| Risk | Planning Response |
|---|---|
| Existing DB has no store marketplace schema | Create separate bookstore domain tables and migrations. |
| Existing security advisors show broad privileged access patterns | Avoid public `SECURITY DEFINER` functions for new marketplace actions. |
| Used inventory may be stale | Require store confirmation before payment. |
| Delivery partner coverage can vary by city | Use provider adapter and serviceability checks. |
| Book identity can be ambiguous | Use ISBN priority and require confirmation for fuzzy matches. |
| Store onboarding can admit bad sellers | Require verification, seller agreement, and platform review. |
| Payment/settlement can become complex | Model ledger and weekly settlement from the start. |
| Customer PII exposure risk | Keep public listing projection separate from private order data. |
| India marketplace compliance may affect seller onboarding and checkout copy | Treat compliance review as a launch gate before payments. |
| Delivery aggregators can create NDR/RTO and billing disputes | Model delivery exception states and provider reconciliation early. |
| Hardcoded policy rules can block business iteration | Centralize platform-configurable policy values. |

---

## 16. Related Documents

- [README](./README.md)
- [DOC-1: Identity, Security, and Compliance](./DOC-1-identity-security-compliance.md)
- [DOC-2: Store Onboarding, Verification, and Subscriptions](./DOC-2-store-onboarding-verification-subscriptions.md)
- [DOC-3: Canonical Books, Metadata, and Inventory](./DOC-3-canonical-books-metadata-inventory.md)
- [DOC-6: Cart, Order Request, and Payment](./DOC-6-cart-order-request-payment.md)
- [DOC-7: Fulfillment and Delivery](./DOC-7-fulfillment-delivery.md)
- [DOC-12: Build Strategy and Implementation Sequence](./DOC-12-build-strategy-and-implementation-sequence.md)
- [DOC-14: Commerce State Machines](./DOC-14-commerce-state-machines.md)
- [DOC-15: Finance, Tax, and Settlement Operating Model](./DOC-15-finance-tax-settlement-operating-model.md)
- [DOC-16: Pilot and Unit Economics](./DOC-16-pilot-and-unit-economics.md)
