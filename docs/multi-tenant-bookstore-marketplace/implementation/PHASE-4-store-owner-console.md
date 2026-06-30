# PHASE-4: Store Owner Console

**Status:** `locally_complete`
**Last updated:** 2026-06-30
**Phase goal:** Build the minimal operating console for approved bookstores.

---

## Required Reading

- [DOC-8: Store Owner Console](../DOC-8-store-owner-console.md)
- [DOC-1: Identity, Security, and Compliance](../DOC-1-identity-security-compliance.md)
- [DOC-2: Store Onboarding, Verification, and Subscriptions](../DOC-2-store-onboarding-verification-subscriptions.md)
- [DOC-3: Canonical Books, Metadata, and Inventory](../DOC-3-canonical-books-metadata-inventory.md)

---

## Scope

- Store Owner access gate.
- Store Owner Console entry from Profile for existing signed-in users.
- Dashboard.
- Inventory list/edit/publish/unpublish.
- Store profile, hours, policies, pickup/delivery settings.
- Subscription/quota visibility.
- Compliance and policy blocker explanations.
- Basic store statement summary area if ledger exists later.

---

## Implementation Units

| Unit | Status | Notes |
|---|---|---|
| Store Owner access gate | `complete` | Active owners route to the console through server-resolved store ownership state. |
| Store Owner surface switch entry | `complete` | Profile entry and Store Owner gate routing were completed in prior Phase 2 work; Phase 4 builds on that gate. |
| Console navigation | `complete` | `app/(store-owner)/_layout.tsx` exposes dashboard, inventory, storefront, and subscription tabs while hiding onboarding/status/setup helper routes. |
| Dashboard cards | `complete` | Dashboard aggregates inventory health, quota usage, subscription status, operational placeholders, and real compliance blockers. |
| Inventory management UI | `complete` | Manual draft entry, duplicate check, list, search/filter chips, edit modal, publish/pause, low/out-of-stock badges, and bulk publish/pause are implemented. Image-to-LLM remains a disabled placeholder for Phase 9. |
| Store profile/settings UI | `complete` | Storefront/profile screen supports public name/description, operating hours, return policy, and pickup/delivery settings. |
| Subscription/quota UI | `complete` | Subscription screen reads owner-scoped subscription/entitlement/usage data and handles null plan configuration. |
| Compliance blocker UI | `complete` | Dashboard shows payout and policy acceptance blockers from store readiness fields. |
| Tests | `complete` | Focused service, screen, and route tests cover owner-scoped data, null/missing rows, validation, private-field boundaries, profile saves, dashboard compliance, subscription quotas, inventory filters, edit preservation, and bulk actions. |

---

## Verification Log

2026-06-30 local verification:

```powershell
npm.cmd test -- --runInBand "src/features/stores"
```

Result: 13 suites passed, 110 tests passed.

```powershell
npm.cmd test -- --runInBand --runTestsByPath "app/(store-owner)/__tests__/_layout.test.tsx" "app/(store-owner)/__tests__/dashboard.test.tsx" "app/(store-owner)/__tests__/index.test.tsx" "app/(store-owner)/__tests__/inventory.test.tsx" "app/(store-owner)/__tests__/storefront.test.tsx" "app/(store-owner)/__tests__/subscription.test.tsx"
```

Result: 6 suites passed, 7 tests passed.

```powershell
npx.cmd tsc --noEmit --pretty false
```

Result: passed.

```powershell
npm.cmd run export:web
```

Result: passed after filesystem approval for Expo/Node access outside the workspace sandbox.

---

## Acceptance Criteria

- [x] Store Owner can access console only through verified store context.
- [x] Existing signed-in users can open Store Owner Console / onboarding from Profile.
- [x] Store Owner cannot access other stores.
- [x] Dashboard shows operational tasks, inventory health, subscription, and quota status.
- [x] Store Owner can manage own inventory/listings and store profile.
- [x] Store Owner can see own plan/limits but not platform-wide subscription management.
- [x] Store statement/compliance data is store-scoped.
- [x] `DOC-13` is updated.

---

## Blockers

- No Phase 4 local implementation blocker remains.
- Live Supabase/RLS smoke for the Phase 4 console was not run in this pass; existing Phase 3 public listing anonymous-read remediation remains a separate pre-Phase-5 backend blocker.

---

## Decisions Made During Implementation

- Limits display uses `store_entitlements.limit_value` as the primary source for `inventory_item_limit`, `monthly_image_extraction_limit`, and `active_listing_limit`.
- Usage display uses `store_usage_counters.used_value` with missing counter rows treated as zero usage.
- Subscription display uses `store_subscriptions.status` and period fields as primary status; missing joined plan name renders as plan pending/trial configuration.
- `operating_hours` is app-shaped as weekday schedules with nullable open/close for closed days plus `temporary_closure`.
- `return_policy_type` is constrained in app code to `no_returns`, `no_returns_except_wrong_item`, `returns_within_3_days`, and `returns_within_7_days`.

---

## Spec Deviations

- Order request, paid fulfillment, demand signals, insights, and settlement statement cards remain placeholder/not implemented because DOC-8 depends on later order, fulfillment, demand, and finance phases.
- Image-to-LLM add-books remains a disabled placeholder in inventory because full extraction is Phase 9 scope.
- Phase 4 did not add migrations or Edge Functions; it consumes existing Phase 1-3 tables, policies, and services.

---

## Handoff Notes

Phase 4 is locally complete for the MVP console surface. Do not add manager delegation, advanced marketing modules, order management, fulfillment, payment, settlement, or full image-to-LLM extraction under Phase 4.

Recommended next work:

1. Resolve the existing Phase 3 anonymous public listing RLS issue before Phase 5 consumer discovery relies on public listing reads.
2. Start Phase 5 with consumer-facing discovery/search on `marketplace_book_listings`, not `store_inventory` or P2P `listings`.
3. Optionally refactor `StoreInventoryScreen.tsx` into a dedicated filter component before adding more inventory UI behavior; the file is currently within the 300-350 line limit but close to the ceiling.
