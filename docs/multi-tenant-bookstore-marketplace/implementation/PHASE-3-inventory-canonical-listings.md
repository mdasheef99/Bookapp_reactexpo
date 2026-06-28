# PHASE-3: Inventory, Canonical Books, and Listings

**Status:** `in_progress`
**Last updated:** 2026-06-28
**Phase goal:** Build manual inventory and public listing projection before image-to-LLM automation.

---

## Required Reading

- [DOC-3: Canonical Books, Metadata, and Inventory](../DOC-3-canonical-books-metadata-inventory.md)
- [DOC-5: Consumer Marketplace and Discovery](../DOC-5-consumer-marketplace-discovery.md)
- [DOC-12: Build Strategy and Implementation Sequence](../DOC-12-build-strategy-and-implementation-sequence.md)

---

## Scope

- Canonical book/edition foundation.
- Metadata source records.
- Manual inventory entry.
- Duplicate detection.
- Public listing projection.
- Listing moderation and quality status.
- Private/public inventory field separation.

---

## Implementation Units

| Unit | Status | Notes |
|---|---|---|
| Canonical work/edition model | `complete` | Migration `20260628000003_marketplace_phase3_inventory_canonical_listings.sql` adds minimum viable `canonical_works` and `canonical_editions`; applied live as `20260628181842 marketplace_phase3_inventory_canonical_listings`. |
| Metadata source records | `complete` | Migration adds `book_metadata_sources`; payloads are platform-only under RLS. |
| Store inventory model | `complete` | Migration adds store-private `store_inventory` with shelf/cost/internal-note/confidence fields. Service inventory rows include timestamps for freshness/sorting. |
| Manual inventory entry | `complete` | `storeInventoryService.createManualInventoryItem` and `StoreInventoryScreen` save draft manual rows for active owners; screen lists local inventory rows with condition, price, quantity, publish, pause, and minimal price/quantity edit controls. |
| Duplicate detection | `complete` | Service searches same-store ISBN/title candidates; migration adds ISBN/provider/title-author indexes. Same-ISBN public listings group by canonical edition/ISBN in service tests. |
| Public listing projection | `complete` | Migration adds `marketplace_book_listings` plus sync trigger gated on active/approved/setup-complete/selling-allowed stores; public RLS also checks current store status/setup/selling gates at read time; service returns grouped public book results with cover URL from the projection only. |
| Listing quality status | `complete` | Inventory/listing quality status fields added; publish validates required fields before marking `ready`. |
| Moderation/risk flags | `complete` | Listing moderation status and `listing_moderation_flags` added; blocked/prohibited listings excluded from public reads. |
| Tests | `complete` | Focused migration/service/screen/route tests added for public/private boundary and manual entry. |

---

## Verification Log

- 2026-06-28: `npm.cmd test -- --runInBand supabase/migrations/__tests__/marketplacePhase3InventoryCanonicalListings.test.ts src/features/stores/services/__tests__/storeInventoryService.test.ts` - pass.
- 2026-06-28: `npm.cmd test -- --runInBand --runTestsByPath ...StoreInventoryScreen.test.tsx ...inventory.test.tsx ...StoreOwnerGateScreen.test.tsx` - pass. Jest printed an invalid testPattern warning for Windows route-group paths but ran the requested paths.
- 2026-06-28: `npm.cmd test -- --runInBand supabase/migrations/__tests__/marketplacePhase3InventoryCanonicalListings.test.ts src/features/stores/services/__tests__/storeInventoryService.test.ts src/features/stores/screens/__tests__/StoreInventoryScreen.test.tsx` - pass, 18 tests.
- 2026-06-28: Review fix slice added publish validation, publish error handling, public RLS store-gate check, condition selector, pause/edit controls, grouped cover URL, wildcard escaping, and list metadata display. Focused service/screen tests passed: `npm.cmd test -- --runInBand src/features/stores/services/__tests__/storeInventoryService.test.ts src/features/stores/screens/__tests__/StoreInventoryScreen.test.tsx` - 19 tests.
- 2026-06-28: Supabase MCP project `ahntbtktjjmvfosgkmgn` confirmed as the configured BookConnect Expo backend. Migration applied live as `20260628181842 marketplace_phase3_inventory_canonical_listings`; remote SQL verification confirmed all six Phase 3 tables have RLS enabled, the owner/private and public listing policies exist, and `sync_marketplace_listing_from_inventory_trg` is enabled.

---

## Acceptance Criteria

- [x] Store Owner can create inventory without publishing it.
- [x] Store Owner can publish only inventory with required public fields.
- [x] Consumer search reads public listing projection only.
- [x] Private inventory fields are not exposed in public listing responses.
- [x] Same ISBN across stores groups under one consumer book result.
- [x] Blocked/suspended/prohibited listings are excluded from consumer discovery.
- [x] `DOC-13` is updated.

---

## Blockers

- Phase 2C authenticated platform-review smoke remains intentionally pending; Phase 3 proceeded per 2026-06-28 handoff without granting platform roles.

---

## Decisions Made During Implementation

- 2026-06-28: Minimum viable canonical model starts edition-first with optional `canonical_works`, per DOC-3 §4.2.
- 2026-06-28: Manual inventory starts with draft entry, condition selection, minimal publish/pause actions, and minimal price/quantity edit controls. Full owner editing UX remains Phase 4, but service methods now support price/quantity/condition/public-note edits and pause.

---

## Spec Deviations

- None yet.

---

## Handoff Notes

Manual inventory and the public projection are implemented, verified locally, exported for web, and live-applied. Remaining operational gate: authenticated store-owner smoke against an explicitly approved active/approved/setup-complete/selling-allowed store owner. Phase 2C authenticated platform-review smoke also remains intentionally pending until a platform-role test user is explicitly approved.
