## Clubs Entitlement and Implementation Analysis

### Purpose
- Capture the current Clubs entitlement model and implementation status using the source of truth established in this session:
  - current codebase structure
  - reviewed Clubs docs/specs
  - verified live/backend behavior
  - identified doc/code/live drift
  - corrected entitlement assumptions agreed during this discussion
  - the Profile/auth dependency issue discovered while implementing entitlement-aware Clubs follow-up

### 1. Current Clubs entitlement model

#### Global membership tiers
- `free`
- `pro`
- `pro_plus`
- Current app-wide source of truth:
  - `user_profiles.membership_tier`
  - `src/features/auth/services/profileService.ts`

#### Club access levels
- `all`
- `pro`
- `pro_plus`
- Intended meaning: minimum membership tier required for club eligibility/join.

#### In-club roles
- `member`
- `moderator`
- `admin`
- Roles are distinct from subscription tiers and from club `access_level`.

### 2. Corrected role / entitlement rules

#### Member eligibility
- A user may be a club `member` only if their global `membership_tier` satisfies the club `access_level`.
- Effective matrix:
  - `free` -> only `all`
  - `pro` -> `all`, `pro`
  - `pro_plus` -> `all`, `pro`, `pro_plus`

#### Moderator eligibility
- Corrected rule for this project context:
  - only `pro` and `pro_plus` users may become or remain `moderator`
  - `free` users must not become or remain `moderator`
- A moderator must also be eligible for the club under `membership_tier` vs `access_level`.
- Moderator assignment remains an admin-managed in-club action.

#### Admin eligibility
- Corrected rule for this project context:
  - only `pro` and `pro_plus` users may become or remain `admin`
  - `free` users must not become or remain `admin`
- An admin must also be eligible for the club under `membership_tier` vs `access_level`.

#### Relationship between tier, access level, and role
- `membership_tier` answers: what subscription entitlement the user has.
- `access_level` answers: what subscription entitlement a club requires.
- `role` answers: what the user may do inside a club after they are validly eligible.

### 3. Current implementation status

#### Clearly implemented
- Clubs service layer has been split into focused modules:
  - reads
  - management
  - membership
  - applications
  - invitations
  - books/voting
- Current Manage Club flow is admin-only.
- Current role-management flow supports `member` <-> `moderator`.
- Current frontend entitlement messaging/gating now covers the active Clubs surfaces in this workstream:
  - club detail join / invite-acceptance states
  - manage-club moderator assignment restrictions
  - application-review manager errors
  - invite-only invitation loading/sending manager errors
- Focused screen tests now cover those entitlement-aware UI paths.
- Live backend entitlement enforcement is now deployed for the current workstream:
  - `membership_tier` vs club `access_level`
  - paid-only `moderator`
  - paid-only `admin`
  - tightened invitation / application / membership enforcement
- Local membership-limit logic exists in `supabase/functions/check-membership-limits/index.ts`:
  - `free` -> `0` clubs created
  - `pro` -> `5`
  - `pro_plus` -> `15`

#### Only documented
- `access_level` as the minimum subscription tier required to join a club.
- Broader downgrade / grace-period behavior.
- Some premium-tier feature descriptions outside core Clubs enforcement.

#### Partially implemented
- Book nomination/voting/current-book workflow now has a narrow implemented product slice: local migration/service-hook support, club-detail nomination + vote/remove-vote/admin-finalize actions, and a dedicated nomination screen.
- That slice remains partial because it was not established as a deployed live end-to-end backend contract in this session.

#### Drifting / inconsistent
- Earlier reviewed docs/spec language conflicted with the corrected model by implying or stating that free users could be moderators.

### 4. Live/backend verification summary

#### Verified in this session
- Real-session Clubs/auth baseline preserved:
  - phone OTP login
  - `1234567890` / `123456`
  - `EXPO_PUBLIC_DEV_SKIP_AUTH=false`
  - persisted session reuse
- Verified live Clubs behavior for:
  - club detail / join states
  - invite acceptance
  - application review access model
  - manage-club / member-role flows
- Verified current live/backend gap:
  - pre-`013` live/backend entitlement gaps were confirmed and then reconciled through the deployment sequence in this session
- Verified live after deployment/reconciliation:
  - migrations `010`, `011`, and `012` were reconciled into live history/state before `013`
  - `013` entitlement helpers, triggers, RPC checks, and key policies are now live
  - the current frontend/service layer is aligned with those live entitlement checks for:
    - club join
    - manager-side invitation handling
    - join-application review
    - moderator assignment

#### Not verified in this session
- Full live deployment/use of downgrade enforcement logic
- Automated grace-period handling for non-renewal/downgrade
- Automated remediation for invalid moderators/admins/memberships
- A fresh end-to-end invite-acceptance walk with a newly created live invitation after `013` deployment
- Live deployment and end-to-end backend verification of the nominations/voting/current-book flow

### 5. Known inconsistencies and risks

#### Session-discovered Profile/auth dependency issue
- This issue surfaced while implementing the next Clubs entitlement slice: clearer service/UI handling for join, invite, and moderator entitlement failures.
- The blocker was not a live `profiles` runtime dependency. The current app runtime reads profile data from `public.user_profiles` via `src/features/auth/services/profileService.ts`.
- The actual issue discovered in-session was:
  - `app/(auth)/verify-otp.tsx` had been routing every authenticated user to `/(auth)/setup-profile`
  - `app/(auth)/setup-profile.tsx` writes a new row into `public.user_profiles`
  - because `user_profiles.user_id` is unique, returning users were at risk of being sent into duplicate profile creation
- Current app-side fields actively relied on by the entitlement-aware Clubs work are:
  - `user_id`
  - `display_name`
  - `username`
  - `avatar_url`
  - `city`
  - `trust_score`
  - `membership_tier`
- Current source-of-truth outcome from this session:
  - canonical runtime profile source: `public.user_profiles`
  - canonical runtime read layer: `profileService`
  - no active runtime `public.profiles` dependency was confirmed in the current app code
- Narrow fixes completed in this session before resuming broader Clubs entitlement work:
  - `verify-otp.tsx` now checks whether a `user_profiles` row already exists and routes existing users into the app
  - `profileService.ts` now explicitly treats `user_profiles` as canonical and its types were aligned with the verified live schema

#### Active task sequence when the issue was discovered
1. Main task: continue the Clubs entitlement correction work.
2. In-progress subtask: add entitlement-aware service/UI behavior for join, invite acceptance, application review, and moderator assignment.
3. Problem encountered: Profile/auth dependency uncertainty while wiring membership-tier-based profile reads and validating current behavior.
4. Paused follow-up tasks:
   - further Clubs entitlement UI polish and messaging (now completed for the currently active detail/manage/applications/invite screens)
   - later Clubs follow-up work beyond the entitlement slice

#### Backend enforcement status
- The current entitlement backend contract for the active workstream is now live:
  - membership entry flows are guarded by `membership_tier` vs `access_level`
  - moderator/admin eligibility is enforced by subscription tier and club access level
- Remaining backend gaps for Clubs are outside this entitlement slice:
  - invitation revoke workflow
  - invitation read-state / inbox workflow

#### Service-layer assumptions
- Current service layer is structurally good and now aligns with the corrected entitlement model for the active flows in this workstream.
- The Profile data contract used by those paths is now clarified: runtime reads should use `profileService` against `public.user_profiles`, not an unverified `profiles` abstraction.

#### Frontend gating gaps
- Frontend coverage is aligned for the active entitlement-sensitive screens in this workstream:
  - detail, manage, applications, and invite screens normalize the main entitlement-sensitive failures
  - focused screen tests passed for those paths in this session
- Some Clubs surfaces outside the currently active slice may still lack equivalent entitlement-specific copy or gating.

#### Downgrade / retention uncertainties
- Docs describe grace-period and downgrade behavior, but implementation/live enforcement is incomplete and not fully verified.
- It remains unclear whether role loss or premium-club access loss should be immediate or grace-period-based.

#### Existing data risks
- Development/QA or live user rows may already violate the corrected model, for example:
  - `free` users assigned as `moderator`
  - `free` users assigned as `admin`
  - users retained in clubs above their allowed `access_level`
- These should be audited before any live remediation.

### 6. Recommended correction plan

#### Foundational fixes first
1. Existing-data audit
   - identify invalid moderators/admins/memberships before remediation
2. Focused live behavior verification
   - re-check invite acceptance with a fresh live pending invitation when suitable test data is available
   - keep validating manager/member flows against the now-live backend contract

#### Incremental follow-up work
- Keep Clubs services and screens aligned to the now-live entitlement backend contract.
- Continue tightening frontend gating and clear upgrade/error messaging only where the current active Clubs entitlement slice still lacks it.
- Continue nominations/voting/current-book follow-up from the current narrow slice now that entitlement enforcement is reliable enough for this workstream.

#### What should wait until later
- Full downgrade/non-renewal automation
- Grace-period warning UX
- Automated admin transfer/orphan-club handling
- Broad data cleanup beyond a targeted audited remediation plan

### 7. Decision summary

#### Should broader Clubs feature work pause?
- No longer for this entitlement foundation issue.
- The current membership/access foundation for the active Clubs flows is now corrected and verified enough to continue this workstream safely.

#### Safest next implementation step
- Keep verification/documentation tight around the now-live entitlement contract and only expand beyond this slice after any remaining invite-only lifecycle caveats are explicitly accepted or further backend support is added.

#### Development data cleanup note
- No broad cleanup is recommended now.
- If later validation is blocked by invalid development/QA-only users, prefer a targeted audited remediation over broad deletion.