# Clubs Feature Module — Pending / Incomplete / Blocked Inventory

**Audit date:** 2026-04-24  
**Sources:** `CLUBS_SPEC_2026-03-06`, `CLUBS_IMPLEMENTATION_STATUS_2026-03-07`, `CLUBS_LIVE_BACKEND_CONTRACT_2026-03-07`, `CLUBS_MANAGE_CLUB_SPEC_2026-03-07`, `FEATURE_IMPLEMENTATION_GAP_ANALYSIS_2026-04-07`, live DB verification, and direct codebase inspection.

---

## Legend

| Status | Meaning |
|--------|---------|
| `Not Started` | Zero implementation exists in repo or live backend. |
| `Backend Ready, Frontend Missing` | DB tables, RPCs, triggers, or Edge Functions exist and are verified live. No Expo Router route or screen component consumes them. |
| `Frontend Exists, Backend Missing` | Route or screen exists but calls missing RPCs, missing Edge Functions, or hits unimplemented DB surfaces. |
| `Partially Implemented` | Some surfaces exist (e.g., service layer but no screen, or screen but missing backend enforcement). |
| `Implemented but Buggy` | Code exists end-to-end but has known functional defects. |

| Criticality | Meaning |
|-------------|---------|
| `Blocker` | Prevents a core user loop from completing. No workaround. |
| `High` | Required for MVP credibility or revenue path. Workaround is painful. |
| `Medium` | Important for retention or moderation. MVP can ship without it. |
| `Low` | Nice-to-have. Does not block MVP launch. |

---

## 1. Frontend Routes / Screens

| # | Item | Status | Criticality | Explicit Blocker |
|---|------|--------|-------------|------------------|
| 1.1 | **Create club screen** — `app/(tabs)/clubs/create.tsx` | `Backend Ready, Frontend Missing` | **Blocker** | No route file. Backend `createClub()` service, `check-membership-limits` Edge Function, and all DB triggers are live. Users cannot create clubs from the app at all. |
| 1.2 | **Club chat / messaging screen** — `app/(tabs)/clubs/[clubId]/chat.tsx` | `Backend Ready, Frontend Missing` | **High** | `club_messages` table exists with full RLS. No Realtime publication enabled for Clubs tables. Zero frontend route, screen, or service. Chat is a core spec feature. |
| 1.3 | **Reading progress & schedule UI** | `Backend Ready, Frontend Missing` | **Medium** | `member_reading_progress` and `reading_schedules` tables exist in migrations. No route, screen, or hook exists in `app/` or `src/features/clubs/screens/`. |
| 1.4 | **Club archive / unarchive UI** | `Not Started` | **Medium** | `book_clubs.is_archived` field exists. No admin UI to archive a club or unarchive within the 180-day window. No user-facing "archived clubs" list. |
| 1.5 | **Admin transfer / succession UI** | `Not Started` | **Medium** | Spec describes admin transfer when downgrading. No screen or flow exists for initiating or accepting admin transfer. |
| 1.6 | **Author club discovery & verification workflow** | `Partially Implemented` | **Medium** | Schema supports `author_club` type and `author_id`. No dedicated discovery section, verified author badge flow, or author-specific club experience (AMA, signed editions). |
| 1.7 | **Moderation dashboard / complaint queue** | `Not Started` | **Medium** | `club_complaints` and `club_member_actions` tables exist with RLS. No frontend for reviewing complaints, issuing warnings, muting, or banning members. |
| 1.8 | **Venue browse / selection / registration screens** | `Not Started` | **Medium** | Full `venues` schema with PostGIS exists. No `src/features/venues/` module, no venue routes, no venue selection inside event creation. |
| 1.9 | **Notification preferences / inbox** | `Not Started` | **High** | No push-token registration UI, no notification history, no per-category settings. Blocks RSVP reminders, nomination close alerts, wishlist matches. |
| 1.10 | **Club discussion report queue (moderator view)** | `Not Started` | **Medium** | `club_discussion_reports` table exists. Report submission frontend plumbing exists (member can report). No moderator-facing queue to act on reports. |

---

## 2. API / Service / Hooks Layer

| # | Item | Status | Criticality | Explicit Blocker |
|---|------|--------|-------------|------------------|
| 2.1 | **`useCreateClub` hook** | `Not Started` | **Blocker** | Not present in `useClubs.ts`. `clubsManagementService.createClub()` exists but no TanStack Query mutation wrapper. |
| 2.2 | **Club chat service & hooks** | `Not Started` | **High** | No `clubMessagesService.ts`, no `useClubMessages` hook, no Realtime subscription hook. `supabase-js` Realtime client is available but not wired. |
| 2.3 | **Reading progress hooks** | `Not Started` | **Medium** | `set_club_current_book_reading_status` RPC exists. No dedicated hook for reading progress tracking or reading schedule display. |
| 2.4 | **Invitation revoke service** | `Frontend Exists, Backend Missing` | **Medium** | UI can display invitation history. No `revoke_club_invitation` RPC in live DB. Admin cannot cancel a sent invitation. |
| 2.5 | **Invitation read-state service** | `Frontend Exists, Backend Missing` | **Low** | No `mark_invitation_read` RPC. Invitees have no "inbox" of unread invitations. |
| 2.6 | **Club archive / unarchive service** | `Partially Implemented` | **Medium** | `updateClub()` can set `is_archived` (inferred from `UpdateClubInput`). No explicit `archiveClub()` / `unarchiveClub()` methods. No grace-period logic in service layer. |
| 2.7 | **Admin transfer service** | `Not Started` | **Medium** | No RPC or service method for transferring admin ownership. Spec describes it but no backend function exists. |
| 2.8 | **Moderation actions service (mute / ban / warning)** | `Not Started` | **Medium** | `club_member_actions` table exists with `duration_hours`, `expires_at`. No service layer to create moderation actions. No hook to check if current user is muted before posting. |
| 2.9 | **Complaint review service** | `Not Started` | **Medium** | `club_complaints` table exists. No service to list complaints for a club, update status, or resolve. |
| 2.10 | **Notification service (FCM token + send)** | `Not Started` | **High** | No `send-notification` Edge Function. No `wishlist-notify` Edge Function. No client-side push token registration service. |
| 2.11 | **Venue service** | `Not Started` | **Medium** | No `venuesService.ts`. No hooks for venue CRUD or geo search. |

---

## 3. Backend RPC / Edge Functions

| # | Item | Status | Criticality | Explicit Blocker |
|---|------|--------|-------------|------------------|
| 3.1 | **`revoke_club_invitation` RPC** | `Not Started` | **Medium** | Listed in `CLUBS_LIVE_BACKEND_CONTRACT` as absent. Confirmed missing in live DB. |
| 3.2 | **`mark_invitation_read` RPC** | `Not Started` | **Low** | Listed in `CLUBS_LIVE_BACKEND_CONTRACT` as absent. Confirmed missing in live DB. |
| 3.3 | **`handle-downgrade-grace-period` Edge Function** | `Not Started` | **High** | Documented in `booktalks_mobile_spec.md`. No file in `supabase/functions/`. No cron job or scheduler configured. Grace period is a promise with no enforcement. |
| 3.4 | **`send-notification` Edge Function** | `Not Started` | **High** | Listed in `EDGE_FUNCTIONS_IMPLEMENTATION_LIST.md` as ❌ Not implemented. Required for push delivery. |
| 3.5 | **`wishlist-notify` Edge Function** | `Not Started` | **High** | Listed in `EDGE_FUNCTIONS_IMPLEMENTATION_LIST.md` as ❌ Not implemented. Required for wishlist matching alerts. |
| 3.6 | **Admin transfer RPC** | `Not Started` | **Medium** | No function for changing `book_clubs.admin_id` with validation of successor eligibility. |
| 3.7 | **Mute / ban / warning RPC** | `Not Started` | **Medium** | No RPC wrapper for `club_member_actions` inserts. RLS exists but requires client to know exact policy shape. |
| 3.8 | **Complaint resolution RPC** | `Not Started` | **Medium** | No RPC for updating `club_complaints.status` and `resolution`. |

---

## 4. Database / Realtime / RLS

| # | Item | Status | Criticality | Explicit Blocker |
|---|------|--------|-------------|------------------|
| 4.1 | **Realtime publication for Clubs tables** | `Not Started` | **High** | `club_messages`, `club_events`, `club_discussion_topics` are not published for Supabase Realtime. Chat cannot function without this. Event/discussion live updates also blocked. |
| 4.2 | **Downgrade grace-period cron / pg_cron** | `Not Started` | **High** | No scheduled job to run daily warnings (Day 7/14/21/29) or auto-archive on Day 30. No `pg_cron` extension usage visible. |
| 4.3 | **`book_clubs` raw SELECT policy clarity** | `Partially Implemented` | **Low** | Raw `book_clubs` RLS is not the public contract. App correctly uses `club_public_details`. The raw policy gap is documented and accepted. |
| 4.4 | **Author club owner consistency enforcement** | `Implemented but Buggy` | **Medium** | `enforce_author_club_owner_consistency` trigger exists. Author verification workflow is incomplete, so the trigger may fire on unverified data. |
| 4.5 | **Automated cleanup of expired `club_member_actions`** | `Not Started` | **Low** | `expires_at` is stored but no cron or trigger auto-updates `club_members.status` when a mute expires. Manual or application-level check required. |

---

## 5. Known Functional Bugs

| # | Item | Status | Criticality | Explicit Blocker |
|---|------|--------|-------------|------------------|
| 5.1 | **Nomination finalize button shown before voting closes** | `Implemented but Buggy` | **High** | `ClubDetailScreen` shows finalize action while `nomination.status === 'active'`. Backend `finalize_club_book_nomination` only succeeds after `voting_ends_at` has passed. Fix: gate UI by `hasNominationVotingClosed()` (already computed in screen). |
| 5.2 | **Google Books API 429 errors block nomination search** | `Implemented but Buggy` | **Medium** | `ClubNominateBookScreen` depends on Google Books API for search input. Rate limiting (`429`) makes normal search unreliable. Needs debounce + caching or fallback to manual-only entry. |
| 5.3 | **`joinClub()` lacks dedicated `author_club` flow** | `Implemented but Buggy` | **Medium** | `author_club` type exists. `joinClub()` service routes `approval` and `author_club` through the same application flow, but no author-specific behavior (e.g., verified reader badge, early access) is implemented. |
| 5.4 | **Test suite leaking timers / open handles** | `Implemented but Buggy` | **Low** | Jest logs: "A worker process has failed to exit gracefully... likely caused by tests leaking due to improper teardown." Does not affect runtime but slows CI. |

---

## 6. Documentation / Specification Gaps

| # | Item | Status | Criticality | Explicit Blocker |
|---|------|--------|-------------|------------------|
| 6.1 | **`README.md` Free-tier moderator claim** | `Implemented but Buggy` (now fixed) | **Low** | Previously claimed Free users could be Moderator. Fixed in `2026-04-24` edit. No remaining drift here. |
| 6.2 | **Downgrade policy not marked as unimplemented** | `Partially Implemented` (now fixed) | **Medium** | Previously documented as implemented without caveat. Now annotated in `README.md` as not yet implemented. |
| 6.3 | **Realtime chat spec vs. reality gap** | `Partially Implemented` | **Medium** | `CLUBS_SPEC` describes chat as a route. Live DB has the table but no Realtime publication and no frontend. Spec understates the gap. |
| 6.4 | **Reading progress / schedule spec** | `Partially Implemented` | **Medium** | Tables exist in migrations. No UI spec or route definition in `CLUBS_SPEC`. Feature is orphaned. |

---

## Summary by Criticality

### Blocker (MVP cannot ship without these)
1. Create-club route + `useCreateClub` hook
2. Nomination finalize UI gating bug

### High (Required for credible MVP or revenue)
1. Club chat / messaging (Realtime publication + frontend)
2. Push notification Edge Functions (`send-notification`, `wishlist-notify`) + client token registration
3. Downgrade grace-period automation (Edge Function + cron)
4. Google Books API rate-limit resilience in nomination search

### Medium (Important for retention, moderation, completeness)
1. Reading progress & schedule UI
2. Club archive / unarchive UI + service
3. Admin transfer UI + RPC
4. Author club discovery & verification workflow
5. Moderation dashboard (mute / ban / warning + complaint queue)
6. Venue frontend module
7. Invitation revoke RPC
8. Discussion report moderator queue

### Low (Polish, edge cases, deferred work)
1. Invitation read-state RPC + inbox
2. `book_clubs` raw SELECT policy refinement
3. Automated cleanup of expired `club_member_actions`
4. Jest timer leaks
