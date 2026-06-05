# Clubs Feature Module — Pending / Incomplete / Blocked Inventory

**Audit date:** 2026-04-24  
**Last reconciled with current code:** 2026-06-05
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
| 1.1 | **Create club screen** — `app/(tabs)/clubs/create.tsx` | `Implemented After Audit` | **Low** | Route, screen, `useCreateClub`, service integration, cover image picker/upload, and verified-author author-club creation now exist. Current product direction keeps the entry point in Profile and visible only to Pro / Pro+ users. Remaining work is richer metadata. |
| 1.2 | **Club chat / messaging screen** — `app/(tabs)/clubs/[clubId]/chat.tsx` | `Backend Ready, Frontend Missing` | **High** | `club_messages` table exists with full RLS. No Realtime publication enabled for Clubs tables. Zero frontend route, screen, or service. Chat is a core spec feature. |
| 1.3 | **Reading progress & schedule UI** | `Implemented After Audit` | **Low** | Reading progress route/screen/hook/service exist. Admin schedule builder and member milestone timeline now consume `reading_schedules` and `member_reading_progress`; builder includes starter templates, YYYY-MM-DD validation, chronological due-date validation, and explicit chapter-order validation. Remaining work is product-depth: reminders and multi-plan behavior. |
| 1.4 | **Club archive / unarchive UI** | `Implemented After Audit` | **Low** | Manage > Lifecycle can archive/restore clubs. Browse > Archived lists archived clubs administered by the signed-in user and routes to lifecycle restore. Retention/grace-period automation remains separate downgrade work. |
| 1.5 | **Admin transfer / succession UI** | `Implemented After Audit` | **Low** | Manage > Lifecycle now sends transfer requests to eligible Pro/Pro+ active members; proposed successors accept from Club Detail before the role changes. Author-club requests are backend-limited to the verified author profile owner. Lifecycle also shows downgrade readiness, successor coverage, archive retention state, admin warnings, downgrade succession guidance, and archive retention guidance. Downgrade-driven succession automation remains product-policy work. |
| 1.6 | **Author club discovery & verification workflow** | `Partially Implemented` | **Medium** | Browse supports the Author clubs filter, shows a dedicated Author clubs spotlight when author clubs are present, links to an Author clubs landing route filtered to `author_club`, cards/detail show verified-author treatment, and verified users can create author clubs. Schema-backed experiences (AMA, signed editions) remain pending. |
| 1.7 | **Moderation dashboard / complaint queue** | `Partially Implemented` | **Medium** | Manage > Reports lists open `club_discussion_reports` plus open `club_complaints`; Manage > Members can warn, timed-mute, or ban members with action history; platform complaints can bridge into those actions before resolution. Manage > Reports now states that durable resolution notes need an app-wide audit/RPC contract before they are saved. Remaining depth is durable notes and any stricter RPC-backed punitive workflow policy. |
| 1.8 | **Venue browse / selection / registration screens** | `Partially Implemented` | **Medium** | Clubs now have a linked venue picker for event creation/editing. Full `src/features/venues/` module, venue registration/CRUD, and geo-search UX remain pending. |
| 1.9 | **Notification preferences / inbox** | `Not Started` | **High** | No push-token registration UI, no notification history, no per-category settings. Blocks RSVP reminders, nomination close alerts, wishlist matches. |
| 1.10 | **Club discussion report queue (moderator view)** | `Implemented After Audit` | **Medium** | Manage > Reports lists open discussion reports for eligible managers and resolves reports through `club_discussion_reports`. Full punitive action workflow remains part of moderation dashboard work. |

---

## 2. API / Service / Hooks Layer

| # | Item | Status | Criticality | Explicit Blocker |
|---|------|--------|-------------|------------------|
| 2.1 | **`useCreateClub` hook** | `Implemented After Audit` | **Low** | Hook now exists in `useClubs.ts` and wraps `clubsManagementService.createClub()` with cache refresh behavior. |
| 2.2 | **Club chat service & hooks** | `Not Started` | **High** | No `clubMessagesService.ts`, no `useClubMessages` hook, no Realtime subscription hook. `supabase-js` Realtime client is available but not wired. |
| 2.3 | **Reading progress / schedule hooks** | `Implemented After Audit` | **Low** | `useClubReadingSchedule`, `useUpsertClubReadingSchedule`, and `useUpdateClubReadingProgress` now wrap schedule/progress services. |
| 2.4 | **Invitation revoke service** | `Implemented After Audit` | **Medium** | 2026-05-24 verification: `revoke_club_invitation` exists live, is not executable by `anon`, and has app service/hook/manage UI support. |
| 2.5 | **Invitation read-state service** | `Implemented After Audit` | **Low** | 2026-05-29 update: `mark_invitation_read` and `club_invitations.read_at` are consumed by a dedicated invitee inbox plus Browse unread badge. Inbox now has pending invite read/unread grouping, accepted/expired/revoked history grouping, incremental paging, and a notification-settings handoff. Actual reminder delivery still depends on the broader notification pipeline. |
| 2.6 | **Club archive / unarchive service** | `Implemented After Audit` | **Low** | `archiveClub()` and `unarchiveClub()` exist in `clubsManagementService`, with `useArchiveClub` / `useUnarchiveClub` hooks and cache invalidation. No grace-period automation in service layer. |
| 2.7 | **Admin transfer service** | `Implemented After Audit` | **Low** | Immediate `transferClubAdmin()` still exists, and request/accept services now wrap `request_club_admin_transfer` plus `accept_club_admin_transfer_request`. Hooks invalidate transfer request, manage detail, public detail, member list, and browse caches. |
| 2.8 | **Moderation actions service (mute / ban / warning)** | `Implemented After Audit` | **Medium** | `club_member_actions` history reads and `issue_club_member_action` writes are wired through service/hooks. Muted/banned posting enforcement remains covered by existing membership status gates and future realtime/chat work. |
| 2.9 | **Complaint review service** | `Implemented After Audit` | **Medium** | `clubsComplaintsService` now lists open `club_complaints` for a club with reporter/reported profile summaries and resolves complaints by updating status, `resolution_action`, and `resolved_at`. Manage > Reports consumes it through `useClubComplaints` and `useResolveClubComplaint`. |
| 2.10 | **Notification service (FCM token + send)** | `Not Started` | **High** | No `send-notification` Edge Function. No `wishlist-notify` Edge Function. No client-side push token registration service. |
| 2.11 | **Venue service** | `Partially Implemented` | **Medium** | Club event venue reads exist through Clubs services/hooks for linked venues. No standalone venue CRUD or geo-search service exists. |

---

## 3. Backend RPC / Edge Functions

| # | Item | Status | Criticality | Explicit Blocker |
|---|------|--------|-------------|------------------|
| 3.1 | **`revoke_club_invitation` RPC** | `Implemented After Audit` | **Medium** | 2026-05-24 live verification confirms `authenticated`/`service_role` execute grants and no `anon` execute grant. |
| 3.2 | **`mark_invitation_read` RPC** | `Implemented After Audit` | **Low** | 2026-05-24 live verification confirms `authenticated`/`service_role` execute grants and no `anon` execute grant. |
| 3.3 | **`handle-downgrade-grace-period` Edge Function** | `Implemented After Audit` | **High** | `supabase/functions/handle-club-downgrade-grace-period/index.ts` invokes the downgrade grace RPC with service-role credentials and optional cron-secret protection. It does not mutate Supabase Auth users. |
| 3.4 | **`send-notification` Edge Function** | `Not Started` | **High** | Listed in `EDGE_FUNCTIONS_IMPLEMENTATION_LIST.md` as ❌ Not implemented. Required for push delivery. |
| 3.5 | **`wishlist-notify` Edge Function** | `Not Started` | **High** | Listed in `EDGE_FUNCTIONS_IMPLEMENTATION_LIST.md` as ❌ Not implemented. Required for wishlist matching alerts. |
| 3.6 | **Admin transfer RPC** | `Implemented After Audit` | **Low** | Migration `20260527104248_transfer_club_admin_rpc.sql` adds `transfer_club_admin(uuid, uuid)`. It validates current admin, successor membership, access level, Pro/Pro+ tier, blocks `author_club`, promotes successor, and demotes previous admin. |
| 3.7 | **Mute / ban / warning RPC** | `Implemented After Audit` | **Medium** | Migration `20260529154500_club_moderation_author_lifecycle_rpc.sql` adds `issue_club_member_action`, validates manager authority, records reasons/durations, and updates member status for mutes/bans. |
| 3.8 | **Complaint resolution RPC** | `Not Started` | **Medium** | No dedicated RPC for updating `club_complaints.status` and `resolution_action`; current frontend uses the table RLS-backed update path. Add an RPC only if product/security policy wants a stricter server-side resolution contract. |

---

## 4. Database / Realtime / RLS

| # | Item | Status | Criticality | Explicit Blocker |
|---|------|--------|-------------|------------------|
| 4.1 | **Realtime publication for Clubs tables** | `Not Started` | **High** | `club_messages`, `club_events`, `club_discussion_topics` are not published for Supabase Realtime. Chat cannot function without this. Event/discussion live updates also blocked. |
| 4.2 | **Downgrade grace-period cron / pg_cron** | `Local Migration Present, Live Rollout Missing` | **High** | Local migration `20260529170000_club_downgrade_grace_period.sql` adds `club_downgrade_grace_events`, `process_club_downgrade_grace_period()`, and a daily pg_cron schedule when `pg_cron` is available. Read-only live verification on 2026-06-05 found the migration absent from project `ahntbtktjjmvfosgkmgn`, no `club_downgrade_grace_events`, no `process_club_downgrade_grace_period`, no installed `pg_cron`, and no `cron.job` relation. Notification warning cadence still needs notification-service tie-ins. |
| 4.3 | **`book_clubs` raw SELECT policy clarity** | `Implemented After Audit` | **Low** | Raw `book_clubs` RLS is not the public contract. App correctly uses `club_public_details`; archived-admin recovery is the known raw-table exception. Migration `20260529143000_clubs_moderation_cleanup_and_policy_notes.sql` documents the raw-table support role without changing the security-invoker view dependency. No frontend expansion of raw `book_clubs` reads is planned. |
| 4.4 | **Author club owner consistency enforcement** | `Implemented After Audit` | **Medium** | `enforce_author_club_owner_consistency` trigger exists, verified-author create flow is wired, and transfer requests enforce that author-club succession can only target the verified author profile owner. |
| 4.5 | **Automated cleanup of expired `club_member_actions`** | `Local Migration Present, Live Rollout Missing` | **Low** | Local migration `20260529143000_clubs_moderation_cleanup_and_policy_notes.sql` adds `cleanup_expired_club_member_actions()` and schedules it when `pg_cron` is available. Read-only live verification on 2026-06-05 found the migration absent from project `ahntbtktjjmvfosgkmgn`, no cleanup function, no installed `pg_cron`, and no `cron.job` relation. |
| 4.6 | **Manage route tab initialization** | `Fixed After Audit` | **Low** | Browser smoke found that direct web navigation to Manage tabs such as `?tab=lifecycle` could default to Current Book. `ClubManageScreen` now initializes from the route tab and falls back to `window.location.search` on web when Expo Router does not expose the query param. |

---

## 5. Known Functional Bugs

| # | Item | Status | Criticality | Explicit Blocker |
|---|------|--------|-------------|------------------|
| 5.1 | **Nomination finalize button shown before voting closes** | `Fixed After Audit` | **Low** | Current `ClubDetailScreen` gates voting with `hasNominationVotingClosed()` and no longer exposes a premature finalize action from the nomination card. Admin finalization belongs to the Manage current-book surface. |
| 5.2 | **Google Books API 429 errors block nomination search** | `Fixed After Audit` | **Medium** | `ClubNominateBookScreen` uses cached provider search with Open Library fallback and a manual title/author nomination path, so provider `429` no longer blocks nomination submission. |
| 5.3 | **`joinClub()` lacks dedicated `author_club` flow** | `Partially Implemented` | **Medium** | `author_club` type exists, verified-author creation/discovery treatment is wired, and `joinClub()` routes approval and author clubs through the same application flow. Author-specific member behavior such as early access or special badges remains product depth, not a blocking bug. |
| 5.4 | **Test suite leaking timers / open handles** | `Fixed After Audit` | **Low** | `ClubNominateBookScreen` now clears its delayed redirect timer on unmount; focused Clubs tests exit cleanly. Keep watching the full suite for unrelated timer leaks. |

---

## 6. Documentation / Specification Gaps

| # | Item | Status | Criticality | Explicit Blocker |
|---|------|--------|-------------|------------------|
| 6.1 | **`README.md` Free-tier moderator claim** | `Implemented but Buggy` (now fixed) | **Low** | Previously claimed Free users could be Moderator. Fixed in `2026-04-24` edit. No remaining drift here. |
| 6.2 | **Downgrade policy not marked as unimplemented** | `Partially Implemented` (now fixed) | **Medium** | Previously documented as implemented without caveat. Now annotated in `README.md` as not yet implemented. |
| 6.3 | **Realtime chat spec vs. reality gap** | `Partially Implemented` | **Medium** | `CLUBS_SPEC` describes chat as a route. Live DB has the table but no Realtime publication and no frontend. Spec understates the gap. |
| 6.4 | **Reading progress / schedule spec** | `Partially Implemented` | **Low** | Basic reading status, schedule builder, milestone timeline, and explicit chapter-order validation are implemented. Product spec still needs to define reminders and multi-plan behavior. |

---

## Summary by Criticality

### Latest verification (2026-06-04)
- Focused Jest passed: 3 suites / 48 tests (`ClubManageScreen`, `ClubInvitationsInboxScreen`, Clubs Browse route).
- `npx.cmd tsc --noEmit` passed.
- Covered in tests: platform complaint action bridge and policy guidance, reading schedule chronological due-date and explicit chapter-order validation, Author clubs spotlight and landing route, Manage route-tab initialization, Lifecycle policy state/downgrade readiness/successor coverage/archive retention state/admin warnings, invitation notification-settings handoff, unread invitation badge, and archived-club routing.
- Browser smoke was completed on `http://localhost:8081` after starting Expo web with the approved outside-sandbox workflow. Sandboxed Expo start still fails with `EPERM` on `C:\Users\user`.
- Live smoke passed: Browse seeded clubs loaded without exposing Create Club; Profile showed Create Club for the Pro test user; Invitations showed the reminder handoff card and accepted invitation history; Manage opened on `ZZ_TEST Manage Basics Club` (`aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1`); Reports showed empty discussion/platform complaint queues; Schedule showed the chronological due-date validation error; Lifecycle showed downgrade successor and archive retention guidance.
- Live smoke limitations: no pending invitation existed for the signed-in account, no open platform complaint data existed for action-button verification, and no live seeded author-club spotlight/card was available. These remain covered by focused unit/fixture tests or require seeded live data. Slow browser-plugin reloads produced a transient `6000ms timeout exceeded` dev LogBox/console entry, but the target routes rendered successfully afterward.
- Read-only Supabase verification on 2026-06-05 found the local May 29 cleanup/downgrade migrations are not applied live: no `cleanup_expired_club_member_actions`, no `process_club_downgrade_grace_period`, no `club_downgrade_grace_events`, no installed `pg_cron`, and no `cron.job` relation. No Auth users were mutated.
- Handoff correction: `/clubs/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3/manage` is `ZZ_TEST Invite Only Club` and denied management for the current test user; Manage Basics is `/clubs/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1/manage`.
- Previous live smoke baseline remains 2026-05-30 partial pass: auth was not blocking; Browse, Club detail, and Manage loaded; Members showed warning/timed-mute/ban/remove controls; Lifecycle showed archive/admin succession UI; Browse did not expose Create Club; Profile for a Pro test user exposed Create Club; no runtime JS errors were observed.

### Blocker (MVP cannot ship without these)
1. No current Clubs blocker remains in this audit after the Create Club and nomination-gating fixes.

### High (Required for credible MVP or revenue)
1. Club chat / messaging (Realtime publication + frontend) — known high-priority gap, but implementation is explicitly deferred by current user direction.
2. Push notification Edge Functions (`send-notification`, `wishlist-notify`) + client token registration
3. Notification/reminder pipeline for invites, nominations, downgrade warnings, and events

### Immediate non-chat task order
1. Build the broader notification pipeline: push token registration, notification preferences/history, `send-notification`, `wishlist-notify`, and reminder delivery.
2. Add schema-backed author experiences such as AMA/signed-edition workflows.
3. Expand reading schedule product depth: reminders and multi-plan behavior.
4. Define exact admin lifecycle automation policy: automated downgrade-driven successor selection and archive retention/deletion rules. Current UI only surfaces readiness and warnings.
5. Decide whether moderation needs durable resolution notes or a stricter RPC-backed punitive workflow policy.
6. Roll out and then re-run read-only live verification for expired `club_member_actions` cleanup.
7. Roll out and then re-run read-only live verification for downgrade grace cron/job state.
8. Keep venue frontend work excluded unless product direction changes.

### Medium (Important for retention, moderation, completeness)
1. Author club product depth (schema-backed AMA/signed-edition experiences)
2. Venue frontend module beyond linked club venue picker
3. Reading schedule product depth (reminders, multi-plan behavior)
4. Admin lifecycle automation policy (automated downgrade-driven successor selection, archive retention/deletion rules)
5. Moderation product depth (durable resolution notes and stricter RPC-backed punitive workflow policy if required)

### Low (Polish, edge cases, deferred work)
1. Roll out and verify expired `club_member_actions` cleanup migration
2. Roll out and verify downgrade grace cron migration
5. ~~Seed at least one dev author club so Author Clubs card badge can be smoke-tested directly~~ — covered by the `e2e/smoke.spec.ts` mocked `dev-author-club` fixture and focused Playwright assertion.
