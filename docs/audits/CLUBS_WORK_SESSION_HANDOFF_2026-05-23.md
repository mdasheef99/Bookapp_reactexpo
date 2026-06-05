# Clubs Work Session Handoff - 2026-05-23

## Context

This handoff summarizes the long BookClub / Clubs review and implementation session from 2026-05-23.

The working tree was already dirty before this work. Do not revert or overwrite unrelated user changes. Treat the items below as the known Clubs/Profile-related work from this session and verify with `git diff` before staging or committing anything.

Live Supabase project used during the session:

- Project id/ref: `ahntbtktjjmvfosgkmgn`
- Project name seen earlier: `Bookconnect_reactexpo`

## What Was Reviewed

The session began as a thorough expert review request for the BookClub / Clubs section:

- Clubs routes, screens, components, hooks, services, tests
- Supabase migrations, RLS, policies, RPC grants
- Browse, create, join/apply, detail, manage, members, invitations, discussions, events, venues, nominations, current book, reading progress
- React Query invalidation behavior
- UX states and feature completeness versus docs/specs
- TypeScript and test health
- Live Supabase drift where tools allowed

Augment/codebase retrieval and Supabase MCP were used for context and live verification.

## Confirmed Product Decisions

- Anonymous users should be able to browse public club details.
- Chat can be postponed for now.
- Create Club should be visible only to Pro / Pro+ customers.
- Create Club entry should live in the Profile section.
- Current Create Club implementation is MVP.
- There is no user-facing subscription upgrade mechanism yet.

## Subscription / Membership Status

Membership tiers exist and are enforced, but subscription upgrade is not implemented.

Implemented:

- `user_profiles.membership_tier`: `free | pro | pro_plus`
- UI displays tier in Profile.
- Clubs entitlement checks use tier.
- Create Club is gated to Pro / Pro+ in Profile.
- DB triggers/RPCs/Edge Function enforce Clubs limits and privileged roles.

Not implemented:

- No subscription upgrade screen.
- No Pro / Pro+ checkout flow.
- No in-app purchase or payment provider integration for membership.
- No billing/subscription tables for user memberships.
- No user-facing path that updates `membership_tier`.

Current practical implication: tiers are admin/seed controlled until Profile/subscription work is designed.

Known live QA phone from docs/live check:

- Phone: `1234567890` as app input, sent to Supabase as `+911234567890`
- OTP: `123456`
- Current profile: `ZZ TEST Clubs Admin`
- Username: `zz_test_admin`
- Tier: `pro`

Do not create fixed OTP accounts by inserting rows into SQL tables. Supabase fixed OTPs are Auth configuration, not ordinary app data.

## Implemented App Changes

### Create Club

Files:

- `app/(tabs)/clubs/create.tsx`
- `app/(tabs)/clubs/_layout.tsx`
- `src/features/clubs/screens/ClubCreateScreen.tsx`
- `src/features/clubs/screens/__tests__/ClubCreateScreen.test.tsx`
- `src/features/clubs/hooks/useClubs.ts`
- `src/features/clubs/services/clubsManagementService.ts`
- `src/features/clubs/services/__tests__/clubsService.test.ts`

Summary:

- Added Create Club screen/route.
- Added `useCreateClub`.
- Moved create service from separate `book_clubs` + `club_members` inserts to transactional `create_club` RPC.
- Kept Edge Function pre-check for membership limits.
- Fetches final club detail after RPC success.

### Profile Create Club Entry

Files:

- `app/(tabs)/profile/index.tsx`
- `app/(tabs)/profile/__tests__/profile.test.tsx`

Summary:

- Added Create Club row in Profile account menu.
- Visible only when `membership_tier` is `pro` or `pro_plus`.
- Hidden for free members.
- Navigates to `/(tabs)/clubs/create`.

### Clubs Browse Search Sanitization

Files:

- `src/features/clubs/services/clubsReadService.ts`
- `src/features/clubs/services/__tests__/clubsService.test.ts`

Summary:

- Added search normalization before interpolating terms into the Supabase/PostgREST `.or(...)` filter.
- Normalizes reserved OR-filter characters such as `%`, `(`, `)`, `,`, `.`.
- Added regression test for malformed/search-injection-like input.

### Invitation Revoke / Read-State

Files:

- `src/features/clubs/services/clubsInvitationsService.ts`
- `src/features/clubs/services/clubsService.types.ts`
- `src/features/clubs/hooks/useClubs.ts`
- `src/features/clubs/screens/ClubManageScreen.tsx`
- `src/features/clubs/screens/manage/ClubManageInvitationsSection.tsx`
- `src/features/clubs/screens/__tests__/ClubManageScreen.test.tsx`
- `src/features/clubs/services/__tests__/clubsService.test.ts`

Summary:

- Added `ClubInvitation.read_at`.
- Added service methods:
  - `revokeClubInvitation(invitationId)`
  - `markInvitationRead(invitationId)`
- Added hooks:
  - `useRevokeClubInvitation`
  - `useMarkInvitationRead`
- Manage Club invitations tab now shows `Revoke` for pending invitations.
- Revoke mutation invalidates club invitations.
- Mark-read hook invalidates club invitations and current user's pending invitation query.

## Implemented Supabase Migrations

Local migration files added:

- `supabase/migrations/20260523035706_harden_clubs_rpc_execute_grants.sql`
- `supabase/migrations/20260523035843_harden_clubs_member_entitlement_execute_grant.sql`
- `supabase/migrations/20260523054932_create_club_rpc.sql`
- `supabase/migrations/20260523090700_harden_club_public_details_view.sql`
- `supabase/migrations/20260523091736_restrict_club_public_details_view_grants.sql`
- `supabase/migrations/20260523092143_add_club_invitation_revoke_read_rpc.sql`

Live Supabase migrations applied successfully during the session:

- `harden_clubs_rpc_execute_grants`
- `harden_clubs_member_entitlement_execute_grant`
- `create_club_rpc`
- `harden_club_public_details_view`
- `restrict_club_public_details_view_grants`
- `add_club_invitation_revoke_read_rpc`

### Live Verification Completed

Verified live:

- Targeted Clubs helper/RPC execute grants no longer expose privileged/trigger-only functions to `anon`.
- `create_club` exists live.
- `create_club` is not `SECURITY DEFINER`.
- `anon` cannot execute `create_club`.
- `authenticated` and `service_role` can execute `create_club`.
- `club_public_details` has `security_invoker=true`.
- `anon` and `authenticated` have only `SELECT` on `club_public_details`.
- `service_role` remains broadly privileged on the view.
- `club_invitations.read_at` exists.
- `revoke_club_invitation` and `mark_invitation_read` exist.
- `anon` cannot execute invitation revoke/read RPCs.
- `authenticated` and `service_role` can execute invitation revoke/read RPCs.

## Verification Run During Session

Known passing commands after the latest work:

```powershell
npm.cmd test -- --runInBand src/features/clubs/services/__tests__/clubsService.test.ts src/features/clubs/hooks/__tests__/useClubs.test.ts src/features/clubs/screens/__tests__/ClubManageScreen.test.tsx
```

Result:

- 3 suites passed
- 73 tests passed

Also passed after latest work:

```powershell
npx.cmd tsc --noEmit
```

Earlier focused passing checks included:

```powershell
npm.cmd test -- --runInBand src/features/clubs/services/__tests__/clubsService.test.ts
npm.cmd test -- --runInBand src/features/clubs/screens/__tests__/ClubCreateScreen.test.tsx "app/(tabs)/profile/__tests__/profile.test.tsx" src/features/clubs/hooks/__tests__/useClubs.test.ts
npm.cmd test -- --runInBand --runTestsByPath "app/(tabs)/profile/__tests__/profile.test.tsx"
```

Note: one combined Jest run did not pick up the Profile route test due path/matcher behavior, but the explicit `--runTestsByPath` Profile run passed.

## Still Pending / Known Gaps

### Must Still Test

The last user request before this handoff was to test remaining Clubs aspects. The process was just beginning when interrupted. Recommended next session should run the full Clubs-focused test inventory.

Likely test files to include:

- `app/(tabs)/clubs/__tests__/index.test.tsx`
- `src/features/clubs/services/__tests__/clubsService.test.ts`
- `src/features/clubs/hooks/__tests__/useClubs.test.ts`
- `src/features/clubs/screens/__tests__/ClubCreateScreen.test.tsx`
- `src/features/clubs/screens/__tests__/ClubDetailScreen.test.tsx`
- `src/features/clubs/screens/__tests__/ClubManageScreen.test.tsx`
- `src/features/clubs/screens/__tests__/ClubApplicationsScreen.test.tsx`
- `src/features/clubs/screens/__tests__/ClubInviteScreen.test.tsx`
- `src/features/clubs/screens/__tests__/ClubEventsScreen.test.tsx`
- `src/features/clubs/screens/__tests__/ClubEventEditorScreen.test.tsx`
- `src/features/clubs/screens/__tests__/ClubDiscussionScreen.test.tsx`
- `src/features/clubs/screens/__tests__/ClubDiscussionThreadScreen.test.tsx`
- `src/features/clubs/screens/__tests__/ClubNominateBookScreen.test.tsx`
- `src/features/clubs/screens/__tests__/ClubReadingProgressScreen.test.tsx`, if present
- `src/features/clubs/screens/__tests__/ClubVenuePickerScreen.test.tsx`, if present
- `src/features/clubs/screens/manage/__tests__/*.test.tsx`

Use `rg --files app src/features/clubs | rg "\.test\.(ts|tsx)$"` to get the actual current list.

### Product/Feature Gaps

- Full chat/realtime messages remain postponed.
- Subscription upgrade flow is not implemented.
- Test-account strategy needs a Profile/subscription/Auth-config pass.
- Need real-device/browser validation with a real session after test accounts exist.
- Need manual invite-only lifecycle validation:
  - create invite
  - revoke pending invite
  - invitee sees pending invite
  - invitee marks read
  - invitee accepts
  - membership and member count update

### Docs Drift

Resolved 2026-05-24 after live verification: older docs were updated to reflect that `revoke_club_invitation` and `mark_invitation_read` are live after the migration.

Docs likely needing updates:

- `docs/features/CLUBS_LIVE_BACKEND_CONTRACT_2026-03-07.md`
- `docs/features/CLUBS_IMPLEMENTATION_STATUS_2026-03-07.md`
- `docs/features/CLUBS_IMPLEMENTATION_INVENTORY.md`
- `docs/audits/CLUBS_PENDING_INVENTORY_2026-04-24.md`

## Prompt For Next Session: Continue Clubs Verification

Use this prompt in a fresh session:

```text
We are in C:\Users\user\Documents\augment-projects\Bookconnect_expo.

Please continue the Clubs / BookClub verification from the handoff doc:
docs/audits/CLUBS_WORK_SESSION_HANDOFF_2026-05-23.md

Important constraints:
- Start by reading the handoff doc.
- The worktree is dirty. Do not revert or overwrite unrelated user changes.
- Use Augment/codebase retrieval first for broad context.
- Use Supabase MCP for live verification if available.
- If you edit files, use apply_patch for manual edits.
- Keep Create Club visible only to Pro / Pro+ users in Profile.
- Subscription upgrade/test-account strategy is deferred to the Profile pass.

Primary goal:
Run and evaluate the remaining Clubs test surface, then fix only Clubs-related regressions found by the tests.

Please do this systematically:
1. Enumerate all Clubs-related test files using rg.
2. Run focused Clubs tests in small batches:
   - routes/browse/create/detail
   - services/hooks
   - manage screen and manage subsections
   - invitations/applications/members
   - discussions/thread/read state
   - events/event editor/venues
   - nominations/current book/reading progress
3. Run TypeScript with `npx.cmd tsc --noEmit`.
4. If any global TypeScript/test failures appear, separate Clubs-related failures from unrelated dirty-worktree failures.
5. Use Supabase MCP to verify live Clubs schema/RPC/policy state where useful:
   - `create_club`
   - `club_public_details`
   - `revoke_club_invitation`
   - `mark_invitation_read`
   - important RLS/grants for `book_clubs`, `club_members`, `club_invitations`
6. Do not create test Auth accounts in SQL. Fixed OTP numbers require Supabase Auth configuration.
7. Report findings in expert review style:
   - Critical/high issues first with file/line references
   - Medium/low improvements
   - What is implemented well
   - Test/verification results
   - Prioritized next action plan

Known passing baseline from previous session:
- `npm.cmd test -- --runInBand src/features/clubs/services/__tests__/clubsService.test.ts src/features/clubs/hooks/__tests__/useClubs.test.ts src/features/clubs/screens/__tests__/ClubManageScreen.test.tsx` passed 73/73.
- `npx.cmd tsc --noEmit` passed.

Known live Supabase state from previous session:
- `create_club_rpc` applied.
- `club_public_details` is `security_invoker=true`.
- `anon`/`authenticated` have only SELECT on `club_public_details`.
- `club_invitations.read_at` exists.
- `revoke_club_invitation` and `mark_invitation_read` exist and are not executable by anon.
```

## Prompt For Profile Section Analysis

Use this prompt when ready to analyze Profile:

```text
Please perform a thorough expert review of the Profile / Account section of this application.

Start read-only. Do not edit files unless I explicitly ask afterward.

Please analyze:
- All Profile routes, screens, components, hooks, services, tests, and Supabase migrations/policies touching profile/account data
- User flows:
  - profile view
  - edit profile
  - setup profile after OTP
  - settings
  - addresses
  - credit history
  - auth/session display and sign out
  - membership tier display
  - Pro / Pro+ gating entry points such as Create Club
  - any planned subscription upgrade flow
- Data model and RLS/security posture:
  - `user_profiles`
  - profile summaries/public profile exposure
  - username uniqueness/format
  - membership_tier mutability
  - address privacy
  - credit history visibility
  - auth/profile creation edge cases
- Subscription/upgrade readiness:
  - confirm whether any user-facing Pro/Pro+ upgrade exists
  - find all docs/specs describing memberships/subscriptions
  - identify missing tables, RPCs, payment/provider integration, and UX
  - propose a feasible MVP upgrade architecture if not implemented
- Test account strategy:
  - determine the safest way to create QA personas for free/pro/pro_plus/verified-author/invitee
  - do not insert directly into `auth.users`
  - verify whether Supabase fixed OTP config is available through tools
  - propose easy memorable phone/OTP mappings and required profile seed data
- Cache invalidation and React Query behavior for profile/account updates
- Feature completeness versus docs/specs
- UX consistency, empty/error/loading states, mobile/web behavior
- TypeScript health and test coverage
- Any schema/code drift or live Supabase mismatch if tools are available

Please use:
- Augment/codebase retrieval for codebase understanding
- Supabase MCP for live schema/RLS/config checks if available
- Focused Profile tests where possible
- TypeScript if feasible

If global TypeScript or tests fail, separate Profile-related failures from unrelated dirty-worktree failures.

Return findings in expert review style:
1. Critical/high issues first with file and line references
2. Medium/low improvements
3. What is already implemented well
4. Test/verification results
5. A recommended prioritized action plan

Important constraints:
- The worktree may be dirty. Do not revert user changes.
- Start read-only.
- Do not create or mutate live Auth users unless explicitly approved.
- Do not claim subscription upgrade exists unless verified in code and/or live Supabase.
```
