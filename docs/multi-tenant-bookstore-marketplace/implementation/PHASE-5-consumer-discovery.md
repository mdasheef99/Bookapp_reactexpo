# PHASE-5: Consumer Discovery

**Status:** `in_progress`
**Last updated:** 2026-07-01
**Phase goal:** Add a consumer marketplace section for bookstore listings inside the current app.

---

## Required Reading

- [DOC-5: Consumer Marketplace and Discovery](../DOC-5-consumer-marketplace-discovery.md)
- [DOC-3: Canonical Books, Metadata, and Inventory](../DOC-3-canonical-books-metadata-inventory.md)
- [DOC-6: Cart, Order Request, and Payment](../DOC-6-cart-order-request-payment.md)
- [DOC-16: Pilot and Unit Economics](../DOC-16-pilot-and-unit-economics.md)

---

## Scope

- Consumer marketplace entry point.
- Search by title, author, ISBN.
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
| Marketplace route/section | `in_progress` | Added `app/(tabs)/marketplace` tab. |
| Search service/query | `in_progress` | `consumerDiscoveryService` reads `marketplace_book_listings` only. ISBN-10/ISBN-13 exact + title ilike. Author search deferred (schema gap). |
| Book result grouping | `in_progress` | canonical_edition_id -> isbn_13 -> normalized title/authors fallback. All offers shown. |
| Store availability cards | `in_progress` | Price, condition, condition notes, availability status, pickup/delivery, locality/city, confirmation message, and public-store navigation. |
| Public store page | `in_progress` | Reads `public_store_profiles` only. Shows public logo/cover/state/hours when projected. Excludes private fields. |
| Consumer disclosures | `in_progress` | Availability disclaimer, confirmation-before-payment, seller/store policy, support positioning. |
| Lightweight demand capture | `deferred` | No-op MVP placeholder. No analytics table created. Gap documented. |
| Single-store cart guardrail | `not_started` | Not needed — no cart skeleton introduced in Phase 5. |
| Tests | `in_progress` | 18 service tests plus marketplace hook/component/screen tests passing. Tab registration test previously passing. |

---

## Verification Log

### 2026-07-01: App-side Phase 5 implementation

- Created `src/features/marketplace/` module with types, service, hooks, components, screens.
- `consumerDiscoveryService` reads ONLY `marketplace_book_listings` and `public_store_profiles`.
- Service never reads `store_inventory`, `stores`, P2P `listings`, or P2P `transactions`.
- Select lists exclude all private fields (shelf_location, acquisition_cost_minor, internal_notes, metadata_confidence, etc.).
- Search: exact ISBN match via `eq` (high priority), title via escaped `ilike`.
- Author partial search NOT implemented — text[] array partial matching not practical through current Supabase filters. Documented as schema gap for Codex/Supabase MCP migration work.
- Grouping: canonical_edition_id -> isbn_13 -> normalized title/authors fallback. All store offers shown (not collapsed).
- Store display names batch-loaded from `public_store_profiles` by returned `store_id`s.
- Public store page reads `public_store_profiles` only (not `stores`).
- Marketplace tab registered in `app/(tabs)/_layout.tsx`.
- Disclosure copy includes confirmation-before-payment and seller/store policy/support positioning.
- Empty search returns no results without exposing customer identity.
- No cart/order/payment implemented.

### 2026-07-01: Review follow-up fixes

- Implemented ISBN-10 exact search fallback, including ISBN-10 values with `X` check digit.
- Normalized title/authors fallback grouping by trimming and collapsing whitespace.
- Added stale in-flight search protection in `useMarketplaceSearch` so older responses cannot overwrite newer results.
- Marketplace search submit now triggers immediate search and disables search-bar autofocus on initial marketplace entry.
- Initial marketplace state now explains title/ISBN discovery before the user searches.
- Store offer cards now show availability status and public condition notes and navigate to the public store profile.
- Grouped results now render public cover images when available.
- Public store page now renders public cover/logo/state/operating-hours fields when available and memoizes display listings.
- Consumer disclosure now includes the availability disclaimer, not only payment/seller/support copy.
- Fixed Expo Router tab registration for the nested marketplace route so the web build no longer warns that `marketplace` is missing.

### Test results

- `src/features/marketplace/services/__tests__/consumerDiscoveryService.test.ts`: 18/18 passed.
- `src/features/marketplace/hooks/__tests__/useMarketplaceSearch.test.ts`: passed.
- `src/features/marketplace/components/__tests__/MarketplaceComponents.test.tsx`: passed.
- `src/features/marketplace/screens/__tests__/MarketplaceSearchScreen.test.tsx`: passed.
- `app/(tabs)/__tests__/_layout.test.tsx`: 1/1 passed (marketplace tab registered).
- `app/(store-owner)/__tests__/_layout.test.tsx`: passed after removing runtime registration for the `__tests__` route.

### Pending

- Phase 3 anonymous public-read RLS blocker must be resolved by Codex/owner before live smoke testing as anonymous consumer.
- Author search schema gap requires migration (generated `authors_text` column or GIN index).
- `public_store_profiles` does not include `return_policy_type` — policy display on public store page is limited.
- `npx.cmd tsc --noEmit --pretty false`: passed after the 2026-07-01 review follow-up fixes.
- `npm.cmd run export:web`: passed after filesystem approval for Expo/Node access outside the workspace sandbox.
- Local web route check against `http://localhost:8081` found no Expo Router warnings/page errors for `/marketplace`, `/marketplace/store/test-store`, `/dashboard`, `/inventory`, `/storefront`, or `/subscription`; the normal `.env` build redirects those unauthenticated routes to `/login`.

---

## Acceptance Criteria

- [x] Customer can search marketplace books by title, ISBN-10, and ISBN-13. (Author search deferred as a schema gap.)
- [x] Search groups copies of the same book across bookstores.
- [x] Customer sees price, condition, public condition notes, availability status, pickup, delivery, and confirmation requirement.
- [x] Suspended/unverified stores are hidden (RLS projection + service-level filters).
- [x] Private inventory fields are not exposed.
- [x] Customer sees required marketplace disclosures before checkout/payment, including availability disclaimer.
- [ ] Unavailable searches can be captured for pilot learning without exposing customer identity to stores by default. Deferred; no safe analytics/demand table exists yet.
- [x] `DOC-13` is updated.

---

## Blockers

- Phase 3 anonymous public listing RLS remediation must be resolved before Phase 5 can be smoke-tested as a public/anonymous consumer surface. Owner/Codex must either:
  1. Apply `supabase/migrations/20260629000001_marketplace_phase3_public_listing_anon_helper_grants.sql`, or
  2. Implement a narrower policy split so the `anon` branch of `marketplace_book_listings` SELECT does not call owner/operator helper functions.
- Author partial search requires a schema migration (generated `authors_text` column or GIN index on `public_authors`).

---

## Decisions Made During Implementation

- 2026-07-01: Created dedicated `src/features/marketplace/` module instead of putting consumer discovery into Store Owner screens.
- 2026-07-01: Author partial search deferred — text[] array partial matching not practical through current Supabase filters without schema change.
- 2026-07-01: Store display names batch-loaded from `public_store_profiles` (not `stores`) to respect public data boundary.
- 2026-07-01: Unavailable-search capture remains deferred. No privacy-sensitive analytics table was created.
- 2026-07-01: No cart skeleton introduced — single-store cart guardrail not needed in Phase 5.

---

## Spec Deviations

- Author search not implemented in Phase 5 due to Supabase text[] filter limitation. Documented as schema gap for Codex/Supabase MCP migration work.
- Unavailable-search capture is not implemented because no safe demand-capture table or API exists yet.
- `public_store_profiles` does not include `return_policy_type` — public store page cannot display store-specific return policy. This is a projection gap that may require a migration to add the field to `public_store_profiles`.

---

## Handoff Notes

Do not implement payment in this phase.

Phase 5 app-side implementation is improved and covered by focused marketplace tests, but remains `in_progress` pending the RLS blocker, author-search schema work, and demand-capture decision. Once Codex/owner resolves the Phase 3 anon RLS blocker and the author-search schema gap, the app can be smoke-tested as a public/anonymous consumer surface.

Recommended next steps for Codex/owner:
1. Resolve Phase 3 anonymous public-read RLS blocker.
2. Add `authors_text` generated column or GIN index for author partial search.
3. Consider adding `return_policy_type` to `public_store_profiles` projection.
4. Decide whether Phase 5 needs unavailable-search capture now or whether it should move to a later demand-signals phase.
5. Run anonymous public-read smoke after the RLS blocker is resolved.
