# Clubs Feature — Full Implementation Inventory

**Last updated:** 2026-06-06
**Sources cross-referenced:**
- `docs/features/CLUBS_SPEC_2026-03-06_234839.md` (canonical product intent)
- `docs/features/CLUBS_IMPLEMENTATION_STATUS_2026-03-07.md` (repo reality)
- `docs/features/CLUBS_MANAGE_CLUB_SPEC_2026-03-07.md` (Manage Club scope)
- `docs/features/CLUBS_ENTITLEMENT_IMPLEMENTATION_ANALYSIS_2026-03-10.md` (tier/role rules)
- Direct codebase inspection of `app/(tabs)/clubs/**`, `src/features/clubs/**`
- Direct codebase reconciliation after Create Club, invite revoke/read-state/notification handoff, venue picker, reading-progress work, admin lifecycle guidance, reading-schedule validation, moderation actions, platform complaint queue action bridge, author-club verified creation/discovery treatment, admin transfer acceptance, and downgrade grace automation
- 2026-06-06 reconciliation after venue frontend Phase 1 work started and enterprise notification routing/reminder rollout was applied live
- Web smoke result from 2026-05-30 on `http://localhost:8082/clubs?smoke=1780053066028`
- **Live Supabase DB audit:** `information_schema.columns`, `pg_policies`, `pg_trigger`, `pg_publication_tables`, `pg_class` (replica identity, Realtime status)

---

## 2026-06-06 Update

- Venue work has started: `src/features/venues/` now provides approved venue browse/detail services, hooks, reusable cards, browse/detail screens, and Clubs routes. Manage Club now includes linked venue add/remove/set-primary support. Venue owner registration/CRUD, admin verification UI, map/geospatial radius UX, and exchange pickup venue selection remain pending.
- Enterprise notification foundation is live: Profile inbox/settings, push token registration, `send-notification`, `wishlist-notify`, notification tables/preferences, and event routing are implemented.
- New live notification routing covers wishlist listing matches, club invitation create/status updates, unread invitation reminders, club event create/update/cancel/reminders, book nomination create/voting-ending reminders, reading schedule create/update/milestone-due reminders, and downgrade grace warning/remediation/deadline-near notifications.
- Live Supabase verification through MCP on 2026-06-06 confirmed migrations `complete_clubs_notifications_and_reminders`, `wishlist_notify_rpc`, active Edge Functions `send-notification` and `wishlist-notify`, installed `pg_cron` 1.6.4, and installed `pg_net` 0.19.5.
- Push dispatch cron is scheduled through `notification-push-dispatch`, but authenticated dispatch requires server-side `app.settings.send_notification_url`, `app.settings.send_notification_bearer`, and optional `app.settings.send_notification_cron_secret` configuration.

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
| Archive / restore lifecycle UI | `src/features/clubs/screens/manage/ClubManageLifecycleSection.tsx` | Admin can archive active clubs and restore archived clubs from the Manage lifecycle tab. Archived clubs are recoverable from Browse > Archived. |
| Admin transfer / succession UI | `src/features/clubs/screens/manage/ClubManageLifecycleSection.tsx`, `src/features/clubs/screens/ClubDetailScreen.tsx` | Current admin sends transfer requests to eligible active/muted Pro or Pro+ members. Proposed successors accept from the club detail page before the admin role changes. Author-club requests are backend-limited to the verified author profile owner. Direct Manage route tabs such as `?tab=lifecycle` now initialize correctly on web. Manage > Lifecycle also surfaces lifecycle policy state: downgrade readiness, successor coverage, archive retention state, and explicit admin warnings. |
| Moderation actions | `src/features/clubs/screens/manage/ClubManageMembersSection.tsx`, `src/features/clubs/services/clubsMembershipService.ts` | Manage > Members can issue warnings, timed mutes, and bans with required reasons. Recent `club_member_actions` history is shown per member. |
| Platform complaint queue | `src/features/clubs/screens/manage/ClubManagePlatformComplaintsSection.tsx`, `src/features/clubs/services/clubsComplaintsService.ts` | Manage > Reports now lists open `club_complaints` (`pending`, `reviewing`) with reporter/reported profile summaries. Resolutions can be `no_action` or bridged into warning/timed-mute/ban member actions before closing the complaint. |
| Supporting service | `src/features/clubs/services/clubsManagementService.ts` | `updateClub`, `createClub`, `deleteClub` (soft-archive), `archiveClub`, `unarchiveClub`, `transferClubAdmin`, `requestClubAdminTransfer`, `acceptClubAdminTransferRequest`, `getClubAdminTransferRequests`, `getJoinQuestions`, `createJoinQuestion`, `updateJoinQuestion`, `deleteJoinQuestion`. |
| Supporting hooks | `src/features/clubs/hooks/useClubs.ts` | `useUpdateClub`, `useArchiveClub`, `useUnarchiveClub`, `useTransferClubAdmin`, `useRequestClubAdminTransfer`, `useAcceptClubAdminTransferRequest`, `useClubAdminTransferRequests`, `useCreateClubMemberAction`, `useClubMemberActions`, `useRemoveClubMember`, `useUpdateClubMemberRole`, `useCreateClubJoinQuestion`, `useUpdateClubJoinQuestion`, `useDeleteClubJoinQuestion`, `useFinalizeClubBookNomination`. |
| Admin transfer RPC | `supabase/migrations/20260527104248_transfer_club_admin_rpc.sql` | Security-definer RPC validates current admin, successor membership, access level, Pro/Pro+ tier, blocks `author_club`, updates `book_clubs.admin_id`, demotes previous admin, and promotes successor to active admin. |
| Admin transfer acceptance RPC | `supabase/migrations/20260529154500_club_moderation_author_lifecycle_rpc.sql` | Adds `club_admin_transfer_requests`, request/accept RPCs, and author-club owner consistency checks for transfer acceptance. |

### Partially Implemented

| Item | Code Location | Gap |
|------|---------------|-----|
| Current-book override reliability | `ClubManageScreen.tsx`, `ClubNominateBookScreen.tsx` | Current-book override and nominations now use cached provider search with Open Library fallback; nomination also has a manual title/author fallback. Override manual entry remains less polished than nomination. |
| Settings depth | `ClubManageScreen.tsx` | Manage settings supports cover image picker/upload plus URL input. No genre/tags or rich description editor yet. |
| Granular moderator permissions | `ClubManageScreen.tsx` | Flat `member ↔ moderator` toggle only. No per-moderator permission matrix. Spec notes this needs "explicit product-policy cleanup." |
| Moderation product depth | `ClubManageScreen.tsx`, `ClubManagePlatformComplaintsSection.tsx` | Discussion reports, member actions, platform complaints, and complaint-to-member-action bridging are exposed. Manage > Reports now states that durable resolution notes need an app-wide audit/RPC contract before they are saved. |
| Admin lifecycle product policy | `ClubManageLifecycleSection.tsx` | Transfer acceptance is implemented. Lifecycle now surfaces downgrade readiness, successor coverage, archive retention state, admin-facing warnings, downgrade-succession guidance, and archive-retention guidance. Automated downgrade-triggered successor selection and retention/deletion windows remain backend/product-policy work. |
---

## 2. Invite Lifecycle

### Implemented

| Item | Code Location | Notes |
|------|---------------|-------|
| Invitation creation by username | `src/features/clubs/screens/ClubInviteScreen.tsx` | Manager can invite by username. Uses `create_club_invitation` RPC. |
| Invitation history listing | `ClubInviteScreen.tsx` | Shows `pending | accepted | expired | revoked` statuses. |
| Invitation acceptance (invitee) | `src/features/clubs/screens/ClubDetailScreen.tsx` | Accept pending invite from detail screen. Uses `accept_club_invitation` RPC. |
| Invitee inbox / unread badge | `src/features/clubs/screens/ClubInvitationsInboxScreen.tsx`, `app/(tabs)/clubs/invitations.tsx`, `app/(tabs)/clubs/index.tsx` | Signed-in invitees can open a dedicated invitations inbox from Browse. Browse shows unread pending invitation count from `club_invitations.read_at`; inbox groups pending unread/read invitations separately from accepted/expired/revoked history, can mark unread invitations read before opening club detail, can accept pending invitations directly, and hands reminder preferences off to Profile notification settings. |
| Invitation revoke | `src/features/clubs/screens/manage/ClubManageInvitationsSection.tsx` | Managers can revoke pending invitations. Uses live `revoke_club_invitation` RPC. |
| Invitation read-state service | `src/features/clubs/services/clubsInvitationsService.ts` | `markInvitationRead` uses live `mark_invitation_read` RPC and `club_invitations.read_at`. |
| Supporting service | `src/features/clubs/services/clubsInvitationsService.ts` | `getClubInvitations`, `getMyPendingInvitation`, `getMyPendingInvitations`, `createClubInvitation`, `acceptClubInvitation`, `revokeClubInvitation`, `markInvitationRead`. |
| Supporting hooks | `src/features/clubs/hooks/useClubs.ts` | `useClubInvitations`, `useMyClubInvitationInbox`, `useCreateClubInvitation`, `useAcceptClubInvitation`, `useRevokeClubInvitation`, `useMarkInvitationRead`. |

### Partially Implemented

| Item | Code Location | Gap |
|------|---------------|-----|
| Invitation inbox polish | `ClubInvitationsInboxScreen.tsx` | Inbox groups pending unread/read invites separately from accepted/expired/revoked history, supports incremental "Load more" paging, and links invitation reminder preferences to Profile notification settings. Actual push/email reminders still depend on the broader notification pipeline. |

### Blocked / Pending

| Item | Blocker | Notes |
|------|---------|-------|
| Invitation reminder notifications | Notification pipeline not built | Inbox/read-state exists, but push/email reminders for unread invitations depend on the broader notification token/preferences/history work. |

---

## 3. Current Book / Nominations

### Implemented

| Item | Code Location | Notes |
|------|---------------|-------|
| Nomination list & vote casting | `src/features/clubs/screens/ClubDetailScreen.tsx` | Members can view nominations, cast/remove vote. Hook: `useCastClubBookVote`, `useRemoveClubBookVote`. |
| Nomination creation | `src/features/clubs/screens/ClubNominateBookScreen.tsx` | Search Google Books/Open Library fallback, set voting deadline (3/7/14 day presets), nominate, or use manual title/author fallback when provider search is unavailable. Hook: `useNominateClubBook`. |
| Finalization (admin) | `ClubManageScreen.tsx` lines 359–372 | Finalize after voting closes. Live RPC `finalize_club_book_nomination`. |
| Current-book status overview | `src/features/clubs/services/clubsBooksService.ts` | `getClubCurrentBookStatusOverview` via `get_club_current_book_status_overview` RPC. |
| Reading status mutation | `clubsBooksService.ts` | `setClubCurrentBookReadingStatus` via `set_club_current_book_reading_status` RPC. |
| Reading progress screen | `src/features/clubs/screens/ClubReadingProgressScreen.tsx` | Displays current book, aggregated progress counts, personal status toggle (`want_to_read`/`reading`/`completed`). Route: `app/(tabs)/clubs/[clubId]/reading.tsx`. Entry point from `ClubDetailScreen.tsx` Current Book tab. |
| Reading schedule builder | `src/features/clubs/screens/manage/ClubManageReadingScheduleSection.tsx` | Admin can create/update milestones for the current book using `reading_schedules.milestones`. Captures label, target, due date, starter templates, validates YYYY-MM-DD dates, blocks backward due dates, and blocks backward-moving explicit chapter targets. |
| Reading schedule timeline | `src/features/clubs/screens/ClubReadingProgressScreen.tsx` | Members see schedule milestones on the reading progress screen and can mark milestone progress through `member_reading_progress.chapters_completed`. |
| Supporting service | `src/features/clubs/services/clubsBooksService.ts` | Full coverage: `getClubBookNominations`, `nominateClubBook`, `castClubBookVote`, `removeClubBookVote`, `finalizeClubBookNomination`, `getClubReadingSchedule`, `upsertClubReadingSchedule`, `updateClubReadingProgress`. |
| Supporting hooks | `src/features/clubs/hooks/useClubs.ts` | `useClubReadingSchedule`, `useUpsertClubReadingSchedule`, and `useUpdateClubReadingProgress` wrap the schedule/progress services and invalidate schedule caches. |

### Partially Implemented

| Item | Code Location | Gap |
|------|---------------|-----|
| Google Books-backed nomination search | `ClubNominateBookScreen.tsx` | Uses cached Google Books search with Open Library fallback and a manual nomination escape hatch, so provider `429` does not block nominations. |
| Reading schedule product depth | `ClubManageReadingScheduleSection.tsx` | Builder supports one latest schedule per club/book, validates YYYY-MM-DD due dates, blocks backward-moving milestone due dates, blocks explicit chapter targets that move backward, and offers starter templates. Multi-plan support and calendar/reminder delivery remain deferred to the app-wide notification/calendar pipeline. |

### Blocked / Pending

| Item | Blocker | Notes |
|------|---------|-------|
| *(none for basic reading schedule UI)* | — | Basic milestone builder and member timeline are implemented. |

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
| Venue selection in event editor | `ClubEventEditorScreen.tsx`, `ClubVenuePickerScreen.tsx` | Event editor can navigate to a linked-club venue picker and still supports manual location fallback. Full venue browse/registration/CRUD is not implemented. |

### Blocked / Pending

| Item | Blocker | Notes |
|------|---------|-------|
| Venue frontend module | No `src/features/venues/` | Full `venues` schema with PostGIS exists. Clubs now have a linked venue picker, but there is still no standalone venue module, venue registration flow, or geo-search UX. |

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
| Browse screen | `src/features/clubs/screens/` (logic in route file) | `ClubsBrowseScreen` with `All clubs / My clubs / Archived` scope toggle, search, filter chips. |
| Search | `app/(tabs)/clubs/index.tsx` lines 54, 12 | Searches `name`, `current_book_title`, `admin_display_name`, `author_display_name` via `club_public_details`. |
| Filters | `app/(tabs)/clubs/index.tsx` lines 28–48 | `club_type`, `meeting_type`, `access_level`. |
| Club card component | `src/features/clubs/components/ClubCard.tsx` | Displays cover, name, type badge, member count, current book snippet. |
| Public detail route | `app/(tabs)/clubs/[clubId]/index.tsx` | Re-export of `ClubDetailScreen`. |
| Public detail screen | `src/features/clubs/screens/ClubDetailScreen.tsx` | Cover, metadata, join/apply/invite-only banner, member-list gating, nominations, events entry, discussion entry, management entry points. |
| Supporting read service | `src/features/clubs/services/clubsReadService.ts` | `getPublicClubs`, `getMyPublicClubs`, `getPublicClubById` over `club_public_details`. |
| Archived managed clubs recovery | `app/(tabs)/clubs/index.tsx`, `src/features/clubs/services/clubsReadService.ts` | Browse > Archived lists archived clubs administered by the current user and routes them to Manage > Lifecycle for restore. Uses raw `book_clubs` because `club_public_details` intentionally filters archived clubs. |
| Supporting hooks | `src/features/clubs/hooks/useClubs.ts` | `useBrowseClubs`, `useMyBrowseClubs`, `useMyArchivedManagedClubs`, `useClubPublicDetail`, `useClubManageDetail`. |

### Partially Implemented

| Item | Code Location | Gap |
|------|---------------|-----|
| Author club product depth | `app/(tabs)/clubs/index.tsx`, `app/(tabs)/clubs/authors.tsx`, `src/features/clubs/screens/ClubAuthorsScreen.tsx`, `src/features/clubs/components/ClubCard.tsx` | Browse supports the Author clubs filter, shows a dedicated Author clubs spotlight when author clubs are present, links to an Author clubs landing route filtered to `author_club`, and cards have verified-author treatment. `e2e/smoke.spec.ts` includes a mocked dev author club so the Author Clubs card badge is covered without mutating live Supabase Auth users. Schema-backed AMA/signed-edition workflows remain future product depth. |

### Blocked / Pending

| Item | Blocker | Notes |
|------|---------|-------|
| *(none for automated Author Clubs badge smoke coverage)* | — | 2026-05-30 follow-up added Playwright smoke fixture `dev-author-club`, which verifies the Author clubs filter renders an author-club card and exact `Verified author` badge. |

---

## 7. Create Club

### Implemented

| Item | Code Location | Notes |
|------|---------------|-------|
| Create club route | `app/(tabs)/clubs/create.tsx` | Registered in Clubs stack. |
| Create club screen | `src/features/clubs/screens/ClubCreateScreen.tsx` | Form covers name, description, cover URL, club type, access level, meeting type, and member cap. Verified authors also see Author club as a club type, with their profile id passed to `create_club`. |
| Create club hook | `src/features/clubs/hooks/useClubs.ts` | `useCreateClub` wraps `clubsManagementService.createClub()` and refreshes club browse/detail caches. |
| Membership-limit check | `src/features/clubs/services/clubsManagementService.ts` | `checkMembershipLimits` calls the `check-membership-limits` Edge Function before creating the club. |
| Product entry point | Profile section | Current product direction keeps Create Club visible only to Pro / Pro+ users from Profile. |

### Partially Implemented

| Item | Code Location | Gap |
|------|---------------|-----|
| Create Club polish | `ClubCreateScreen.tsx` | Supports cover image picker/upload plus raw URL input and verified-author author-club creation. Advanced tags/genre controls remain pending. Smoke confirmed Browse does not expose Create Club and Profile exposes Create Club for a Pro test user. |

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
| Downgrade grace-period automation | `supabase/functions/handle-club-downgrade-grace-period/index.ts`, `supabase/migrations/20260529170000_club_downgrade_grace_period.sql` | Adds a grace-event table, conservative remediation RPC, Edge Function wrapper, and daily pg_cron scheduling when `pg_cron` is available. It records warnings and archives excess active clubs after the grace window without mutating Supabase Auth users. Notification tie-ins remain future work. |

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

## 11. Latest Smoke Verification

**Smoke date:** 2026-06-04
**URL:** `http://localhost:8081`
**Result:** Focused TypeScript/Jest verification passed in the prior session. Browser smoke was completed after starting Expo web with the approved outside-sandbox workflow because sandboxed `npx.cmd expo start --web --non-interactive` still fails with `EPERM` on `C:\Users\user`.

| Area | Result |
|------|--------|
| Browse | Live smoke passed. Seeded clubs loaded, Browse did not expose Create Club, and the Author clubs filter was present. No live seeded author-club spotlight/card was available in this dataset, so author spotlight remains covered by mocked Playwright fixture rather than live seeded data. |
| Invitations | Live smoke passed for the notification handoff and history path. The Invitation reminders card was visible and linked to notification settings; one accepted past invitation rendered. No pending invitation existed for the signed-in account, so pending unread/read grouping remains unit-covered but not live-verified in this smoke. |
| Manage | Live smoke passed on `ZZ_TEST Manage Basics Club` at `/clubs/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1/manage`. The handoff URL `/clubs/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3/manage` points to `ZZ_TEST Invite Only Club` and correctly denied management for the current session. |
| Manage > Reports | Live smoke passed for the Reports surface. It showed "No open discussion reports" and "No open platform complaints"; complaint action buttons remain data-dependent and were not visible without seeded open complaints. |
| Manage > Schedule | Live smoke passed. Entering backward due dates produced "Due dates must stay in chronological order." |
| Manage > Lifecycle | Live smoke passed. Downgrade successor guidance and archive retention guidance were visible, including eligible Pro successor rows. |
| Follow-up route smoke | Live smoke passed after the latest pass: `/clubs/authors`, Manage `?tab=reports`, `?tab=lifecycle`, and `?tab=schedule` rendered the expected updated surfaces. The route-tab smoke exposed and fixed a web initialization bug where non-`events` manage tabs could default to Current Book on fresh navigation. |
| Live Supabase cleanup/cron verification | Read-only verification on 2026-06-05 against project `Bookconnect_reactexpo` (`ahntbtktjjmvfosgkmgn`) found that local migrations `20260529143000_clubs_moderation_cleanup_and_policy_notes.sql`, `20260529154500_club_moderation_author_lifecycle_rpc.sql`, and `20260529170000_club_downgrade_grace_period.sql` are not in live migration history. Catalog checks returned no `cleanup_expired_club_member_actions`, no `process_club_downgrade_grace_period`, no `club_downgrade_grace_events`, no installed `pg_cron`, and no `cron.job` relation. No Auth users were mutated and no maintenance functions were executed. |
| Create Club entry point | Product constraint remains unchanged and live-smoked: Create Club appears on Profile for the Pro test user and does not appear in Browse. |
| Console | Expected development warnings were observed (`shadow*`/`pointerEvents` deprecations and missing Sentry DSN). Slow browser-plugin reloads also produced a transient `6000ms timeout exceeded` dev LogBox/console entry, but the target routes rendered successfully afterward. |
| Verification commands | `npx.cmd tsc --noEmit` passed. Focused Jest passed: Manage suite 40/40 tests, Browse/author route suites 7/7 tests. Prior invite-inclusive focused suite remains 3 suites / 48 tests. |

**Previous live smoke baseline:** 2026-05-30 partial pass on `http://localhost:8082/clubs?smoke=1780053066028`: auth was not blocking; Browse, Club detail, and Manage loaded; Members showed Warn / Timed mute / Ban / Remove controls; Lifecycle showed archive/admin succession UI; Browse did not expose Create Club; Profile for Pro test user exposed Create Club; no runtime JS errors were observed.

**Immediate non-chat tasks after this smoke:**

1. Add schema-backed author experiences such as AMA and signed-edition workflows.
2. Expand reading schedule product depth: multi-plan behavior.
3. Define exact admin lifecycle automation policy beyond conservative remediation. Current policy warns, allows manual reduction, then archives excess newest clubs after grace; automatic successor selection is not enabled.
4. Configure and monitor authenticated push dispatch settings for `notification-push-dispatch`.
5. Decide whether moderation needs durable resolution notes or a stricter RPC-backed punitive workflow policy.
6. Continue venue frontend Phase 1 follow-through; venue owner/admin/geospatial and exchange pickup venue flows remain pending.
7. Keep Clubs chat/realtime as a known high-priority gap, but defer implementation per the current user direction.

---

## Summary Table

| Feature Area | Implemented | Partially Implemented | Blocked / Pending |
|--------------|-------------|---------------------|-----------------|
| Manage Club | Settings slice, join-question CRUD, member-role toggle, member removal, current-book finalization, manual override, archive/restore UI, lifecycle policy state, admin transfer request/accept flow, discussion report queue, platform complaint queue, warning/timed-mute/ban member actions | Granular moderator perms, moderation product depth, automated downgrade-driven succession, archive retention/deletion rules | â€” |
| Invite Lifecycle | Create by username, history list, invitee accept, invitee inbox/unread badge, manager revoke, read-state RPC/service, inbox paging, pending unread/read grouping, accepted/expired/revoked history grouping, notification routing, unread invite reminders | Notification handoff card remains a route into Profile settings | — |
| Current Book / Nominations | Nomination list, vote cast/remove, nomination creation with provider/manual fallback, finalize, reading status RPC, reading progress screen, reading schedule builder/templates, explicit chapter-order validation, reading schedule timeline/milestone progress, nomination/schedule/reminder notification routing | Multi-plan schedules | — |
| Events | List, create, edit, cancel, delete, RSVP, linked venue picker, event notification routing/reminders | Full venue registration/CRUD absent | — |
| Chat (backend) | `club_messages`, `message_reactions` with RLS + moderation columns | *(Backend ready; frontend completely missing)* | `chat.tsx` route, `ClubChatScreen`, `useRealtimeMessages`, Realtime publication (`is_in_publication = false`) |
| Discussion | Topics, replies, votes, reactions, reports, read-state — 6 tables, 22 RLS policies, 4 triggers | *(Fully end-to-end; frontend consumes exclusively)* | Realtime publication (`is_in_publication = false`) — currently polled via TanStack Query |
| Browse / Discovery | Browse screen, search, filters including Author clubs, Author clubs landing route, All/My/Archived scope toggle, archived-club recovery, detail screen, member-list gating, verified-author card treatment, automated author-club badge smoke fixture, Clubs venue browse/detail entry point | Schema-backed author experiences and advanced venue discovery | — |
| Create Club | Route, screen, hook, service, membership-limit check, cover image picker/upload | Author-club creation flow, advanced tags/genre controls | — |
| Membership & Applications | Join, apply, application review, member list, leave service, leave-club UX | — | — |
| Entitlement | Tier logic, frontend gating, live RLS/RPC enforcement, downgrade grace event/RPC/Edge Function/cron scaffolding, downgrade notification/reminder routing | Richer user-choice keep-list and successor-selection policy | Automated invalid-role remediation beyond conservative club archiving |

> 2026-05-30 correction: the Create Club summary row above should be read with verified-author author-club creation and Profile-only Pro/Pro+ entry point included in Implemented. The remaining Create Club gap is advanced tags/genre metadata.

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

2. **Create Club documentation drift — resolved in code**
   - **Spec:** §4.4 defines `app/(tabs)/clubs/create.tsx` with a full creation form.
   - **Current code:** Route, screen, hook, service, and membership-limit check now exist. Product entry point is Profile-only for Pro / Pro+ users.
   - **Remaining gap:** Polish only: richer metadata and tags/genre controls.
   - **Files:** `app/(tabs)/clubs/create.tsx`, `src/features/clubs/screens/ClubCreateScreen.tsx`, `src/features/clubs/hooks/useClubs.ts`, `src/features/clubs/services/clubsManagementService.ts`.

3. **`lead` role legacy in old migrations**  
   - **Spec:** §1.2 mandates `member | moderator | admin`. Rejects `lead`.  
   - **Reality:** Early migration `20251228114444_008_rls_policies_venues_clubs.sql` still references `lead_id` and `role = 'lead'`. Later migration `20260310153000_013_clubs_entitlement_enforcement.sql` cleans this live.  
   - **Files:** `CLUBS_SPEC_2026-03-06_234839.md` §1.2 vs `supabase/migrations/20251228114444_008_rls_policies_venues_clubs.sql`.

4. **Nomination finalization gating — resolved in current UI**
   - **Spec:** Admin should finalize after voting closes.
   - **Current code:** Detail screen now gates voting with `hasNominationVotingClosed()` and does not expose a premature finalize action from the nomination card. Manage current-book controls remain the admin finalization surface.
   - **Current code:** Nomination search now uses cached provider fallback and manual nomination fallback. Remaining depth is around richer book metadata validation, not provider availability blocking.
   - **Files:** `src/features/clubs/screens/ClubDetailScreen.tsx`, `src/features/clubs/screens/manage/ClubManageCurrentBookSection.tsx`.

5. **Reading schedules orphaned (resolved for basic milestone UI)**
   - **Spec:** Mentions "reading schedules" and "member reading progress" as member-visible features.
   - **Reality:** Tables exist (`reading_schedules`, `member_reading_progress`). RPC `set_club_current_book_reading_status` exists. **Reading progress screen implemented** (`ClubReadingProgressScreen.tsx`, route `app/(tabs)/clubs/[clubId]/reading.tsx`). **Reading schedule builder and member timeline are now implemented** using `reading_schedules.milestones` and `member_reading_progress.chapters_completed`.
   - **Remaining gap:** Multi-plan schedules and reminder notifications are product-depth work rather than the basic missing UI.
   - **Files:** `CLUBS_SPEC_2026-03-06_234839.md` §2.2 vs `src/features/clubs/services/clubsBooksService.ts` vs `src/features/clubs/screens/ClubReadingProgressScreen.tsx`.
