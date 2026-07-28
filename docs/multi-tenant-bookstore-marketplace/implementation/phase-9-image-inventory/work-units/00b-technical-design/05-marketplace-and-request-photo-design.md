# WU0B Marketplace and Customer Request-Photo Design

**Status:** `independently_approved`
**Commerce boundary:** pre-payment Phase 6 seams only; Phase 7/8 excluded

## 1. Two-stage marketplace query

Q07 is a service-internal matching stage. It normalizes bounded query/filter context, searches eligible edition/listing identities using exact ISBN, exact original title/author, exact approved alias, strong original relevance and bounded fuzzy relevance, then returns internal match identities/scores/reasons. It is never client-callable or independently client-paginated.

Q08 consumes the bounded Q07 set inside the controlled query boundary, filters current public eligibility, groups by `store_id`, computes one store-group match score/summary, ranks stores, and paginates store groups. Book matching and store ranking use separate version identifiers. Grouping always occurs before pagination; raw listing pages are never grouped after slicing.

## 2. Ranking, cursor, and count contract

Store ranking stages are eligibility, availability, pilot locality/distance, fulfillment compatibility, freshness, then price/condition tie-breakers, with final `store_id ASC`. The server-authenticated cursor contains WU0A query/ranking versions, a fingerprint of normalized query+filters+locale+page size, last match score, last store ID and page size. Malformed, tampered, stale-version or context-mismatched cursors return `P9_CURSOR_INVALID`; they never restart silently.

| Count | Definition |
| --- | --- |
| `bookstore_count` | distinct eligible store groups matching the bound query across the result set |
| `offer_count` | eligible public inventory offers across matching store groups |
| `title_count` | distinct active public edition/title identities in the selected complete storefront catalogue |

Counts never reveal exact inventory quantity. The public availability value is a bounded band. Exact SQL/search extensions/indexes, current public policy compatibility and query-plan thresholds are `DB_AUDIT_REQUIRED_BEFORE_DATABASE_DESIGN`.

## 3. Public projections and storefront

A store-group card exposes only WU0A public register fields: public store identity/name/locality, match summary, availability band, approved cover, price-from, condition/damage summary and counts. Selecting a store returns Q09’s complete active eligible catalogue with stable title/offer ordering. The searched match may be pinned/highlighted through removable query context; removing it restores the same complete catalogue, not a search-filtered fragment.

Q10 listing detail exposes approved authoritative metadata, public price, condition/damage disclosure and approved `public_copy` media. It excludes scan/request media, exact quantity, acquisition cost, shelf/location, internal notes, raw provenance/payload, customer information and worker/provider state.

Only active store-scoped Unit 5C variants participate in matching.
Deterministic normalized keys are separate representations. The response may
state bounded variant-match context, but displays confirmed original title and
author as primary. Variants never define canonical identity, duplicate advice,
grouping, inventory compatibility, or global search authority.

## 4. Marketplace consistency and cache boundaries

Public cache keys include query/ranking/projection policy versions and normalized context fingerprint. Publication/retraction changes advance projection identity/invalidation evidence. Private Owner/customer queries never use shared public caches. A page must contain each store once; across a stable cursor traversal, no eligible store is omitted or duplicated. Concurrent projection changes may require a new context/version rather than pretending snapshot stability.

## 5. Request-photo aggregate

| State | Authorized action | Preconditions and result |
| --- | --- | --- |
| `none` | C14 customer request | owning customer, eligible request item, count 1–3 → `requested` |
| `requested|uploading` | C15 Owner capability; C16 supply; C27 validate | owning-store Owner supplies fresh purpose-bound media; worker validation completes all links → `provided`; upload/supply alone stays `uploading` |
| `provided` | C28 Owner confirms item; C30 creates/refreshes soft hold | Owner confirms current availability, sellable quantity, price and applicable terms; atomic Phase 6 transaction records proposal, creates bounded soft hold and enters `awaiting_customer_decision` |
| `provided` with current confirmation and active soft hold | C17 accept or C18 decline | owning customer accepts current proposal or declines; acceptance promotes soft→firm through Phase 6, decline releases/recalculates |
| any nonterminal | C19 unfulfilled or C29 hold expiry | Owner inability marks unfulfilled; system expiry releases soft hold and expires/recalculates through Phase 6 |
| any nonterminal | approved system expiry/lifecycle only | later policy; no implicit customer decision or payment effect |

The request-photo aggregate belongs to a specific Phase 6 request item and customer/store pair. Media are newly captured, request-purpose, private, 1–3, and delivered through a short-lived customer capability. Scan/public-copy media cannot satisfy the request, and request media cannot affect duplicate identity, listing display or public media eligibility. `provided` means media evidence is validated; it is not customer-acceptable until C28 records a current Owner confirmation and C30 creates an active soft hold.

## 6. Phase 6 seam contract

C14 only creates photo state and has no hold/amount effect. After C27 completes media validation, C28 must invoke the existing Phase 6 Owner-confirmation seam with confirmed quantity and unit price; C30 is the internal transaction-owning hold operation used inside that same transaction. It locks the request item and inventory, validates quantity against current available stock, validates price against the server-bound listing terms, records `confirmed_full|confirmed_partial`, creates or refreshes a `soft` hold, sets `acceptance_expires_at` from the Phase 6 `commerce.acceptance_window_seconds` policy, and moves the request to `awaiting_customer_decision`.

The customer projection includes the validated photos plus the exact confirmed quantity, unit price, applicable fulfillment/terms, proposal/request version and acceptance expiry. C17 is invalid before this projection and an active unexpired matching soft hold exist. It invokes the existing Phase 6 customer-acceptance seam, promotes soft holds to firm, and may enter `payment_ready` only when every existing guard passes. It does not create provider payment, a paid order, ledger entry, settlement, pickup or refund.

If price or quantity changes after photo supply but before Owner confirmation, C28 snapshots the current authorized values. If the Owner changes either after confirmation, a new expected-version confirmation must atomically release/replace the prior soft hold and issue a new proposal/version; prior customer acceptance becomes stale. If another sale consumes stock before C30 locks it, confirmation fails with insufficient available quantity or the Owner confirms a smaller quantity. Once the soft hold commits, ordinary sales must respect reserved quantity. Expiry C29 or decline/unfulfilled C18/C19 releases the hold and recalculates request totals.

Decline/unfulfilled withdraws or marks affected items and releases/recalculates eligible holds/amounts through the existing command semantics. Partial item decisions return truthful remaining request state. The soft hold is an unpaid, bounded anti-oversell reservation only; it is not payment authorization, an order, settlement or completed sale. Exact live RPC/function compatibility, version predicates, event types and task interactions remain `DB_AUDIT_REQUIRED_BEFORE_DATABASE_DESIGN` and must be verified against live M01–M39 before database design.

## 7. Authorization and privacy

Customer Q11 selects only the authenticated customer’s request/item photo projection. Owner Q11 selects only request items belonging to an administered store and uses a different positive allowlist. Neither returns a storage path, persistent signed URL, other customer data, private job state or raw media metadata. Viewing capability issuance reauthorizes on every request.

Store A/B, Customer A/B, forged request/store/item, expired/replayed capability, wrong sequence/purpose, request-media public projection, and direct storage enumeration are mandatory denial tests.

## 8. Failure semantics and freshness

Invalid or missing media leaves the request nonprovided with a stable code. A successful upload that fails validation/linking leaves only private staged media eligible for lifecycle cleanup. Customer acceptance before Owner confirmation, without an active soft hold, after expiry, or against a stale price/quantity proposal fails closed. Acceptance/decline is idempotent; stale opposite decisions conflict. Owner unfulfilled or hold expiry races with customer acceptance under request/item/hold locks, so exactly one wins.

Repeated Owner inability to provide current-copy evidence emits bounded freshness/review signals for the listing. It does not automatically accuse the store, publish customer details, mutate quantity, or execute paid-order behavior. Exact thresholds and operational review policy remain later configuration/product gates.

## 9. Explicit Phase 7/8 exclusions

No WU0B boundary creates payment intent, captures money, creates paid orders, posts ledger entries, settles stores, schedules pickup, fulfills pickup, or issues refunds. `payment_ready` remains the furthest existing provider-independent Phase 6 state and is reachable only through existing guards. Any future provider-payment or fulfillment behavior requires the deferred Phase 7/8 authorizations.
