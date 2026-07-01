# PHASE-5: Consumer Discovery

**Status:** `in_progress`
**Last updated:** 2026-07-01
**Phase goal:** Add a consumer marketplace section for bookstore listings inside the current app.

---

## Required Reading

- [DOC-5: Consumer Marketplace and Discovery](../DOC-5-consumer-marketplace-discovery.md)
- [DOC-3: Canonical Books, Metadata, and Inventory](../DOC-3-canonical-books-metadata-inventory.md)
- [DOC-6: Cart, Order Request, and Payment](../DOC-6-cart-order-request-payment.md)
- [DOC-11: Demand Signals, Bookclubs, and Places](../DOC-11-demand-signals-bookclubs-places.md)
- [DOC-16: Pilot and Unit Economics](../DOC-16-pilot-and-unit-economics.md)

---

## Scope

- Consumer marketplace entry point.
- Search by title, author, ISBN-10, and ISBN-13.
- Book result grouping across stores.
- Store availability cards.
- Public store pages.
- Policy/seller disclosure display.
- Lightweight unavailable-search capture for pilot learning.
- Single-store cart replacement warning if cart skeleton is introduced here.

---

## Implementation Units

| Unit | Status | Notes |
|---|---|---|
| Marketplace route/section | `in_progress` | Added `app/(tabs)/marketplace` tab and hidden nested public-store route. |
| Search service/query | `in_progress` | `consumerDiscoveryService` reads `marketplace_book_listings` only. ISBN-10/ISBN-13 exact search plus title/author partial search through public projection fields. |
| Book result grouping | `in_progress` | `canonical_edition_id` -> `isbn_13` -> normalized title/authors fallback. All store offers are shown when the same book is available at multiple stores. |
| Store availability cards | `in_progress` | Price, condition, condition notes, availability status, pickup/delivery, locality/city, confirmation message, and public-store navigation. |
| Public store page | `in_progress` | Reads `public_store_profiles` only. Shows public logo/cover/state/hours/return policy when projected. Excludes private fields. |
| Consumer disclosures | `in_progress` | Availability disclaimer, confirmation-before-payment, seller/store policy, support positioning. |
| Lightweight demand capture | `in_progress` | Live private `marketplace_search_events` and `book_demand_signals` tables plus SECURITY DEFINER RPC. No customer identity is exposed to stores. |
| Single-store cart guardrail | `not_started` | Not needed; no cart skeleton introduced in Phase 5. |
| Tests | `in_progress` | Marketplace service, hook, component, screen, route, and schema migration tests passing. |

---

## Verification Log

### 2026-07-01: App-side Phase 5 implementation

- Created `src/features/marketplace/` module with types, service, hooks, components, screens.
- `consumerDiscoveryService` reads ONLY `marketplace_book_listings` and `public_store_profiles`.
- Service never reads `store_inventory`, `stores`, P2P `listings`, or P2P `transactions`.
- Select lists exclude private fields such as shelf location, acquisition cost, internal notes, metadata confidence, seller documents, payout state, and suspension reason.
- Search: exact ISBN-10/ISBN-13 match via `eq`; title and author partial search via escaped `ilike` against public projection fields.
- Grouping: `canonical_edition_id` -> `isbn_13` -> normalized title/authors fallback. All store offers are shown, not collapsed.
- Store display names batch-loaded from `public_store_profiles` by returned `store_id`s.
- Public store page reads `public_store_profiles` only, including public `return_policy_type`.
- Marketplace tab registered in `app/(tabs)/_layout.tsx`.
- Disclosure copy includes confirmation-before-payment and seller/store policy/support positioning.
- No cart/order/payment implemented.

### 2026-07-01: Review follow-up fixes

- Implemented ISBN-10 exact search fallback, including ISBN-10 values with `X` check digit.
- Normalized title/authors fallback grouping by trimming and collapsing whitespace.
- Added stale in-flight search protection in `useMarketplaceSearch` so older responses cannot overwrite newer results.
- Marketplace search submit now triggers immediate search and disables search-bar autofocus on initial marketplace entry.
- Initial marketplace state now explains title/author/ISBN discovery before the user searches.
- Store offer cards now show availability status and public condition notes and navigate to the public store profile.
- Grouped results now render public cover images when available.
- Public store page now renders public cover/logo/state/operating-hours/return-policy fields when available and memoizes display listings.
- Consumer disclosure now includes the availability disclaimer, not only payment/seller/support copy.
- Fixed Expo Router tab registration for the nested marketplace route so the web build no longer warns that `marketplace` is missing.

### 2026-07-01: Supabase MCP schema follow-up

- Applied live migration `20260701062905 marketplace_phase5_consumer_discovery_schema` to project `ahntbtktjjmvfosgkmgn` through Supabase MCP.
- Added generated `marketplace_book_listings.authors_text` backed by immutable helper `public.marketplace_authors_text(public_authors)`.
- Added GIN trigram index `idx_marketplace_listings_authors_text_trgm` for author partial search and `idx_marketplace_listings_isbn10` for ISBN-10 lookup.
- Added `public_store_profiles.return_policy_type`, updated `marketplace_sec.sync_public_store_profile()`, and backfilled active public profiles from `stores`.
- Added private `marketplace_search_events` and `book_demand_signals` tables with RLS enabled and no broad table grants.
- Added SECURITY DEFINER RPC `public.record_marketplace_unavailable_search(...)` granted to `anon` and `authenticated`.
- App service records non-empty zero-result searches through the RPC and ignores capture failures so search availability is not blocked.
- Live SQL verification confirmed columns, indexes, RLS, RPC grants, and rollback-safe demand-capture smoke behavior.

### Test results

- `src/features/marketplace/services/__tests__/consumerDiscoveryService.test.ts`: passed.
- `src/features/marketplace/hooks/__tests__/useMarketplaceSearch.test.ts`: passed.
- `src/features/marketplace/components/__tests__/MarketplaceComponents.test.tsx`: passed.
- `src/features/marketplace/screens/__tests__/MarketplaceSearchScreen.test.tsx`: passed.
- `supabase/migrations/__tests__/marketplacePhase5ConsumerDiscoverySchema.test.ts`: passed.
- `app/(tabs)/__tests__/_layout.test.tsx`: passed.
- `app/(store-owner)/__tests__/_layout.test.tsx`: passed.
- `npx.cmd tsc --noEmit --pretty false`: passed after the 2026-07-01 review follow-up fixes.
- `npm.cmd run export:web`: previously passed after filesystem approval for Expo/Node access outside the workspace sandbox. Current schema follow-up rerun hit sandbox `EPERM` on `C:\Users\user`, and the elevated retry was blocked by the approval system usage limit.
- Local web route check against `http://localhost:8081` found no Expo Router warnings/page errors for `/marketplace`, `/marketplace/store/test-store`, `/dashboard`, `/inventory`, `/storefront`, or `/subscription`; the normal `.env` build redirects those unauthenticated routes to `/login`.

### Pending

- Phase 3 anonymous public-read RLS blocker must be resolved by Codex/owner before live smoke testing as anonymous consumer.
- Store-facing demand dashboards/aggregate insight surfaces remain later demand-signal work; Phase 5 only captures private zero-result demand safely.

---

## Acceptance Criteria

- [x] Customer can search marketplace books by title, author, ISBN-10, and ISBN-13.
- [x] Search groups copies of the same book across bookstores and displays every store offer with price and relevant availability details.
- [x] Customer sees price, condition, public condition notes, availability status, pickup, delivery, and confirmation requirement.
- [x] Customer sees public store return policy when opening a public store page.
- [x] Suspended/unverified stores are hidden by projection and service-level filters.
- [x] Private inventory fields are not exposed.
- [x] Customer sees required marketplace disclosures before checkout/payment, including availability disclaimer.
- [x] Unavailable searches can be captured for pilot learning without exposing customer identity to stores by default.
- [x] `DOC-13` is updated.

---

## Blockers

- Phase 3 anonymous public listing RLS remediation must be resolved before Phase 5 can be smoke-tested as a public/anonymous consumer surface. Owner/Codex must either:
  1. Apply `supabase/migrations/20260629000001_marketplace_phase3_public_listing_anon_helper_grants.sql`, or
  2. Implement a narrower policy split so the `anon` branch of `marketplace_book_listings` SELECT does not call owner/operator helper functions.

---

## Decisions Made During Implementation

- 2026-07-01: Created dedicated `src/features/marketplace/` module instead of putting consumer discovery into Store Owner screens.
- 2026-07-01: Implemented author partial search through `authors_text` generated from public author projection data.
- 2026-07-01: Store display names and return policy are loaded from `public_store_profiles` (not `stores`) to respect the public data boundary.
- 2026-07-01: Implemented unavailable-search capture as private analytics/demand tables behind a narrow RPC; stores do not receive customer identity or raw search rows by default.
- 2026-07-01: No cart skeleton introduced; single-store cart guardrail is not needed in Phase 5.

---

## Spec Deviations

- None for the Phase 5 app/schema scope. Store-facing demand dashboards are intentionally deferred to the later demand-signals phase while Phase 5 records private zero-result demand.

---

## Handoff Notes

Do not implement payment in this phase.

Phase 5 app and schema implementation is covered by focused marketplace tests and live Supabase MCP schema verification, but remains `in_progress` pending the Phase 3 anonymous public-read RLS blocker and a final anonymous consumer smoke.

Recommended next steps for Codex/owner:
1. Resolve Phase 3 anonymous public-read RLS blocker.
2. Run anonymous public-read smoke after the RLS blocker is resolved.
3. Keep payment-gated selling, orders, fulfillment, delivery, and Phase 7 commerce out of Phase 5 scope.
