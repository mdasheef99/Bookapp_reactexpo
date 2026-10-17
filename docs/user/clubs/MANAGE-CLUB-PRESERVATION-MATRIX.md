# Manage Club behavior preservation matrix

## Post-inspection decision — 2026-10-10

The user chose to retain the current Manage application layout. The original
full-redesign effort was stopped; the scope recommendation below is historical
and does not direct implementation. Existing refinements and all 119 control
IDs/control families remain the preservation baseline.

A subsequent direct request in the design session started a separate fresh
mobile Current Book artboard. Its reported 390×844 render, remaining generic
canvas label and incomplete proposal/critique evidence are recorded in the
[current Clubs handoff](./TRACKER.md#current-handoff--2026-10-10-documentation-refresh).
These reports do not approve application changes or close this matrix's runtime
gaps. The original inspection screenshots and Git snapshot below remain dated
inspection evidence, not a newly rerun browser/Git closeout.

Inspection date: 2026-10-10. Scope: current `feat/clubs-v2` checkout served at
`http://localhost:8081/clubs/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1/manage`.
This is an inspection record; no application code, designs, or business data
were changed. Browser screenshots referenced below are saved outside the repo
under `C:/Users/LEGION/.codex/visualizations/2026/10/09/01a122ea-ae40-7c61-8bdf-be08fa53a846/`.

## Git state at inspection close and scope boundary

At inspection close, branch `feat/clubs-v2`, HEAD
`07998254726f3d31a6dfb561657744562818fc88`. `git fetch origin main` completed
on 2026-10-10; `origin/main` resolved to
`2f2f383b14b5818b62682ae5bdd7fa295550ba5b`; `HEAD...origin/main` is `5 0`
(five ahead, zero behind). Cached `origin/feat/clubs-v2` comparison is `4 0`.
Initial status contained 38 modified tracked files and 3 untracked entries,
nothing staged. At close there are 38 modified tracked files and 4 untracked
entries, nothing staged. The tracker was already modified at session start;
this inspection adds one dated entry to that existing mixed diff and this new
untracked document. The other 37 modified tracked paths and 3 untracked entries
are preserved from initial status. Exact close status:

```text
 M app/(tabs)/clubs/__tests__/index.test.tsx
 M app/(tabs)/clubs/index.tsx
 M app/(tabs)/profile/__tests__/notification-settings.test.tsx
 M app/(tabs)/profile/__tests__/notifications.test.tsx
 M app/(tabs)/profile/__tests__/settings.test.tsx
 M app/(tabs)/profile/notification-settings.tsx
 M app/(tabs)/profile/notifications.tsx
 M app/(tabs)/profile/settings.tsx
 M docs/multi-tenant-bookstore-marketplace/implementation/phase-9-image-inventory/supporting/database-current-vs-target.md
 M docs/user/clubs/AGGREGATE-PUBLICATION-REVIEW-20261008.md
 M docs/user/clubs/PRE-PR-REVIEW.md
 M docs/user/clubs/REVIEW-CORRECTIONS-HANDOFF.md
 M docs/user/clubs/TRACKER.md
 M src/features/clubs/screens/ClubApplicationsScreen.tsx
 M src/features/clubs/screens/ClubAuthorsScreen.tsx
 M src/features/clubs/screens/ClubCreateScreen.tsx
 M src/features/clubs/screens/ClubDetailScreen.tsx
 M src/features/clubs/screens/ClubDiscussionScreen.tsx
 M src/features/clubs/screens/ClubDiscussionThreadScreen.tsx
 M src/features/clubs/screens/ClubEventEditorScreen.tsx
 M src/features/clubs/screens/ClubEventsScreen.tsx
 M src/features/clubs/screens/ClubInvitationsInboxScreen.tsx
 M src/features/clubs/screens/ClubInviteScreen.tsx
 M src/features/clubs/screens/ClubManageScreen.tsx
 M src/features/clubs/screens/ClubNominateBookScreen.tsx
 M src/features/clubs/screens/ClubVenuePickerScreen.tsx
 M src/features/clubs/screens/__tests__/ClubAuthorsScreen.test.tsx
 M src/features/clubs/screens/__tests__/ClubCreateScreen.test.tsx
 M src/features/clubs/screens/__tests__/ClubDetailScreen.test.tsx
 M src/features/clubs/screens/__tests__/ClubDiscussionScreen.test.tsx
 M src/features/clubs/screens/__tests__/ClubEventEditorScreen.test.tsx
 M src/features/clubs/screens/__tests__/ClubInvitationsInboxScreen.test.tsx
 M src/features/clubs/screens/__tests__/ClubManageScreen.test.tsx
 M src/features/clubs/screens/__tests__/ClubVenuePickerScreen.test.tsx
 M src/features/venues/screens/VenueDetailScreen.tsx
 M src/features/venues/screens/VenuesBrowseScreen.tsx
 M src/features/venues/screens/__tests__/VenueDetailScreen.test.tsx
 M src/features/venues/screens/__tests__/VenuesBrowseScreen.test.tsx
?? clubs-home-390x844-authenticated-dedup.png
?? docs/user/clubs/MANAGE-CLUB-PRESERVATION-MATRIX.md
?? src/features/clubs/__tests__/
?? src/features/clubs/navigation.ts
```

Marketplace continuity authority remains Phase 9 Unit 6H, correction complete,
with M62 runtime rollout and connected proof pending. This Manage inspection
does not authorize Phase 9 implementation, migration, or rollout.

## Reading the matrix

Every ID is one independently invokable control or navigation action. Repeated
row controls are parameterized by the displayed record/member/venue ID. “UI”
means React frontend visibility/state; it does not establish server permission.
Server conditions below come from current source and read-only live catalog
inspection, not from attempting writes. A listed success/error path is source
behavior unless explicitly called browser-observed. Refetch means the section’s
parent query is also explicitly refetched where noted. The app’s query client
has no global retry policy configured; queries without a section-specific
`retry: false` inherit TanStack Query defaults. Most mutations are not given an
automatic retry policy.

Source abbreviations (paths relative to repository root; line numbers are from
this checkout):

| Ref | Source |
|---|---|
| R | `app/(tabs)/clubs/[clubId]/manage.tsx:1` route re-export |
| M | `src/features/clubs/screens/ClubManageScreen.tsx:90-750` tabs, gates, handlers and composition |
| B | `src/features/clubs/screens/manage/ClubManageCurrentBookSection.tsx`; `ClubManageBookOverrideSection.tsx` |
| SCH | `src/features/clubs/screens/manage/ClubManageReadingScheduleSection.tsx`; `manageUtils.ts` |
| E | `src/features/clubs/screens/manage/ClubManageEventsSection.tsx`; `src/features/clubs/screens/ClubEventEditorScreen.tsx:94-500`; `clubsEventsService.ts:70-241` |
| V | `src/features/clubs/screens/manage/ClubManageVenuesSection.tsx`; `ClubVenuePickerScreen.tsx:15-200`; `clubsEventsService.ts:135-179` |
| REP | `src/features/clubs/screens/manage/ClubManageDiscussionReportsSection.tsx`; `ClubManagePlatformComplaintsSection.tsx`; `clubsComplaintsService.ts:48-68` |
| MEM | `src/features/clubs/screens/manage/ClubManageMembersSection.tsx:1-280`; `clubsMembershipService.ts:73-137` |
| SET | `src/features/clubs/screens/manage/ClubManageSettingsSection.tsx:1-270`; `manageUtils.ts:1-95` |
| Q | `src/features/clubs/screens/manage/ClubManageJoinQuestionsSection.tsx:1-180`; `clubsManagementService.ts:94-125` |
| APP | `src/features/clubs/screens/manage/ClubManageApplicationsSection.tsx:1-160`; `clubsApplicationsService.ts:1-38` |
| INV | `src/features/clubs/screens/manage/ClubManageInvitationsSection.tsx:1-150`; `clubsInvitationsService.ts:1-85` |
| LIFE | `src/features/clubs/screens/manage/ClubManageLifecycleSection.tsx:1-240`; `clubsManagementService.ts:37-90` |
| H | `src/features/clubs/hooks/useClubs.ts` (query and mutation hooks named per row) |
| AUTH | `src/application/auth/sessionCoordinator.ts`; `src/features/marketplace/commerce/services/commerceSession.ts`; `src/lib/queryClient.ts`; `app/_layout.tsx` |
| WEB | installed `node_modules/react-native-web/dist/exports/Alert/index.js:1-20` |

Evidence shorthand: **Browser** means the current local checkout rendered at
8081 and the named screenshots/controls below. **Tests** names the existing
source test; tests were inspected as source and are not represented as newly
run. **DB** means read-only Supabase MCP on project `ahntbtktjjmvfosgkmgn`,
verified twice on 2026-10-10 as `Bookconnect_reactexpo`, ACTIVE_HEALTHY,
ap-southeast-2, Postgres 17.6.1.063. Catalog evidence describes policy and
privilege definitions, not an observed request failure.

## Page, routes, and permission map

The route resolves to `ClubManageScreen` (R). Its identity boundary is
`[clubId,userId]`; the root remounts on identity change and returns focus to
“Club management.” Manage detail and membership load before rendering. Current
Book is available to a recorded owner or any membership with `role=admin`, or
an active eligible moderator. Tabs marked `adminOnly` additionally require
`isAdmin`; that frontend predicate accepts owner OR membership role admin but
does not check status or entitlement. The backend helper `can_user_hold_club_role`
requires the recorded owner plus Pro/Pro+ and access-level compatibility for
admin, and an active moderator with Pro/Pro+ and access compatibility for
moderator-only manager paths. A database membership row saying role=admin alone
does not satisfy the backend helper. Owner-only primary venue selection also
requires the club not archived. Event create/edit is more permissive than the
Manage Events tab: active eligible moderators may create events and edit their
own events. Archived-club behavior is enforced unevenly per server policy/RPC;
do not assume hidden/disabled UI is the security boundary.

Visible tab keys are Current Book, Schedule, Analytics, Events, Venues, Reports,
Applications (approval/author clubs only), Invitations (invite-only only),
Members, Settings, Join Questions, Lifecycle. Current Book and Reports are
shown to managers and active eligible moderators; the other ordinary admin
tabs use the frontend admin predicate. Applications/Invitations use
`adminOnly:false` plus their club-type predicate, and their queries are enabled
for frontend admin OR active moderator. A requested tab is applied only when
visible; manual tab changes are in component state and do not rewrite `?tab=`.
Browser saw 10 tabs because the seed club is public; conditional Applications
and Invitations were not browser-rendered. The login was not repeated during
this continuation; its exact role/tier is not established by the visible
controls. Visible owner-like actions are not treated as proof of role.

Global fixed bottom navigation: My Library, Exchange, Marketplace, Clubs,
Profile. Manage back icon currently calls `navigateBackOrFallback` with the
allowlisted `clubOrigin`; it uses `router.replace(clubHomeHref(...))`, not
browser-history back. The icon lacks an explicit accessibility label/role in
Manage. Existing working-tree navigation corrections propagate `clubOrigin`
from All/My/Archived/Invitations scopes.

Query isolation: Manage keys include club ID; several viewer-dependent queries
also include user ID (membership, nomination/current-book status, events,
schedule, application/invitation self views). Screen identity remount fences
late screen-local responses. Shared-cache cleanup on account change was
confirmed in D13: the auth transition coordinator cancels queries, clears the
mutation cache, and clears the root `appQueryClient` before publishing the new
authenticated state. The account-switch behavior was not browser-verified for
this screen. Preserve this existing safeguard; do not present club-key scoping
alone as account isolation.

## Stable action inventory

The rows identify labels/locations, prerequisites and disabled conditions,
input/default/validation, route/backend path, effects/cache, failure/recovery,
and focus/draft/return behavior. `section load` entries include passive loading
and error presentation so an empty list is not mistaken for permission.

### Global shell and tabs

| ID / control | Gate, behavior, route/effect and evidence |
|---|---|
| G01 Back arrow, Manage header | Visible after manage access. Replaces route with club home derived from allowlisted origin; retains directory return context. No mutation; no confirmation. Root restores management focus after identity switch; return-focus after route transition not browser-verified. Source M/navigation.ts. Browser current screenshot. |
| G02-G06 My Library / Exchange / Marketplace / Clubs / Profile bottom tabs | Always-visible app navigation; routes are app tab roots. No Manage mutation or confirmation. Section-local drafts reset on actual unmount; retention after switching global tabs was not verified and must not be inferred from navigation alone. Browser screenshot `manage-current-desktop.jpg`; routes `app/(tabs)/_layout.tsx`. |
| T01 Current Book | Visible manager/admin or active moderator. Opens section in place, URL unchanged; loads nominations/status overview. Draft override state is separate and opens from B. Browser desktop/mobile Current Book screenshots; M/B. |
| T02 Schedule | Frontend admin only and a current book is needed to edit; otherwise read-only explanatory empty state. Loads club/current-book/viewer schedule. Tab switch unmounts draft; source SCH. Browser desktop/mobile schedule screenshots. |
| T03 Analytics | Frontend admin. Passive counts, no section action. Current-book overview may error independently. Browser desktop/mobile screenshots; analytics tests in `ClubManageScreen.test.tsx` around 1806,1869. |
| T04 Events | Frontend admin tab. Lists scheduled upcoming and cancelled/past, route to create/edit and exposes per-event actions. Browser desktop/mobile screenshots; M/E. |
| T05 Venues | Frontend admin; list query frontend-admin gated. Link rows/actions reconciled against readable club links. Browser screenshots; M/V. |
| T06 Reports | Frontend manager/moderator; open discussion reports and pending/reviewing platform complaints. Browser screenshots; M/REP. |
| T07 Applications | Only approval/author club; manager/admin or active eligible moderator by UI. Pending applications oldest first. Not browser-visible on the public seed. Source M/APP and `ClubManageScreen.test.tsx` around 1668. |
| T08 Invitations | Only invite-only club; manager/admin or active eligible moderator by UI. Pending/recent invitation list. Not browser-visible on the public seed. Source M/INV and test around 1714. |
| T09 Members | Frontend admin tab; list/actions query gated admin/moderator. One member can be expanded. Browser desktop/mobile screenshots and source MEM. |
| T10 Settings | Frontend admin. Parent draft survives ordinary tab switches, section-local draft state survives only while section mounted; cover upload is immediate external Storage effect. Browser screenshots; source SET. |
| T11 Join Questions | Frontend admin. Questions query gated admin. Browser desktop/mobile screenshots; source Q. |
| T12 Lifecycle | Frontend admin. Archive/restore and eligible Pro successor requests. Browser desktop/mobile screenshot; source LIFE. |

### Current Book and override

| ID / control | Gate, inputs, route/effect, recovery and evidence |
|---|---|
| B01 Finalize nomination | Only admin; only active nomination with valid voting end at/before now. No confirmation. Calls `finalize_club_book_nomination` via `finalizeClubBookNomination(nominationId)`; affects selected nomination/current book, invalidates nominations/public/manage/browse/current-book status then parent refetch. Pending is per nomination button; failure shown in shared feedback. No local draft. Not clicked. Browser current-book view; M/B, clubsBooksService, H; existing test around 1394. |
| B02 Set as current | Only admin; active nomination and vote still open (null/invalid end is treated open). No confirmation. Calls `setClubCurrentBookFromNomination(nominationId)` RPC; invalidates nomination/public/manage/browse/current-book status and refetches. Per-row pending; failure feedback. Not clicked. Browser current book screenshot state has an active nomination/button; M/B, service, H; test around 1425. |
| B03 Admin override open / B04 Cancel override | Admin-only tile opens inline search; Cancel closes/unmounts and loses query/results/selection. No backend on open/cancel. Browser desktop override screenshot; source B/M. |
| B05 Override query input | Admin-only; arbitrary text, 400ms debounce, auto-search at 3+ trimmed characters. Calls external Google Books cached search offset 0 limit 10. Cache banner on cached result; rate limit/error message, no results on error; no app mutation. Query/results persist while panel stays open; unmount loses them. Browser only opened panel, search not exercised; B, `booksService.searchGoogleBooksCached`. |
| B06 Search | Disabled blank or while searching; manual click accepts query, under 3 chars shows validation; results same API/cache/error behavior. Browser not exercised. B; tests around 1622-1660. |
| B07 Select/deselect result | Search result rows toggle selected book; no mutation. Selection required before Apply button appears. Browser not exercised; B. |
| B08 Apply admin override | Selected item required. Alert asks confirmation, but Web Alert is a no-op; callback therefore does not run on Web. On native confirm, first nominates Google book, then separately finalizes (not atomic), refetches, and clears panel query/results/selection on success; error keeps selection and feedback for retry. Not submitted. B/M, `nominateClubBook`, `finalizeClubBookNomination`, WEB; test around 1565. |

### Schedule

| ID / control | Gate, inputs, route/effect, recovery and evidence |
|---|---|
| S01 3 parts template / S02 4 weeks template | Admin/current book editor only. Replaces all unsaved milestones immediately, due dates null; no confirmation/undo. On switch/tab unmount unsaved template is lost. Source SCH; browser captured blank schedule desktop/mobile; template not selected during safe inspection. |
| S03 Label / S04 Target / S05 Due date | Per milestone, label and target free text; due date blank/null default and strict valid `YYYY-MM-DD` when provided. Draft-only until Save. Browser desktop/mobile schedule. Source SCH. |
| S06 Remove milestone / S07 Add milestone | Admin/current-book editor. Remove shown only with >1 row and never removes final row; Add always available. Draft only; no confirmation; ordering follows current array. Browser schedule. SCH. |
| S08 Save schedule | Disabled while saving. Requires current book and at least one milestone with label or target; date parse/roundtrip validity, nondecreasing nonblank due dates, nondecreasing detected chapter-start targets. Trims fields, drops fully blank rows. Upsert `club_id,current_book_id,milestones,created_by`; invalidates schedule, parent refetch. Success/error feedback, retains draft on failure; remount loses draft. No confirmation. Browser not submitted; source M/SCH/H, tests around 1025/1060/1087. |

### Analytics

AN01-AN06 are passive readouts, not action buttons: member/moderator counts, active nominations, upcoming and past events, capacity, and current reading progress. Admin-only tab, loaded from enabled member, nomination, event, club, and current-book-status queries. No mutation or confirmation. Empty/error subqueries can produce incomplete counts; status query has retry disabled and independent error. Browser desktop/mobile screenshots show seed values (3 members, 0 moderators, 1 active nomination, 1 upcoming, 2 past, capacity 3/50); browser error state not tested. M, analytics tests around 1806/1869.

### Events, nested event editor, and venue picker

| ID / control | Gate, inputs, route/effect, recovery and evidence |
|---|---|
| E01 Create event | Manage Events tab admin-gated. Navigates `/clubs/:id/events/create?returnTo=manage&manageTab=events` plus clubOrigin. No mutation until Save. Browser observed route and Back. M/E. |
| E02 Edit event | Each event row has Edit; only pending mutation state disables row. Routes to event editor with event ID and return context. Existing draft serialized when browsing venues. Browser source/nav inspected; E. |
| E03 Cancel event | Shown for scheduled records, including past scheduled records. Alert “Cancel event?” with Keep/Cancel event; Web no-op, so callback cannot fire on Web. Native confirm updates status cancelled and cancelled_at; service accepts `cancelledBy` but does not write `cancelled_by`. Invalidates event and events query; feedback, row pending then retry on failure. Browser action not invoked during continuation; historical Oct 9 test evidence in tracker says Web Alert no-op. E/M/H/WEB; event cancel test around 1975. |
| E04 Delete event | Shown for non-scheduled/cancelled records; permanent DB delete. Alert warns permanent, Keep/Delete; Web no-op. Native confirmation deletes by event ID, invalidates events and removes event cache; feedback and retry on failure. Not exercised due destructive scope. E/M/H/WEB. |
| E05-E07 Event title / description / type (Virtual, In person, Hybrid) | Create/edit route; editable by owner/eligible manager per event service (owner or eligible active moderator who created event), though Manage list itself is admin-gated. Title trim/nonempty; description optional. Type toggles local state. Browser created editor, toggled types and cancelled via Back; screenshots desktop. E editor/service. |
| E08-E11 Start date/time and optional end date/time; E12 Clear optional end | Editor controls; start required valid timestamp; optional end blank or valid and strictly after start. Clear sets both end fields blank. Browser editor opened; controls not submitted. Draft survives nested venue-picker return via serialized query; ordinary Back loses draft without a confirmation. E editor/service. |
| E13 Location mode: linked venue / enter meetup place | Displayed when linked venues exist; otherwise manual-place explanation. Toggles local draft only. In-person/hybrid require a venue or nonblank manual location. Browser toggled editor mode; no submission. E. |
| E14 Browse venues from event editor | Pushes club venues picker with `returnTo=event-editor`, create/edit mode, serialized entire draft and clubOrigin. Selecting venue returns to editor with preselectedVenueId; browsing alone does not link it to club. Browser not exercised from editor in this continuation; source E/ClubVenuePickerScreen. |
| E15 Select linked venue | Only linked venue cards; toggles local selection. If link removed before save server/event validation may reject; errors preserve draft. E. |
| E16 Manual meetup place / E17 Meeting link | Manual text available for in-person/hybrid without linked selection. Meeting link shown for virtual/hybrid and requires http(s); virtual/hybrid require link. E. |
| E18 Save event | Create or edit; submit disabled during pending. Requires title/start/end ordering and event-type location/link rules; service payload trims title, normalizes optionals, carries event type/start/end/venue/manual location/meeting link; create default max_attendees null, update omits it if unspecified. Direct `club_events` insert/update, invalidates events/public detail. Error retains draft; success returns Manage Events or Events according return context. Not submitted; source E/M/H; no destructive action. |
| E19 Back from event editor | Replaces to Manage tab or Events using returnTo/manageTab and clubOrigin; no unsaved-changes prompt; serialized route draft only used when returning from venue picker. Browser return to `/manage?tab=events` observed. E/M and current checkout navigation diff. |
| V01 Add venue | Manage Venues Add always shown. Routes `/clubs/:id/venues?returnTo=manage-venues` with origin; no direct mutation until card picked. Browser observed picker. M/V. |
| V02 Set primary venue / V03 Retry primary selection | Owner only and nonarchived; Set shown when not already primary or a recoverable primary error, global primary action serializes and disables while pending. Calls `set_primary_club_venue(club_id,venue_id)` authenticated RPC. Locks/validates owner, eligible entitlement, nonarchive, linked target, reconciles exactly one primary on readback. Success requires readable target confirmation; ambiguous transport/refetch errors preserve previous readable state and expose retry. Invalidation plus explicit venue refetch. No automatic primary on removal. Browser existing venue/state and recovery labels inspected; never clicked; source M/V/H, primary venue tests 233-910. |
| V04 Remove venue open / V05 Cancel Remove / V06 Confirm removal | Linked venue row Remove. Custom native/React modal asks “Remove venue?”; browser rendered on desktop/mobile. Cancel and Escape close and restore focus to same Remove button (browser verified). Confirm is a distinct user-confirmed destructive action; one-shot ref prevents double submit; parent deletes only the selected `club_venues` link, invalidates the club venue query and explicitly reconciles; errors surface shared feedback. Existing event venue references remain unchanged: the service issues no event update, and fresh live catalog evidence shows `club_events.venue_id` references `venues`, no inbound FK to `club_venues`, and no user trigger or rewrite rule on `club_venues`. Primary removal note explains no automatic replacement. Modal can close if target disappears. Focus trigger/escape observed, screen-reader announcement not assessed. V06 was not clicked. Source V/M/H/DB; tests 391,451,527,586. |
| V07 Choose approved venue card in Manage picker | 11 approved venue cards (limit 50, offset 0), including already linked venue because picker does not prefilter existing links. Card click immediately inserts `club_venues{club_id,venue_id,is_primary:false}`; owner/server/duplicate constraints remain enforced. One request at a time, duplicate/permission/network/generic errors allow retry; success replaces to Manage Venues preserving origin. This is a business mutation and was not clicked; browser saw list only. Source picker/V/H and current venue-picker screenshot. |
| V08 Picker Back | Routes to Manage or prior editor/list by `returnTo`; event editor return preserves draft and origin. On manage data error there is no explicit retry/Back recovery in the error state (source finding); browser used named Back to Manage. Source picker, browser picker screenshot. |

### Reports

| ID / control | Gate, inputs, route/effect, recovery and evidence |
|---|---|
| RPT01 Mark discussion report resolved | Reports tab manager/moderator. Immediate action, no confirmation. Updates report status resolved, invalidates open/resolved reports and discussion; per-global pending disables resolution; shared success/error feedback and retry. Not clicked. Browser reports screenshot; REP/M/H; tests around 911. |
| RPT02 Warn / RPT03 Timed mute / RPT04 Ban complaint target | Buttons immediately call composite handler, no confirmation and no editable reason/duration dialog. Requires complaint target still in member list; reason derives trimmed complaint description or fixed “Platform complaint: …”; timed mute fixed 24h; warning/ban duration null. First inserts `issue_club_member_action`, then separately updates complaint resolution (two writes, not atomic). If resolution fails, moderation may already have applied; retry may duplicate action. Action-pending is not part of button-disabled condition, so duplicate taps possible. Server helper requires eligible active target/manager, blocks self/admin; errors shared and complaint/member/action queries refetched in finally. Not clicked. Browser Reports screenshot; REP/MEM/H; tests around 957. |
| RPT05 No action | Immediate complaint status resolution with `resolution_action=no_action`, no confirmation; no member action. Updates complaint status/resolved timestamp; pending/error/refetch behavior shared with RPT02. Not clicked; source REP/M/H. |

### Members and moderation

| ID / control | Gate, inputs, route/effect, recovery and evidence |
|---|---|
| MEM01 Expand/collapse Manage member | Members/admin tab; excludes null IDs and recorded owner. First manageable row defaults expanded; only one row expanded. Browser first row expanded, second Manage toggle exercised. Local state only; no mutation. Source MEM and screenshots. |
| MEM02 Change role to Moderator / MEM03 Change role to Member | Active/muted nonowner, non-admin-role only. Promotion additionally requires member Pro/Pro+ and access-level compatibility in UI and service. Updates `club_members.role`; backend RLS owner/entitlement/self restriction; invalidates members. Per-user pending disables actions; feedback on eligibility/error, retry. Browser observed buttons, did not click. Source MEM/M/H/DB; tests 1457/1484. |
| MEM04 Mute / MEM05 Unmute | Nonowner/nonadmin, active/muted only. Updates status active↔muted, invalidates members/public detail/current-book overview; row pending and feedback/retry. Not clicked; browser member screenshot. Source MEM/M/H/DB; test 1914. |
| MEM06 Warn / MEM07 Timed mute / MEM08 Ban open draft | Nonowner/nonadmin member with user ID; inline editor. Reason default blank. Timed mute duration defaults 24 hours; Warn/Ban duration blank (optional). Opens draft only. Browser opened Warn, Timed mute, Ban then cancelled. Source MEM and `manage-member-draft-desktop.jpg`. |
| MEM09 Reason / MEM10 Duration hours | Inline draft inputs; reason trim required; duration when supplied must be integer ≥1; server RPC also validates action enum/reason/duration; timed mute service passes duration or null. Not submitted. MEM; browser draft screenshot. |
| MEM11 Cancel moderation draft | Clears local draft, no mutation. Browser cancellation verified; keyboard/focus return not explicitly controlled and focus fell to document/body in observed web flow. MEM. |
| MEM12 Apply Warn / MEM13 Apply Timed mute / MEM14 Apply Ban | Requires nonempty trimmed reason and valid optional duration; all use `issue_club_member_action` RPC. Warn and ban alter action history/status according RPC; timed mute creates expiry. Mutations invalidate members, action history, membership/current-book status; parent refetches members/actions. Success closes draft; failure retains values; per-user busy is set but Apply lacks disabled prop (duplicate-submit risk). Not clicked. Source MEM/M/H and DB RPC catalog summary; tests 1939. |
| MEM15 Remove from club open / MEM16 Cancel / MEM17 Remove | Excludes owner/admin. Alert says member loses club access immediately; native Cancel/Remove destructive confirmation. Web Alert is empty/no-op: observed tap opened no dialog (`getJsDialog` absent); no callback. On native confirm deletes membership row by club/user, invalidates public/browse/members/membership/current-book queries; feedback and retry on error. No deletion performed. Browser member screenshot/open action; MEM/H/WEB/DB; test 1504. |
| MEM18 Recent moderation history | Passive newest three actions with type/reason/expiry. Loading spinner; member-actions query retries disabled and errors currently can appear empty. No controls. Browser member screenshot/source MEM/M/H. |

### Settings and Storage

| ID / control | Gate, inputs, route/effect, recovery and evidence |
|---|---|
| SET01 Name / SET02 Description | Admin tab. Name starts saved; required after trim. Description optional. Local editor draft; validation feedback appears after touched; reset discards changes. Browser typed inspection-only name and Reset, confirmed original restored; no save. SET/M. |
| SET03 Select cover image | Admin tab. Requests photo-library permission then image picker, image-only, editable 3:4, quality .85. Cancelled picker leaves draft. Selection fetches blob and immediately uploads `club-banners/{clubId}/cover.{jpg|png|webp}` with upsert and content type; public URL updates local draft only after upload. Storage mutation occurs before Settings Save and is not rolled back by Reset. Upload button disabled while upload; save may remain enabled. Permission/upload error text and manual URL fallback. Not opened; no permission prompt/upload. Source SET; tests 1741-1800. |
| SET04 Cover URL | Admin text input, blank or valid absolute `http:`/`https:` only; local draft. Browser baseline and screenshot; changed image URL not saved. SET/manageUtils. |
| SET05 Member cap | Admin numeric-like text; blank/null or positive whole number and not below current `member_count`. UI normalizes via `parseInt` before regex, so strings like `2foo` can normalize to `2` (source quirk); validation only after touched. Payload `max_members:number|null`. SET/M/service; existing tests 1342. |
| SET06 Club type Public / Approval / Invite only | Admin; selector shown except author clubs (fixed). Local draft; selection changes conditional Applications/Invitations only after saved club type/refetch. Server owner/Pro/access and author consistency triggers still apply. No confirmation. Browser selector not changed. SET/M/DB. |
| SET07 Access All members / Pro / Pro+ | Admin local selector; changing saved access can be rejected by server if owner entitlement or existing active/muted members fail access. No confirmation; server entitlement trigger. Browser untouched. SET/M/DB. |
| SET08 Meeting type Not set / Online only / Venue based / Hybrid | Admin local selector; payload nullable enum. No extra UI validation recorded. Browser baseline Hybrid; selector not changed. SET/M. |
| SET09 Save | Enabled only dirty, valid, not saving. Sends name, description, cover_url, max_members (parseInt/null), access_level, meeting_type and club_type except author club; `updateClub` direct `book_clubs.update(...).eq(id).select().single()`, updated_at added by service. Success feedback then manage-detail refetch; hook invalidates public detail/manage detail/browse. Failure feedback; section clears touched flag after parent resolves even if parent swallowed the error, but local values remain. No confirmation. Not submitted. Source SET/M/H/management service and DB. Tests around 1304. |
| SET10 Reset | Enabled only when dirty and not saving (`disabled={!isDirty || isSaving}`). Restores section values from parent draft and calls parent reset to persisted club values. Discards unsaved values; no confirmation. Browser verified. SET/M. |

### Join Questions

| ID / control | Gate, inputs, route/effect, recovery and evidence |
|---|---|
| Q01 New question / Q02 Required switch | Admin only, default required=true. Question trim must be nonempty; local draft. Browser screenshot shows two seed questions; no entry changed. Q. |
| Q03 Add | Disabled blank or any question action pending. Inserts `{club_id,question:trim,is_required,order_index:max+1}`; hook updates sorted cache, parent refetches. Success clears draft and resets Required=true; failure keeps draft; feedback. No confirmation. Not clicked. Q/M/H; test around 1537. |
| Q04 Existing question text / Q05 Required switch | Per-question local edits; fallback question and required=true for nullable legacy value. No server change until Save. Q. |
| Q06 Save question | Disabled blank or same question pending. Updates question trim and required flag; hook cache set then parent refetch; success feedback, failure retains edits/retry. No confirmation. Not clicked. Q/M/H. |
| Q07 Delete question | Disabled only same active row; immediate delete with no confirmation. Hook removes cache then parent refetch; failure feedback. Not clicked; source Q/M/H; current Tests existence only. |

### Applications (conditional)

| ID / control | Gate, inputs, route/effect, recovery and evidence |
|---|---|
| A01 Load/display application and answers | Only club type approval/author, manager query gated admin or active moderator. Pending rows ordered oldest first; array/object answers normalized with fallback “No answer submitted.” Query pending-state and failure may look empty under default empty destructuring. Not browser-visible. APP/M/H/DB. |
| A02 Approve / A03 Decline | Per pending application; one active ID disables both row choices. Alert asks confirmation; Cancel or destructive Decline / Approve. Web Alert no-op. Native confirm calls `review_club_join_application(applicationId,decision,declineReason=null)`; approve activates membership and updates application, decline stores null reason; RPC is transactional and rejects archived/noneligible/existing membership conditions. Invalidates public/browse/members/applications/current-book/self-application, parent refetch. Error keeps row, feedback, retry. Not browser-visible or submitted. APP/M/H/WEB/DB; test around 1668. |

### Invitations (conditional)

| ID / control | Gate, inputs, route/effect, recovery and evidence |
|---|---|
| I01 Invitee username | Invite-only club, manager query/action UI gate. Starts blank; trims; no note UI. Create disabled blank or pending; RPC resolves username case-insensitively, checks club status/type, invite permission, self, tier/access, existing membership/application/pending invitation. INV/M/H/DB. Not browser-visible. |
| I02 Send invitation | Sends `clubId,trimmedUsername,note:null` to `create_club_invitation`; pending label “Sending…”. Success clears username; error retains for correction/retry. Invalidates invitation query and parent refetch. No confirmation. Not submitted. INV/M/H. |
| I03 Revoke pending invitation | Per pending only; global revoke pending disables. Immediate, no confirmation. `revoke_club_invitation(invitationId)` RPC, owner or active admin/mod membership server condition; sets revoked/responded timestamp; cache invalidated/refetched. Error feedback and retry. Not browser-visible. INV/M/H/DB. |

### Lifecycle

| ID / control | Gate, inputs, route/effect, recovery and evidence |
|---|---|
| L01 Archive club | Frontend admin tab; shown when active; all lifecycle requests share busy disable. Alert says hidden from public browse/restorable; Cancel/Archive. Web Alert no-op, confirmed by browser tap with no JS dialog. Native confirmation directly updates `{is_archived:true,archived_at:now,updated_at:now}` by ID, invalidates/refetches manage/public/browse; feedback. Server RLS still requires the current eligible owner; the archived resulting row skips the entitlement trigger's active-club tier/cap branch, as detailed in the catalog recheck below. No RPC/delegate. Not submitted. LIFE/M/H/WEB/DB. Existing test 1115 mocks Alert confirmation; not a Web runtime proof. |
| L02 Restore club | Frontend admin on archived state; Alert asks Restore; Web Alert no-op. Native confirm update `{is_archived:false,archived_at:null,updated_at:now}`; same invalidation/refetch/feedback; owner role/Pro/access and active-club cap enforced by RLS/helper/trigger. No RPC/delegate. Archived browser state unavailable. LIFE/M/H/WEB/DB. |
| L03 Transfer Request open / L04 Cancel / L05 Send request | Candidate must have user ID, differ from owner, status active/muted, Pro/Pro+ and satisfy club access. Pending same-target request disables row; any archive state does not hide candidate in frontend. Alert names person and club; Cancel/Send request. Web Alert no-op by platform source, but opening the Request control was explicitly blocked by automatic review because it can submit an ownership transfer. This control therefore remains unverified in browser. Native callback sends `request_club_admin_transfer(clubId,newAdminUserId)` RPC; server verifies owner, nonarchive, eligible target and author-specific profile condition where relevant, replaces prior pending requests and creates a new pending request. Cache invalidates transfer requests; parent refetch/feedback and per-selected-target pending. No app-side rollback if RPC succeeds but refetch fails. LIFE/M/H/WEB/DB; existing test around 1197. |
| L06 Transfer requests/readiness | Passive lifecycle state: eligibility guidance, counts, pending request list, downgrade warning/retention policy. Request query only frontend admin; backend select policies for proposed user/managers. Loading may be spinner; query error can resemble empty list. Browser shows 2 eligible, 0 pending. LIFE/M/H/DB. |

### Venue picker return control

Picker is reached from V01 or E14. Manage add mode loads club detail and up to 50 approved venues, but does not fetch linked venues to hide duplicates; database uniqueness/duplicate message is final guard. Initial errors render without an explicit retry control. Event-editor mode reads linked venues and only selects a venue into serialized editor draft; it does not insert a club link. `clubOrigin`, editor mode, event ID, return target, Manage tab and draft query preserve return navigation. This is source mapped; only Manage venue-picker was browser opened.

## Live database UPDATE recheck: three separate paths

Project was reverified through Supabase MCP immediately before SQL reads: ID/ref
`ahntbtktjjmvfosgkmgn`, name `Bookconnect_reactexpo`, ACTIVE_HEALTHY,
ap-southeast-2, Postgres 17.6.1.063. Inspection used catalog SELECT only; no
table row, grant, policy, function, Storage object or migration was written.

`authenticated` has no table-level UPDATE grant on `public.book_clubs`, but
`has_column_privilege` is true for the actual columns used in all three paths:
Settings `name,description,cover_url,max_members,access_level,meeting_type,
club_type,updated_at`; Archive `is_archived,archived_at,updated_at`; Restore
`is_archived,archived_at,updated_at`. It is also true for other columns except
`current_book_id` (false). Effective row policy is “Admins can update their
clubs”, USING and WITH CHECK both call
`can_user_hold_club_role(auth.uid(),id,'admin')`. The SECURITY DEFINER helper
requires recorded club owner, Pro/Pro+, and access-level compatibility. RLS is
enabled on `book_clubs`, not FORCE enabled. Catalog check therefore **retracts
the claimed blanket UPDATE-grant defect**: table-level false did not account
for column grants. There is no observed runtime failure; no write was tried.

| Action | Actual source request | Live enforcement and result of audit |
|---|---|---|
| Settings Save | `updateClub` direct PostgREST update by club ID, fields listed above (author club omits club_type); no RPC. | Relevant effective column grants all true. RLS owner+Pro/access helper applies to row and resulting row. Entitlement trigger checks active club owner tier/access, club-count cap, and existing member access when access changes; author consistency trigger applies if club_type/author/admin columns are touched (author path omits club_type). No catalog evidence of a blanket grant defect; no runtime request tested. |
| Archive | Same direct update, `is_archived=true`, current timestamp `archived_at`, `updated_at`. | Column grants true; RLS owner+Pro/access helper required even when archiving. Trigger on `is_archived` runs; because row becomes archived, trigger’s active-club tier/cap branch is skipped. No RPC/delegate. No write/runtime test. |
| Restore | Same direct update, `is_archived=false`, `archived_at=null`, `updated_at`. | Column grants true; same RLS owner+Pro/access check; entitlement trigger re-enters active-club tier/access/cap/member-compatibility checks. No RPC/delegate. No write/runtime test. |

Other confirmed policy boundaries relevant to this matrix: `club_members`
UPDATE requires eligible owner and prevents self-target; DELETE permits self-leave
except owner, or eligible owner removing another. `club_events` insert requires
eligible manager, creator self, scheduled; update/delete use owner or eligible
creator helper. `club_venues` UPDATE requires nonarchived entitled owner; INSERT
has ordinary owner link path plus stricter primary path; DELETE policy checks
recorded owner (effective role/grants and surrounding policy still apply).
Application review RPC and invitation/member-action/transfer RPCs enforce their
own actor and state rules. Roles and policy definitions are from DB catalog;
RPC bodies were read in earlier continuity audit on this project, not called
here. A catalogue policy is not a reproduction of every runtime edge condition.

## Existing findings (not design proposals)

| ID | Finding / evidence strength |
|---|---|
| D01 | Web confirmations implemented with React Native `Alert.alert` do nothing (`react-native-web` implementation is empty). Browser observed this for member removal and Archive; source proves same mechanism for event Cancel/Delete, Restore, application Approve/Decline, transfer request, and override Apply. Those other callbacks were not invoked to demonstrate it. This is an existing confirmation failure on Web. |
| D02 | Settings upload writes Storage before Settings Save; Reset only resets URL/draft, it cannot undo an uploaded object. Different image extension may leave older `cover.*`; URL has no cache-buster. Source only; upload not exercised. |
| D03 | Settings Save handler swallows update error; child `handleSave` then clears touched indicator despite failure while leaving values. Error feedback should still display; no failed save browser-tested. |
| D04 | Initial Manage rendering returns loading while `!settings` before testing `isError`; if first club fetch fails before draft initializes, failure branch may remain unreachable. Source ordering M; not forced in browser. |
| D05 | Several query failures default to empty arrays and show empty-state content; review/actions/transfers/schedule queries with explicit `retry:false` have no section-level retry affordance. Inspect live query states before drawing UI conclusion. Source M/hooks; no errors forced. |
| D06 | Member moderation actions are two-tap safe only by habit, not UI state: Apply is not disabled during pending, so double submit may duplicate. Complaint Warn/Mute/Ban does action RPC then complaint update nonatomically and buttons do not key off action pending; retry after second-step failure can repeat moderation. Source MEM/REP/M/hooks; tests cover bridge success, not partial failure proof. |
| D07 | Web/manual tab switch does not rewrite requested `?tab=`; reload/return may select stale requested tab. Browser saw current URL `?tab=venues` remain while switching tabs in earlier inspection. M. |
| D08 | Venue custom Remove modal is working and has Cancel/confirm; preserve it. Browser observed opening, Cancel, Escape and focus restoration, no unlink. Source V and existing race/recovery tests. |
| D09 | Venue reconciliation is deliberate: only recorded owner/nonarchived can set primary, serialized target, readback must match club and linked venue, recoverable retry retains prior state; removing primary does not choose replacement. Preserve as behavior. Source M/V and tests 233-910. |
| D10 | Event cancel callback accepts `cancelledBy` but `clubsEventsService.cancelClubEvent` updates only status and cancelled_at, not cancelled_by. Potential audit-field discrepancy from source; live column contract/value not changed or runtime tested. |
| D11 | Event create/editor route is reachable only through frontend admin tab, while event RLS allows eligible active moderator creator to create/edit own event. This reflects UI reachability limitation for moderators; backend policy is broader. Source M/E and live policy. |
| D12 | Manage back control has no explicit accessibility role/name, unlike picker/editor back controls. Browser AX screenshot displayed icon glyph only; inspect mobile screen-reader runtime later. |
| D13 | Manage club/account identity remount protects local responses. Shared-cache cleanup also exists: `applySessionTransition` calls `cleanPreviousUserState` when an observed authenticated user changes or signs out; that calls `clearCommerceSession`, which cancels queries, clears the mutation cache, and clears the same `appQueryClient` supplied by the root provider. The coordinator awaits cleanup before publishing the new authenticated state and exposes a cleanup-error state on failure. Preserve this existing safeguard; its account-switch runtime behavior was not browser-verified in this inspection. The earlier claim that broad query-cache cleanup was absent is retracted. Source AUTH. |
| D14 | Management venue picker list includes existing linked venue; duplicate is server/database-rejected with message. Current seed showed existing Central Reading Library among 11 cards. No duplicate attempted. |

## Screenshot index and browser evidence

All are JPEGs at the directory given at top. Desktop viewport captures were
1280×720. Mobile viewport was 390×844. Browser address matched localhost:8081;
the Expo start session started from this checkout root after 8081 was found
refusing connections in the prior handoff. Page rendered current Manage code.
All screenshots are current-checkout captures dated 2026-10-10 (not earlier
8082/historical captures).

| Screenshot | View/state |
|---|---|
| `manage-current-desktop.jpg`, `manage-current-390x844.jpg` | Current Book default, page shell and global nav. |
| `manage-schedule-desktop.jpg`, `manage-schedule-390x844.jpg` | Schedule blank draft/current book. |
| `manage-analytics-desktop.jpg`, `manage-analytics-390x844.jpg` | Seed analytics. |
| `manage-events-desktop.jpg`, `manage-events-390x844.jpg` | Scheduled and past event lists. |
| `manage-event-create-desktop.jpg` | Event-create editor with Hybrid and manual physical location; draft not saved. |
| `manage-venues-desktop.jpg`, `manage-venues-390x844.jpg` | Linked venue and add action. |
| `manage-remove-dialog-desktop.jpg`, `manage-remove-dialog-390x844.jpg` | Open venue Remove modal; no confirmation submitted. |
| `manage-venue-picker-desktop.jpg` | Approved venue choices; no card selected. |
| `manage-reports-desktop.jpg`, `manage-reports-390x844.jpg` | Reports/complaint controls. |
| `manage-members-desktop.jpg`, `manage-members-390x844.jpg` | Expanded member controls and collapsed second row. |
| `manage-member-draft-desktop.jpg` | Timed-mute inline draft default (24 hours), no submit. |
| `manage-settings-desktop.jpg`, `manage-settings-390x844.jpg` | Settings baseline. |
| `manage-settings-bottom-390x844.jpg` | Settings lower portion after Reset; draft returned to saved values. |
| `manage-questions-desktop.jpg`, `manage-join-questions-390x844.jpg` | Join Questions (tab label is “Join Questions”). |
| `manage-lifecycle-desktop.jpg`, `manage-lifecycle-390x844.jpg` | Active lifecycle and transfer candidates. |
| `manage-override-desktop.jpg` | Override search panel open, query blank. |

The 27 captures are an index of screen states, not proof every hidden row,
conditional club type, narrow dialog, platform-specific picker, role, or
mutation succeeded. Browser inspection included tab navigation, member expand/
collapse, event create-route entry and Back, event type/local editor toggles,
venue picker entry and Back, venue Remove open/Cancel/Escape, settings local
edit/Reset, member moderation draft open/Cancel, override open/Cancel, and
opening Member Remove/Archive Alert call sites (Web rendered no dialog). No
business submit was accepted. No database/Storage write occurred.

## Verification gaps

- Test user’s exact auth UUID, membership role/status, subscription tier, and
  relation to seeded owner/member identities were not independently established
  in browser. Do not infer them from owner-like controls.
- Active moderator, nonadmin member, free-tier member, invite-only/approval/
  author club, archived club, ineligible successor, and signed-out/other-club
  identities were not browser-exercised. Source, catalog, and named tests cover
  only the conditions each test asserts; roles were not promoted.
- Confirmation Cancel/final callbacks for member removal, event cancel/delete,
  lifecycle Archive/Restore/transfer, Applications decisions and override were
  not clicked. Web no-op is source-confirmed for the component’s `Alert.alert`
  calls and directly observed on Member Remove and Archive. Venue Remove is
  the sole fully browser-opened functional dialog.
- Settings Save, question CRUD, member role/status/moderation/removal, reports,
  Applications/Invitations, event Save/Cancel/Delete, venue Add/Remove/Set
  primary, Archive/Restore/transfer, and Storage upload outcomes were not
  submitted. Their success/error/cache results are source and existing test
  contracts, not newly run runtime proofs.
- Google Books search is mapped in source and existing tests; no query was sent.
  Image permission/picker UI cannot be meaningfully verified in this Web
  runtime without an unapproved permission prompt/upload.
- The Transfer Request browser click was blocked by automatic review because
  the control can submit ownership transfer. Source and existing test map the
  native confirmation; no workaround or submission was attempted.
- Event-create and event-picker validation/focus on native iOS/Android were
  not verified. Keyboard/screen-reader accessibility beyond browser AX/focus
  observations is open.
- Screenshot binary evidence is retained at the absolute local paths above;
  this Markdown links by basename, not embedded thumbnails. Browser tab was
  reset to the default viewport before close.

## Historical design-scope recommendation

Read-only matrix review on 2026-10-10 corrected V04's unsupported event-unlink
claim and D13's missing indirect auth-cleanup trace. Supabase MCP reverified
`Bookconnect_reactexpo` / `ahntbtktjjmvfosgkmgn` as ACTIVE_HEALTHY before narrow
catalog SELECTs: the event venue FK targets `venues`, no FK targets
`club_venues`, and that link table has no user triggers or rewrite rules.
Source inspection also clarified Settings Reset's disabled condition, Archive's
resulting-row trigger branch, and unverified draft retention across global-tab
navigation. The duplicated tracked matrix path was removed from the Git snapshot;
this file remains untracked. No new browser checks or tests were run by this
review, and none of the existing runtime gaps is closed by these corrections.
The matrix remains cohesive as one Manage control inventory, evidence record,
and design-preservation contract. Continuity validation and diff hygiene passed
after these documentation corrections; code tests were not run.

Prepare an information-architecture and visual refinement for the Manage shell
and each existing section surface: compact warm-ivory page framing, stronger
club identity and return context, clear owner/moderator capability grouping,
responsive tab navigation for ten to twelve conditional sections, and a
consistent hierarchy for status, feedback, empty/loading/error/retry states.
Refine the existing Settings form, Schedule editor, Current Book/override,
Analytics, Events, Venues, Reports, Members, Questions, Applications,
Invitations and Lifecycle surfaces against every ID in this matrix. Keep Newsreader
headings, Inter controls/body, white surfaces and burgundy actions, calm
reading-community tone, compact spacing and accessible touch targets.

The proposal must preserve all current route parameters/clubOrigin, frontend
tab predicates, authoritative backend actor checks, club/account isolation,
archived restrictions, application/invitation type visibility, exact
validation/defaults, moderation and ownership consequences, current book
nomination rules, event payloads, venue link/primary reconciliation and working
Remove modal. The Web Alert defect is an existing behavior finding to resolve
only in a separately approved scope with explicit equivalent cancel/confirm
semantics. Storage upload-before-save and non-rollback must be shown honestly;
do not imply Reset undoes an upload. Treat failure/retry, draft retention,
focus restoration, conditional sections and nested editor return as first-class
design states. This is a scope recommendation only, not artboards or an
implementation authorization.

## Coverage and closeout

Inventory coverage: 12 tab actions; 5 app navigation actions plus one Manage
back action; 8 Current Book/
override actions; 8 Schedule controls; 6 passive Analytics readouts; 19
Events/editor/return controls; 8 Venue actions; 5 Reports controls; 18 Member
controls/readout families; 10 Settings controls; 7 Join Question controls; 3
Application controls; 3 Invitation controls; 6 Lifecycle actions/readout
families; plus picker mode and state contracts above. Count is **119 stable
IDs/control families**, each with source evidence and browser/test gap stated;
record-parameterized row actions apply per visible event/member/question/venue.
The source control scan included all manage-section `onPress`, `onChangeText`,
and native Alert call sites; the conditional sections are explicitly listed.

Next action at inspection close was a separate design decision; no design was
created during that inspection. The later layout-retention decision and limited
unapproved draft activity are recorded in the current Clubs handoff. Future
behavior corrections, implementation and business submissions require their
own scope and authorization.
