# Clubs Feature — Full Implementation Inventory

**Last updated:** 2026-05-01
**Sources cross-referenced:**
- `docs/features/CLUBS_SPEC_2026-03-06_234839.md` (canonical product intent)
- `docs/features/CLUBS_IMPLEMENTATION_STATUS_2026-03-07.md` (repo reality)
- `docs/features/CLUBS_MANAGE_CLUB_SPEC_2026-03-07.md` (Manage Club scope)
- `docs/features/CLUBS_ENTITLEMENT_IMPLEMENTATION_ANALYSIS_2026-03-10.md` (tier/role rules)
- Direct codebase inspection of `app/(tabs)/clubs/**`, `src/features/clubs/**`
- **Live Supabase DB audit:** `information_schema.columns`, `pg_policies`, `pg_trigger`, `pg_publication_tables`, `pg_class` (replica identity, Realtime status)

---

## Legend

| Status | Meaning |
|--------|---------|
| **Implemented** | End-to-end path exists: route → screen → hook → service → live backend. Validated or freshly audited. |
| **Partially Implemented** | Some surfaces exist (service but no screen, screen but backend gap, or functional but with known bugs). |
| **Backend Ready / Frontend Missing** | Live DB schema, RLS, triggers, and/or RPCs are fully deployed. Zero frontend references — no route, screen, hook, or service calls the backend object. |
| **Blocked / Pending** | Zero frontend or zero backend support exists; cannot be exercised by a user. |

---

## 1. Manage Club

### Implemented

| Item | Code Location | Notes |
|------|---------------|-------|
| Route entry | `app/(tabs)/clubs/[clubId]/manage.tsx` | Thin re-export of `ClubManageScreen`. |
| Manage screen | `src/features/clubs/screens/ClubManageScreen.tsx` | ~660 lines. Single-scroll admin/moderator surface. |
| Basic settings slice | `ClubManageScreen.tsx` lines 30–38, 505–560 | Name, description, cover URL, member cap, club type, access level, meeting type. Dirty-state tracking, validation, reset affordance. |
| Join-question CRUD | `ClubManageScreen.tsx` lines 321–357, 586–596 | Create, inline edit (question + required toggle), delete. Hooks: `useCreateClubJoinQuestion`, `useUpdateClubJoinQuestion`, `useDeleteClubJoinQuestion`. |
| Member-role toggles | `ClubManageScreen.tsx` lines 257–289 | Admin can promote/demote `member ↔ moderator`. Checks `canHoldPrivilegedClubRole` + `membershipTierSatisfiesAccessLevel`. |
| Member removal | `ClubManageScreen.tsx` lines 291–319 | Admin can remove non-admin members. `Alert` confirmation. Hook: `useRemoveClubMember`. |
| Current-book finalization | `ClubManageScreen.tsx` lines 359–372 | Admin can finalize closed nominations. Hook: `useFinalizeClubBookNomination`. |
| Manual current-book override | `ClubManageScreen.tsx` lines 374–438 | Admin can search Google Books and bypass nominations by creating a past-date nomination + immediate finalize. |
| Supporting service | `src/features/clubs/services/clubsManagementService.ts` | `updateClub`, `createClub`, `deleteClub` (soft-archive), `getJoinQuestions`, `createJoinQuestion`, `updateJoinQuestion`, `deleteJoinQuestion`. |
| Supporting hooks | `src/features/clubs/hooks/useClubs.ts` | `useUpdateClub`, `useRemoveClubMember`, `useUpdateClubMemberRole`, `useCreateClubJoinQuestion`, `useUpdateClubJoinQuestion`, `useDeleteClubJoinQuestion`, `useFinalizeClubBookNomination`. |

### Partially Implemented

| Item | Code Location | Gap |
|------|---------------|-----|
| Current-book override reliability | `ClubManageScreen.tsx` lines 374–438 | Depends on Google Books search which frequently returns `429`. Manual-only path is a workaround, not a first-class product flow. |
| Settings depth | `ClubManageScreen.tsx` | Cover is still a raw URL `TextInput`. No image upload picker. No genre/tags, no rich description editor. Described as "first basic settings slice" in docs. |
| Granular moderator permissions | `ClubManageScreen.tsx` | Flat `member ↔ moderator` toggle only. No per-moderator permission matrix. Spec notes this needs "explicit product-policy cleanup." |

### Blocked / Pending

| Item | Blocker | Notes |
|------|---------|-------|
| Ownership transfer UI | Not in v1 scope per canonical spec | Spec: "v1 does not support ownership transfer." No RPC exists. |
| Archive / unarchive UI | Explicitly deferred by product decision | `deleteClub()` soft-deletes via `is_archived`. No admin-facing archive toggle or "archived clubs" list. |
| Moderation dashboard (mute / ban / warnings) | No frontend screen; `club_member_actions` table unused by app | `ClubManageScreen` only shows `active/muted/banned` status label, no action buttons. |

---

## 2. Invite Lifecycle

### Implemented

| Item | Code Location | Notes |
|------|---------------|-------|
| Invitation creation by username | `src/features/clubs/screens/ClubInviteScreen.tsx` | Manager can invite by username. Uses `create_club_invitation` RPC. |
| Invitation history listing | `ClubInviteScreen.tsx` | Shows `pending | accepted | expired | revoked` statuses. |
| Invitation acceptance (invitee) | `src/features/clubs/screens/ClubDetailScreen.tsx` | Accept pending invite from detail screen. Uses `accept_club_invitation` RPC. |
| Supporting service | `src/features/clubs/services/clubsInvitationsService.ts` | `getClubInvitations`, `getMyPendingInvitation`, `createClubInvitation`, `acceptClubInvitation`. |
| Supporting hooks | `src/features/clubs/hooks/useClubs.ts` | `useClubInvitations`, `useCreateClubInvitation`, `useAcceptClubInvitation`. |

### Partially Implemented

| Item | Code Location | Gap |
|------|---------------|-----|
| Invitation status surface | `ClubInviteScreen.tsx` | Displays `revoked` status but no user action can produce it. `declined` was removed from local typing to match live DB. |

### Blocked / Pending

| Item | Blocker | Notes |
|------|---------|-------|
| Revoke invitation | `revoke_club_invitation` RPC missing live | UI can display history but admin cannot cancel a pending invite. Confirmed in `CLUBS_LIVE_BACKEND_CONTRACT_2026-03-07.md`. |
| Mark invitation read / invitee inbox | `mark_invitation_read` RPC missing live | No invitee-facing unread badge or inbox. |

---

## 3. Current Book / Nominations

### Implemented

| Item | Code Location | Notes |
|------|---------------|-------|
| Nomination list & vote casting | `src/features/clubs/screens/ClubDetailScreen.tsx` | Members can view nominations, cast/remove vote. Hook: `useCastClubBookVote`, `useRemoveClubBookVote`. |
| Nomination creation | `src/features/clubs/screens/ClubNominateBookScreen.tsx` | Search Google Books, set voting deadline (3/7/14 day presets), nominate. Hook: `useNominateClubBook`. |
| Finalization (admin) | `ClubManageScreen.tsx` lines 359–372 | Finalize after voting closes. Live RPC `finalize_club_book_nomination`. |
| Current-book status overview | `src/features/clubs/services/clubsBooksService.ts` | `getClubCurrentBookStatusOverview` via `get_club_current_book_status_overview` RPC. |
| Reading status mutation | `clubsBooksService.ts` | `setClubCurrentBookReadingStatus` via `set_club_current_book_reading_status` RPC. |
| Reading progress screen | `src/features/clubs/screens/ClubReadingProgressScreen.tsx` | Displays current book, aggregated progress counts, personal status toggle (`want_to_read`/`reading`/`completed`). Route: `app/(tabs)/clubs/[clubId]/reading.tsx`. Entry point from `ClubDetailScreen.tsx` Current Book tab. |
| Supporting service | `src/features/clubs/services/clubsBooksService.ts` | Full coverage: `getClubBookNominations`, `nominateClubBook`, `castClubBookVote`, `removeClubBookVote`, `finalizeClubBookNomination`. |

### Partially Implemented

| Item | Code Location | Gap |
|------|---------------|-----|
| Finalize UI gating | `ClubDetailScreen.tsx` | Shows finalize action while `nomination.status === 'active'` even if voting hasn't closed. Backend only succeeds after `voting_ends_at`. `ClubManageScreen` has correct gating; detail screen does not. |

### Blocked / Pending

| Item | Blocker | Notes |
|------|---------|-------|
| Reading schedule UI | No route or screen | `reading_schedules` table exists in migrations. Milestones/chapters builder and schedule timeline not built. Reading progress screen exists but schedule management is separate. |

---

## 4. Events

### Implemented

| Item | Code Location | Notes |
|------|---------------|-------|
| Event list route | `app/(tabs)/clubs/[clubId]/events.tsx` | Re-export of `ClubEventsScreen`. |
| Event list screen | `src/features/clubs/screens/ClubEventsScreen.tsx` | Shows upcoming schedule, RSVP actions, cancel/delete for eligible managers. |
| Event creation route | `app/(tabs)/clubs/[clubId]/events/create.tsx` | Re-export of `ClubEventEditorScreen` (create mode). |
| Event edit route | `app/(tabs)/clubs/[clubId]/events/[eventId]/edit.tsx` | Re-export of `ClubEventEditorScreen` (edit mode). |
| Event editor screen | `src/features/clubs/screens/ClubEventEditorScreen.tsx` | Create/edit with title, description, event type (`virtual | in_person | hybrid`), start/end time, venue linkage, manual location, meeting link, max attendees. |
| Event service | `src/features/clubs/services/clubsEventsService.ts` | `getClubEvents`, `getClubEventById`, `createClubEvent`, `updateClubEvent`, `cancelClubEvent`, `deleteClubEvent`, `upsertClubEventRsvp`. |
| Event hooks | `src/features/clubs/hooks/useClubs.ts` | `useClubEvents`, `useClubEvent`, `useCreateClubEvent`, `useUpdateClubEvent`, `useCancelClubEvent`, `useDeleteClubEvent`, `useUpsertClubEventRsvp`. |
| Shared entitlement logic | `src/features/clubs/screens/clubEvents.shared.ts` | `canCreateClubEvents`, `canManageClubEvent`, `canRsvpToClubEvents`, `canViewClubEvents`. |
| Live backend enforcement | `CLUBS_LIVE_BACKEND_CONTRACT_2026-03-07.md` | `014` and `015` migrations deployed. `manual_location`, cancellation state, event type constraints, active-member RSVP writes, creator-scoped moderator management all verified live. |

### Partially Implemented

| Item | Code Location | Gap |
|------|---------------|-----|
| Venue selection in event editor | `ClubEventEditorScreen.tsx` | `useClubEventVenues` hook exists but live `club_venues` link count is `0`. Editor supports manual location fallback; no venue browse/registration UI exists. |

### Blocked / Pending

| Item | Blocker | Notes |
|------|---------|-------|
| Venue frontend module | No `src/features/venues/` | Full `venues` schema with PostGIS exists. No venue routes or venue picker. |

---

## 5. Chat / Discussion

> **Architecture Note:** The live database contains **two parallel, complete backend systems** for member communication. The frontend exclusively consumes the **Discussion** system and ignores the **Chat** system entirely. This is a deliberate or accidental architectural fork, not a backend gap.

---

### 5A. Chat Message Backend (Live DB — Frontend Ignores)

**Status: Backend Ready / Frontend Missing**

| Item | Live DB Evidence | Status |
|------|------------------|--------|
| `club_messages` table | **10 columns:** `id` (uuid PK), `club_id` (uuid), `user_id` (uuid), `content` (text, NOT NULL), `chapter_tag` (integer — spec's chapter reference), `has_spoiler` (boolean — spec's spoiler toggle), `is_deleted` (boolean — soft-delete for moderation), `deleted_by` (uuid), `deleted_reason` (text), `created_at` (timestamptz) | ✅ Implemented |
| `message_reactions` table | **4 columns:** `message_id` (uuid FK), `user_id` (uuid), `emoji` (text), `created_at` (timestamptz). **No `id` column** — composite PK on `(message_id, user_id, emoji)` implied by upsert conflict semantics. | ✅ Implemented |
| RLS policies on `club_messages` | **4 policies:** (1) `INSERT` — active members only; (2) `SELECT` — active/muted members, hides deleted unless author; (3) `UPDATE` (own) — author edit; (4) `UPDATE` (moderator) — `is_active_eligible_club_manager()` can soft-delete. | ✅ Implemented |
| RLS policies on `message_reactions` | **3 policies:** (1) `INSERT` — active members via `club_members.status = 'active'`; (2) `DELETE` — own reactions; (3) `SELECT` — active/muted members. | ✅ Implemented |
| Triggers | **None** on `club_messages` or `message_reactions`. | N/A |
| Realtime publication | `replica_identity = 'default'`, `is_in_publication = false` | ⚠️ **Not in Supabase Realtime** — cannot receive live events even if frontend subscribed. |
| Frontend consumption | **Zero references.** Searched `src/features/clubs/services/`, `src/features/clubs/screens/`, `src/features/clubs/hooks/useClubs.ts`, `app/(tabs)/clubs/**` — no matches for `club_messages`, `message_reactions`, or `ClubMessage`. | ❌ **Not consumed** |
| Frontend route | **`app/(tabs)/clubs/[clubId]/chat.tsx` does not exist.** No screen named `ClubChatScreen` or `ClubMessagesScreen`. | ❌ **Not consumed** |

**Live DB SQL confirmation sources:** `information_schema.columns` (tables `club_messages`, `message_reactions`), `pg_policies` (8 policies total), `pg_trigger` (0 triggers), `pg_publication_tables` + `pg_class` (Realtime status).

---

### 5B. Discussion Backend (Live DB — Frontend Fully Consumes)

**Status: Implemented**

| Item | Live DB Evidence | Frontend Consumption | Notes |
|------|----------------|---------------------|-------|
| `club_discussion_topics` | **11 columns:** `id`, `club_id`, `author_user_id`, `title`, `body`, `is_deleted`, `is_edited`, `created_at`, `updated_at`, `deleted_at`, `last_replied_at` | ✅ `clubsDiscussionService.ts` lines 183, 232, 283 | End-to-end via `ClubDiscussionScreen.tsx` |
| `club_discussion_replies` | **7 columns:** `id`, `topic_id`, `parent_reply_id`, `author_user_id`, `body`, `is_deleted`, `created_at`, `deleted_at` | ✅ `clubsDiscussionService.ts` lines 195, 240, 296 | Nested replies up to depth 4 in `ClubDiscussionThreadScreen.tsx` |
| `club_discussion_votes` | **6 columns:** `id`, `topic_id`, `reply_id`, `user_id`, `vote_type`, `created_at` | ✅ `clubsDiscussionService.ts` lines 209, 254, 309, 321 | Upvote/downvote on topics and replies |
| `club_discussion_reactions` | **6 columns:** `id`, `topic_id`, `reply_id`, `user_id`, `emoji`, `created_at` | ✅ `clubsDiscussionService.ts` lines 210, 255, 331, 343 | Emoji reactions (`👍 ❤️ 🔥 👏 😂`) |
| `club_discussion_reports` | **9 columns:** `id`, `topic_id`, `reply_id`, `reporter_user_id`, `reason`, `details`, `status` (default `'open'`), `created_at`, `resolved_at`, `resolved_by` | ✅ `clubsDiscussionService.ts` line 353 | Report topics/replies; `status` field for moderation workflow |
| `club_discussion_topic_reads` | **4 columns:** `topic_id`, `user_id`, `last_read_at`, `unread_reply_count` | ✅ `clubsDiscussionService.ts` lines 212, 257, 365 | Unread badge tracking in topic list |
| **RLS policies** | **22 policies** across 6 tables using `can_participate_club_discussion()`, `can_view_club_discussion()`, `can_moderate_club_discussion()`, `get_club_discussion_target_club_id()` | ✅ Service calls pass through RLS | Active member participation, manager moderation, viewer entitlement all enforced |
| **Triggers** | 4 triggers: `enforce_club_discussion_reply_state`, `handle_club_discussion_reply_insert`, `enforce_club_discussion_report_state`, `set_club_discussion_topic_updated_fields` | N/A | Backend state integrity |
| **Realtime publication** | All 6 tables: `replica_identity = 'default'`, `is_in_publication = false` | N/A | **Neither Chat nor Discussion is Realtime-enabled.** Discussion uses TanStack Query polling; Chat is entirely absent. |
| **Frontend screens** | — | ✅ `ClubDiscussionScreen.tsx`, `ClubDiscussionThreadScreen.tsx` | Full topic list, thread detail, create topic, reply, vote, react, report flows |
| **Frontend hooks** | — | ✅ `useClubs.ts` — 8 discussion hooks | `useClubDiscussionTopics`, `useClubDiscussionTopic`, `useCreateClubDiscussionTopic`, `useCreateClubDiscussionReply`, `useSetClubDiscussionVote`, `useSetClubDiscussionReaction`, `useReportClubDiscussionContent`, `useMarkClubDiscussionTopicRead` |

**Live DB SQL confirmation sources:** `information_schema.columns` (all 6 tables), `pg_policies` (22 policies), `pg_trigger` (4 triggers), `pg_publication_tables` + `pg_class` (Realtime status).

---

## 6. Browse / Discovery

### Implemented

| Item | Code Location | Notes |
|------|---------------|-------|
| Browse route | `app/(tabs)/clubs/index.tsx` | Re-export of `ClubsBrowseScreen`. |
| Browse screen | `src/features/clubs/screens/` (logic in route file) | `ClubsBrowseScreen` with `All clubs / My clubs` scope toggle, search, filter chips. |
| Search | `app/(tabs)/clubs/index.tsx` lines 54, 12 | Searches `name`, `current_book_title`, `admin_display_name`, `author_display_name` via `club_public_details`. |
| Filters | `app/(tabs)/clubs/index.tsx` lines 28–48 | `club_type`, `meeting_type`, `access_level`. |
| Club card component | `src/features/clubs/components/ClubCard.tsx` | Displays cover, name, type badge, member count, current book snippet. |
| Public detail route | `app/(tabs)/clubs/[clubId]/index.tsx` | Re-export of `ClubDetailScreen`. |
| Public detail screen | `src/features/clubs/screens/ClubDetailScreen.tsx` | Cover, metadata, join/apply/invite-only banner, member-list gating, nominations, events entry, discussion entry, management entry points. |
| Supporting read service | `src/features/clubs/services/clubsReadService.ts` | `getPublicClubs`, `getMyPublicClubs`, `getPublicClubById` over `club_public_details`. |
| Supporting hooks | `src/features/clubs/hooks/useClubs.ts` | `useBrowseClubs`, `useMyBrowseClubs`, `useClubPublicDetail`. |

### Partially Implemented

| Item | Code Location | Gap |
|------|---------------|-----|
| Create CTA on browse | Missing | No "Create club" button on browse screen because `create.tsx` route does not exist. |

### Blocked / Pending

| Item | Blocker | Notes |
|------|---------|-------|
| Author club discovery section | No dedicated UX | Schema supports `author_club`. No separate author-club browse filter or verified-author badge flow. |

---

## 7. Create Club

### Blocked / Pending — **MVP Blocker**

| Item | Code Location / Absence | Notes |
|------|------------------------|-------|
| Create club route | **`app/(tabs)/clubs/create.tsx` does not exist** | Spec §4.4 defines required route. `_layout.tsx` does not register it. |
| Create club screen | **No `ClubCreateScreen.tsx`** | No component in `src/features/clubs/screens/`. |
| Create club hook | **`useCreateClub` not in `useClubs.ts`** | `clubsManagementService.createClub()` exists and is fully backend-ready. No TanStack Query wrapper. |
| Membership-limit check | `src/features/clubs/services/clubsManagementService.ts` lines 7–12 | `checkMembershipLimits` calls `check-membership-limits` Edge Function. Live and deployed. **Service exists but is unreachable from UI.** |

**Discrepancy:** The canonical spec lists Create Club as Phase 1 buildable-after-prerequisites. All prerequisites (username, invitation model, public detail view) are live. The backend service is implemented. The frontend is entirely missing.

---

## 8. Membership & Applications

### Implemented

| Item | Code Location | Notes |
|------|---------------|-------|
| Public club join | `src/features/clubs/services/clubsMembershipService.ts` lines 26–50 | Immediate insert into `club_members` with tier/access-level validation. |
| Approval/author club apply | `clubsMembershipService.ts` lines 52–63 | Inserts into `club_join_applications` with answers. Handles `23505` duplicate gracefully. |
| Application review | `src/features/clubs/screens/ClubApplicationsScreen.tsx` | Moderator/admin can approve/decline pending applications. View applicant answers. |
| Application service | `src/features/clubs/services/clubsApplicationsService.ts` | `getMyJoinApplication`, `getClubApplications`, `reviewJoinApplication`. |
| Member list gating | `src/features/clubs/components/ClubMemberList.tsx` | Visible only to active/muted members. |
| Leave club | `clubsMembershipService.ts` lines 68–71 | `leaveClub()` exists. |
| Leave-club UX | `ClubDetailScreen.tsx` | Prominent "Leave club" button with `Alert` confirmation. Navigates to browse on success. Hook: `useLeaveClub`. |
| Supporting hooks | `src/features/clubs/hooks/useClubs.ts` | `useJoinClub`, `useMyClubApplication`, `useClubApplications`, `useReviewClubApplication`, `useClubMembers`, `useClubMembership`, `useLeaveClub`. |

### Partially Implemented

| Item | Code Location | Gap |
|------|---------------|-----|
| *(none)* | — | — |

---

## 9. Entitlement / Membership Tiers

### Implemented

| Item | Code Location | Notes |
|------|---------------|-------|
| Tier/role logic | `src/features/clubs/services/clubsEntitlement.ts` | `membershipTierSatisfiesAccessLevel`, `canHoldPrivilegedClubRole`, `isActiveEligibleClubManager`, `getModeratorEligibilityMessage`, `getClubsEntitlementErrorMessage`. |
| Frontend gating | `ClubManageScreen.tsx`, `ClubDetailScreen.tsx`, `ClubInviteScreen.tsx`, `ClubApplicationsScreen.tsx`, `ClubEventsScreen.tsx` | All active surfaces normalize entitlement-sensitive failures via `getClubsEntitlementErrorMessage`. |
| Live backend enforcement | `CLUBS_LIVE_BACKEND_CONTRACT_2026-03-07.md` §Session update 2026-03-10 | Migrations `010`–`015` deployed. `membership_tier_rank`, `user_meets_access_level`, `can_user_hold_club_role`, `is_active_eligible_club_manager` all live. RLS policies enforce Pro/Pro+ for moderator/admin. |
| Membership-limit Edge Function | `supabase/functions/check-membership-limits/index.ts` | Enforces `free: 0`, `pro: 5`, `pro_plus: 15` club creation limits. |

### Partially Implemented

| Item | Code Location | Gap |
|------|---------------|-----|
| Downgrade grace-period automation | Not in service layer | `MembershipLimitAction` includes `'check_downgrade'` but no automation. No `handle-downgrade-grace-period` Edge Function. No cron job. Spec promises grace period but no enforcement exists. |

### Blocked / Pending

| Item | Blocker | Notes |
|------|---------|-------|
| Automated remediation of invalid roles | No backend job | If a user downgrades from Pro to Free, no automatic demotion from moderator/admin. Manual or audit-level fix only. |

---

## 10. Tests

### Implemented

| Item | Code Location |
|------|---------------|
| Browse route test | `app/(tabs)/clubs/__tests__/index.test.tsx` |
| Service tests | `src/features/clubs/services/__tests__/clubsService.test.ts` |
| Hook tests | `src/features/clubs/hooks/__tests__/useClubs.test.ts` |
| Screen tests | `src/features/clubs/screens/__tests__/ClubDetailScreen.test.tsx`, `ClubManageScreen.test.tsx`, `ClubApplicationsScreen.test.tsx`, `ClubInviteScreen.test.tsx`, `ClubEventsScreen.test.tsx`, `ClubEventEditorScreen.test.tsx`, `ClubDiscussionScreen.test.tsx`, `ClubDiscussionThreadScreen.test.tsx`, `ClubNominateBookScreen.test.tsx` |

---

## Summary Table

| Feature Area | Implemented | Partially Implemented | Blocked / Pending |
|--------------|-------------|---------------------|-----------------|
| Manage Club | Settings slice, join-question CRUD, member-role toggle, member removal, current-book finalization, manual override | Settings depth (URL cover), override reliability, granular moderator perms | Ownership transfer UI, archive UI, moderation dashboard |
| Invite Lifecycle | Create by username, history list, invitee accept | Status surface shows `revoked` with no production path | Revoke RPC, mark-read RPC |
| Current Book / Nominations | Nomination list, vote cast/remove, nomination creation, finalize, reading status RPC, reading progress screen | Finalize UI gating on detail screen | Reading schedule UI (milestones/timeline) |
| Events | List, create, edit, cancel, delete, RSVP | Venue selection (no venues registered live) | Venue frontend module |
| Chat (backend) | `club_messages`, `message_reactions` with RLS + moderation columns | *(Backend ready; frontend completely missing)* | `chat.tsx` route, `ClubChatScreen`, `useRealtimeMessages`, Realtime publication (`is_in_publication = false`) |
| Discussion | Topics, replies, votes, reactions, reports, read-state — 6 tables, 22 RLS policies, 4 triggers | *(Fully end-to-end; frontend consumes exclusively)* | Realtime publication (`is_in_publication = false`) — currently polled via TanStack Query |
| Browse / Discovery | Browse screen, search, filters, scope toggle, detail screen, member-list gating | Create CTA missing | Author club discovery section |
| Create Club | *(service layer only)* | — | **Route, screen, hook entirely missing** |
| Membership & Applications | Join, apply, application review, member list, leave service, leave-club UX | — | — |
| Entitlement | Tier logic, frontend gating, live RLS/RPC enforcement | Grace-period automation | Automated invalid-role remediation |

---

## Canonical Spec ↔ Codebase Discrepancies Flagged

1. **Chat vs. Discussion — Architectural Misalignment**
   - **Spec intent:** `app/(tabs)/clubs/[clubId]/chat.tsx` with real-time `club_messages`, `chapter_tag`, `has_spoiler`, message reactions, moderator soft-delete, typing indicators.
   - **Live DB reality:** `club_messages` (10 columns) and `message_reactions` (4 columns) exist with full RLS (7 policies total: 4 on messages, 3 on reactions) and moderator-delete policy. Schema supports spoiler toggle and chapter references natively.
   - **Frontend reality:** `app/(tabs)/clubs/[clubId]/discussion.tsx` renders forum-style topics/replies via `ClubDiscussionScreen.tsx` and `ClubDiscussionThreadScreen.tsx`. Service `clubsDiscussionService.ts` exclusively calls `club_discussion_topics`, `club_discussion_replies`, `club_discussion_votes`, `club_discussion_reactions`, `club_discussion_reports`, `club_discussion_topic_reads`.
   - **Searched scope:** `src/features/clubs/services/` (all files), `src/features/clubs/screens/` (all files), `src/features/clubs/hooks/useClubs.ts`, `app/(tabs)/clubs/` — zero matches for `club_messages`, `message_reactions`, or `ClubMessage`.
   - **Realtime gap:** Both chat (`club_messages`, `message_reactions`) and discussion (all 6 tables) have `replica_identity = 'default'` and `is_in_publication = false`. Neither system receives live Supabase Realtime events.
   - **Decision required:** Either (a) migrate Discussion to Chat and deprecate 6 discussion tables, (b) keep Discussion as primary and delete orphaned chat schema, or (c) run both side-by-side (Discussion for long-form threads, Chat for real-time messaging) with separate routes.
   - **Files:** `CLUBS_SPEC_2026-03-06_234839.md` §4.5 vs live DB `club_messages`/`message_reactions` vs `src/features/clubs/services/clubsDiscussionService.ts`.

2. **Create Club route missing**  
   - **Spec:** §4.4 defines `app/(tabs)/clubs/create.tsx` with full form.  
   - **Reality:** No route file. No screen. No hook. Backend `createClub()` is orphaned.  
   - **Files:** `CLUBS_SPEC_2026-03-06_234839.md` §4.4 vs `app/(tabs)/clubs/` directory listing.

3. **`lead` role legacy in old migrations**  
   - **Spec:** §1.2 mandates `member | moderator | admin`. Rejects `lead`.  
   - **Reality:** Early migration `20251228114444_008_rls_policies_venues_clubs.sql` still references `lead_id` and `role = 'lead'`. Later migration `20260310153000_013_clubs_entitlement_enforcement.sql` cleans this live.  
   - **Files:** `CLUBS_SPEC_2026-03-06_234839.md` §1.2 vs `supabase/migrations/20251228114444_008_rls_policies_venues_clubs.sql`.

4. **Finalize button gating mismatch**  
   - **Spec:** Admin should finalize after voting closes.  
   - **Reality:** `ClubDetailScreen` exposes finalize while `nomination.status === 'active'` without checking `voting_ends_at`. `ClubManageScreen` has correct gating via `hasNominationVotingClosed()`.  
   - **Files:** `CLUBS_SPEC_2026-03-06_234839.md` vs `src/features/clubs/screens/ClubDetailScreen.tsx` (finalize guard) vs `src/features/clubs/screens/ClubManageScreen.tsx` lines 461–476.

5. **Reading schedules orphaned (progress UI now implemented)**
   - **Spec:** Mentions "reading schedules" and "member reading progress" as member-visible features.
   - **Reality:** Tables exist (`reading_schedules`, `member_reading_progress`). RPC `set_club_current_book_reading_status` exists. **Reading progress screen implemented** (`ClubReadingProgressScreen.tsx`, route `app/(tabs)/clubs/[clubId]/reading.tsx`). Reading *schedule* builder (milestones, chapters, timeline) still not built.
   - **Files:** `CLUBS_SPEC_2026-03-06_234839.md` §2.2 vs `src/features/clubs/services/clubsBooksService.ts` vs `src/features/clubs/screens/ClubReadingProgressScreen.tsx`.
