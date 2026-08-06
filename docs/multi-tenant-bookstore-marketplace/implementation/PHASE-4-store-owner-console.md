# PHASE-4: Store Owner Console

**Status:** `locally_complete`
**Last updated:** 2026-07-15
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

2026-07-15 review remediation closed three implementation gaps: profile/setup writes now use a JWT-authenticated, ownership-checked `store-profile` Edge Function instead of a client-side `stores` update; approved stores can edit and complete the required setup checklist; and inventory publish/select/draft-failure behavior now matches the documented workflow. A least-privilege migration also revokes client execution of the SECURITY DEFINER listing-projection trigger function.

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

2026-07-15 local review verification:

```powershell
npm.cmd test -- --runInBand "src/features/stores"
```

Result: 13 suites passed, 118 tests passed.

```powershell
npx.cmd tsc --noEmit --pretty false
```

Result: passed. The Store Owner route/auth/function/migration suites also passed; one unrelated Profile test exceeded its fixed five-second timeout only in the combined-load run and passed 7/7 when rerun alone.

```powershell
npm.cmd run export:web
```

Result: passed; Expo exported the production web bundle to `dist`.

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
- `store-profile` version 1 is deployed ACTIVE with `verify_jwt=true`, and migration `marketplace_phase4_security_hardening` is live. Unauthenticated smoke returned `401` and is present in Edge Function logs. Positive authenticated owner-write smoke remains pending because no approved disposable user password is configured locally.
- Existing Phase 3 public listing anonymous-read remediation remains a separate pre-Phase-5 backend blocker.

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
- The 2026-07-15 security review added and deployed the controlled `store-profile` Edge Function and narrow trigger-function EXECUTE hardening migration.

---

## Handoff Notes

Phase 4 is implemented and deployed for the MVP console surface, including review remediation. Grant verification passed (`anon=false`, `authenticated=false`, `service_role=true`) and unauthenticated function smoke returned `401`; only positive authenticated owner-write smoke remains pending an approved disposable credential. Do not add manager delegation, advanced marketing modules, order management, fulfillment, payment, settlement, or full image-to-LLM extraction under Phase 4.

Recommended next work:

1. Run positive authenticated profile/setup smoke when an approved disposable Store Owner credential is available.
2. Apply the separately reviewed Phase 3 anonymous policy split before Phase 5 consumer discovery relies on public listing reads.
3. Continue Phase 5 using `marketplace_book_listings` and `public_store_profiles`, never `store_inventory` or P2P `listings`.

2026-08-03 route/runtime follow-up: the Store Owner tab registration was
corrected to use the concrete `orders/index` route, and its route regression
test passed. Production web export passed after bundling 2,245 modules, and
the authenticated Codex in-app browser rendered the Store Owner dashboard and
inventory routes without browser console errors. A fresh exact-project
read-only ACL check confirmed the later Phase 9 controlled boundary: direct
authenticated access to `store_inventory` is denied even though owner RLS
policies remain present. Legacy dashboard/inventory services still use direct
table calls; that separate boundary remediation must not be solved by adding
broad client grants or by silently reopening the Phase 4 completion status.

2026-08-04 WU2 follow-up: the active Store Owner `/inventory` route now uses
the Phase 9 canonical `phase9_owner_inventory_page_v1` RPC through a strict,
read-only client boundary. The legacy `StoreInventoryScreen`, hook, and service
remain in the repository for separately authorized cleanup but are no longer
reachable from that route. Dashboard remediation remains out of WU2 scope, and
Phase 4 completion status is unchanged.
