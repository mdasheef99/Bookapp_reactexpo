# PHASE-3: Inventory, Canonical Books, and Listings

**Status:** `in_progress`
**Last updated:** 2026-07-15
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
- 2026-06-29: Supabase MCP re-check confirmed Phase 3 migration remains live as `20260628181842 marketplace_phase3_inventory_canonical_listings`; all six Phase 3 tables have RLS enabled and the listing projection trigger is enabled. Reused disposable owner fixture `test@example.com` / store `68b0c1c9-7f70-4388-bd87-298df3a2ded4`, temporarily moved it to `active` / `approved` / `complete` / `allowed`, inserted inventory row `74690587-c532-4f2c-928f-436bed5602cd` for `The Hobbit` ISBN `9780547928227`, and verified trigger-created listing `9badc801-29ae-4dad-97a8-9e2f7b008026` in `marketplace_book_listings`. Cleanup deleted the smoke inventory/listing rows and restored the store to `pending_verification` / `pending` / `incomplete` / `not_allowed`; final store inventory/listing counts were both 0.
- 2026-06-29: Anonymous public-read smoke with `SET LOCAL ROLE anon` failed with `permission denied for function is_store_admin`. Root cause: the Phase 3 public listing RLS policy is `TO anon, authenticated` but includes owner/operator helper branches (`marketplace_sec.is_store_admin`, `marketplace_sec.is_platform_operator`) whose execute permissions were intentionally revoked from `anon` in Phase 1. The helper-grant draft was rejected because it broadened anonymous access to private SECURITY DEFINER helpers. Local least-privilege migration `20260713000001_marketplace_phase3_public_listing_policy_split.sql` instead separates the anonymous public-only policy from authenticated public/owner/operator access and has focused static coverage. It has not been live-applied.
- 2026-07-15: Supabase advisor review found `public.sync_marketplace_listing_from_inventory()` remained executable by client roles even though it is a SECURITY DEFINER trigger helper. Local migration `20260715000001_marketplace_phase4_security_hardening.sql` revokes EXECUTE from `PUBLIC`, `anon`, and `authenticated`, retains `service_role`, and has static coverage. It has not been live-applied.

---

## Acceptance Criteria

- [x] Store Owner can create inventory without publishing it.
- [x] Store Owner can publish only inventory with required public fields.
- [-] Consumer search reads public listing projection only. Service/static coverage passes, and service-role SQL verified projection row creation; live anonymous public-read smoke is blocked by the Phase 3 listing policy's `anon` helper execute permission issue.
- [x] Private inventory fields are not exposed in public listing responses.
- [x] Same ISBN across stores groups under one consumer book result.
- [x] Blocked/suspended/prohibited listings are excluded from consumer discovery.
- [x] `DOC-13` is updated.

---

## Blockers

- Phase 2C authenticated platform-review smoke remains intentionally pending; Phase 3 proceeded per 2026-06-28 handoff without granting platform roles.
- Live anonymous public listing reads are blocked until the Phase 3 listing RLS policy is remediated. The local policy-split migration avoids granting `anon` access to owner/operator helpers, but still requires explicit security approval before live application.
- The listing projection trigger helper EXECUTE hardening was applied live on 2026-07-15. Verification confirms `anon` and `authenticated` cannot execute it while `service_role` can.

---

## Decisions Made During Implementation

- 2026-06-28: Minimum viable canonical model starts edition-first with optional `canonical_works`, per DOC-3 §4.2.
- 2026-06-28: Manual inventory starts with draft entry, condition selection, minimal publish/pause actions, and minimal price/quantity edit controls. Full owner editing UX remains Phase 4, but service methods now support price/quantity/condition/public-note edits and pause.

---

## Spec Deviations

- None yet.

---

## Handoff Notes

Manual inventory and the public projection are implemented, verified locally, exported for web, and live-applied. Live smoke confirmed the database trigger projects a published ready inventory row into `marketplace_book_listings`, then cleanup restored the disposable store and removed smoke rows. Remaining operational gate: remediate and rerun anonymous public-read smoke for `marketplace_book_listings`; Phase 2C authenticated platform-review smoke also remains intentionally pending until a platform-role test user is explicitly approved.
