# Feature Implementation Verification Matrix - 2026-04-07

## Purpose

This document is a stricter follow-up to `FEATURE_IMPLEMENTATION_GAP_ANALYSIS_2026-04-07.md`.

It cross-verifies feature status against the actual implementation in:

- `app/`
- `src/features/`
- `src/components/`
- `supabase/functions/`
- `supabase/migrations/`

The goal is to reduce ambiguity by attaching each status claim to concrete implementation evidence or to a verified absence in the current repo structure.

## Verification method

Statuses in this document were assigned using these checks:

1. route inventory in `app/`
2. feature module inventory in `src/features/`
3. service/hook implementation checks in relevant feature folders
4. edge-function inventory in `supabase/functions/`
5. backend contract verification from migrations in `supabase/migrations/`
6. current feature docs under `docs/features/`

Status meanings:

- `Implemented`: clear app-facing flow or backend/runtime path exists in current repo
- `Partial`: meaningful implementation exists, but the full product loop is incomplete
- `Missing`: no complete app-facing implementation found for the intended feature
- `Backend only`: schema/service contract exists without a surfaced user flow

## 1. Authentication

### Status

- Phone OTP sign-in: `Implemented`
- OTP verification: `Implemented`
- New-user profile setup: `Implemented`
- Existing-user bypass after OTP: `Implemented`
- Profile editing: `Missing`
- User-facing avatar management: `Missing`

### Evidence

- Login screen calls OTP sign-in:
  - `app/(auth)/login.tsx`
  - `src/features/auth/services/authService.ts`
- OTP verification flow:
  - `app/(auth)/verify-otp.tsx`
  - `src/features/auth/services/authService.ts`
- Existing-user bypass after verification:
  - `app/(auth)/verify-otp.tsx`
- Setup profile writes profile data and grants signup bonus:
  - `app/(auth)/setup-profile.tsx`
- Profile read service exists:
  - `src/features/auth/services/profileService.ts`
- No dedicated edit-profile route found in `app/`
- No user-facing profile/avatar edit screen found in `app/`

### Notes

- A storage helper for avatar upload exists, but it is not surfaced as a complete profile-management flow:
  - `src/features/exchange/services/listingsService.ts`

## 2. Personal Library

### Status

- Book search via Google Books: `Implemented`
- Manual entry fallback: `Implemented`
- Library list: `Implemented`
- Book detail: `Implemented`
- Reading notes CRUD: `Implemented`
- Public/community reviews: `Implemented`
- Barcode scanning: `Missing`
- OCR notes: `Missing`
- Rich text notes: `Missing`

### Evidence

- Library routes:
  - `app/(tabs)/library/index.tsx`
  - `app/(tabs)/library/search.tsx`
  - `app/(tabs)/library/[bookId].tsx`
  - `app/(tabs)/library/notes.tsx`
- Books service:
  - `src/features/books/services/booksService.ts`
- Notes service:
  - `src/features/books/services/notesService.ts`
- Public reviews runtime path:
  - `app/(tabs)/library/[bookId].tsx`
  - `src/features/books/services/booksService.ts`
  - `supabase/migrations/20260312120000_019_book_public_reviews_contract.sql`
- No barcode-scan route, hook, or camera-based ISBN workflow found in current app code
- No OCR implementation found in current notes/library code

## 3. P2P Exchange

### Status

- Browse listings: `Implemented`
- Create listing: `Implemented`
- Listing detail: `Implemented`
- Request transaction: `Implemented`
- Approve/decline/cancel/complete transaction: `Implemented`
- My transactions: `Implemented`
- Meetup path: `Implemented`
- Non-meetup payment/shipping path: `Partial`
- Ratings/reviews for transactions: `Missing`
- Dispute UI: `Missing`

### Evidence

- Exchange routes:
  - `app/(tabs)/exchange/index.tsx`
  - `app/(tabs)/exchange/create.tsx`
  - `app/(tabs)/exchange/[listingId].tsx`
  - `app/(tabs)/exchange/my-transactions.tsx`
  - `app/(tabs)/exchange/transaction/[transactionId].tsx`
- Exchange services/hooks:
  - `src/features/exchange/services/listingsService.ts`
  - `src/features/exchange/services/transactionsService.ts`
  - `src/features/exchange/services/addressesService.ts`
  - `src/features/exchange/hooks/useListings.ts`
  - `src/features/exchange/hooks/useTransactions.ts`
  - `src/features/exchange/hooks/useAddresses.ts`
- Address picker component:
  - `src/components/exchange/AddressPicker.tsx`
- RPC integration present for:
  - `request_transaction`
  - `approve_transaction`
  - `decline_transaction`
  - `cancel_transaction`
  - `complete_transaction`
  - evidence in `src/features/exchange/services/transactionsService.ts`

### Verification notes

- Non-meetup statuses are modeled, but the app explicitly blocks/downgrades those flows in the transaction screen:
  - `app/(tabs)/exchange/transaction/[transactionId].tsx`
- Missing edge functions confirm payment/shipping are incomplete:
  - no `supabase/functions/create-payment-order`
  - no `supabase/functions/verify-payment`
  - no `supabase/functions/book-shipment`
- No dedicated transaction rating screen, rating hook, or rating service found
- No dispute filing/review app flow found

## 4. Credit Economy

### Status

- Balance service: `Implemented`
- Credit history service: `Implemented`
- Profile balance card: `Implemented`
- Credit history screen: `Implemented`
- Dedicated credits section/route: `Missing`
- Downgrade grace-period automation: `Missing`

### Evidence

- Credit service:
  - `src/features/credits/services/creditService.ts`
- Profile screen renders balance:
  - `app/(tabs)/profile.tsx`
- Signup bonus invocation:
  - `app/(auth)/setup-profile.tsx`
- Transfer-credits edge function exists:
  - `supabase/functions/transfer-credits/index.ts`
- Dedicated credit history route exists:
  - `app/(tabs)/profile/credit-history.tsx`
- No grace-period edge function found in `supabase/functions/`

## 5. Clubs

### Status

- Browse clubs: `Implemented`
- Club detail: `Implemented`
- Public join/apply baseline: `Implemented`
- Application review: `Implemented`
- Invite creation/history: `Implemented`
- Invite acceptance: `Implemented`
- Discussion: `Implemented`
- Events list/create/edit: `Implemented`
- Current-book nominations/voting/finalize: `Implemented`
- Manage-club settings/member management: `Implemented`
- Create-club user flow: `Partial`
- Invite revoke: `Missing`
- Invitation read-state/inbox: `Missing`
- Reading schedule UI: `Missing`
- Member reading progress UI: `Missing`
- Complaint/moderation UI: `Partial`

### Evidence

- Clubs routes:
  - `app/(tabs)/clubs/index.tsx`
  - `app/(tabs)/clubs/[clubId]/index.tsx`
  - `app/(tabs)/clubs/[clubId]/applications.tsx`
  - `app/(tabs)/clubs/[clubId]/discussion.tsx`
  - `app/(tabs)/clubs/[clubId]/events.tsx`
  - `app/(tabs)/clubs/[clubId]/events/create.tsx`
  - `app/(tabs)/clubs/[clubId]/events/[eventId]/edit.tsx`
  - `app/(tabs)/clubs/[clubId]/invite.tsx`
  - `app/(tabs)/clubs/[clubId]/manage.tsx`
  - `app/(tabs)/clubs/[clubId]/nominate.tsx`
- Core Clubs screens:
  - `src/features/clubs/screens/ClubDetailScreen.tsx`
  - `src/features/clubs/screens/ClubApplicationsScreen.tsx`
  - `src/features/clubs/screens/ClubDiscussionScreen.tsx`
  - `src/features/clubs/screens/ClubEventsScreen.tsx`
  - `src/features/clubs/screens/ClubEventEditorScreen.tsx`
  - `src/features/clubs/screens/ClubInviteScreen.tsx`
  - `src/features/clubs/screens/ClubManageScreen.tsx`
  - `src/features/clubs/screens/ClubNominateBookScreen.tsx`
- Hooks/services:
  - `src/features/clubs/hooks/useClubs.ts`
  - `src/features/clubs/services/clubsService.ts`
  - `src/features/clubs/services/clubsManagementService.ts`
  - `src/features/clubs/services/clubsInvitationsService.ts`
  - `src/features/clubs/services/clubsDiscussionService.ts`
  - `src/features/clubs/services/clubsEventsService.ts`
  - `src/features/clubs/services/clubsBooksService.ts`

### Verified backend contract evidence

- Invitation RPCs:
  - `supabase/migrations/20260307000500_010_clubs_identity_invitations_public_contract.sql`
  - `supabase/migrations/20260310153000_013_clubs_entitlement_enforcement.sql`
- Finalize nomination RPC:
  - `supabase/migrations/20260309143000_012_club_book_workflow_contract.sql`
  - `supabase/migrations/20260311113000_014_club_book_finalize_manager_authorization.sql`

### Verified missing or partial areas

- Create-club backend service exists:
  - `src/features/clubs/services/clubsManagementService.ts`
- 2026-05-24 update: create-club route/hook support now exists in the Clubs/Profile slice.
- 2026-05-24 update: `revoke_club_invitation` and `mark_invitation_read` now exist in app services/hooks and live Supabase; invitee inbox UX remains a separate gap.
- Reading schedule/progress backend tables exist only in migrations:
  - `supabase/migrations/20251228114118_004_chat_and_moderation.sql`
- No reading schedule or member-progress UI route/module found in `app/` or `src/features/clubs/screens/`
- Complaint/reporting is only partially surfaced:
  - service/hook plumbing exists:
    - `src/features/clubs/services/clubsDiscussionService.ts`
    - `src/features/clubs/hooks/useClubs.ts`
  - but no complaint queue, complaint screen, or moderation panel route was found

## 6. Venues

### Status

- Backend schema: `Implemented`
- App feature family: `Missing`

### Evidence

- Venue table and club-venue schema in migrations:
  - `supabase/migrations/20251228114057_003_venues_and_clubs.sql`
- No `src/features/venues` folder found
- No venue routes found under `app/`
- Venue-linked event contract exists indirectly in Clubs events implementation:
  - `src/features/clubs/services/clubsEventsService.ts`
  - `src/features/clubs/screens/ClubEventEditorScreen.tsx`

### Assessment

- The repo has venue-capable backend structure, but not a dedicated venues product surface.

## 7. Moderation & Safety

### Status

- Domain/schema baseline: `Implemented`
- Clubs reporting plumbing: `Partial`
- User-facing moderation workflows: `Missing`

### Evidence

- Complaint and moderation-related tables in migrations:
  - `supabase/migrations/20251228114118_004_chat_and_moderation.sql`
- Complaint-related policies in migrations:
  - `supabase/migrations/20251228114516_009_rls_policies_chat_moderation.sql`
  - `supabase/migrations/20260307000500_010_clubs_identity_invitations_public_contract.sql`
  - `supabase/migrations/20260310153000_013_clubs_entitlement_enforcement.sql`
- Discussion report service/hook:
  - `src/features/clubs/services/clubsDiscussionService.ts`
  - `src/features/clubs/hooks/useClubs.ts`

### Verified missing areas

- No moderation dashboard route
- No complaint review screen
- No warning-system screen
- No platform moderation feature module

## 8. Push Notifications

### Status

- App/system implementation: `Missing`

### Evidence

- Architecture/docs expect:
  - `wishlist-notify`
  - `send-notification`
  - push token support
- Current repo has no:
  - `supabase/functions/wishlist-notify`
  - `supabase/functions/send-notification`
  - notification feature module
  - push notification registration UI
  - notification settings screen
- No `expo-notifications` implementation was found in app/source files during verification

## 9. Profile

### Status

- Base profile screen: `Implemented`
- Credit summary in profile: `Implemented`
- Real account destinations and settings flows: `Partial`
- Credit history filters and running balances: `Implemented`
- Edit profile: `Missing`

### Evidence

- Profile route:
  - `app/(tabs)/profile.tsx`
- The screen renders account rows for:
  - My Books
  - Exchange History
  - My Clubs
  - Settings
- No actual destination routes were found from those profile menu rows in that screen
- No dedicated profile edit route found

## 10. Admin Panel

### Status

- `Missing`

### Evidence

- Spec defines admin dashboard/queues, but no admin-panel route family or feature module exists in current mobile repo
- No `src/features/admin` or equivalent folder found
- No admin-panel routes found under `app/`

## 11. Author Features

### Status

- Domain-level support: `Partial`
- Productized user-facing flows: `Missing`

### Evidence

- Author-club typing and author fields exist in Clubs models and migrations:
  - `src/features/clubs/services/clubsService.types.ts`
  - Clubs migrations under `supabase/migrations/`
- No dedicated author program routes found
- No AMA flow found
- No signed-edition or exclusive author-listing flow found in app routes

## 12. Edge Functions

### Status summary

- Implemented in repo:
  - `check-membership-limits`
  - `complete-transaction`
  - `transfer-credits`
- Missing in repo:
  - `create-payment-order`
  - `verify-payment`
  - `book-shipment`
  - `wishlist-notify`
  - `send-notification`
  - `handle-downgrade-grace-period`

### Evidence

- Present:
  - `supabase/functions/check-membership-limits/index.ts`
  - `supabase/functions/complete-transaction/index.ts`
  - `supabase/functions/transfer-credits/index.ts`
- No corresponding folders found for the missing functions in `supabase/functions/`

## Cross-check outcomes

## Confirmed stronger than some older docs suggest

- Clubs is substantially implemented in the repo
- Exchange is substantially implemented for the meetup/core RPC path
- Library is implemented beyond the oldest architecture status markers

## Confirmed still genuinely pending

- Exchange payment and shipping completion
- transaction ratings
- dispute UX
- credit history screen
- create-club app flow
- invite revoke and invitation read-state
- venues frontend
- moderation UI
- push notifications
- admin panel

## Important nuance corrections from verification

- avatar handling is not entirely absent:
  - an upload helper exists, but not a finished user-facing flow
- complaint/reporting is not entirely absent:
  - service/hook plumbing exists, but not a complete moderation UI
- archiving is not entirely absent:
  - service-level support exists in Clubs, but not a surfaced management feature

## Recommended use of this document

Use this matrix when:

- creating implementation tasks
- updating stale status docs
- deciding whether a feature is truly missing versus only partially surfaced
- preparing a cleaner source-of-truth roadmap for the repo

It should be read together with:

- `docs/audits/FEATURE_IMPLEMENTATION_GAP_ANALYSIS_2026-04-07.md`
- `docs/features/P2P_EXCHANGE_STATUS.md`
- `docs/features/CLUBS_IMPLEMENTATION_STATUS_2026-03-07.md`
