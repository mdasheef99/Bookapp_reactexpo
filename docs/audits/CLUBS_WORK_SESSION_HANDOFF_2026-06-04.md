# Clubs Work Session Handoff - 2026-06-04

## Source of truth for the next session

Start with these docs, in this order:

1. `docs/features/CLUBS_IMPLEMENTATION_INVENTORY.md`
2. `docs/audits/CLUBS_PENDING_INVENTORY_2026-04-24.md`
3. This handoff: `docs/audits/CLUBS_WORK_SESSION_HANDOFF_2026-06-04.md`

Do not use older March docs as source of truth except as historical context. The March docs still help explain intent, but the two files above are the current implementation/pending inventory.

## Current repo and workflow constraints

- Repo: `C:\Users\user\Documents\augment-projects\Bookconnect_expo`
- Do not revert unrelated dirty-worktree changes.
- Do not mutate live Supabase Auth users.
- Create Club must remain visible only from Profile and only for Pro / Pro+ users.
- Venue frontend work was explicitly excluded by the user in this thread.
- Prefer Augment/codebase retrieval first where available. In this session, Augment/codebase retrieval failed with connection/timeout errors, so local file inspection was used.
- Use Supabase MCP read-only checks where useful. No live write/mutation checks should be done against Auth users.
- Use `apply_patch` for file edits.
- Use focused TDD for behavior changes: add/adjust a failing test, confirm the failure, implement, rerun.

## Completed in the latest non-venue pass

### Platform complaint queue and moderation bridge

- `src/features/clubs/screens/manage/ClubManagePlatformComplaintsSection.tsx`
- `src/features/clubs/screens/ClubManageScreen.tsx`
- `src/features/clubs/screens/__tests__/ClubManageScreen.test.tsx`

Manage > Reports now lists platform complaints and supports resolving them with:

- `no_action`
- `warned`
- `muted`
- `banned`

For warning/mute/ban, `ClubManageScreen` creates a matching `club_member_actions` entry before resolving the complaint. Muted complaints use a conservative 24-hour duration.

Follow-up completed in the latest pass: Manage > Reports now makes the durable-notes boundary explicit. Resolution actions create moderation records, but saved resolution notes remain deferred until an app-wide audit/RPC contract exists.

### Reading schedule validation

- `src/features/clubs/screens/manage/ClubManageReadingScheduleSection.tsx`
- `src/features/clubs/screens/__tests__/ClubManageScreen.test.tsx`

The schedule builder now blocks milestones whose due dates move backward and explicit chapter targets that move backward, such as `Chapters 10-12` before `Chapters 1-3`. It still supports one latest schedule per club/book, starter templates, and YYYY-MM-DD validation. Reminder delivery is documented in-app as deferred to the app-wide notification pipeline.

### Author club discovery polish

- `app/(tabs)/clubs/index.tsx`
- `app/(tabs)/clubs/authors.tsx`
- `app/(tabs)/clubs/_layout.tsx`
- `src/features/clubs/screens/ClubAuthorsScreen.tsx`
- `app/(tabs)/clubs/__tests__/index.test.tsx`
- `app/(tabs)/clubs/__tests__/authors.test.tsx`

Browse now shows an Author clubs spotlight when author clubs are present in the all-clubs view and no club-type filter is selected, and the spotlight links to a dedicated Author clubs landing route filtered to `author_club`. This did not add a Create Club entry point to Browse.

### Admin lifecycle product-depth polish

- `src/features/clubs/screens/manage/ClubManageLifecycleSection.tsx`
- `src/features/clubs/screens/ClubManageScreen.tsx`
- `src/features/clubs/screens/__tests__/ClubManageScreen.test.tsx`

Manage > Lifecycle now surfaces:

- Downgrade succession guidance
- Archive retention guidance
- Downgrade readiness
- Successor coverage
- Archive retention state
- Admin-facing warnings that no automatic demotion, ownership transfer, archival, or deletion runs from this screen

This is UI/product guidance only. The latest pass now explicitly states that automatic successor selection is not enabled and that archive deletion rules are policy-controlled. Automated downgrade-driven successor selection and archive retention/deletion rules remain pending product/backend work.

Browser smoke also found and fixed a direct-route bug: fresh web navigation to Manage tabs such as `?tab=lifecycle`, `?tab=schedule`, or `?tab=reports` could default to Current Book. `ClubManageScreen` now initializes from the requested route tab and falls back to `window.location.search` on web if Expo Router does not expose the query param.

### Invitation inbox notification handoff

- `src/features/clubs/screens/ClubInvitationsInboxScreen.tsx`
- `src/features/clubs/screens/__tests__/ClubInvitationsInboxScreen.test.tsx`

Invitations inbox now includes an Invitation reminders card that routes to Profile notification settings. Actual push/email reminder delivery remains blocked on the broader notification pipeline.

### Documentation updated

- `docs/features/CLUBS_IMPLEMENTATION_INVENTORY.md`
- `docs/audits/CLUBS_PENDING_INVENTORY_2026-04-24.md`

The docs now record the 2026-06-04 verification state, completed non-venue Medium/Low work, and the completed browser smoke follow-up.

### Live Supabase cleanup/cron verification

Read-only checks were run on 2026-06-05 against Supabase project `Bookconnect_reactexpo` (`ahntbtktjjmvfosgkmgn`). No Auth users were mutated and no maintenance functions were executed.

Result:

- Live migration history does not include local migrations `20260529143000_clubs_moderation_cleanup_and_policy_notes.sql`, `20260529154500_club_moderation_author_lifecycle_rpc.sql`, or `20260529170000_club_downgrade_grace_period.sql`.
- Catalog checks found no `cleanup_expired_club_member_actions`.
- Catalog checks found no `process_club_downgrade_grace_period`.
- Catalog checks found no `club_downgrade_grace_events`.
- `pg_cron` is available in the extension catalog but not installed.
- No `cron.job` relation exists, so cleanup/downgrade scheduled jobs are not present.

## Verification from this session

Passed:

- `npm.cmd test -- --runInBand --runTestsByPath "src/features/clubs/screens/__tests__/ClubManageScreen.test.tsx" "src/features/clubs/screens/__tests__/ClubInvitationsInboxScreen.test.tsx" "app/(tabs)/clubs/__tests__/index.test.tsx"`
- `npm.cmd test -- --runInBand --runTestsByPath "app/(tabs)/clubs/__tests__/index.test.tsx" "app/(tabs)/clubs/__tests__/authors.test.tsx"`
- `npm.cmd test -- --runInBand "src/features/clubs/screens/__tests__/ClubManageScreen.test.tsx"`
- `npx.cmd tsc --noEmit`

Latest focused Jest result: 2 Browse/author suites / 7 tests passed and Manage suite / 40 tests passed. Previous focused invite-inclusive result: 3 suites / 48 tests passed.

Known warning:

- Clubs Browse route test logs a React Native `VirtualizedList` `act(...)` warning. It does not fail the suite.

Browser smoke:

- Completed on `http://localhost:8081` after starting Expo web with the approved outside-sandbox workflow. Sandboxed `npx.cmd expo start --web --non-interactive` still fails with `EPERM` on `C:\Users\user`.
- Auth was not blocking. `/login` redirected to `/library`; Profile showed `ZZ Test Playwright` with Pro tier.
- Browse loaded seeded clubs, exposed the Author clubs filter, and did not expose Create Club.
- Profile exposed Create Club for the Pro test user, preserving the Profile-only Create Club entry point.
- Invitations showed the Invitation reminders handoff card and accepted invitation history. No pending invitation existed for this account, so pending unread/read grouping was not live-verified.
- Manage smoke succeeded on `ZZ_TEST Manage Basics Club` at `/clubs/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1/manage`.
- Correction: `/clubs/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3/manage` is `ZZ_TEST Invite Only Club`, not Manage Basics, and correctly denied management for the current session.
- Manage > Reports rendered with no open discussion reports and no open platform complaints. Platform complaint action buttons remain data-dependent because no seeded open complaint existed.
- Manage > Schedule showed the chronological validation error when backward due dates were entered: `Due dates must stay in chronological order.`
- Manage > Lifecycle showed downgrade successor guidance and archive retention guidance.
- Follow-up route smoke passed for `/clubs/authors`, Manage `?tab=reports`, Manage `?tab=lifecycle`, and Manage `?tab=schedule`.
- Console showed expected development warnings (`shadow*`/`pointerEvents` deprecations and missing Sentry DSN). Slow browser-plugin reloads also produced a transient `6000ms timeout exceeded` dev LogBox/console entry, but the target routes rendered successfully afterward.

## Still pending after this pass

Venue work remains excluded unless the user changes direction.

Non-venue pending items:

1. Schema-backed author experiences such as AMA/signed-edition workflows.
2. Reading schedule reminders and multi-plan behavior.
3. Automated downgrade-driven successor selection and archive retention/deletion rules.
4. Durable moderation resolution notes or stricter RPC-backed punitive workflow policy, if product/security wants it.
5. Roll out and re-run live verification for expired `club_member_actions` cleanup.
6. Roll out and re-run live verification for downgrade grace cron.
7. Broader notification pipeline: push token registration, notification preferences/history, `send-notification`, `wishlist-notify`, and reminder delivery for invitations/nominations/downgrades/events.
8. High-priority Clubs chat/realtime path remains outside the Medium/Low-only pass and is still listed in the pending inventory, but implementation is explicitly deferred by current user direction.

Recommended non-chat task order:

1. Build the broader notification pipeline: push token registration, notification preferences/history, `send-notification`, `wishlist-notify`, and reminder delivery.
2. Add schema-backed author experiences such as AMA/signed-edition workflows.
3. Expand reading schedule product depth: reminders and multi-plan behavior.
4. Define exact admin lifecycle automation policy: automated downgrade-driven successor selection and archive retention/deletion rules. Current UI only surfaces readiness and warnings.
5. Decide whether moderation needs durable resolution notes or a stricter RPC-backed punitive workflow policy.
6. Roll out and then re-run read-only live verification for expired `club_member_actions` cleanup.
7. Roll out and then re-run read-only live verification for downgrade grace cron/job state.
8. Keep venue frontend work excluded unless product direction changes.

## Suggested first checks for next session

1. Read the three source-of-truth docs listed above.
2. Run `git status --short` and do not revert unrelated dirty files.
3. If implementing UI changes, check whether `http://localhost:8081` is reachable before starting Expo. Use the approved outside-sandbox Expo workflow if the sandbox hits `EPERM`.
4. If live Supabase read-only MCP is available after rollout, verify migration rollout state for:
   - `cleanup_expired_club_member_actions`
   - downgrade grace cron/job state
   - raw `book_clubs` policy posture if needed
