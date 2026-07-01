# 09 - Marketplace Phase 4 And Phase 5 Readiness

## Current Marketplace Status

As of 2026-06-30:

- Phase 4 Store Owner Console is locally complete.
- Phase 4 did not add migrations or Edge Functions; it consumes existing Phase 1-3 marketplace tables and policies.
- Local verification passed:
  - `npm.cmd test -- --runInBand "src/features/stores"`: 13 suites, 110 tests.
  - Store Owner route tests via `--runTestsByPath`: 6 suites, 7 tests.
  - `npx.cmd tsc --noEmit --pretty false`.
  - `npm.cmd run export:web`, after filesystem approval for Expo/Node access outside the workspace sandbox.
- Phase 3 anonymous public listing read is still blocked by the RLS helper execute-permission issue documented in `08-marketplace-phase-3-readiness.md`.

## Phase 4 Files To Know

Routes:

- `app/(store-owner)/_layout.tsx`
- `app/(store-owner)/dashboard.tsx`
- `app/(store-owner)/inventory.tsx`
- `app/(store-owner)/storefront.tsx`
- `app/(store-owner)/subscription.tsx`

Services:

- `src/features/stores/services/storeDashboardService.ts`
- `src/features/stores/services/storeInventoryService.ts`
- `src/features/stores/services/storeProfileService.ts`
- `src/features/stores/services/storeSubscriptionService.ts`

Screens/hooks/components:

- `src/features/stores/screens/StoreDashboardScreen.tsx`
- `src/features/stores/screens/StoreInventoryScreen.tsx`
- `src/features/stores/screens/StoreProfileScreen.tsx`
- `src/features/stores/screens/SubscriptionStatusScreen.tsx`
- `src/features/stores/hooks/useStoreInventory.ts`
- `src/features/stores/components/AddInventoryForm.tsx`
- `src/features/stores/components/EditModal.tsx`
- `src/features/stores/components/InventoryItem.tsx`
- `src/features/stores/types.ts`

## Phase 4 Behavior

- Active owners enter the Store Owner console through the server-resolved gate.
- Dashboard aggregates inventory health, quota usage, subscription status, operational placeholders, and store compliance blockers.
- Inventory supports manual draft entry, duplicate checks, search, condition/status/quantity/source/date filter chips, edit modal, publish/pause, low/out-of-stock badges, and bulk publish/pause.
- Storefront/profile settings support public name/description, weekly operating hours, temporary closure, return policy, pickup, delivery, and minimum delivery order value.
- Subscription screen reads own subscription/entitlement/usage status and handles a missing plan row gracefully.
- Image-to-LLM inventory remains a disabled placeholder for Phase 9.
- Order requests, paid fulfillment, demand signals, insights, and settlement statements remain out of scope until later phases.

## Phase 5 Starting Point

Read in this order:

1. `docs/multi-tenant-bookstore-marketplace/DOC-13-implementation-tracker.md`
2. `docs/multi-tenant-bookstore-marketplace/DOC-5-consumer-marketplace-discovery.md`
3. `docs/multi-tenant-bookstore-marketplace/DOC-3-canonical-books-metadata-inventory.md`
4. `docs/multi-tenant-bookstore-marketplace/DOC-6-cart-order-request-payment.md`
5. `docs/multi-tenant-bookstore-marketplace/implementation/PHASE-5-consumer-discovery.md`
6. `CODEBASE_INTELLIGENCE/08-marketplace-phase-3-readiness.md`
7. `CODEBASE_INTELLIGENCE/09-marketplace-phase-4-5-readiness.md`

## Phase 5 Boundaries

- Consumer discovery must read public marketplace projections, especially `marketplace_book_listings`.
- Do not read raw `store_inventory` from consumer services or UI.
- Do not reuse P2P `listings`, `transactions`, or credit assumptions for bookstore commerce.
- Hide suspended/unverified/non-sellable stores and blocked/prohibited listings.
- Keep private inventory fields out of consumer results: shelf location, acquisition cost, internal notes, duplicate state, raw extraction payload, and seller documents.
- Payment, order confirmation, fulfillment, delivery, settlement, and full cart checkout are not Phase 5 except for a single-store cart replacement warning if a cart skeleton is introduced.

## Recommended Phase 5 Shape

Phase 5 is medium-to-high complexity because it crosses public listing security, consumer navigation, search/grouping behavior, and public storefront disclosure UI.

Recommended implementation slices:

1. Resolve the Phase 3 anonymous public listing RLS blocker and rerun public-read smoke.
2. Add a consumer marketplace route/entry using public listing search only.
3. Build a marketplace discovery service around `storeInventoryService.searchPublicListings` or a dedicated consumer service wrapper.
4. Render grouped book results by canonical edition/ISBN with store availability cards.
5. Add public store pages using only public store/listing fields.
6. Add unavailable-search capture if a safe table/API already exists; otherwise keep a local/no-op MVP placeholder and document the gap.
7. Add focused tests for private-field exclusion, hidden suspended/unverified stores, search grouping, disclosure copy, and cart replacement guardrail if cart skeleton appears.

## Refactor Note

`src/features/stores/screens/StoreInventoryScreen.tsx` is currently 340 lines, inside the 300-350 line project limit but close to the ceiling. Do not add more inventory UI behavior directly to that file. If inventory work continues before Phase 9, extract the filter panel and bulk action bar first.

## Phase 5: Consumer Discovery - App-Side Implementation (2026-07-01)

### New Module: src/features/marketplace/

Created dedicated consumer marketplace module (separate from src/features/stores/):

- types.ts - Consumer-facing types (MarketplaceListingOffer, GroupedBookResult, PublicStoreProfile)
- services/consumerDiscoveryService.ts - Reads ONLY marketplace_book_listings and public_store_profiles
- services/__tests__/consumerDiscoveryService.test.ts - 18 tests (all passing)
- hooks/useMarketplaceSearch.ts - Debounced search hook
- hooks/__tests__/useMarketplaceSearch.test.ts - stale response guard coverage
- hooks/usePublicStoreProfile.ts - Public store profile + listings hook
- components/StoreOfferCard.tsx - Single store availability card
- components/GroupedBookCard.tsx - Expandable grouped book result with all store offers
- components/MarketplaceDisclosure.tsx - Confirmation-before-payment disclosure banner
- components/__tests__/MarketplaceComponents.test.tsx - disclosure, navigation, availability detail, cover coverage
- screens/MarketplaceSearchScreen.tsx - Main search screen
- screens/PublicStoreScreen.tsx - Public store page
- screens/__tests__/MarketplaceSearchScreen.test.tsx - initial state and submit coverage
- constants/disclosures.ts - Disclosure copy

### New Routes

- app/(tabs)/marketplace/index.tsx - Marketplace search home
- app/(tabs)/marketplace/store/[storeId].tsx - Public store page

### Tab Registration

- Marketplace tab added to app/(tabs)/_layout.tsx as nested screen `marketplace/index` (between Exchange and Clubs)
- Tab test updated in app/(tabs)/__tests__/_layout.test.tsx

### Service Contracts

consumerDiscoveryService.searchMarketplaceBooks(query: string): Promise<GroupedBookResult[]>
- Reads marketplace_book_listings with status=active, moderation_status=approved
- ISBN search: exact eq on isbn_10 or isbn_13, including ISBN-10 values with `X` check digit
- Title search: escaped ilike on public_title
- Author search: NOT implemented (schema gap - text[] partial match not practical)
- Grouping: canonical_edition_id -> isbn_13 -> normalized title/authors with trimmed/collapsed whitespace
- Batch-loads store display names from public_store_profiles

consumerDiscoveryService.getPublicStoreProfile(storeId: string): Promise<PublicStoreProfile>
- Reads public_store_profiles only (not stores)
- Excludes: pincode, legal_name, legal_seller_name, minimum_delivery_order_value_minor, return_policy_type, payout_account_status, suspension_reason

consumerDiscoveryService.getStoreListings(storeId: string): Promise<MarketplaceListingOffer[]>
- Reads marketplace_book_listings filtered by store_id, status=active, moderation_status=approved

### Public Data Boundary (Enforced)

Consumer marketplace code reads ONLY:
- marketplace_book_listings (public listing projection)
- public_store_profiles (public store profile projection)

Never reads: store_inventory, stores, P2P listings, P2P transactions, seller documents, payout data, internal notes, shelf location, acquisition cost, duplicate state, metadata confidence internals, raw extraction payloads.

### Verification Results

- consumerDiscoveryService.test.ts: 14/14 passed
- consumerDiscoveryService.test.ts after review fixes: 18/18 passed
- useMarketplaceSearch.test.ts: passed
- MarketplaceComponents.test.tsx: passed
- MarketplaceSearchScreen.test.tsx: passed
- _layout.test.tsx: 1/1 passed (marketplace tab registered)
- tsc --noEmit: clean (no errors)
- npm run export:web: success (2006 modules bundled, exported to dist)

2026-07-01 review follow-up verification:
- `npm.cmd test -- --runInBand src/features/marketplace/services/__tests__/consumerDiscoveryService.test.ts src/features/marketplace/hooks/__tests__/useMarketplaceSearch.test.ts src/features/marketplace/components/__tests__/MarketplaceComponents.test.tsx src/features/marketplace/screens/__tests__/MarketplaceSearchScreen.test.tsx`: 4 suites, 24 tests passed.
- `npx.cmd tsc --noEmit --pretty false`: passed.
- `npm.cmd run export:web`: passed after filesystem approval for Expo/Node access outside the workspace sandbox.
- Local web route check against `http://localhost:8081` found no Expo Router warnings/page errors for Phase 4/5 routes. With the normal `.env` build, unauthenticated access redirects `/marketplace`, `/marketplace/store/test-store`, `/dashboard`, `/inventory`, `/storefront`, and `/subscription` to `/login`.

### Pending Blockers (for Codex/owner)

1. Phase 3 anonymous public-read RLS blocker must be resolved before live smoke testing
2. Author partial search requires schema migration (generated authors_text column or GIN index)
3. public_store_profiles does not include return_policy_type - projection gap
