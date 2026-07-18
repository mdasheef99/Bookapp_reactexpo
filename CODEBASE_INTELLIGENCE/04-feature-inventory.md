# 04 - Feature Inventory

## Library And Books

Routes:

- `app/(tabs)/library/index.tsx`
- `app/(tabs)/library/search.tsx`
- `app/(tabs)/library/[bookId].tsx`
- `app/(tabs)/library/notes.tsx`

Services/hooks:

- `src/features/books/services/booksService.ts`
- `src/features/books/services/notesService.ts`
- `src/features/books/hooks/useLibraryBooks.ts`

Owns:

- user library
- Google Books search/manual entry
- `books`
- `user_books`
- reading notes
- wishlist-style ownership patterns

Marketplace reuse:

- `books` may seed/reference metadata.
- Do not assume it is the complete canonical marketplace metadata layer.

## Exchange / P2P

Routes:

- `app/(tabs)/exchange/index.tsx`
- `app/(tabs)/exchange/create.tsx`
- `app/(tabs)/exchange/[listingId].tsx`
- `app/(tabs)/exchange/my-transactions.tsx`
- `app/(tabs)/exchange/transaction/[transactionId].tsx`

Services/hooks:

- `src/features/exchange/services/listingsService.ts`
- `src/features/exchange/services/transactionsService.ts`
- `src/features/exchange/services/addressesService.ts`
- `src/features/exchange/services/ratingsService.ts`
- `src/features/exchange/hooks/useListings.ts`
- `src/features/exchange/hooks/useTransactions.ts`
- `src/features/exchange/hooks/useAddresses.ts`
- `src/features/exchange/hooks/useRatings.ts`
- `src/features/exchange/utils/transactionActionResolver.ts`

Owns:

- peer listings
- borrower/lender transactions
- credits
- meetup/shipping paths
- ratings/disputes

Marketplace boundary:

- Do not reuse P2P `listings` as store inventory.
- Do not reuse P2P `transactions` as store orders.
- Do not reuse borrower/lender credit assumptions for bookstore commerce.
- Reuse only generic UI/testing/service patterns after review.

## Clubs

Routes:

- `app/(tabs)/clubs/index.tsx`
- `app/(tabs)/clubs/create.tsx`
- `app/(tabs)/clubs/authors.tsx`
- `app/(tabs)/clubs/invitations.tsx`
- `app/(tabs)/clubs/venues.tsx`
- nested routes under `app/(tabs)/clubs/[clubId]/`

Services/screens:

- `src/features/clubs/services/clubsService.ts`
- `src/features/clubs/services/clubsManagementService.ts`
- `src/features/clubs/services/clubsMembershipService.ts`
- `src/features/clubs/services/clubsInvitationsService.ts`
- `src/features/clubs/services/clubsEventsService.ts`
- `src/features/clubs/services/clubsDiscussionService.ts`
- `src/features/clubs/screens/`
- `src/features/clubs/screens/manage/`

Owns:

- club browse/detail/create/manage
- membership
- applications/invitations
- discussions
- events
- venue links
- nominations/current book
- moderation/admin transfer flows

Reusable patterns:

- feature service split by responsibility
- focused screen components
- many Jest examples for complex UI state
- entitlement error normalization patterns

## Venues

Routes/screens:

- `app/(tabs)/clubs/venues.tsx`
- `app/(tabs)/clubs/venues/[venueId].tsx`
- `src/features/venues/screens/VenuesBrowseScreen.tsx`
- `src/features/venues/screens/VenueDetailScreen.tsx`

Services/hooks/components:

- `src/features/venues/services/venuesService.ts`
- `src/features/venues/hooks/useVenues.ts`
- `src/features/venues/components/VenueCard.tsx`
- `src/features/venues/components/VenueTypeBadge.tsx`

Marketplace reuse:

- useful for locality/place patterns later
- not part of MVP store commerce

## Notifications

Routes:

- `app/(tabs)/profile/notifications.tsx`
- `app/(tabs)/profile/notification-settings.tsx`

Services/hooks:

- `src/features/notifications/services/notificationsService.ts`
- `src/features/notifications/hooks/useNotifications.ts`
- `src/features/notifications/types.ts`
- `supabase/functions/send-notification/index.ts`
- notification migrations `20260606103405_enterprise_notifications.sql` through
  `20260606143000_wishlist_notify_rpc.sql` under `supabase/migrations/`

Owns:

- in-app notification delivery
- preferences
- push token flow
- event routing/reminders

Marketplace reuse:

- use patterns for future marketplace notifications, but keep marketplace event visibility restricted through projections.

## Profile / Account

Routes:

- `app/(tabs)/profile/index.tsx`
- `app/(tabs)/profile/settings.tsx`
- `app/(tabs)/profile/edit.tsx`
- `app/(tabs)/profile/addresses.tsx`
- `app/(tabs)/profile/credit-history.tsx`
- `app/(tabs)/profile/notifications.tsx`
- `app/(tabs)/profile/notification-settings.tsx`

Owns:

- consumer account hub
- settings
- profile edit
- addresses
- credit history
- notification preferences

Marketplace reuse:

- Profile is the correct signed-in entry point for "Apply as Bookstore" or "Store Owner Console".
- Do not use consumer profile fields as Store Owner authorization.

## Store Owner / Marketplace Onboarding

Routes:

- `app/(store-owner)/index.tsx`
- `app/(store-owner)/onboarding.tsx`
- `app/(store-owner)/status.tsx`
- `app/(store-owner)/setup.tsx`
- `app/(store-owner)/dashboard.tsx`
- `app/(store-owner)/inventory.tsx`
- `app/(store-owner)/storefront.tsx`
- `app/(store-owner)/subscription.tsx`
- `app/(store-owner)/orders/index.tsx`
- `app/(store-owner)/orders/[requestId].tsx`
- `app/(tabs)/marketplace/index.tsx`
- `app/(tabs)/marketplace/cart.tsx`
- `app/(tabs)/marketplace/requests/index.tsx`
- `app/(tabs)/marketplace/requests/[requestId].tsx`

Services/hooks/screens:

- `src/features/stores/services/storeDashboardService.ts`
- `src/features/stores/services/storeOwnerService.ts`
- `src/features/stores/services/storeInventoryService.ts`
- `src/features/stores/services/storeProfileService.ts`
- `src/features/stores/services/storeSubscriptionService.ts`
- `src/features/stores/hooks/useStoreInventory.ts`
- `src/features/stores/hooks/useStoreOwnerGate.ts`
- `src/features/stores/screens/StoreDashboardScreen.tsx`
- `src/features/stores/screens/StoreOwnerGateScreen.tsx`
- `src/features/stores/screens/StoreOnboardingScreen.tsx`
- `src/features/stores/screens/StoreReviewStatusScreen.tsx`
- `src/features/stores/screens/StoreSetupChecklistScreen.tsx`
- `src/features/stores/screens/StoreInventoryScreen.tsx`
- `src/features/stores/screens/StoreProfileScreen.tsx`
- `src/features/stores/screens/SubscriptionStatusScreen.tsx`
- `src/features/stores/components/AddInventoryForm.tsx`
- `src/features/stores/components/EditModal.tsx`
- `src/features/stores/components/InventoryItem.tsx`
- `src/features/stores/types.ts`
- `src/features/marketplace/commerce/`
- `src/features/marketplace/services/consumerDiscoveryService.ts`
- `src/features/notifications/services/notificationsService.ts`

Edge Functions:

- `supabase/functions/store-application/index.ts`
- `supabase/functions/store-review/index.ts`
- `supabase/functions/_shared/marketplaceAuth.ts`

Owns:

- Store Owner access gate.
- Store application start/resume/save/submit.
- Private seller verification document metadata.
- Platform review state transitions.
- Approved-pending-setup status and setup checklist display.
- Basic founding-trial subscription/entitlement assignment on approval.
- Manual inventory draft entry for active owners.
- Public listing projection reads through `marketplace_book_listings`, including grouped book results by canonical edition/ISBN.
- Owner-scoped publish/pause/edit service methods for store inventory, with publish validation, manual draft entry, duplicate check, search/filter chips, edit modal, low/out-of-stock badges, and bulk publish/pause.
- Store Owner dashboard aggregation for inventory health, entitlement/usage quotas, subscription status, operational placeholders, and compliance blockers.
- Storefront/profile settings for public name/description, weekly operating hours, temporary closure, return policy, pickup, delivery, and minimum delivery order value.
- Subscription/quota screen that shows the store's own subscription, entitlement limits, usage counters, feature locks, and null-plan fallback.
- Phase 3 inventory/canonical/listing migration is live-applied on Supabase MCP project `ahntbtktjjmvfosgkmgn` as `20260628181842 marketplace_phase3_inventory_canonical_listings`.
- Phase 5 public discovery, profiles, canonical grouping, offer comparison, and unavailable-search capture are complete and accepted.
- Phase 6 provides a single-store cart, atomic unpaid request submission, full/partial/unavailable/rejection outcomes, clarification/support, soft/firm holds, cancellation/expiry, provider-independent `payment_ready`, canonical events/inbox, scheduler/task worker, and reconciliation/observability.
- Phase 6 ends before provider payment, paid order, ledger, pickup, refund, or settlement.

Marketplace boundary:

- Store Owner authority comes from `store_administrators` and review authority comes from `platform_user_roles`.
- Do not trust route params, local storage, request body actor IDs, or `user_profiles.account_type`.
- Approval does not make stores sellable; it keeps `setup_status = incomplete` and `selling_status = not_allowed`.
- Inventory/listing code must stay separate from P2P `listings`; Phase 3 uses `store_inventory` and `marketplace_book_listings`.
- Consumer discovery must use public projection/service boundaries, not raw `store_inventory`; private fields such as acquisition cost, internal notes, shelf location, and verification documents must stay out of Phase 5 UI/services.
- Phase 9 inventory writes must use controlled server-side commands and preserve `quantity_total = quantity_available + quantity_reserved + quantity_sold + quantity_removed`; never overwrite reserved/sold buckets from OCR review UI.
- Phases 7 and 8 are deferred. Phase 9 must not create provider objects, paid orders, pickup codes, ledger entries, refunds, or settlement state.
