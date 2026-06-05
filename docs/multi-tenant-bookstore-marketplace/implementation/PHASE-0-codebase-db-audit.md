# PHASE-0: Codebase and DB Audit

**Status:** `needs_review`
**Last updated:** 2026-05-22
**Phase goal:** Re-audit the current app and Supabase project before writing migrations or app code.

---

## Required Reading

- [DOC-12: Build Strategy and Implementation Sequence](../DOC-12-build-strategy-and-implementation-sequence.md)
- [DOC-13: Implementation Tracker](../DOC-13-implementation-tracker.md)
- [DOC-0: Product Architecture](../DOC-0-product-architecture.md)
- [DOC-1: Identity, Security, and Compliance](../DOC-1-identity-security-compliance.md)
- [DOC-14: Commerce State Machines](../DOC-14-commerce-state-machines.md)
- [DOC-15: Finance, Tax, and Settlement Operating Model](../DOC-15-finance-tax-settlement-operating-model.md)
- [DOC-16: Pilot and Unit Economics](../DOC-16-pilot-and-unit-economics.md)

---

## Scope

- Inspect current app architecture, route groups, auth/session handling, services, hooks, tests, and naming patterns.
- Identify current Login / first-run auth and Profile section structures for Store Owner entry placement.
- Inspect current P2P exchange implementation boundaries so bookstore marketplace does not reuse incorrect assumptions.
- Use Supabase MCP to inspect live schema, RLS policies, functions, storage buckets, realtime publication, and security/performance advisors.
- Identify reusable primitives and forbidden reuse areas.
- Record implementation constraints before Phase 1.
- Record where current app/DB can support or block commerce state machines, ledger-first finance, support ops, and Bangalore locality rollout.

---

## Implementation Units

| Unit | Status | Notes |
|---|---|---|
| Codebase route/navigation audit | `complete` | Current app uses `(auth)` and `(tabs)` route groups; tabs are Library, Exchange, Clubs, Profile. No marketplace or Store Owner route exists yet. |
| Auth/session audit | `complete` | Supabase phone OTP plus MMKV-persisted session. Store Owner intent and gate do not exist yet. |
| P2P exchange boundary audit | `complete` | P2P exchange tables/services/RPCs are peer/credit based and must not become bookstore commerce primitives. |
| Supabase schema audit | `complete` | Live project has consumer/P2P/bookclub tables only. No store, seller, inventory, marketplace order, ledger, settlement, or shipment tables were found. |
| RLS/storage/functions audit | `complete` | Existing project has security advisor warnings; new marketplace work must use stricter patterns. |
| Realtime audit | `complete` | No public tables are currently in `pg_publication_tables`; app code uses channel subscriptions for credit balance/events. |
| Ops/finance readiness audit | `complete` | Existing credits and transaction events are P2P-only; no marketplace support, refund, payment, ledger, settlement, admin, or reconciliation primitives exist. |
| Implementation constraint summary | `complete` | Findings and Phase 1 prerequisites are recorded below. |

---

## Audit Findings - 2026-05-22

### App Architecture

- Current app is an Expo Router app with root auth guarding in `app/_layout.tsx`.
- Public/unauthenticated flow is under `app/(auth)`:
  - `login.tsx`: phone OTP request.
  - `verify-otp.tsx`: OTP verification, then profile lookup.
  - `setup-profile.tsx`: creates `user_profiles` row and grants signup bonus.
- Signed-in consumer flow is under `app/(tabs)`:
  - `library`, `exchange`, `clubs`, `profile`.
  - Hidden tabs/routes include addresses and credit history.
- There is no current `store-owner`, `marketplace`, `seller`, `orders`, `inventory`, or admin route group.
- Existing profile screen already has an Account menu and is the right future integration point for "Store Owner Console / Apply as Bookstore".
- Existing login screen has no Store Owner entry. Adding it later must carry Store Owner intent through OTP and any profile setup.

### Auth And Store Owner Gate Implications

- `useAuth` stores global Supabase session/user state and initializes from `supabase.auth.getSession()`.
- `src/lib/supabase.ts` uses only `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` in app code, with MMKV storage, `persistSession: true`, `autoRefreshToken: true`, and `detectSessionInUrl: false`.
- A dev bypass exists through `EXPO_PUBLIC_DEV_SKIP_AUTH=true`; this must not be used to validate Store Owner authorization.
- Root navigation currently redirects authenticated users away from `(auth)` to `/(tabs)/library`. Store Owner login intent will need an explicit redirect path/gate so this default consumer redirect does not discard Store Owner intent.
- Store Owner access must be resolved server-side from future ownership/onboarding records, not from `user_profiles.account_type` or client navigation state.
- Sign-out currently clears Supabase auth globals only. Future Store Owner work should also clear store-scoped query caches/local state.

### P2P Exchange Boundaries

Do not reuse these as bookstore marketplace primitives:

- Tables: `listings`, `transactions`, `transaction_events`, `transaction_ratings`, `credit_events`, `user_credit_balances`.
- Services/hooks: `listingsService`, `transactionsService`, `useListings`, `useTransactions`, `creditService`.
- RPCs: `request_transaction`, `approve_transaction`, `decline_transaction`, `cancel_transaction`, `complete_transaction`, `transition_transaction_status`, `place_hold`, `release_hold`, `transfer_credits`.
- Storage bucket: `listing-photos`.

Reason:

- Current P2P model uses owner/borrower/lender roles, credits, meetup-first behavior, and peer transaction statuses.
- Bookstore commerce needs store tenant/customer/platform roles, order requests, partial availability, payment after confirmation, refunds, delivery exceptions, ledger entries, and weekly settlement.
- Current P2P RLS is user-centric, not tenant/store-centric.

### Reusable Primitives

These can be considered for reuse after review:

- Expo Router structure, React Query patterns, Supabase client setup, Sentry capture helpers, UI components, and test style.
- `user_profiles` as the consumer/account profile anchor, not as the Store Owner authorization source.
- `user_addresses` for customer delivery addresses after privacy/checkout review.
- `books` as a seed/reference metadata table, not the complete canonical marketplace metadata layer.
- PostGIS/location capability for Bangalore locality discovery, with caveats below.
- `venues` / clubs / places only for later growth phases, not for MVP store commerce.

### Live Supabase Project Summary

- Supabase project: `Bookconnect_reactexpo`, ref `ahntbtktjjmvfosgkmgn`, region `ap-southeast-2`, Postgres 17.
- Public tables currently include consumer/P2P/bookclub objects such as `books`, `user_profiles`, `user_books`, `listings`, `transactions`, `transaction_events`, `credit_events`, `user_credit_balances`, `user_addresses`, `book_clubs`, `venues`, and clubs/discussion tables.
- Query for marketplace-like table names returned no rows for `store`, `marketplace`, `seller`, `inventory`, `settlement`, `payment`, `delivery`, `shipment`, `order`, `canonical`, `extraction`, `commerce`, or `finance`.
- Storage buckets currently exist for `club-banners`, `listing-photos`, and `profile-avatars`; all are public.
- Edge Functions currently exist for P2P/bookclub support only: `complete-transaction`, `transfer-credits`, `check-membership-limits`. All require JWT, but they call existing public RPCs with service role.
- No Supabase local `supabase/config.toml` was found in the repo.

### RLS, Storage, Functions, And Realtime

- Supabase security advisor reports:
  - `public.club_public_details` is a SECURITY DEFINER view.
  - `public.spatial_ref_sys` has RLS disabled.
  - PostGIS is installed in the public schema.
  - Public buckets allow broad object listing for existing buckets.
  - Many public SECURITY DEFINER functions are executable by `anon` and/or `authenticated`.
  - Many functions have mutable/missing `search_path`.
  - Leaked password protection is disabled.
- Function audit found 44 public SECURITY DEFINER functions, 13 SECURITY DEFINER functions with missing `search_path` config, and hundreds of public-schema functions executable by anon/authenticated roles because PostGIS functions are exposed in public.
- Existing P2P functions with risky grants/search path include `request_transaction`, `approve_transaction`, `cancel_transaction`, `complete_transaction`, `decline_transaction`, `transition_transaction_status`, `place_hold`, `release_hold`, `grant_signup_bonus`, and `update_credit_balance`.
- Performance advisor reports many unindexed foreign keys and multiple permissive policy warnings in existing non-marketplace tables. New marketplace migrations must not repeat this pattern.
- `pg_publication_tables` returned no rows. Realtime is not currently configured through publication tables, although app code uses Supabase channels for credit balance/events.
- Relevant Supabase remediation docs surfaced by advisor:
  - <https://supabase.com/docs/guides/database/database-linter?lint=0010_security_definer_view>
  - <https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable>
  - <https://supabase.com/docs/guides/database/database-linter?lint=0013_rls_disabled_in_public>
  - <https://supabase.com/docs/guides/database/database-linter?lint=0025_public_bucket_allows_listing>
  - <https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable>
  - <https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable>

### Ops And Finance Readiness

- Existing `credit_events` and `user_credit_balances` are P2P credit accounting, not money ledger infrastructure.
- Existing `transaction_events` are P2P transaction logs, not marketplace commerce audit logs.
- There are no current tables/services for:
  - platform support cases
  - seller verification queues
  - refund/reconciliation queues
  - payment intents/orders
  - finance ledger entries
  - settlement batches/statements
  - seller payout accounts
  - delivery shipments/webhooks/NDR/RTO cases
  - platform policy config
- Phase 1 must create minimal ops/audit/config primitives before Store Owner UI or consumer ordering can be safely built.

---

## Phase 1 Risks And Prerequisites

1. Create the marketplace foundation separately from P2P tables. Do not migrate or rename P2P `listings`/`transactions` into bookstore commerce.
2. Define Store Owner gate data model first: `stores`, `store_administrators` or equivalent, onboarding/verification status, and server-authorized access checks.
3. Use tenant-scoped RLS from day one, including cross-store denial tests.
4. Avoid public SECURITY DEFINER RPCs for marketplace actions. Prefer private schemas/Edge Functions/service-role server paths for privileged transitions, with strict JWT actor checks and idempotency.
5. Create private seller document storage and public store/listing asset storage with no broad object listing.
6. Add policy config and append-only audit/event foundations before order/payment phases.
7. Decide whether existing Supabase security advisor issues will be cleaned before marketplace launch or isolated from new marketplace work. They should not block schema planning, but they are a launch risk if left unresolved.
8. Keep payment, refund, settlement, and delivery code out of Phase 1 except for foundational data structures and audit requirements.

---

## Verification Log

- Read Phase 0 tracker, DOC-13, implementation README, and Phase 1 tracker.
- Inspected app routes with `rg --files app`.
- Inspected feature modules with `rg --files src/features`.
- Inspected migrations with `rg --files supabase/migrations`.
- Read auth/navigation files: `app/_layout.tsx`, `app/index.tsx`, `app/(auth)/login.tsx`, `app/(auth)/verify-otp.tsx`, `app/(auth)/setup-profile.tsx`, `app/(tabs)/_layout.tsx`, `app/(tabs)/profile/index.tsx`, `useAuth.ts`, `profileService.ts`, `supabase.ts`, `mmkv.ts`.
- Read P2P exchange files: `listingsService.ts`, `transactionsService.ts`, `addressesService.ts`, `creditService.ts`, `exchangeConfig.ts`, `transactionActionResolver.ts`, and P2P migrations.
- Used Supabase MCP on project `ahntbtktjjmvfosgkmgn` to list tables, storage buckets, Edge Functions, policies, realtime publication tables, SECURITY DEFINER functions, and security/performance advisors.
- Ran targeted live SQL for marketplace-like table names, storage bucket policies, public table policies, `pg_publication_tables`, view metadata, and public function grants.
- No app tests were run because Phase 0 was a read-only audit plus documentation update.

---

## Acceptance Criteria

- [x] Current codebase architecture summary is recorded.
- [x] Current Supabase schema and RLS/storage/function findings are recorded.
- [x] P2P exchange reuse boundaries are documented.
- [x] Store Owner route/surface implementation options are documented.
- [x] Login / first-run auth and Profile integration points for Store Owner entry are documented.
- [x] Current support/admin/payment/ledger/event primitives are documented.
- [x] Phase 1 risks and prerequisites are listed.
- [x] `DOC-13` is updated with Phase 0 status and handoff.

---

## Blockers

- No marketplace schema exists yet; Phase 1 must begin with a migration/security design review.
- Existing Supabase advisor issues must be either remediated separately or explicitly isolated before marketplace production launch.
- Store Owner gate, platform ops primitives, payment/ledger primitives, and marketplace storage buckets are absent.

---

## Decisions Made During Implementation

- Phase 0 did not create migrations, feature code, or schema changes.
- Phase 1 should start with a reviewed marketplace foundation migration plan, not direct coding of Store Owner UI.

---

## Spec Deviations

- None.

---

## Handoff Notes

Phase 0 audit is ready for founder/technical review. Recommended next step is to create a Phase 1 foundation schema and security implementation plan covering marketplace tenant tables, strict RLS, storage buckets, platform/admin primitives, policy config, and audit/event foundations before any UI work.
