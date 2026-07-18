# 10 - Marketplace Phase 6 And Phase 9 Readiness

## Current Status

As of 2026-07-18:

- Phase 6 Order Request and Confirmation is `complete_e2e_deferred`.
- All Phase 6 M01-M39 migrations are applied to development Supabase project `ahntbtktjjmvfosgkmgn`.
- Persisted behavior is verified through provider-independent `payment_ready`.
- Scheduler v5, task worker v3, and cron job 5 are active; recent cron runs succeeded.
- Comprehensive customer/Owner browser E2E, responsive/accessibility review, browser-created persisted-effect review, and real timed commerce-command E2E are deferred.
- Phases 7 Payment/Ledger and 8 Pickup Fulfillment are deferred.
- Phase 9 Image-to-LLM Inventory is `planning_authorized`; implementation has not started.

`DOC-13` remains the status authority. `DOC-14` remains authoritative for commerce transitions
even while Phases 7 and 8 are deferred.

## Phase 6 Product Boundary

Phase 6 owns:

- single-store customer cart and explicit cross-store replacement
- atomic unpaid order request submission
- immutable item, seller, policy, and private snapshots
- Owner full/partial/unavailable/distinct-rejection outcomes
- clarification and non-transitioning support requests
- soft/firm inventory holds and exactly-once release
- customer acceptance, cancellation, and expiry
- provider-independent `payment_ready`
- append-only transitions/events/audit, safe inbox projections, tasks, retries, dead letters
- schedule/deadline engine, reconciliation, and operational observations

Phase 6 explicitly does not own:

- provider payment objects or `payment_pending`
- paid orders
- ledger, refunds, settlement, or payout
- pickup readiness/codes/completion
- third-party delivery

## Phase 6 Files To Know

Customer routes:

- `app/(tabs)/marketplace/cart.tsx`
- `app/(tabs)/marketplace/requests/index.tsx`
- `app/(tabs)/marketplace/requests/[requestId].tsx`

Owner routes:

- `app/(store-owner)/orders/index.tsx`
- `app/(store-owner)/orders/[requestId].tsx`

Commerce module:

- `src/features/marketplace/commerce/vocabulary.ts`
- `src/features/marketplace/commerce/schemas.ts`
- `src/features/marketplace/commerce/eligibility.ts`
- `src/features/marketplace/commerce/timeEngine.ts`
- `src/features/marketplace/commerce/services/customerCommerceService.ts`
- `src/features/marketplace/commerce/services/ownerCommerceService.ts`
- `src/features/marketplace/commerce/services/commerceSession.ts`
- `src/features/marketplace/commerce/hooks/useCustomerCommerce.ts`
- `src/features/marketplace/commerce/hooks/useOwnerCommerce.ts`
- `src/features/marketplace/commerce/screens/`
- `src/features/marketplace/commerce/__tests__/`

Backend:

- `supabase/migrations/20260716000001_marketplace_phase6_order_request_core.sql` through M39
- `supabase/functions/commerce-scheduler/index.ts`
- `supabase/functions/commerce-task-worker/index.ts`
- `supabase/tests/phase6_unit*_integration.sql`
- `supabase/tests/phase6_unit*_concurrency.ps1`

## Inventory Boundary Phase 9 Must Preserve

Phase 6 makes inventory a concurrent commerce resource:

```text
quantity_total = quantity_available + quantity_reserved + quantity_sold + quantity_removed
```

- Soft/firm holds move quantities between available and reserved buckets.
- Direct authenticated `store_inventory` updates are revoked.
- Commands lock inventory/hold/request rows in deterministic order.
- Reconciliation detects bucket/hold mismatches and does not guess destructive repairs.
- The equality constraint currently has zero live violations but remains `NOT VALID`; validate it with a forward migration before production readiness.

Phase 9 must therefore create or increment inventory through a controlled server-side command.
Extraction review must never overwrite `quantity_reserved`, `quantity_sold`, or active-hold state.

## Phase 9 Starting Slice

Start with `single_cover` only:

1. Authenticated active Owner starts a store-scoped extraction session.
2. Image uploads to private `image-extraction-inputs` storage.
3. Server-side provider adapter performs multimodal extraction.
4. Output is schema-validated and capped at one candidate.
5. Candidate is enriched through canonical metadata providers.
6. Duplicate matching checks ISBN, provider identity, and normalized title/author.
7. Owner corrects and confirms title, author, condition, price, quantity, and shelf/location.
8. Controlled inventory command creates a draft or explicitly reviewed listing projection.
9. Session records quota, provider usage, estimated cost, lineage, and terminal state.
10. Logout clears local extraction workflow state; manual entry remains available.

Only after real-store accuracy/cost review should `spine_stack` be added with a 15-candidate cap.

## Phase 9 Files To Inspect First

- `docs/multi-tenant-bookstore-marketplace/DOC-3-canonical-books-metadata-inventory.md`
- `docs/multi-tenant-bookstore-marketplace/DOC-4-image-to-llm-inventory-workflow.md`
- `docs/multi-tenant-bookstore-marketplace/DOC-8-store-owner-console.md`
- `docs/multi-tenant-bookstore-marketplace/implementation/PHASE-9-image-to-llm-inventory.md`
- `src/features/stores/services/storeInventoryService.ts`
- `src/features/stores/screens/StoreInventoryScreen.tsx`
- `src/features/stores/components/AddInventoryForm.tsx`
- `src/features/stores/hooks/useStoreInventory.ts`
- Phase 3 canonical/listing migrations and Phase 6 inventory/hold migrations
- `src/features/auth/hooks/useAuth.ts` and `src/features/marketplace/commerce/services/commerceSession.ts`

`StoreInventoryScreen.tsx` is near the project line ceiling. Extract Phase 9 workflow UI into a
dedicated feature folder/screens instead of adding the scanner flow directly to that file.

## Security And Privacy Gates

- Resolve `store_id` from authenticated Owner context; never trust a mobile-supplied tenant.
- Keep images, raw model payloads, shelf location, confidence internals, and provider payloads private.
- Use server-side provider credentials only.
- Require Owner review before inventory write or publish.
- Enforce per-image candidate caps, retries, store quota, and cost accounting before paid calls.
- Retain only the minimum image/payload period required by debugging, audit, and consent policy.
- Add cross-store denial tests for every privileged function/RPC.
- Preserve public listing projection boundaries; consumers never read raw inventory or extraction rows.

## Testing Gate

- Red-first deterministic tests for session states, caps, confidence categories, duplicate choices, quota, retries, logout cleanup, and inventory bucket preservation.
- Recorded provider fixtures and schema/contract checks for LLM output; never assert exact generated prose.
- Migration/RLS/grant tests for private sessions, inputs, candidates, attempts, and controlled inventory writes.
- Cross-tenant denial through the real server boundary.
- Supabase readback after migrations; do not infer live state from local files.
- TypeScript, focused Jest, production web export, and device capture/upload smoke before completion.

## Deferred Phase Isolation

Phase 9 must not introduce:

- payment provider selection or SDK flows
- `payment_pending`, paid orders, ledger entries, refunds, or settlement
- packing/readiness, pickup codes, or pickup completion
- delivery provider booking or webhooks

Those remain behind separately authorized Phases 7 and 8.
