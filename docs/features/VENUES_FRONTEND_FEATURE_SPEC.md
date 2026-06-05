# Venues Frontend Feature Spec

Last updated: 2026-06-05

## Purpose

Venues are BookConnect's physical community layer. A venue is a real-world place where readers can gather around books: cafes, libraries, bookstores, coworking spaces, and future types such as offices, schools, cultural centers, apartment communities, or other approved meetup spaces.

The feature must be designed as a shared platform module, but Phase 1 is intentionally Clubs-first. The strongest current product loop is helping users discover book clubs and club events through physical places, while helping club admins link trusted venues to their clubs and events.

Exchange pickup and venue-owner self-service are important future consumers of the same venue module, but they are not part of the first implementation phase.

## Product Positioning

Venues should not become a bottom tab in Phase 1. They should appear inside the Clubs section because the first complete user loop is:

1. A reader explores clubs and venue-based or hybrid communities.
2. A reader opens a venue and sees related clubs and upcoming club events.
3. A club admin links approved venues to their club.
4. A club event creator chooses a linked venue or keeps using a manual meetup location.

The implementation should still use a standalone `src/features/venues/` module so the same venue browsing, detail, and picker logic can later be reused by Exchange pickup and venue-owner workflows without making Exchange depend on Clubs internals.

## Phase Boundary

### Phase 1: Clubs and Venue Discovery

Phase 1 includes:

- Venue browse/search inside Clubs.
- Venue detail screen inside Clubs.
- Showing clubs and club events associated with a venue where the existing data contract supports it.
- Club admin venue linking/unlinking through Manage Club.
- Event editor venue selection using linked venues.
- Manual meetup location fallback for clubs without linked venues.
- Documentation of Exchange and venue-owner flows as future consumers.

Phase 1 excludes:

- Exchange pickup venue selection.
- Venue-owner registration and self-management.
- Admin verification workflows.
- Payment, booking, commission, or revenue workflows.
- Full map dependency unless approved separately.
- New bottom tab for Venues.

### Phase 2: Exchange Pickup Venues

Phase 2 should let users choose an approved venue as a meetup or pickup point during exchange flows. This should build on the Phase 1 venue service and picker, not duplicate venue-specific code under Exchange.

### Phase 3: Venue Owner Tools

Phase 3 should let venue owners register and manage their spaces, with verification status surfaced clearly. Owner tools should respect the existing `venues.owner_user_id` and `venues.verification_status` model, but final admin review policy still needs product approval.

## Existing Context

### Backend Tables and Fields

The live-derived migration `supabase/migrations/20251228114057_003_venues_and_clubs.sql` creates:

- `venues`
  - `id`
  - `venue_code`
  - `name`
  - `description`
  - `venue_type`
  - `cover_url`
  - `photos`
  - `address_line1`
  - `address_line2`
  - `city`
  - `state`
  - `pincode`
  - `location geography(point)`
  - `operating_hours`
  - `amenities`
  - `max_capacity`
  - `booking_required`
  - `owner_user_id`
  - `verification_status`
  - `is_exchange_partner`
  - timestamps

- `club_venues`
  - `club_id`
  - `venue_id`
  - `is_primary`

The current venue type check allows:

- `cafe`
- `library`
- `coworking`
- `bookstore`
- `other`

The frontend should not hard-code assumptions that prevent future venue types. Unknown or new venue types should render as title-cased labels, and filters should be data/config driven where practical.

### RLS and Visibility

The live-derived RLS migration `supabase/migrations/20251228114444_008_rls_policies_venues_clubs.sql` establishes:

- Approved venues are publicly readable.
- Venue owners can manage their own venues.
- Club venue links are viewable by club members.
- Club admins can manage club venue links.

The Phase 1 frontend should respect those surfaces. Public venue browse should query approved venues. Club-linked venue management should remain admin-only in the UI and accept backend denials gracefully.

### Club Events Contract

The live events contract in `docs/features/CLUBS_LIVE_BACKEND_CONTRACT_2026-03-07.md` confirms:

- `club_events.venue_id` exists.
- `club_events.manual_location` exists and is important today.
- `virtual` events require a meeting link.
- `in_person` events require either `venue_id` or `manual_location`.
- `hybrid` events require a physical location source and a meeting link.
- Current live `club_venues` link count was recorded as `0`, so manual locations must remain a supported fallback.

## Current Frontend Reality

There is no standalone venue feature module today.

Current venue-related code exists inside Clubs:

- `app/(tabs)/clubs/[clubId]/venues.tsx`
  - Re-exports the club venue picker.

- `src/features/clubs/screens/ClubVenuePickerScreen.tsx`
  - Lists venues already linked to a club.
  - Lets the event editor return with `preselectedVenueId`.
  - Shows an empty state saying admins can add venues, but Manage Club does not currently provide that UI.

- `src/features/clubs/screens/ClubEventEditorScreen.tsx`
  - Supports `linked_venue` and `manual_location`.
  - Uses `useClubEventVenues`.
  - The "Browse all venues" action currently routes to the linked venue picker, not a true all-venue browser.

- `src/features/clubs/services/clubsEventsService.ts`
  - Reads `club_venues` through `getClubEventVenues`.
  - Reads event venue summaries through `club_events.venue_id`.

- `src/features/clubs/hooks/useClubs.ts`
  - Provides `useClubEventVenues`.

- `app/(tabs)/clubs/index.tsx`
  - Clubs browse already supports meeting format filters: online, venue, hybrid.

## Recommended Architecture

Create a venue module independent of Clubs:

```text
src/features/venues/
  components/
    VenueCard.tsx
    VenueTypeBadge.tsx
  hooks/
    useVenues.ts
  screens/
    VenuesBrowseScreen.tsx
    VenueDetailScreen.tsx
    VenuePickerScreen.tsx
  services/
    venuesService.ts
    venuesService.types.ts
```

Clubs should consume the venue module through stable service and screen contracts, not by owning venue data directly.

Recommended Clubs routes:

```text
app/(tabs)/clubs/venues.tsx
app/(tabs)/clubs/venues/[venueId].tsx
app/(tabs)/clubs/[clubId]/venues.tsx
```

Route intent:

- `/clubs/venues`
  - Browse approved venues from inside Clubs.

- `/clubs/venues/[venueId]`
  - Venue detail, related clubs, and upcoming related events.

- `/clubs/[clubId]/venues`
  - Club-scoped picker or management-adjacent route, depending on query params.

## Phase 1 User Experience

### Clubs Browse Entry

Add a clear entry point in Clubs browse for venue discovery. This can be a compact action row or section inside the Clubs screen, not a new bottom tab.

Expected user intent:

- "Show me places where clubs meet."
- "Find venue-based or hybrid communities near a city."
- "Open this venue and see related clubs/events."

### Venue Browse

Venue browse should support:

- Loading approved venues.
- Search by venue name, city, neighborhood/address text where available.
- Filter by venue type.
- Filter or sort by city first.
- Empty, loading, and error states.
- No map requirement in Phase 1 unless separately approved.

Distance sorting should be treated as optional until a geospatial RPC and location-permission UX are explicitly designed.

### Venue Detail

Venue detail should show:

- Name.
- Type.
- Verification state when relevant.
- Address.
- Description.
- Photos or cover when available.
- Amenities.
- Operating hours when available.
- Capacity and booking-required flag when available.
- Related clubs if available.
- Upcoming linked club events if available.

If related clubs/events cannot be fetched cleanly under current RLS or schema constraints, the detail screen should still launch with venue information and document the missing relationship query as a follow-up.

### Club Manage Venue Linking

Add a Manage Club venue section or tab for admins.

Expected capabilities:

- View venues linked to the club.
- Link an approved venue.
- Unlink a venue.
- Mark one linked venue as primary.
- Surface backend permission errors with clear messages.

This closes the current gap where the picker says admins can add venues but no Manage UI exists.

### Event Venue Selection

The event editor should continue supporting manual meetup locations.

When a club has linked venues:

- The event creator can choose "Use linked venue."
- The picker lists the club's linked venues.
- The selected venue writes `club_events.venue_id`.

When a club has no linked venues:

- The event creator can use `manual_location`.
- UI should not block event creation solely because no venue has been linked.

## Service Design

### Venue Service

`venuesService.ts` should own direct reads from `venues`.

Recommended methods:

- `getApprovedVenues(filters)`
- `getVenueById(venueId)`
- `getVenueTypes()`, if types become dynamic later
- `getVenueClubLinks(venueId)` if feasible
- `getVenueUpcomingClubEvents(venueId)` if feasible

Initial filters:

- `search`
- `city`
- `venueType`
- `limit`
- `offset`

Future filters:

- `nearLat`
- `nearLng`
- `radiusMeters`
- `isExchangePartner`

### Club Venue Link Service

Club venue link mutations may live in a Clubs service because they mutate the relationship between a club and a venue.

Recommended methods:

- `getClubVenueLinks(clubId)`
- `addClubVenueLink(clubId, venueId)`
- `removeClubVenueLink(clubId, venueId)`
- `setPrimaryClubVenue(clubId, venueId)`

This can start in `clubsEventsService.ts` only if scoped narrowly, but a dedicated club venue service is cleaner if the management UI grows.

## Data and Query Notes

Public venue browse can query `venues` directly because approved venues are public under RLS.

Related clubs/events are more nuanced:

- `club_venues` is currently member-visible, not globally public.
- Public venue detail may not be allowed to show all related club links without a view or policy adjustment.
- `club_events` visibility depends on existing event policies and membership assumptions.

Before implementation, verify whether public venue detail can safely show:

- public clubs linked to the venue
- upcoming public events linked to the venue

If the current policies do not allow that, the spec should either:

- add a read-only public view/RPC for venue discovery, or
- defer public related-club/event lists while still supporting admin linking and event selection.

## Exchange Phase 2 Notes

Exchange currently supports `delivery_type = 'meetup'`, but there is no venue pickup model in frontend transaction or listing services.

Phase 2 should add venue selection for meetup exchanges only after Phase 1 establishes:

- reusable venue browse/picker components
- approved venue reads
- optional `is_exchange_partner` filtering

Likely future Exchange files:

```text
src/features/exchange/services/transactionsService.ts
src/features/exchange/services/listingsService.ts
src/features/exchange/config/exchangeConfig.ts
src/features/exchange/utils/transactionActionResolver.ts
app/(tabs)/exchange/*
```

Phase 2 may require schema/RPC changes if transactions need a durable `venue_id` or pickup metadata.

## Venue Owner Phase 3 Notes

The table already has `owner_user_id` and `verification_status`, but owner self-service needs a separate product policy:

- Who can create a venue?
- Does creation immediately insert `pending` venues?
- Who verifies venues?
- What proof is required?
- Can an owner edit an approved venue without re-review?
- How are suspended/rejected venues shown to owners?

Do not implement owner self-service in Phase 1.

## Likely File Impact

New files:

```text
src/features/venues/components/VenueCard.tsx
src/features/venues/components/VenueTypeBadge.tsx
src/features/venues/hooks/useVenues.ts
src/features/venues/screens/VenuesBrowseScreen.tsx
src/features/venues/screens/VenueDetailScreen.tsx
src/features/venues/screens/VenuePickerScreen.tsx
src/features/venues/services/venuesService.ts
src/features/venues/services/venuesService.types.ts
app/(tabs)/clubs/venues.tsx
app/(tabs)/clubs/venues/[venueId].tsx
src/features/venues/**/__tests__/*
```

Likely modified files:

```text
app/(tabs)/clubs/_layout.tsx
app/(tabs)/clubs/index.tsx
app/(tabs)/clubs/[clubId]/venues.tsx
src/features/clubs/screens/ClubVenuePickerScreen.tsx
src/features/clubs/screens/ClubEventEditorScreen.tsx
src/features/clubs/screens/ClubManageScreen.tsx
src/features/clubs/screens/manage/index.ts
src/features/clubs/screens/manage/ManageTabBar.tsx
src/features/clubs/hooks/useClubs.ts
src/features/clubs/services/clubsEventsService.ts
src/features/clubs/services/clubsService.types.ts
src/features/clubs/screens/__tests__/*
app/(tabs)/clubs/__tests__/*
```

Possible new file:

```text
src/features/clubs/screens/manage/ClubManageVenuesSection.tsx
src/features/clubs/services/clubsVenuesService.ts
```

## Testing Strategy

Add focused tests for:

- Venue service query construction.
- Venue browse loading, empty, search/filter, and error states.
- Venue detail basic rendering.
- Club Manage venue section link/unlink/primary interactions.
- Event editor behavior with linked venues and manual fallback.
- Route registration for new Clubs venue routes.

Run:

```text
npx.cmd tsc --noEmit
npm.cmd test -- --runInBand <focused venue and clubs tests>
```

Browser smoke should cover:

- Clubs browse opens venue discovery.
- Venue browse renders.
- Venue detail renders.
- Manage Club venue section renders for an eligible admin.
- Event editor still allows manual location when no linked venues exist.

## Risks and Open Questions

| Topic | Risk / Question | Phase | Resolution |
|---|---|---:|---|
| Public related clubs | `club_venues` is member-visible today, so public venue detail may not be able to show linked clubs without a view/RPC/policy review. | 1 | Verify before implementation. |
| Public related events | Event visibility by venue may require a public-safe query. | 1 | Verify before implementation. |
| Venue type extensibility | DB check constraint currently limits venue types. | 1+ | Frontend should tolerate unknown labels; schema changes are future backend work. |
| Geospatial search | PostGIS exists, but frontend has no approved RPC/location UX yet. | 1+ | Use city/search first; defer radius search unless explicitly scoped. |
| Maps | `react-native-maps` is not installed. | 1+ | Defer map until approved as separate dependency/workflow. |
| Live data | Docs recorded `club_venues` link count as `0`. | 1 | Keep manual location fallback and support empty states. |
| Owner management | Owner fields exist, but workflow policy is not defined. | 3 | Defer and document separately. |
| Exchange pickup | Exchange meetup requests need a durable venue handoff point. | 2 | Implemented with `transactions.pickup_venue_id` and approved exchange-partner venue validation in `request_transaction`. |

## Implementation Tracker

| Area | Scope | Status | Notes |
|---|---|---|---|
| Feature spec and tracker | Planning | Drafted | This document establishes the Clubs-first Phase 1 boundary. |
| Venue module scaffold | Phase 1 | Implemented | `src/features/venues/` now contains service, hooks, screens, components, and tests. |
| Approved venue browse | Phase 1 | Implemented | Clubs venue browse can search/filter approved venues. |
| Venue detail | Phase 1 | Implemented | Shows approved venue facts; public related clubs/events remain policy-gated. |
| Clubs route entry | Phase 1 | Implemented | Clubs stack includes venue browse/detail routes. |
| Clubs browse entry point | Phase 1 | Implemented | Clubs browse links into venue discovery. |
| Club venue linking UI | Phase 1 | Implemented | Manage Club includes venue link/unlink/primary controls. |
| Club venue link mutations | Phase 1 | Implemented | Clubs hooks/services support link, unlink, and primary updates. |
| Event editor venue picker reuse | Phase 1 | Implemented | Event editor still supports linked venue selection and manual fallback. |
| Manual location fallback | Phase 1 | Existing / Preserve | Must remain available for clubs without linked venues. |
| Public related club query | Phase 1 | Needs Verification | Confirm RLS/view/RPC strategy before building public venue detail relationships. |
| Public related event query | Phase 1 | Needs Verification | Confirm RLS/view/RPC strategy before building public venue detail relationships. |
| Geospatial radius search | Future | Deferred | PostGIS exists, but UX/RPC/location permission are not in Phase 1. |
| Map view | Future | Deferred | Requires dependency and separate UX approval. |
| Exchange pickup venue selection | Phase 2 | Implemented | Listing detail now requires an approved exchange-partner pickup venue for meetup requests and transaction detail displays the selected venue. |
| Venue owner registration/manage | Phase 3 | Deferred | Requires verification/admin policy. |

## Phase 1 Acceptance Criteria

Phase 1 is complete when:

- Users can enter venue discovery from Clubs.
- Users can search/filter approved venues.
- Users can open venue detail.
- Club admins can link/unlink approved venues and mark a primary venue.
- Club event creators can select linked venues for in-person/hybrid events.
- Club event creators can still use manual meetup location fallback.
- Exchange integration remains untouched except for documented Phase 2 notes.
- Tests cover venue browse/detail and club venue linking/picker behavior.
- TypeScript passes.
