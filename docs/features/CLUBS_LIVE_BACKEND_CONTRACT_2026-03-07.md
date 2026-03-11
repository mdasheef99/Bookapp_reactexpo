# Clubs Live Backend Contract — 2026-03-07

## Role of this document

This document records the **verified live Supabase contract** that the current Clubs implementation depends on.

Use this together with:
- `docs/features/CLUBS_SPEC_2026-03-06_234839.md` for canonical intent.
- `docs/features/CLUBS_IMPLEMENTATION_STATUS_2026-03-07.md` for repo progress and audit status.

## Verified live now

### Session update — 2026-03-10

- live migration history is now reconciled through `010`, `011`, `012`, `013`, `014`, and `015`
- the current Clubs entitlement enforcement contract is now live for the active workstream:
  - `membership_tier` vs club `access_level`
  - paid-only `moderator`
  - paid-only `admin`
  - tightened invitation / application / membership enforcement
- the current app/runtime dependency used by this workstream is aligned with that contract:
  - profile reads use `src/features/auth/services/profileService.ts`
  - canonical runtime profile source is `public.user_profiles`
- the live Clubs Events contract is now also deployed and verified:
  - `public.club_events` now supports `manual_location`, `status`, `cancelled_at`, `cancelled_by`, and `updated_at`
  - `public.club_events.event_type` is now enforced as `virtual | in_person | hybrid`
  - `public.can_manage_club_event(uuid, uuid)` is live for creator/admin event management
  - `public.event_rsvps` write paths are now limited to active members on scheduled events
- live rollback-cleaned verification in this session confirmed:
  - admin create succeeds
  - regular member create is denied by RLS
  - active-member RSVP succeeds
  - muted-member RSVP is denied by RLS
  - an eligible moderator can create a hybrid event with `manual_location` + `meeting_link`, update/cancel/delete their own event, and cannot update/delete an admin-created event

### Identity and discovery

- `public.user_profiles.username` exists live
- `public.club_public_details` exists live
- current live row count in `public.club_public_details`: `3`

### Invite/apply infrastructure

- `public.club_invitations` exists live
- live RPC: `review_club_join_application(p_application_id uuid, p_decision text, p_decline_reason text)` -> `club_join_applications`
- live RPC: `create_club_invitation(p_club_id uuid, p_invitee_username text, p_note text)` -> `club_invitations`
- live RPC: `accept_club_invitation(p_invitation_id uuid)` -> `club_members`

### Entitlement helpers now live

- `membership_tier_rank(text)`
- `club_access_level_rank(text)`
- `get_user_membership_tier(uuid)`
- `user_meets_access_level(uuid, text)`
- `user_meets_club_access_level(uuid, uuid)`
- `can_user_hold_club_role(uuid, uuid, text)`
- `is_active_eligible_club_manager(uuid, uuid)`

### Missing live RPCs that still matter

- `revoke_club_invitation` — **not live**
- `mark_invitation_read` — **not live**

## Public browse/detail contract

### Current contract surface

The app should use `public.club_public_details` for public browse/detail rather than raw `book_clubs` reads.

### Live `club_public_details` columns

- core: `id`, `name`, `description`, `cover_url`, `club_type`, `access_level`, `meeting_type`, `member_count`, `max_members`
- book summary: `current_book_id`, `current_book_google_books_id`, `current_book_title`, `current_book_authors`, `current_book_cover_url`, `current_book_retail_price`, `current_book_currency_code`
- admin summary: `admin_id`, `admin_profile_id`, `admin_display_name`, `admin_avatar_url`, `admin_city`
- author summary: `author_id`, `author_user_id`, `author_display_name`, `author_avatar_url`, `author_city`
- timestamps: `created_at`, `updated_at`

### Important caveat

The raw `book_clubs` SELECT policy still is not the public-by-type visibility model described in the original draft spec. The current app contract works because it reads through `club_public_details`.

## Live policy facts that matter now

### `public.book_clubs`

- live SELECT policy: `Clubs are viewable based on type`
- current predicate effectively allows:
  - non-archived clubs
  - or admin-owned clubs
  - or clubs where the current user is an active/muted member

**Implication:** do not treat raw `book_clubs` as the safe public detail contract for the app.

- live INSERT policy: `Authenticated users can create clubs`
- live UPDATE policy: `Admins can update their clubs`
- current create/update enforcement now requires:
  - eligible Pro/Pro+ ownership
  - `membership_tier` satisfaction for the target `access_level`
  - `can_user_hold_club_role(..., 'admin')` for admin updates

### `public.club_members`

- live SELECT policy: `Members can view club members`
- `2026-03-08` remediation: the policy now delegates to `public.can_view_club_members(uuid, uuid)` to avoid the earlier recursive self-reference
- current predicate allows member-list reads for:
  - active/muted members of the same club
  - or the club admin

- validated live after remediation:
  - authenticated membership-state lookup on `club_members` now returns `200`
  - earlier failure was `42P17 infinite recursion detected in policy for relation "club_members"`

**Implication:** current member-list gating is backed live and can be used now.

### `public.club_members` insert behavior

- live public-membership inserts succeed only for authenticated users on eligible `public` clubs whose `membership_tier` satisfies the club `access_level`
- current live behavior is safer when the client inserts first and loads membership in a separate read
- the `2026-03-08` client remediation stopped depending on insert-time row representation for the public join flow

**Implication:** public join is live now under the entitlement model, but the client should not depend on `.insert(...).select(...).single()` when creating `club_members` rows.

- live UPDATE policy: `Admins can manage members`
- current member-role enforcement now requires:
  - only the eligible Pro/Pro+ club owner may remain `admin`
  - only eligible Pro/Pro+ users who satisfy the club `access_level` may be `moderator`

### `public.club_join_questions`

- live SELECT policy: `Join questions are viewable with clubs`
- current predicate allows read access when:
  - the club is `approval` or `author_club`, or
  - the user is the club admin, or
  - the user is an active/muted member

**Implication:** join questions are safe to use for the current approval/author-club apply flows and admin management.

### `public.club_join_applications`

- live INSERT policy: `Users can apply to join clubs`
- current predicate allows insert only when:
  - `auth.uid() = user_id`
  - target club type is `approval` or `author_club`
  - club is not archived
  - the user is not banned in that club

- live SELECT policy: `Applications viewable by applicant and club moderators`
- live UPDATE policy: `Moderators can update applications`

- live review workflow now also enforces:
  - `is_active_eligible_club_manager(...)` for reviewer eligibility
  - applicant `membership_tier` satisfaction for the club `access_level` before approval-to-membership conversion

**Implication:** public self-apply is live now for `approval` and `author_club`, and only eligible managers can complete approval-to-membership review through the live workflow.

### `public.club_invitations`

- live SELECT policy: `Participants and moderators can view invitations`
- current predicate allows reads for:
  - inviter
  - invitee
  - active eligible club managers via `is_active_eligible_club_manager(...)`

- live invitation creation now also enforces:
  - only eligible managers may send invitations
  - invitee `membership_tier` must satisfy the club `access_level`

- live invitation acceptance now also enforces:
  - accepting user `membership_tier` must satisfy the club `access_level`

**Implication:** manager-side invitation history is live now, and invitee-side reads are possible once the client adds that UI.

### `public.club_events`

- current live columns include:
  - `id`, `club_id`, `title`, `description`, `event_type`, `start_time`, `end_time`
  - `venue_id`, `manual_location`, `meeting_link`, `max_attendees`
  - `created_by`, `created_at`, `updated_at`
  - `status`, `cancelled_at`, `cancelled_by`

- current live constraints now enforce:
  - `event_type in ('virtual', 'in_person', 'hybrid')`
  - `status in ('scheduled', 'cancelled')`
  - `virtual` events require a non-empty `meeting_link`
  - `in_person` events require either `venue_id` or a non-empty `manual_location`
  - `hybrid` events require both:
    - a physical location source (`venue_id` or `manual_location`)
    - and a non-empty `meeting_link`
  - cancelled-state consistency:
    - scheduled events must keep `cancelled_at` / `cancelled_by` null
    - cancelled events must set both fields

- current live policies:
  - `Members can view club events`
    - active/muted club members can view events
  - `Eligible managers can create club events`
    - requires `auth.uid() = created_by`
    - requires `status = 'scheduled'`
    - requires `public.is_active_eligible_club_manager(auth.uid(), club_id)`
  - `Admins or event creators can update club events`
    - admins may manage any event in the club
    - non-admin eligible managers may update only events they created
  - `Admins or event creators can delete club events`
    - admins may delete any event in the club
    - non-admin eligible managers may delete only events they created

### `public.can_manage_club_event(uuid, uuid)`

- this helper is now live and is used by the deployed Events management policies
- it returns true when either:
  - the user can currently hold the `admin` role for the event’s club
  - or the user both:
    - created the event
    - and is still an active eligible club manager for that club

### `public.event_rsvps`

- current live columns include:
  - `event_id`, `user_id`, `status`, `created_at`

- current live RSVP status check remains:
  - `status in ('going', 'maybe', 'not_going')`

- current live policies:
  - `Members can view event RSVPs`
    - active/muted club members can read RSVP rows
  - `Active members can RSVP to scheduled club events`
    - inserts require `auth.uid() = user_id`
    - the target event must be `scheduled`
    - the user must be an `active` club member
  - `Active members can update their own RSVP`
    - updates require `auth.uid() = user_id`
    - the target event must be `scheduled`
    - the user must be an `active` club member
  - `Members can delete their own RSVP`
    - delete remains self-scoped to `auth.uid() = user_id`

### `public.club_venues` and Events

- live venue linkage still uses:
  - `public.club_venues(club_id, venue_id, is_primary)`
  - `public.venues(...)`
- relevant live policies remain:
  - club members can view `club_venues`
  - club admins can manage `club_venues`
- live data note from this session:
  - current live `club_venues` link count is still `0`

**Implication:** the deployed `manual_location` field is currently important for real Clubs Events usage because clubs can now create in-person or hybrid events even when no linked venue exists yet.

## Live constraints and indexes that matter now

### Application uniqueness

- unique index: `club_join_applications_club_id_user_id_key`
- pending index: `idx_applications_pending`

**Implication:** duplicate application submission races can be handled against a real backend uniqueness rule.

### Invitation uniqueness

- status check: `pending | accepted | revoked | expired`
- unique pending index: `club_invitations_pending_unique_idx` on `(club_id, invitee_user_id)` where `status = 'pending'`

**Implication:** local client types should not include `declined`, and manager invite creation can rely on pending-invite uniqueness.

## What backend is already sufficient live

These Clubs areas can continue without new backend work right now:

- public browse/detail using `club_public_details`
- public join for `public` clubs under the entitlement model
- public apply for `approval` and `author_club`
- member-list gating
- application review via `review_club_join_application` under eligible-manager enforcement
- join-question management under existing policies
- manager invitation creation/listing by username under eligible-manager enforcement
- invite acceptance under access-level enforcement
- moderator assignment/admin membership updates under the deployed entitlement rules
- member-only club events with creator/admin management and active-member RSVP under the deployed Events rules

## Supporting auth/session baseline used for current Clubs validation

- live Auth now has `external_phone_enabled = true`
- current dev QA login uses the normal phone OTP path for `+911234567890`
- current fixed test OTP mapping is live as `911234567890=123456` until `2026-12-31T23:59:59+00:00`
- Clubs validation in this session used a real persisted Supabase session, not mock auth

**Implication:** current Clubs browser validation results are based on a real authenticated session and can be reused across app launches until sign-out/session expiry.

## What backend is still incomplete live

These areas still need backend support before they can be considered complete:

- invitation revoke workflow
- invitation read-state workflow
- any full invite-only lifecycle claim that depends on revoke/read/inbox completeness

## Current practical guidance

1. Keep browse/detail reads on `club_public_details`.
2. Keep using `username` as the user-facing invitation identifier.
3. Treat invite-only Clubs as **partially complete** until revoke/read-state support exists live.
4. If future documentation or code conflicts with live Supabase, use live Supabase as canonical and document the drift explicitly.