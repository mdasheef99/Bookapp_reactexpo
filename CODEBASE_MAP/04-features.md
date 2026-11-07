# 04 — Feature Modules

**Last checked:** 2026-10-24, against the code and the documents it cites.

Each module lives in `src/features/<name>/`. Typical subfolders are `services/`
or `api/` (backend calls), `hooks/` or `queries/` (TanStack Query), `screens/`,
`components/`, `contracts/` (Zod schemas) and `__tests__/`.

The app has two halves that must stay separate:

- **Consumer social app** — Library, Exchange (P2P), Clubs, Venues, Notifications, Profile.
- **Bookstore marketplace** — Stores, Image inventory, Store View, Marketplace discovery and Commerce.

## Bookstore marketplace

### Stores — `src/features/stores/`

Store Owner gate, onboarding and console basics.

- Services: `storeOwnerService` (gate reads of `store_administrators` /
  `store_verification_requests`; application via `store-application`),
  `storeProfileService` (direct `stores` reads; updates via `store-profile`),
  `storeDashboardService` and `storeSubscriptionService` (direct table reads).
- **Shared Owner gate:** `hooks/useStoreOwnerGate.ts`. Image inventory identity,
  the Owner orders screen and nearly every Store Owner console screen (gate,
  onboarding, review status, setup checklist, dashboard, profile, subscription)
  use it to resolve the Owner's store, so a change here affects the whole console.
- **Approval does not make a store sellable.** A `store-review` approval sets
  `setup_status = incomplete` and `selling_status = not_allowed`. Selling becomes
  `allowed` only when the Owner completes setup through `store-profile`, which
  checks profile, hours, fulfillment, return policy, payout, agreements and an
  trialing, active or grace-period subscription. Rejection keeps `not_allowed`;
  suspend and restrict set `restricted`.
- Screens: `StoreOwnerGateScreen`, `StoreOnboardingScreen`,
  `StoreReviewStatusScreen`, `StoreSetupChecklistScreen`, `StoreDashboardScreen`,
  `StoreProfileScreen`, `SubscriptionStatusScreen`.
- **Legacy, not routed:** `StoreInventoryScreen`, `useStoreInventory`,
  `storeInventoryService`, `AddInventoryForm`, `EditModal`, `InventoryItem`,
  `InventoryBulkActions`. These are the old Phase 3/4 manual inventory UI. No
  route mounts them; they are reachable only from their own tests. Do not extend
  them; inventory work belongs in Image inventory and Store View.
- `components/InventoryFilterPanel.tsx` also belongs to the legacy UI; its only
  caller is `StoreInventoryScreen`.

### Image inventory (Phase 9) — `src/features/imageInventory/`

The Owner scan-to-inventory workflow: start a scan session, photograph shelves,
let the server read spines and look up metadata, review each detected book
("candidate"), then explicitly **Add to Inventory**.

| Folder | Contents |
| --- | --- |
| `api/` | Backend calls. Through the `phase9-owner-ingestion` Edge Function: `captureService`, `ownerUxService`/`ownerUxTransport`, `ownerBatchReviewService`, `ownerEditionPickerService`/`ownerEditionPickerCommands`, `publicationService`. Direct SQL RPCs instead: `ownerCorrectionService` (see 03); `ownerInventoryReadService` now holds only the owner-inventory cache contract version and filter types |
| `contracts/` | Client-side Zod contracts mirroring the server contracts |
| `capture/` | Capture workflow context, upload transport, cancellation, duplicate-image confirmation, input removal |
| `review/` | Compact drafts, edition-selection drafts, missed-book form, leave guard |
| `commit/` | Add to Inventory coordination. Batch behaviour (how many commits run at once) is in `inventoryCommitBatchExecution.ts`; `inventoryCommitCoordinator.ts` / `useInventoryCommitCoordinator.ts` drive it; the UI is `components/BatchInventoryCommitControls.tsx` |
| `queries/` | Query keys, reads and cache rules per area (owner UX, batch review, edition picker, inventory read cache keys, publication) |
| `identity/` | Owner identity fencing so stale responses from a previous user are dropped |
| `close/` | Auto-close of completed scan sessions |
| `offline/`, `telemetry/`, `navigation/`, `scanSetup/` | Offline gate, telemetry, route helpers, scan defaults form |
| `screens/` | `InventoryFoundationScreens` (route entry points incl. `InventoryHubFoundationScreen`), `CaptureScreens`, `CaptureProgressScreens`, `MissedBookScreen`, `ReadinessSummaryScreen`, `InventoryAccessBoundary` |
| `components/` | Review cards and fields, edition picker (`CandidateEditionPicker`, `EditionOptionList`, `CandidateMetadataSheet`), confirmation dialogs, post-scan summary |
| `testing/` | Shared test fixtures |

Every Image inventory Owner screen is wrapped in `InventoryAccessBoundary`
(Store View has its own `StoreViewAccessBoundary`, below). Server code for this
feature is in `supabase/functions/_shared/imageInventory/` and `workers/` (see 03).
Source-scanning architecture tests restrict what code may do in this module
(see 06 "Architecture guard tests").

`review/compactReviewDraft.ts` derives a manual review's script during validation,
after deciding its metadata choice. `contracts/ownerUxValidation.ts` holds the
shared language/script map, app coherence rule and server-rule mirror. The card's
edit tracking uses the original script accessor. Scan setup and the card language
chooser share `scanSetup/scanSetupForm.ts`'s language options (including Kannada,
Telugu and Malayalam). See [post-scan SDD-1 §6](../docs/multi-tenant-bookstore-marketplace/implementation/phase-9-image-inventory/work-units/post-scan-rework/01-review-screen-sdd.md#6-slice-4--remove-full-correction-simplify-add-a-book).

Typed-ISBN search starts at `components/CandidateEditionIsbnSearch.tsx` in the
edition picker. `queries/ownerEditionPickerIsbnMutation.ts` coordinates review
save, ISBN save, authoritative reread and edition lookup;
`queries/ownerMissedBookIsbnFlow.ts` coordinates the Add-a-book ISBN flow.
Shared normalization and recovery helpers live in `review/isbn.ts` and
`review/isbnSearchRecovery.ts`.

### Store View — `src/features/storeView/`

Management of books already added to inventory: list, detail, edit, stock
adjustments, photos, history and publication to the marketplace. Routes are
`app/(store-owner)/store-view/` (`index` → `StoreViewListScreen`,
`[inventoryId]` → `StoreViewDetailScreen`; the route validates the id as a UUID,
and `navigation/storeViewRoutes.ts` builds the paths).

Rule of thumb: **Inventory acquires and reviews; Store View manages what was committed.**

| Folder | Contents |
| --- | --- |
| `api/` | One service per contract family, all calling `phase9-owner-ingestion`: `storeViewService` (page, detail), `storeViewManagementService` (save details, adjust stock), `storeViewMediaService` (read, reorder, remove, replace photos), `storeViewHistoryService` |
| `contracts/` | Zod schemas and `decode…Response` for each family; each family has its own `…_CONTRACT_VERSION` constant. Item, filter, attention-reason and capability enums live in `storeViewContracts.ts` |
| `queries/` | TanStack Query hooks, query keys and mutation hooks (`storeViewQueries`, `storeViewManagementQueries`, `storeViewMediaQueries`/`storeViewMediaCommands`, `storeViewHistoryQueries`) |
| `forms/` | `storeViewEditForm.ts`: draft, validation and the diff that builds the `changes` payload |
| `components/` | `StoreViewCard`, `StoreViewActions`, the edit, stock and manage-photos modals, `StoreViewHistorySection`, and `storeViewPresentation.ts` (labels, `formatPrice`, `stockLabel`) |
| `screens/` | `StoreViewListScreen`, `StoreViewDetailScreen`, `StoreViewAccessBoundary` |

Server actions the module calls (the RPC behind each is dispatched in
`supabase/functions/_shared/imageInventory/runtime/ownerIngestion.ts`, with the
Store View branches in `runtime/storeView*.ts`):

| Action | RPC |
| --- | --- |
| `read_store_view_page` | `phase9_store_view_page_v2` |
| `read_store_view_detail` | `phase9_store_view_detail_v1` |
| `read_store_view_media` / `reorder_` / `remove_` / `replace_store_view_media` | `phase9_store_view_media_v1` / `phase9_reorder_` / `phase9_remove_` / `phase9_replace_store_view_media_v1` |
| `read_store_view_history` | `phase9_store_view_history_v1` |
| `update_store_inventory_details` | `phase9_update_store_inventory_details_v1` |
| `adjust_inventory_stock` | `phase9_adjust_inventory_stock_v2` |
| `set_publication_state` (intent `publish`, `pause` or `private`), `retry_publication` | `phase9_set_publication_state_v2`, `phase9_retry_publication_owner_v1`: reused from Image inventory (`imageInventory/api/publicationService.ts`, `queries/publicationQueries.ts`), not duplicated here |
| `authorize_public_copy` (with `operationKind`, for photo replace/add) | `phase9_authorize_store_view_media_upload_v1`, then a signed Storage upload |

How it behaves:

- **Server decides what is shown and allowed.** The list filter (`all`, `private`,
  `live`, `paused`, `needs_attention`, `out_of_stock`) is applied by the server
  before cursor pagination (page size 20 from the app). Each item carries
  `lifecycle` states, `attention.attentionReasons` and a `capabilities` array
  (`edit_details`, `adjust_stock`, `manage_photos`, `publish`, `pause`,
  `republish`, `make_private`, `retry_publication`); `StoreViewActions` renders
  only the buttons the server allows. Attention reasons are a server enum
  (for example `missing_price`, `damage_evidence_required`,
  `active_listing_limit_reached`, `publication_failed`); the list card shows only
  a "Needs attention" badge, and the detail screen lists the reasons as text with
  no per-reason fix action.
- **Prices are integer paise.** `sellingPriceMinor` is paise; the edit form takes a
  whole non-negative paise value and `formatPrice` shows INR using `en-IN`.
- **Every write is versioned and idempotent.** Save, stock and photo commands send
  `expectedInventoryVersion`, an `idempotencyKey` and a `commandId` (made by
  `createCaptureAttempt` from Image inventory), and refuse to run while offline.
  Publication commands also send `expectedPublicationIntentVersion`. A
  `P9_VERSION_CONFLICT` response makes the detail screen refetch and ask the Owner
  to retry. There is no bulk action; each command targets one `inventoryId`.
  The stock modal checks only that the change is a whole number in range; the
  server decides whether available stock would go negative
  (`P9_QUANTITY_INVARIANT_FAILED`), and the detail screen then refetches.
- **Access loss clears everything.** HTTP 401/403 or an access-lost code from any
  read or command on either screen calls `removeStoreViewCachesForIdentity`
  (`queries/storeViewInvalidation.ts`), which removes every Store View page,
  detail, summary, media and history cache for that user and store.
- **Activity is shown once per action.** Each command writes an audit row and an
  event row with the same `commandId`; `filterStoreViewActivity`
  (`StoreViewHistorySection.tsx`) hides the event when its audit is present.
- **Private versus public fields.** `shelfLocation` and `internalNotes` appear only
  in the detail response (`privateOperations`), labelled "Owner only"; they never
  reach consumer screens (see 05).
- **Search, sort, sale prices, promotions and campaigns are not in this module.**
  The only list controls are the filter chips and "Load more".

Query keys and cache:

- Store View, media and history keys are built in `queries/*Queries.ts` from
  `imageInventoryKeys.identity(identity)` plus a family segment and contract
  version, so they live under the Image inventory root and are removed by
  `clearImageInventoryPrivateQueries` on user switch or logout (see 02).
- Each file also exports an `all` key (`[...imageInventoryKeys.all, 'storeView',
  version]`) used for invalidation after commands. TanStack Query matches
  invalidation keys **by prefix**, and stored keys start
  `[...imageInventoryKeys.all, 'identity', userId, storeId, …]`. When you add a
  query or change an invalidation, check that the key you invalidate is a
  prefix of the keys actually stored.
- Detail-screen commands: save/stock invalidate Store View and
  `ownerInventoryReadKeys`; photo commands invalidate Store View, media and
  history; publication commands invalidate `imageInventoryKeys.all`,
  `ownerInventoryReadKeys.all` and `['marketplace']`.

Access and guards:

- `StoreViewAccessBoundary` wraps `useImageInventoryIdentity` (the same Owner
  identity as Image inventory) and passes `identity` to the list and detail
  content; it shows a loading state, then "Store View unavailable" for anyone
  without active Store Owner access.
- `__tests__/storeViewManagementArchitecture.test.ts` follows the imports from the
  detail route and requires them to include `storeViewManagementService`,
  `publicationQueries` and `publicationService`, to exclude the legacy
  `storeInventoryService`, and to forbid direct `store_inventory` /
  `marketplace_book_listings` table access. See 06.

### Marketplace discovery — `src/features/marketplace/`

Customer-facing search and store pages.

- `services/consumerDiscoveryService.ts` — the only data source; reads public
  projections and public RPCs only. One side effect: a search with no results is
  logged best-effort by `recordUnavailableSearch` (RPC
  `record_marketplace_unavailable_search`, a demand signal), which
  `useMarketplaceSearch` calls.
- Flow: search bookstores → a store's public catalogue (`marketplace/store/[storeId]`)
  → one listing's detail (`marketplace/book/[listingId]`, `PublicBookOffersScreen`
  using `usePublicListingDetail`), which adds that copy to the cart.
- Hooks: `useMarketplaceSearch`, `usePublicBookOffers`, `usePublicListingDetail`,
  `usePublicStoreProfile`, `useStorefrontCatalogue`.
- Screens: `MarketplaceSearchScreen`, `PublicBookOffersScreen`, `PublicStoreScreen`.
- Components: bookstore result cards, grouped book card, store offer card,
  disclosure banner.

### Commerce (Phase 6) — `src/features/marketplace/commerce/`

Single-store cart, unpaid order requests, Owner decisions, holds and expiry, up
to `payment_ready`. No payment, pickup fulfillment or settlement.

- Domain: `vocabulary.ts`, `schemas.ts`, `eligibility.ts`, `timeEngine.ts`.
- Services: `customerCommerceService`, `ownerCommerceService`, `commandIdentity`,
  `commerceSession` (logout cleanup).
- State: `store/commerceStore.ts`. Hooks: `useCustomerCommerce`, `useOwnerCommerce`.
- Screens: customer cart, request list, request detail; Owner orders and order detail.
- Backend: Phase 6 migrations (Phase 6 M01–M39, files `20260716000001…000039`),
  `commerce-scheduler`, `commerce-task-worker`.

## Consumer social app

### Library — `src/features/books/`

Personal library, book search and reading notes. `booksService` searches Google
Books and Open Library and reads/writes `books` and `user_books`;
`notesService` defines note types and category presentation; `notes/manualNotesGateway.ts`
handles note reads/writes. `hooks/useSearchBookActions.ts` holds the
search result actions; `utils/libraryShelf.ts` supplies the shelf
filters and counts, and `src/components/library/LibraryShelf.tsx` renders the
shelf.
UI is in `src/components/library/` (library catalogue search components in
`library/search/`) and `src/components/notes/`; `src/components/search/` keeps only
the shared `SearchBar` and `SkeletonCard`, also used outside the library.

Library note retrieval entry points:

- `app/(tabs)/library/notes.tsx` combines category filtering with search over
  loaded notes through `notes/noteSearch.ts` and
  `src/components/notes/NoteSearchField.tsx`.
- `notes/manualNotesGateway.ts` reads the deck index from `reading_notes`,
  then loads note bodies and their `user_books`/`books` metadata in batches.
  `notes/noteDeck.ts` handles scope, seeded ordering, categories and position
  reconciliation; `notes/useNoteDeck.ts` and `notes/noteDeckCache.ts` manage
  queries and card loading. `notes/noteSwipeConstants.ts` holds batch and
  gesture settings, and `notes/noteNavigation.ts` carries reader return state.
- `src/components/library/notes-swipe/` holds `NoteSwipeHomeTile`,
  `NoteSwipeCard`, `NoteSwipeStack`, `NoteFullNoteSheet`, `NoteOrderMenu`,
  `NoteDeckChips` and `useNoteSwipeMotion`. Library Home opens the all-notes
  deck; the per-book Notes screen opens a book-scoped deck and a collection's
  screen opens a collection-scoped deck, all at
  `app/(tabs)/library/notes-swipe.tsx`.
- `history/onThisDay.ts` matches finished reads from earlier years to a
  calendar day. `src/components/library/history/OnThisDayLine.tsx` uses it
  with the reading-history query and Library Home's book titles, and refreshes
  its calendar on local midnight and app/window focus.

Library organising entry points:

- `organising/organisingGateway.ts` and `useOrganising.ts` own fixed label/collection
  tables, owner-bound requests, conditional renames, paged memberships and cache
  updates. `src/components/library/organising/OrganisingSheet.tsx` uses one Modal
  with validation, draft confirmation and confirmed/uncertain creation recovery.
- `labels/labelsContract.ts`, `utils/libraryShelf.ts` and
  `src/components/library/labels/` serve Book Details labels and the separate Home
  label filter; status counts are computed after the label subset.
- `collections/collectionsContract.ts` defines tagged swipe filters and membership
  list ordering. `collections/useCollectionCards.ts` reuses the note card loader
  and cache. `app/(tabs)/library/collections.tsx` manages groups;
  `collection.tsx` lists their notes through `CollectionNoteRow`.
- The reader footer and swipe card/button/custom action open the same collections
  sheet. `noteNavigation.ts` carries the collection origin and swipe fallback
  filter. `useNoteDeck.ts` intersects collection membership with its original
  scope and retains per-filter positions. Swipe chrome and controls scroll
  separately from the card in constrained windows.

Other Library entry points:

- `history/readingHistoryGateway.ts` and its hooks own reads, progress, reading
  goals and statistics; `app/(tabs)/library/stats.tsx` renders the statistics.
- `services/bookReviewService.ts` and `reviews/useReviewWrite.ts` serve
  `app/(tabs)/library/review.tsx`.
- `notes/captureSession.ts`, `notes/captureAdapter.ts` and
  `services/ocrService.ts` serve page capture and reviewed OCR in the note
  composer; cloud OCR calls `ocr-fallback` (see 03).
- `export/` loads and formats Library CSV, notes Markdown/PDF and passage cards;
  `src/components/library/export/` holds the export UI.

`books` can be reference data for the marketplace, but it is **not** the
marketplace's canonical book catalogue.

### Exchange (P2P) — `src/features/exchange/`

Credit-based peer-to-peer book lending and exchange (no sale prices; payments
and courier delivery are switched off in `config/exchangeConfig.ts`, meetup is
on): listings, transactions, addresses, ratings, credits. Services
`listingsService`, `transactionsService`, `addressesService`, `ratingsService`;
`utils/transactionActionResolver.ts`. Credits:
`src/features/credits/services/creditService.ts`.

**Never reuse for bookstore commerce** (see 05).

### Clubs — `src/features/clubs/`

Book clubs: browse, create, membership, applications, invitations, events,
discussions, reading schedule, nominations, venues, moderation and management.
Services are split by responsibility (`clubsService`, `clubsReadService`,
`clubsMembershipService`, `clubsEventsService`, `clubsDiscussionService`,
`clubsInvitationsService`, `clubsApplicationsService`, `clubsBooksService`,
`clubsManagementService`, `clubsComplaintsService`, `clubsEntitlement`).
`screens/manage/` holds the Manage Club sections. `theme/` holds the Clubs
design tokens and fonts.

Clubs has its own handoff and process: [Clubs TRACKER](../docs/user/clubs/TRACKER.md)
and [page refinement process](../docs/user/clubs/PAGE-REFINEMENT-PROCESS.md).

### Venues — `src/features/venues/`

Venue browse/detail (`VenuesBrowseScreen`, `VenueDetailScreen`), `venuesService`.
Used by Clubs.

### Notifications — `src/features/notifications/`

In-app notifications and preferences (`notificationsService`, `useNotifications`).
The inbox merges two sources: commerce notifications (RPC
`marketplace_list_commerce_notifications`) and legacy `notification_deliveries`.
Mark-read calls a different RPC per source, and a Realtime channel
(`commerce-inbox:<userId>`) refreshes the commerce side. `wishlist-notify`
queues wishlist-match deliveries; `send-notification` pushes legacy deliveries
and `commerce-task-worker` delivers commerce notifications.

### Profile — `app/(tabs)/profile/`, `src/features/profile/`

Account hub, settings, edit profile, addresses, credit history, notifications.
`ProfileAccountMenu` is the signed-in entry point to the Store Owner console.
Consumer profile fields (for example `user_profiles.account_type`) never grant
Store Owner authority.
