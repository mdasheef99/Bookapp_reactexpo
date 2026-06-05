# Clubs Implementation Status — 2026-03-07

## Role of this document

This document records the **current implementation reality** for Clubs after the audit and remediation work completed on `2026-03-07`.

> **Historical snapshot note (2026-05-25):** This file preserves the March implementation/audit history. For the current implemented-vs-pending state after Create Club, reading progress, invitation revoke/read-state, venue picker, and nomination-gating updates, use `docs/features/CLUBS_IMPLEMENTATION_INVENTORY.md` and `docs/audits/CLUBS_PENDING_INVENTORY_2026-04-24.md`.

Use this together with:
- `docs/features/CLUBS_SPEC_2026-03-06_234839.md` for canonical product intent and roadmap.
- `docs/features/CLUBS_LIVE_BACKEND_CONTRACT_2026-03-07.md` for verified live Supabase behavior.
- `docs/features/CLUBS_MANAGE_CLUB_SPEC_2026-03-07.md` for the cleaned-up Manage Club scope and its separation from broader Clubs feature areas.

## Sources used

- current repo state under `app/(tabs)/clubs/**` and `src/features/clubs/**`
- live Supabase schema, policies, views, and RPCs
- live Supabase Auth config used for the current one-number dev phone login baseline
- targeted Jest validation for Clubs services/hooks/screens
- Playwright validation of the remediated browse surface, authenticated join/apply flows, and persisted-session behavior

## Current snapshot

## Session update — 2026-03-11

### Verified end to end in this session

- live browser + Supabase-backed validation now confirms:
  - invite acceptance on `ZZ_TEST Invite Only Club`
  - Manage Club settings save on `ZZ_TEST Manage Basics Club`
  - application approval on `ZZ_TEST Approval Club`
  - club event create and edit on `ZZ_TEST Manage Basics Club`
  - nomination rendering, vote cast, and current-book finalization on `ZZ_TEST Manage Basics Club`
- the nominations/current-book path was validated against the live backend using seeded `ZZ_TEST` data after repeated Google Books `429` responses blocked normal search-driven nomination entry

### Live `ZZ_TEST` data already present before this validation

- seeded clubs already existed live:
  - `ZZ_TEST Manage Basics Club`
  - `ZZ_TEST Approval Club`
  - `ZZ_TEST Invite Only Club`
- seeded supporting users already existed live:
  - `zz_test_admin`
  - `zz_test_member`
  - `zz_test_reader`
- before the additional validation seed work, the Playwright user already had:
  - active membership in `ZZ_TEST Manage Basics Club`
  - a pending application in `ZZ_TEST Approval Club`
  - no usable pending invitation in `ZZ_TEST Invite Only Club`

### Additional minimal `ZZ_TEST` data seeded or adjusted in this session

- added a `public.user_profiles` row for the Playwright user so profile-backed manager flows could run against the normal live contract
- elevated the Playwright user to:
  - `admin` in `ZZ_TEST Manage Basics Club`
  - `moderator` in `ZZ_TEST Approval Club`
- created a fresh pending invitation for the Playwright user in `ZZ_TEST Invite Only Club` and accepted it through the current detail-screen path
- created and edited one `ZZ_TEST` club event in `ZZ_TEST Manage Basics Club`
- seeded one `ZZ_TEST` nomination/vote scenario in `ZZ_TEST Manage Basics Club` and closed the voting window so live `finalize_club_book_nomination` could be validated safely

### Remaining blockers and mismatches

- Google Books nomination search remains unreliable because repeated `429` responses still block the normal live search path
- invite revoke and invitation read-state/inbox remain unsupported live
- frontend/backend mismatch: `ClubDetailScreen` currently exposes finalize while `nomination.status === 'active'`, but live finalization succeeds only after `voting_ends_at` has passed

## Session update — 2026-03-10

### Implemented

- live backend now includes the deployed Clubs entitlement enforcement migration for:
  - `membership_tier` vs `access_level`
  - paid-only `moderator`
  - paid-only `admin`
  - tightened invitation / application / membership enforcement
- live backend now also includes deployed Clubs Events migrations `014` and `015` for:
  - `manual_location` fallback when a club has no linked venue
  - preserved event cancellation state (`status`, `cancelled_at`, `cancelled_by`)
  - `virtual` / `in_person` / `hybrid` event enforcement
  - active-member-only RSVP writes
  - admin override plus creator-scoped eligible-manager event management
- the current runtime Profile dependency for this workstream is now explicit and verified:
  - profile reads use `src/features/auth/services/profileService.ts`
  - canonical runtime source is `public.user_profiles`
- current Clubs screens now normalize entitlement-sensitive failures on the active surfaces:
  - detail join / invite acceptance state
  - manage moderator assignment
  - applications review
  - invite manager tooling
- current Clubs Events app surfaces now exist and are wired into the Clubs flow:
  - `app/(tabs)/clubs/[clubId]/events.tsx`
  - `app/(tabs)/clubs/[clubId]/events/create.tsx`
  - `app/(tabs)/clubs/[clubId]/events/[eventId]/edit.tsx`
  - `src/features/clubs/screens/ClubEventsScreen.tsx`
  - `src/features/clubs/screens/ClubEventEditorScreen.tsx`
  - `src/features/clubs/services/clubsEventsService.ts`

### Verified

- live migration history and schema were reconciled through `010`, `011`, `012`, and `013`
- live migration history now also includes `014` and `015` for Clubs Events alignment
- focused Jest verification passed for the active Clubs entitlement slice:
  - `src/features/clubs/hooks/__tests__/useClubs.test.ts`
  - `src/features/clubs/services/__tests__/clubsService.test.ts`
  - `src/features/clubs/screens/__tests__/ClubDetailScreen.test.tsx`
  - `src/features/clubs/screens/__tests__/ClubManageScreen.test.tsx`
  - `src/features/clubs/screens/__tests__/ClubApplicationsScreen.test.tsx`
  - `src/features/clubs/screens/__tests__/ClubInviteScreen.test.tsx`
- focused Events validation also passed in this session:
  - `src/features/clubs/screens/__tests__/ClubEventsScreen.test.tsx`
  - `src/features/clubs/screens/__tests__/ClubEventEditorScreen.test.tsx`
  - adjacent Clubs service/hook regression suites
- live backend verification confirmed the current entitlement helpers, RPCs, triggers, and key policies now match the active Clubs entitlement model
- live rollback-cleaned Events verification also confirmed:
  - admin can create club events
  - regular members cannot create club events
  - active members can RSVP
  - muted members cannot RSVP
  - an eligible moderator can create a `hybrid` event with `manual_location` + `meeting_link` and no linked venue
  - an eligible moderator can update / cancel / delete only the event they created and cannot update / delete an admin-created event

### Remaining caveats

- a fresh end-to-end invite-acceptance walkthrough after live `013` deployment was not performed in this session because no fresh pending invitation test case was prepared
- invite revoke and invitation read-state/inbox remain out of scope and unsupported live
- the current-book nominations/voting app slice exists, but this session did not establish it as a deployed live end-to-end backend contract
- a real browser smoke check for the new Events UI still could not run because the Playwright browser MCP remained unavailable (`Not connected`)

## Session update — 2026-03-08

### Implemented

- one-number dev mobile login for Clubs validation now uses phone `1234567890` (sent as `+911234567890`) through the normal Supabase phone OTP flow
- the current dev login path uses a fixed live test OTP managed in Supabase Auth, not a local email/password shortcut
- `EXPO_PUBLIC_DEV_SKIP_AUTH` stays `false` for real-session Clubs testing
- public-club join now inserts membership first and loads membership in a follow-up read instead of depending on insert-time row representation
- live `club_members` member-visibility reads now rely on a non-recursive helper-backed policy, not the earlier recursive SELECT policy

### Validated

- the one-number dev login creates a real Supabase session and the app reuses that session on reload through the normal persisted auth flow
- `ZZ_TEST Manage Basics Club` public join works end to end for the dev login user
- member-list gating works again after join because the authenticated `club_members` lookup no longer fails
- `ZZ_TEST Approval Club` application submit works end to end for the dev login user
- invite-only detail currently shows the correct invite-required state when the dev login user has no pending invitation

### Partially implemented or not re-verified in this session

- the current Manage Club route baseline has expanded beyond the original audited narrow slice: it now includes current-book workflows, lightweight analytics, admin event administration, the current settings slice, member-role/status management, and join-question management
- invite acceptance still exists in the client/live RPC surface, but it was not re-verified in this session because the dev login user had no fresh pending invitation
- the current dev login user state is no longer clean-room neutral after validation: it now has an active membership in `ZZ_TEST Manage Basics Club` and a pending application in `ZZ_TEST Approval Club`

### Out of scope / unsupported

- invitation revoke
- invitation read-state / inbox workflow
- any claim that invite-only Clubs are complete end to end
- chat, reactions, complaints, and reading-progress surfaces

### Implemented routes in repo

- `app/(tabs)/clubs/index.tsx`
- `app/(tabs)/clubs/[clubId]/index.tsx`
- `app/(tabs)/clubs/[clubId]/applications.tsx`
- `app/(tabs)/clubs/[clubId]/events.tsx`
- `app/(tabs)/clubs/[clubId]/events/create.tsx`
- `app/(tabs)/clubs/[clubId]/events/[eventId]/edit.tsx`
- `app/(tabs)/clubs/[clubId]/invite.tsx`
- `app/(tabs)/clubs/[clubId]/manage.tsx`
- `app/(tabs)/clubs/[clubId]/nominate.tsx`

### Core frontend surfaces in repo

- browse: `app/(tabs)/clubs/index.tsx`
- detail: `src/features/clubs/screens/ClubDetailScreen.tsx`
- applications review: `src/features/clubs/screens/ClubApplicationsScreen.tsx`
- club events: `src/features/clubs/screens/ClubEventsScreen.tsx`
- club event editor: `src/features/clubs/screens/ClubEventEditorScreen.tsx`
- invite manager tooling: `src/features/clubs/screens/ClubInviteScreen.tsx`
- manage basics + join-question management: `src/features/clubs/screens/ClubManageScreen.tsx`
- book nomination entry: `src/features/clubs/screens/ClubNominateBookScreen.tsx`
- shared hooks/service: `src/features/clubs/hooks/useClubs.ts`, `src/features/clubs/services/clubsService.ts`

### Validated in this remediation pass

- service tests: `src/features/clubs/services/__tests__/clubsService.test.ts`
- hook tests: `src/features/clubs/hooks/__tests__/useClubs.test.ts`
- detail screen test: `src/features/clubs/screens/__tests__/ClubDetailScreen.test.tsx`
- browse route test: `app/(tabs)/clubs/__tests__/index.test.tsx`
- manage screen test: `src/features/clubs/screens/__tests__/ClubManageScreen.test.tsx`

## Phase 0 — alignment and backend readiness

### Intended scope

- add `username`
- add invitation data model
- add curated public detail contract
- align live policies/functions with Clubs role and visibility decisions

### Current status

**Strong enough for the currently implemented phases, with live entitlement enforcement now aligned for the active Clubs workstream.**

### Current reality

- live `public.user_profiles.username` exists and is usable now
- live `public.club_public_details` exists and is the current browse/detail contract
- live `public.club_invitations` exists
- live seeded browse baseline now exists in `public.club_public_details` with `3` rows
- live RPCs now include:
  - `review_club_join_application`
  - `create_club_invitation`
  - `accept_club_invitation`
  - `revoke_club_invitation`
  - `mark_invitation_read`
- live entitlement helpers now exist for Clubs enforcement:
  - `user_meets_club_access_level`
  - `can_user_hold_club_role`
  - `is_active_eligible_club_manager`

### Still incomplete or caveated

- invitee-facing invitation inbox/read badge UX is still incomplete
- manual invite-only lifecycle validation with real users/sessions is still pending
- the raw `book_clubs` SELECT policy still does not serve as the public-by-type contract; the app correctly relies on `club_public_details` instead

### Relevant backend surfaces

- view: `public.club_public_details`
- tables: `public.book_clubs`, `public.club_members`, `public.club_join_questions`, `public.club_join_applications`, `public.club_invitations`
- policies: `Clubs are viewable based on type`, `Members can view club members`, `Users can apply to join clubs`, `Join questions are viewable with clubs`, `Participants and moderators can view invitations`

## Phase 1A — route scaffold and browse screen

### Intended scope

- nested Clubs routes
- browse screen
- public discovery search/filtering

### Current implementation status

**Partial, remediated after audit.**

### Implemented now

- nested route layout exists in `app/(tabs)/clubs/_layout.tsx`
- browse route exists at `app/(tabs)/clubs/index.tsx`
- browse uses `useBrowseClubs` + `clubsService.getPublicClubs()` over `club_public_details`
- browse also supports **All Clubs / My Clubs** scope switching via `useMyBrowseClubs` + `clubsService.getMyPublicClubs()`
- current browse search covers:
  - club name
  - current book title
  - admin display name
  - author display name
- current browse filters cover:
  - `club_type`
  - `meeting_type`
  - `access_level`

### Remediated after audit

- added browse filter support for `meeting_type`
- added browse filter support for `access_level`
- broadened search coverage to curator/author metadata
- updated stale browse copy to reflect current shipped flows

### Still partial / caveats

- create CTA is still absent because `app/(tabs)/clubs/create.tsx` does not exist
- chat route is still absent
- Playwright validation of populated browse results remains limited by live data availability and intermittent browser-side Supabase REST timeouts

### Relevant files

- routes: `app/(tabs)/clubs/_layout.tsx`, `app/(tabs)/clubs/index.tsx`
- component: `src/features/clubs/components/ClubCard.tsx`
- hooks/service: `src/features/clubs/hooks/useClubs.ts`, `src/features/clubs/services/clubsService.ts`

## Phase 1B — public detail shell and join/apply entry points

### Intended scope

- public detail screen
- direct join for `public`
- apply flow for `approval`
- apply flow for `author_club`
- invite-only entry states, including invite-required messaging and invite acceptance for invited readers

### Current implementation status

**Partial, but the core live-backed flows and active entitlement checks are implemented.**

### Implemented now

- detail route exists at `app/(tabs)/clubs/[clubId]/index.tsx`
- public detail reads use `useClubPublicDetail` + `clubsService.getPublicClubById()` over `club_public_details`
- direct join works for `public` clubs
- application submit works for `approval` and `author_club`
- pending application state is shown back to the applicant
- invite-only clubs show invite-required messaging when no pending invitation is available to the signed-in reader
- signed-in invitees can accept a pending invitation from the detail screen via live `accept_club_invitation`

### Validated in the current Clubs validation cycle

- public join on `ZZ_TEST Manage Basics Club`
- approval apply on `ZZ_TEST Approval Club`
- invite-required messaging on the current invite-only seeded club when no invitation exists for the signed-in user
- invite acceptance on `ZZ_TEST Invite Only Club` using a fresh pending invitation created for the Playwright user

### Remediated after audit

- fixed stale detail copy so it matches currently shipped flows
- improved public detail metadata display for:
  - access requirement
  - meeting format
  - admin summary
  - featured author summary
  - member capacity / community city when present

### Still partial / caveats

- leave-club behavior exists in the service layer but is not surfaced as a polished detail-screen action in this current status pass
- member-only chat is still not implemented yet
- member-only Events is now implemented with member-only visibility, active-member RSVP, and creator-scoped moderator management under the live backend rules
- the current-book nominations/voting surface now has a verified live end-to-end path for seeded `ZZ_TEST` data, but it remains a narrow UI slice and still depends on unreliable Google Books search input
- invite-only lifecycle is still incomplete because inbox/read-state/revoke flows are not fully supported live
- frontend/backend mismatch: finalize is still exposed before voting has closed even though live finalization only succeeds after `voting_ends_at`

### Relevant files

- route: `app/(tabs)/clubs/[clubId]/index.tsx`
- screen: `src/features/clubs/screens/ClubDetailScreen.tsx`
- hooks/service: `src/features/clubs/hooks/useClubs.ts`, `src/features/clubs/services/clubsService.ts`

## Phase 1C — member-list gating

### Intended scope

- non-members can view club detail
- non-members cannot view member list
- members can view member list

### Current implementation status

**Complete for the currently implemented scope.**

### Implemented now

- member list reads use `useClubMembers` + `clubsService.getClubMembers()`
- detail screen gates the list on membership state
- live `club_members` policy supports this model after the `2026-03-08` recursion fix

### Validated in this session

- authenticated membership-state lookup returns successfully again for the dev login user
- member list becomes visible after the dev login user joins the public seeded club

### Caveats

- this does not imply chat or broader member-only engagement surfaces beyond the current Events and nominations/voting slices are implemented yet

### Relevant files

- component: `src/features/clubs/components/ClubMemberList.tsx`
- screen: `src/features/clubs/screens/ClubDetailScreen.tsx`
- policy dependency: `public.club_members` SELECT policy

## Phase 2A — application review screen

### Intended scope

- moderator/admin review of pending applications
- decision actions for approve / decline

### Current implementation status

**Complete for the current scope, with live entitlement enforcement aligned.**

### Implemented now

- route: `app/(tabs)/clubs/[clubId]/applications.tsx`
- screen: `src/features/clubs/screens/ClubApplicationsScreen.tsx`
- hook/service path: `useClubApplications`, `useReviewClubApplication`, `clubsService.reviewJoinApplication()`
- backend path: live `review_club_join_application` RPC

### Remediated after audit

- fixed query invalidation so browse/detail/member/application state refreshes correctly after review decisions
- normalized manager-side entitlement errors so the screen now matches the live eligible-manager backend checks

### Caveats

- broader moderation tooling beyond applications review remains out of scope for the current implementation

## Phase 2B — Manage Club basics (current manage-screen scope)

### Intended scope

- broader manage-club settings, starting with join rules; the current route now includes current-book workflows, lightweight analytics, event administration, member management, and join-question management, while still remaining intentionally bounded

### Current implementation status

**Implemented, but still intentionally bounded.**

### Implemented now

- route: `app/(tabs)/clubs/[clubId]/manage.tsx`
- screen: `src/features/clubs/screens/ClubManageScreen.tsx`
- admin-only access guard on the manage surface
- current-book workflows:
  - view current book
  - finalize a closed nomination
  - set an active nomination as current book
  - manual override via nomination-backed shortcut flow
- lightweight analytics summary cards
- admin event administration:
  - create
  - edit
  - cancel
  - delete cancelled/past events
- first basic settings slice via live-supported `book_clubs` updates:
  - metadata editing
  - privacy / access rule editing
  - cover photo URL field
  - member-cap editing
  - meeting format editing
  - saved-state summary, reset affordance, and validation
- member role/status management:
  - assign/remove moderator
  - mute/unmute member
  - remove member
- join-question CRUD via:
  - `useClubJoinQuestions`
  - `useCreateClubJoinQuestion`
  - `useUpdateClubJoinQuestion`
  - `useDeleteClubJoinQuestion`
- conditional applications and invitations tabs tied to club type

### Remediated after audit

- corrected stale copy that implied broader settings were already in progress
- kept labels/copy honest so the screen is still presented as a bounded club-management surface, not a complete governance dashboard

### Still partial / caveats

- the current settings support is only the first basic slice, not a complete manage-club settings surface
- admin-only moderator assignment/remove-member actions remain part of the current manage-screen baseline, and moderator assignment is now constrained by live paid-tier + access-level enforcement
- the current events tab/actions are admin-only in the client, even though the live backend now supports creator-scoped eligible-manager event management
- current-book management is implemented, but the longer-term product rule for nominations versus override flows still needs clarification
- archive is out of the accepted current Manage Club roadmap
- the detailed intended Manage Club expansion path now lives in `docs/features/CLUBS_MANAGE_CLUB_SPEC_2026-03-07.md`

## Phase 3A — invite-only manager tooling

### Intended scope

- managers invite by username
- invite history/statuses
- invite acceptance/revoke lifecycle

### Current implementation status

**Partial, with live entitlement and invitation revoke/read-state backend support aligned; invitee inbox UX and manual lifecycle validation remain pending.**

### Implemented now

- route: `app/(tabs)/clubs/[clubId]/invite.tsx`
- screen: `src/features/clubs/screens/ClubInviteScreen.tsx`
- service/hook path:
  - `useClubInvitations`
  - `useCreateClubInvitation`
  - `useRevokeClubInvitation`
  - `useMarkInvitationRead`
  - `clubsService.getClubInvitations()`
  - `clubsService.createClubInvitation()`
  - `clubsService.revokeClubInvitation()`
  - `clubsService.markInvitationRead()`
- backend path:
  - `public.club_invitations`
  - live `create_club_invitation` RPC
  - live `accept_club_invitation` RPC is surfaced in the client through the club-detail invitation-acceptance flow
  - live `revoke_club_invitation` RPC
  - live `mark_invitation_read` RPC
  - live `club_invitations.read_at`

### Remediated after audit

- aligned invite-screen copy with current live capabilities
- removed unsupported local invitation status drift (`declined`)
- normalized invitation loading/sending entitlement failures so the screen matches the live eligible-manager backend checks
- added revoke/read-state service and hook support after the 2026-05-23 live migration
- surfaced pending-invitation revoke in Manage Club invitations

### Still partial / blocked

- no invitee-facing invitation inbox yet
- resend/revoke/read-state cannot be called complete until inbox UX and real-session lifecycle validation are finished or the scope is explicitly reduced

## Deferred or still-partial phases

### Phase 4 — chat and engagement

**Partially implemented.** Chat, reactions, and reading-progress surfaces remain deferred. Member-only Events/RSVP is implemented and verified in the current live slice; the current-book nominations/voting flow now has a verified live end-to-end backend path for seeded `ZZ_TEST` data (nomination render, vote cast, finalize, current-book update), but the slice remains narrow, Google Books search is still externally unreliable (`429`), and finalize-button gating is still misaligned with the backend voting-close rule. Broader engagement depth is still incomplete.

### Phase 5 — author-club enhancements

**Not started.** Advanced author-club discovery and author-specific management/AMA flows remain deferred.

## Audit remediations completed on 2026-03-07

### Cache/query invalidation

- fixed join/apply invalidation to refresh all Clubs browse queries
- fixed review-decision invalidation to refresh browse results too

### UI copy corrections

- removed stale “coming later” claims where flows are already live
- clarified where features are still blocked by backend gaps

### Repo/live contract alignment

- aligned local invitation status typing with live Supabase (`pending | accepted | revoked | expired`)

### Browse/detail alignment

- added browse filters for meeting/access
- expanded public search coverage
- improved detail metadata display

## Additional remediations completed on 2026-03-08

### Authenticated Clubs QA baseline

- replaced the temporary email/password dev shortcut with a single-number phone OTP dev login path
- validated real-session persistence with `EXPO_PUBLIC_DEV_SKIP_AUTH=false`

### Live/backend join-flow repair

- fixed the recursive `public.club_members` SELECT policy that caused `42P17 infinite recursion detected in policy for relation "club_members"`
- updated public join to avoid depending on insert-time row representation for `club_members`

## What still needs UX/validation

- invitee-facing invitation inbox/read-state UX
- manual full invite-only lifecycle validation with real users/sessions
- any claim that invite-only Clubs are fully complete end-to-end

## What should come next

1. Refine and validate the current **basic club settings** slice for fuller Manage Club expansion.
2. Align the manage UI with the live backend capability model where appropriate, especially for moderator event-management parity.
3. Resolve the remaining current-book product-policy questions around nomination-driven versus override-driven flows.
4. Finish and validate the invite-only lifecycle UX now that `revoke_club_invitation` and `mark_invitation_read` are live.
5. Define whether richer analytics/reporting belongs in the near-term Manage Club roadmap or should stay out of scope.
6. Add real seeded Clubs data in a safe environment if stronger end-to-end validation is needed.
7. Keep future Clubs work aligned to the canonical spec, this status doc, the dedicated Manage Club spec, and the live backend contract doc together.
