# Feature Implementation Gap Analysis - 2026-04-07

## Purpose

This document consolidates the current implementation reality of the BookTalks mobile repo against:

- `docs/architecture/booktalks_mobile_spec.md` for the full MVP scope
- `docs/architecture/architecture_react_expo.md` for architectural and feature expectations
- `docs/architecture/EDGE_FUNCTIONS_IMPLEMENTATION_LIST.md` for backend function scope
- `docs/features/*.md` for the most current feature-specific truth, especially Clubs and Exchange
- the current repo state under `app/`, `src/features/`, and `supabase/functions/`

This should be treated as the current working implementation matrix for the repo as of `2026-04-07`.

## Scope notes

- This document distinguishes between:
  - implemented
  - partially implemented
  - not implemented
  - documentation drift
- MVP and post-MVP scope are separated where the source docs clearly do that.
- Older status documents outside the feature docs are sometimes stale and should not be treated as canonical if they conflict with the current repo or newer feature-specific docs.

## Source-of-truth hierarchy used

1. current repo implementation
2. newer feature-specific docs under `docs/features/`
3. backend/edge-function docs under `docs/architecture/`
4. broader architecture/spec docs
5. older audit/status snapshots only when they do not conflict with the above

## Executive summary

The repo currently has strong implementation coverage for:

- authentication baseline
- library baseline
- exchange meetup flow baseline
- substantial Clubs implementation

The largest remaining implementation gaps are:

- exchange payment and shipping flows
- transaction ratings, dispute flow, and credit history UI
- profile editing and avatar management
- venue system frontend and partner flows
- push notifications
- moderation and complaint tooling
- admin panel
- several planned edge functions

There is also meaningful documentation drift:

- some older status docs still describe Exchange and Clubs as not started
- some Clubs docs understate recently implemented discussion, events, and current-book management surfaces

## Current repo surface inventory

### Current route families in `app/`

- Authentication:
  - login
  - OTP verification
  - profile setup
- Library:
  - library index
  - search
  - book detail
  - notes
- Exchange:
  - browse
  - create listing
  - listing detail
  - transaction detail
  - my transactions
- Clubs:
  - browse
  - detail
  - applications
  - discussion
  - events
  - create event
  - edit event
  - invite
  - manage
  - nominate
- Profile:
  - single profile screen

### Current feature modules in `src/features/`

- `auth`
- `books`
- `clubs`
- `credits`
- `exchange`

### Current edge functions in `supabase/functions/`

- `check-membership-limits`
- `complete-transaction`
- `transfer-credits`

No repo implementation was found for:

- `create-payment-order`
- `verify-payment`
- `book-shipment`
- `wishlist-notify`
- `send-notification`
- `handle-downgrade-grace-period`
- moderation-related edge functions
- author analytics or referral helper functions mentioned in older docs

## Feature-by-feature matrix

## 1. Authentication

### Implemented

- phone OTP login
- OTP verification flow
- persisted auth/session handling
- existing-user bypass from OTP to app instead of duplicate profile setup
- initial profile setup with:
  - display name
  - city
  - referral code support
  - signup bonus RPC invocation

### Partial

- profile data reads exist and are used by multiple features
- membership tier is available in `user_profiles` and used by Clubs entitlement logic

### Missing

- standalone profile edit flow
- user-facing avatar upload/edit flow
- profile settings management beyond signup-time fields

### Verification note

- an avatar storage helper exists in the codebase, but it is not surfaced as a complete profile-management experience in the current app

## 2. Personal Library

### Implemented

- Google Books search
- manual entry fallback
- library CRUD
- canonical wishlist handling through `user_books.ownership = 'wishlist'`
- ratings and reviews on books
- community/public reviews UI
- reading notes CRUD
- book detail view

### Partial

- public reviews are implemented and repo/backend aligned
- ownership/status flows exist, but not every status in the original broad product language is visibly surfaced as a dedicated experience

### Missing or deferred

- barcode scanning
- OCR note capture
- rich text note formatting
- reading session linkage
- custom cover upload for manual entry is not established as a finished user-facing flow

## 3. P2P Exchange

### Implemented

- listings browse
- create listing
- listing detail
- request transaction
- approve transaction
- decline transaction
- cancel transaction
- complete transaction
- my transactions
- transaction detail timeline
- address picker for shipping-based flows
- core exchange services/hooks
- meetup path baseline
- credit hold and completion RPC integration

### Partial

- non-meetup transaction statuses are modeled in the UI
- payment-related and shipping-related statuses appear in timelines and labels
- address management exists for shipping-capable paths

### Missing

- payment order creation flow
- payment verification flow
- actual deposit collection via Razorpay
- shipment booking flow via Porter/Dunzo
- transaction ratings/reviews
- dispute filing and resolution UI
- fully completed non-meetup delivery path

### Current blockers

- payment and shipment rely on missing provider integrations and missing edge functions

## 4. Credit Economy

### Implemented

- credit balance service
- credit history service layer
- real-time credit balance subscription support
- signup bonus RPC usage
- balance card on profile
- backend event-sourced credit foundation
- admin transfer edge function exists in repo

### Partial

- balance visibility exists in UI
- backend structure is stronger than frontend exposure

### Missing

- credit history screen
- dedicated credits route in app
- admin-facing credit tooling in the app itself
- downgrade/grace-period automation described in docs

## 5. Book Clubs

### Implemented

- clubs browse
- clubs detail
- membership reads
- join/apply/invite acceptance baseline
- application review
- invitation creation and invitation history
- discussion screen with:
  - topic creation
  - reply creation
  - votes
  - reactions
  - read/unread handling
- nominations and voting
- current-book finalization flow
- manage club screen with:
  - current-book management
  - settings slice
  - meeting type/access level editing
  - member-cap editing
  - join-question CRUD
  - member role toggles
  - remove-member flow
- events list
- create event
- edit event
- RSVP-related contract support
- entitlement-aware gating across major active surfaces

### Partial

- create-club backend service exists but is not exposed as a visible app flow
- invite-only lifecycle is incomplete
- nomination/current-book flow works, but the UI/backend finalization rule is not perfectly aligned
- current management surface is substantial, but still narrower than the broad product spec
- discussion reporting service and hook plumbing exist, but there is no complete complaint/moderation UI flow
- club archiving exists at the service level, but not as a finished user-facing management workflow

### Missing

- create-club route and user-facing creation flow
- invitation revoke
- invitation read-state/inbox workflow
- ownership transfer
- archive/delete governance flows as productized user-facing features
- full reading schedule UI
- member reading progress UI
- complaint/report moderation UI
- full club-admin dashboard breadth from the original broad spec

### Important current caveats

- newer feature docs indicate discussion, events, invitation history, and current-book management are real
- older or broader docs may still understate those areas

## 6. Venues System

### Implemented

- database schema and migrations exist for venues-related tables
- Clubs events support venue-linked or manual-location flows at the backend contract level

### Missing

- no venue feature module in `src/features`
- no venue routes in `app/`
- no venue browse/detail screens
- no venue owner registration flow
- no verified venue selection flow as a dedicated surfaced feature
- no venue management UI
- no exchange partner/dropbox flow

### Assessment

This is effectively backend-schema-only from the app perspective.

## 7. Moderation & Safety

### Implemented

- some club role/member enforcement exists
- discussion/report-related service types and hooks exist in the Clubs layer
- mute/ban concepts exist in the backend/domain model

### Partial

- moderation-adjacent controls exist indirectly through member-role/member-removal flows
- report-related service plumbing exists, but not a complete surfaced moderation experience

### Missing

- warning system UI
- complaint queue UI
- moderation dashboard
- platform-level moderation tools
- club complaint management UI
- content filter administration
- dispute review panel

## 8. Push Notifications

### Implemented

- no complete push-notification implementation was found in the repo

### Missing

- user push token registration flow
- notification preferences UI
- `send-notification` edge function
- `wishlist-notify` edge function
- notification inbox/history UI
- per-category delivery settings

## 9. Profile

### Implemented

- profile screen shell
- sign out
- credit balance card
- display of current phone number

### Partial

- profile screen presents account/menu rows suggesting future destinations

### Missing

- those menu items do not currently provide real navigation/actions
- edit profile
- avatar management
- address management from profile
- membership settings
- clubs/archive/history profile sections

## 10. Admin Panel

### Implemented

- none found in the mobile repo

### Missing

- dashboard
- venue verification queue
- user management
- dispute resolution console
- content moderation console

### Assessment

The spec treats this as a parallel track. It is not currently represented in the app codebase.

## 11. Author Features

### Implemented

- author-club concepts exist in the schema/domain/docs
- some author-related club typing is present in Clubs models

### Missing

- verified author workflows
- AMA experience
- signed editions flow
- early-release/exclusive flows
- author analytics tooling

## 12. Edge Functions

### Implemented in repo

- `complete-transaction`
- `transfer-credits`
- `check-membership-limits`

### Missing from repo but expected by docs

- `create-payment-order`
- `verify-payment`
- `book-shipment`
- `wishlist-notify`
- `send-notification`
- `handle-downgrade-grace-period`
- `moderate-content` or equivalent moderation helper
- author/referral analytics helpers described in older documentation

## MVP implementation status by feature family

### Strongest implemented areas

- Authentication
- Library
- Exchange meetup baseline
- Clubs core engagement and management slices

### Partially implemented MVP areas

- Exchange as a full 8-step transactional product
- Credits as a user-facing feature
- Profile/account management

### Mostly unimplemented MVP areas

- Venues
- Push notifications
- Moderation and safety
- Admin panel
- Author feature program

## Documentation drift

## 1. Older status docs understate the current repo

Older high-level project status documents still describe Exchange or Clubs as not started or placeholder-only. That is no longer accurate.

Current repo reality includes:

- full Exchange surface set for browse/create/detail/transactions
- substantial Clubs routes, services, tests, events, discussion, invites, and manage flows

## 2. Clubs spec drift

`docs/features/CLUBS_SPEC_2026-03-06_234839.md` still contains stale wording that `create` and `chat` routes are not implemented.

Current repo reality:

- chat/discussion route is implemented
- create-club route still appears missing

## 3. Manage Club doc drift

`docs/features/CLUBS_MANAGE_CLUB_SPEC_2026-03-07.md` understates some current shipped behavior.

Current repo reality includes:

- current-book finalization in Manage Club
- event create/edit routes and screens

## Recommended implementation order

## Tier 1 - unblock core MVP completion

- finish Exchange payment flow
- finish Exchange shipping flow
- build transaction ratings/reviews
- build dispute flow
- add credit history screen
- wire real profile navigation and profile editing

## Tier 2 - complete currently scaffolded product areas

- expose create-club flow in app
- finish invite lifecycle:
  - revoke
  - read-state/inbox
- align nomination finalization UI with backend voting-close rule
- expand credits into a first-class feature area

## Tier 3 - deliver missing MVP feature families

- build Venues frontend
- build push notifications system
- build moderation and safety tooling
- build any required admin/operations surface

## Tier 4 - post-MVP or optional roadmap work

- barcode scanning
- OCR note capture
- Goodreads import
- venue QR check-in
- club book pool
- author program
- gamification
- Hindi localization

## Recommended documentation cleanup

- update or retire stale high-level project status docs that still say Exchange/Clubs are not started
- update Clubs spec to reflect discussion/chat as implemented
- update Manage Club scope doc to reflect current-book and event-management reality
- keep feature-specific docs as the primary status reference for active workstreams

## Conclusion

The repo is further along than several broad status docs suggest, especially for Clubs and Exchange. The most important remaining work is not foundational CRUD anymore; it is finishing the missing operational/product loops:

- payments
- shipping
- ratings
- disputes
- credits UI
- profile management
- venues
- notifications
- moderation

That should be the baseline assumption for all future planning and task breakdowns from this point onward.
