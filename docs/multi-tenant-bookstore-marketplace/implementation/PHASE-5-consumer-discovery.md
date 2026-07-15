# PHASE-5: Consumer Discovery

**Status:** `in_progress`
**Last updated:** 2026-07-15
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
- Search public bookstores by store name.
- Book result grouping across stores.
- Public book-detail availability across stores.
- Store availability cards.
- Public store pages.
- Policy/seller disclosure display.
- Lightweight unavailable-search capture for pilot learning.
- Single-store cart replacement warning if cart skeleton is introduced here.

---

## Implementation Units

| Unit | Status | Notes |
|---|---|---|
| Marketplace route/section | `locally_complete` | Marketplace tab plus nested public-store and public-book availability routes. |
| Search service/query | `locally_complete` | Reads only `marketplace_book_listings` and `public_store_profiles`; supports ISBN/title/author/store-name search, safe quoted filters, runtime validation, paging, retry, and stale-query protection. |
| Book result grouping | `locally_complete` | `canonical_edition_id` -> `isbn_13` -> normalized title/authors fallback. All store offers are shown and link to book availability detail. |
| Store availability cards | `in_progress` | Price, condition, condition notes, availability status, pickup/delivery, locality/city, confirmation message, and public-store navigation. |
| Public store page | `in_progress` | Reads `public_store_profiles` only. Shows public logo/cover/state/hours/return policy when projected. Excludes private fields. |
| Consumer disclosures | `in_progress` | Availability disclaimer, confirmation-before-payment, seller/store policy, support positioning. |
| Lightweight demand capture | `in_progress` | Live private `marketplace_search_events` and `book_demand_signals` tables plus SECURITY DEFINER RPC. No customer identity is exposed to stores. |
| Single-store cart guardrail | `not_started` | Not needed; no cart skeleton introduced in Phase 5. |
| Tests | `locally_complete` | Marketplace service, hook, component, screen, route, and schema migration tests pass; TypeScript and production web export pass. |

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

### 2026-07-15: Phase 5 review remediation

- Added red tests before production changes for PostgREST filter grammar, malformed projection rows, explicit pagination, submit/debounce duplication, retry/copy, book-detail navigation, anonymous policy separation, pilot-locality gating, and demand RPC hardening.
- Split the 368-line discovery service into typed query/orchestration, schema/mapping, and deterministic helper modules; all production Phase 5 files are below 300 lines.
- Added Zod runtime validation for public listing and store-profile responses.
- Added store-name search through `public_store_profiles` only and public book-offer detail through `marketplace_book_listings` only.
- Added explicit page ranges, retry actions, safe quoted `or` filters, and immediate-submit debounce cancellation.
- Added migration `20260715000002_marketplace_phase5_discovery_hardening.sql`: narrow anonymous/authenticated public policies, pilot-locality gates, explicit anon private-inventory SELECT revoke, 90-day search/demand expiry metadata, and a bounded fixed-context rate-limited demand RPC returning only boolean success.
- Verification: relevant Jest 8 suites/54 tests passed; `npx.cmd tsc --noEmit --pretty false` passed; `npm.cmd run export:web` passed; `git diff --check` passed.
- This remediation was committed and pushed to `main` in commit `3ff5c3d7c3676094ab05dee708dbbd6b6590fb43`.

### 2026-07-15: Live discovery hardening deployment

- Applied `20260713000001_marketplace_phase3_public_listing_policy_split.sql` live as `20260715155047 marketplace_phase3_public_listing_policy_split`.
- Applied `20260715000002_marketplace_phase5_discovery_hardening.sql` live as `20260715155103 marketplace_phase5_discovery_hardening`.
- Verified the anonymous listing policy contains only public eligibility and pilot-locality checks; private `marketplace_sec` owner/operator helpers occur only in the authenticated policy.
- Verified anonymous and authenticated public-profile reads require an eligible store in a pilot-enabled locality.
- Verified `anon` can select public listings/profiles but cannot select `store_inventory`, access `marketplace_sec`, or read/write the private search/demand tables.
- Verified the only live demand-capture overload is `record_marketplace_unavailable_search(text) returns boolean`, with `SECURITY DEFINER`, blank `search_path`, bounded input, fixed source/no location, rate limiting, deduplication, and 90-day retention.
- Security advisor findings for the three private demand tables are intentional `RLS enabled with no policy` informational notices; the anonymous-callable SECURITY DEFINER warning is expected for the deliberately public, constrained capture RPC.
- Live listing, public-profile, search-event, and demand-signal row counts remain zero. No RPC smoke call or disposable fixture was created.

### Pending

- Anonymous/authenticated positive live discovery and demand-RPC smoke require an approved disposable public listing fixture; the migrations and read-only structural verification are complete.
- Store-facing demand dashboards/aggregate insight surfaces remain later demand-signal work; Phase 5 only captures private zero-result demand safely.

---

## Acceptance Criteria

- [x] Customer can search marketplace books by title, author, ISBN-10, and ISBN-13.
- [x] Customer can find public bookstores by store name.
- [x] Customer can open public book-detail availability across eligible stores.
- [x] Search groups copies of the same book across bookstores and displays every store offer with price and relevant availability details.
- [x] Customer sees price, condition, public condition notes, availability status, pickup, delivery, and confirmation requirement.
- [x] Customer sees public store return policy when opening a public store page.
- [x] Suspended/unverified stores are hidden by projection and service-level filters.
- [x] Private inventory fields are not exposed.
- [x] Customer sees required marketplace disclosures before checkout/payment, including availability disclaimer.
- [x] Unavailable searches can be captured for pilot learning without exposing customer identity to stores by default.
- [x] Public reads enforce pilot-locality eligibility in the prepared local hardening migration.
- [x] Public projection responses are runtime-validated and search input cannot alter PostgREST filter grammar.
- [x] `DOC-13` is updated.

---

## Blockers

- Positive anonymous/authenticated discovery smoke is operationally pending because the live marketplace currently has zero public listing/profile rows; creating a disposable fixture requires separate authorization.

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

Phase 5 is locally complete and its hardening migrations are live, but it remains `in_progress` overall until anonymous/authenticated positive consumer smoke passes.

Recommended next steps for Codex/owner:
1. With separately approved disposable data, run anonymous and authenticated public discovery plus bounded demand-capture smoke, then clean up.
2. Keep payment-gated selling, orders, fulfillment, delivery, and Phase 7 commerce out of Phase 5 scope.
