# 08 - Marketplace Phase 3 Readiness

## Current Marketplace Status

As of 2026-06-28:

- Phase 1 marketplace foundation is live.
- Phase 2A Store Owner gate/auth hardening is live.
- Phase 2B store application/document flow is live and authenticated-smoke-verified.
- Phase 2C platform review/setup entitlements is implemented and deployed.
- `store-review` has only unauthenticated live smoke (`401`) so far; authenticated platform-review smoke is intentionally pending/skipped unless a platform-role test user is explicitly approved.

Phase 3 is now in progress locally because the pending Phase 2C smoke gate was accepted as pending for this slice.

## Read First

For Phase 3, read in this order:

1. `CODEBASE_INTELLIGENCE/README.md`
2. `CODEBASE_INTELLIGENCE/01-system-map.md`
3. `CODEBASE_INTELLIGENCE/03-supabase-backend-map.md`
4. `CODEBASE_INTELLIGENCE/04-feature-inventory.md`
5. `CODEBASE_INTELLIGENCE/05-marketplace-phase-2-readiness.md`
6. `CODEBASE_INTELLIGENCE/06-testing-verification-map.md`
7. `docs/multi-tenant-bookstore-marketplace/README.md`
8. `docs/multi-tenant-bookstore-marketplace/DOC-13-implementation-tracker.md`
9. `docs/multi-tenant-bookstore-marketplace/DOC-12-build-strategy-and-implementation-sequence.md`
10. `docs/multi-tenant-bookstore-marketplace/DOC-1-identity-security-compliance.md`
11. `docs/multi-tenant-bookstore-marketplace/DOC-2-store-onboarding-verification-subscriptions.md`
12. `docs/multi-tenant-bookstore-marketplace/DOC-3-canonical-books-metadata-inventory.md`
13. `docs/multi-tenant-bookstore-marketplace/DOC-5-consumer-marketplace-discovery.md`
14. `docs/multi-tenant-bookstore-marketplace/DOC-8-store-owner-console.md`
15. `docs/multi-tenant-bookstore-marketplace/implementation/PHASE-3-inventory-canonical-listings.md`

## Phase 3 Scope

Build manual inventory and public listing projection before image-to-LLM automation.

In scope:

- canonical work/edition foundation or minimum viable equivalent
- metadata source records
- store-private inventory rows
- manual inventory entry
- duplicate detection by ISBN/provider/title-author
- public listing projection
- listing quality/moderation status
- tests for public/private data boundaries

Out of scope:

- image-to-LLM inventory workflow
- orders, payments, fulfillment, delivery, refunds, settlement
- P2P listings/transactions/credits reuse
- public consumer marketplace search UI beyond what is needed to prove projections

## Existing Files To Inspect

Store Owner surface:

- `app/(store-owner)/index.tsx`
- `app/(store-owner)/setup.tsx`
- `src/features/stores/services/storeOwnerService.ts`
- `src/features/stores/hooks/useStoreOwnerGate.ts`
- `src/features/stores/screens/StoreSetupChecklistScreen.tsx`
- `src/features/stores/types.ts`

Books/library metadata:

- `src/features/books/services/booksService.ts`
- `src/features/books/hooks/useLibraryBooks.ts`
- `app/(tabs)/library/search.tsx`
- `app/(tabs)/library/[bookId].tsx`

Forbidden direct reuse examples:

- `src/features/exchange/services/listingsService.ts`
- `src/features/exchange/services/transactionsService.ts`
- P2P `listings` and `transactions` tables/RPCs

Supabase patterns:

- `supabase/migrations/20260619000001_marketplace_foundation_schema.sql`
- `supabase/migrations/20260619000003_marketplace_foundation_rls.sql`
- `supabase/functions/_shared/marketplaceAuth.ts`
- `supabase/functions/store-application/index.ts`
- `supabase/functions/store-review/index.ts`

## Phase 3 Security Boundary

- Store Owners can manage only inventory for stores resolved through server-side ownership.
- Consumer APIs must read `marketplace_book_listings` or another public projection, never raw `store_inventory`.
- Private fields such as shelf location, acquisition cost, internal notes, metadata confidence internals, and duplicate-resolution state must not appear in consumer responses.
- Suspended/restricted stores and blocked/prohibited listings must not appear in public discovery.
- Approval alone is not enough to sell; setup and selling status must still be enforced.

## Tests To Plan

- migration/static tests for canonical/inventory/listing tables and RLS policies
- service tests proving store owner inventory calls use server-verified store context
- projection tests proving public listing output omits private inventory fields
- duplicate/grouping tests for same ISBN across stores and same ISBN within one store
- blocked/suspended/prohibited listing exclusion tests
- TypeScript and web export after UI/service changes

## 2026-06-28 Local Phase 3 Start

Added locally:

- `supabase/migrations/20260628000003_marketplace_phase3_inventory_canonical_listings.sql`
- `supabase/migrations/__tests__/marketplacePhase3InventoryCanonicalListings.test.ts`
- `src/features/stores/services/storeInventoryService.ts`
- `src/features/stores/services/__tests__/storeInventoryService.test.ts`
- `src/features/stores/screens/StoreInventoryScreen.tsx`
- `src/features/stores/screens/__tests__/StoreInventoryScreen.test.tsx`
- `app/(store-owner)/inventory.tsx`
- `app/(store-owner)/__tests__/inventory.test.tsx`

Current behavior:

- canonical work/edition/source tables are defined locally
- `store_inventory` keeps private shelf, cost, internal notes, metadata confidence, and duplicate state out of the consumer projection
- `marketplace_book_listings` is the public listing projection
- listing sync requires active store, approved verification, completed setup, allowed selling, published visibility, ready quality, and positive quantity/price
- public listing RLS also checks current store active/approved/setup-complete/selling-allowed state at read time to avoid suspended-store stale projection exposure
- active owners route to `/(store-owner)/inventory`
- the first UI saves manual inventory as draft, supports condition selection, shows condition/price/quantity, and can publish/pause ready rows
- `storeInventoryService` validates publishable rows, supports owner-scoped publish, pause, limited edit, duplicate lookup, wildcard-escaped public listing search, and grouped public book results by canonical edition/ISBN with cover URL

Still pending:

- live Supabase migration application and runtime RLS verification
- richer owner edit UI
- consumer marketplace discovery UI beyond projection service tests

## Phase 3 First Slice Recommendation

Start with schema and server boundary, not UI polish:

1. Apply and verify the Phase 3 migration in Supabase when deployment is approved.
2. Add richer owner edit UI and consumer discovery UI on top of the projection service.
3. Keep Phase 2C authenticated reviewer smoke pending unless a platform-role test user is explicitly approved.
