# 05 - Marketplace Phase 2 Readiness

## Current Marketplace Status

At pack creation time:

- Phase 1 foundation migrations exist in `supabase/migrations`.
- Live Supabase check showed foundation tables present with RLS enabled.
- `docs/multi-tenant-bookstore-marketplace/DOC-13-implementation-tracker.md` says the next step is Phase 2: Store Onboarding and Verification.
- `docs/multi-tenant-bookstore-marketplace/implementation/PHASE-2-store-onboarding-verification.md` is `not_started`.

2026-06-28 update:

- Phase 2A Store Owner gate/auth hardening is implemented and live.
- Phase 2B store application/document flow is implemented, deployed, and authenticated-smoke-verified.
- Phase 2C platform review/setup entitlements is implemented and deployed: `store-review` version 1 is live with `verify_jwt=true`, review metadata migration `20260628102752 marketplace_phase2c_review_metadata` is live, and Store Owner status/setup checklist screens exist.
- Phase 2C authenticated platform-review smoke remains pending a platform-role test user.

Current handoff:

- Treat Phase 2 as implemented/deployed but `needs_review` until authenticated `store-review` smoke is either run or explicitly waived.
- Do not create or grant a platform role casually in live Supabase. If a smoke test is required later, use an explicitly approved test user and record the role grant/cleanup.
- Phase 3 may start if the team accepts skipping authenticated Phase 2C smoke for now; keep the pending smoke gate documented in DOC-13.

## Read First

For any Phase 2 follow-up or Phase 3 handoff work, read:

1. `docs/multi-tenant-bookstore-marketplace/README.md`
2. `docs/multi-tenant-bookstore-marketplace/DOC-13-implementation-tracker.md`
3. `docs/multi-tenant-bookstore-marketplace/DOC-12-build-strategy-and-implementation-sequence.md`
4. `docs/multi-tenant-bookstore-marketplace/DOC-2-store-onboarding-verification-subscriptions.md`
5. `docs/multi-tenant-bookstore-marketplace/DOC-1-identity-security-compliance.md`
6. `docs/multi-tenant-bookstore-marketplace/DOC-9-platform-ops-admin.md`
7. `docs/multi-tenant-bookstore-marketplace/implementation/PHASE-2-store-onboarding-verification.md`
8. `CODEBASE_INTELLIGENCE/08-marketplace-phase-3-readiness.md`

## Phase 2 Goal

Let a bookstore apply, be reviewed, accepted, restricted, or rejected safely.

Core units:

- seller application flow
- Store Owner entry from Login / first-run auth
- Store Owner entry from Profile
- verification document upload
- platform review states
- seller agreement acceptance
- prohibited/counterfeit/pirated-book policy acceptance
- tax/payout readiness fields
- basic entitlement/subscription status
- store setup checklist

## Live Foundation Tables To Build Against

Expected Phase 1 tables include:

- `stores`
- `store_administrators`
- `store_status_history`
- `store_verification_requests`
- `store_verification_documents`
- `seller_payout_accounts`
- `store_subscriptions`
- `store_entitlements`
- `store_usage_counters`
- `store_subscription_plans`
- `marketplace_policy_config`
- `marketplace_localities`
- `platform_user_roles`
- `platform_admin_actions`
- `marketplace_events`
- `marketplace_notifications`
- `marketplace_audit_logs`
- `commerce_idempotency_keys`
- ops queue primitives such as support/refund/reconciliation/delivery/moderation/risk tables

Confirm live state through Supabase MCP before implementing.

## Entry Points

Likely files to inspect first:

- `app/(auth)/login.tsx`
- `app/(auth)/verify-otp.tsx`
- `app/(tabs)/profile/index.tsx`
- `app/(tabs)/profile/_layout.tsx`
- `app/_layout.tsx`
- `app/index.tsx`
- `src/features/auth/hooks/useAuth.ts`

Needed behavior:

- unauthenticated users can choose Store Owner path from Login/first-run auth
- signed-in users can choose Apply as Bookstore / Store Owner Console from Profile
- auth redirect must preserve Store Owner intent
- entry must route to onboarding state, not bypass verification

## Store Owner Surface

Store Owner surface now exists:

- `app/(store-owner)/...`
- `src/features/stores/...`
- dedicated Store Owner services/hooks/query keys
- dedicated tests for gates, onboarding, review function security, and setup checklist

Phase 3 should extend this surface with inventory routes/screens while keeping inventory/listing code separate from P2P exchange.

## Reuse Allowed

Controlled reuse:

- Expo Router layout patterns
- React Query patterns
- Supabase client setup
- Sentry capture helpers
- existing UI primitives
- profile/account entry surface
- `user_addresses` for customer delivery later, after privacy review
- `books` as seed/reference metadata
- PostGIS/location capability
- notification delivery patterns

## Forbidden Or Risky Reuse

Do not directly reuse:

- P2P `listings` as bookstore inventory
- P2P `transactions` as bookstore orders
- P2P transaction states for marketplace order requests
- borrower/lender assumptions
- credit economy assumptions
- public storage bucket patterns without review
- broad `SECURITY DEFINER` patterns
- `user_profiles.account_type` as Store Owner authorization

## Tests To Plan

Phase 2 implemented focused tests for:

- Login entry preserves Store Owner intent after OTP verification.
- Profile entry routes signed-in users to Store Owner onboarding/gate.
- users without approval cannot sell or access owner console actions.
- document upload uses `seller-verification-docs/{store_id}/...`.
- seller documents are private and path scoped.
- platform reviewer actions require platform role.
- approval moves store status to approved pending setup.
- rejected/restricted/suspended states block selling.

Additional useful commands:

```powershell
npm.cmd test -- --runInBand src/features/stores supabase/functions/__tests__/store_application_function.test.ts supabase/functions/__tests__/store_review_function.test.ts supabase/migrations/__tests__/marketplacePhase2OnboardingHardening.test.ts supabase/migrations/__tests__/marketplacePhase2CReviewMetadata.test.ts
npx.cmd tsc --noEmit
npm.cmd run export:web
```
