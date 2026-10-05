# Clubs UI Overhaul Tracker

## Manual nomination and aggregate publication review (2026-10-05; published)
- The user authorized successful manual nomination verification and a combined review of all unpublished Clubs commits against main, resolving introduced findings before publication. Immediately before push, the fresh fetch showed `origin/main` at `d1d5386e365d1f5851e582049badcdfc85c772aa` and the reviewed implementation branch `feat/clubs-v2` at `26eea88d8e1fdefccb68b3672c12763acfcdeddb`: zero behind / nine ahead, with main an ancestor. No merge/rebase was needed.
- Supabase MCP reconfirmed healthy `Bookconnect_reactexpo` / `ahntbtktjjmvfosgkmgn`. Submitted `ZZ_TEST Manual Nomination Verification 2026-10-05`, author `BookConnect Test Author`, once through the running app's manual form with its default seven-day duration. Pending control, automatic nominations redirect, exact title/author and zero votes were observed; reload confirmed persistence and displayed closing date 12 October 2026. Current read remained Critique of Pure Reason. Error-log query returned none. Success banner was not captured. One additional test nomination and any book record created/reused by the existing service are retained; no direct SQL write, deletion, vote, permission, Storage, migration or deployment action was performed. Evidence: `C:/Users/LEGION/.codex/visualizations/2026/09/30/01a0f41a-79cd-73b0-a323-1079b03f96ad/manual-nomination-persisted-2026-10-05.jpg`.
- Independent aggregate reviewers `aggregate_discovery_review` and `aggregate_management_review` inspected complementary subsets of the complete `origin/main...HEAD` production/test diff. Neither found an actionable introduced regression. They checked shared SearchBar and VenueCard/Badge defaults/callers, routes, gates, handlers, payloads, confirmations and recovery; reviews were static/read-only, with no tests or external writes by reviewers. Historical nomination search concurrency, Authors web retry and picker/reading error-recovery limitations predate this diff. Lack of direct default Exchange VenueCard regression coverage and failed-member-action draft recovery coverage remain test gaps, not proven defects.
- Fresh broader regression run PASS: 33 suites / 465 tests across Clubs routes, screens, components, hooks, services and public venues, normal process exit. Existing directory VirtualizedList act warnings and Node DEP0040 warning remain; this is not a warning-free run. Aggregate diff hygiene PASS. TypeScript completion and final continuity result are recorded in the scoped pre-PR record.
- Native-device, screen-reader/enlarged-text and eligible invitation/application manager live flows remain unverified. This is not a new live authorization audit and does not resolve earlier policy concerns or deferred venue relationship/primary-selection functionality. Prior desktop/mobile browser audit and prior web export results remain historical evidence, not newly repeated here.
- Published the nine reviewed implementation commits plus scoped review record as a fast-forward: `origin/main` moved from `d1d5386` to `a220d5324a3620a71c498c141841e96ba6e055d6`. Follow-up fetch confirms `origin/main` and local HEAD match, zero ahead / zero behind. No production/test source changes, deployment, migration, database/Storage operation or marketplace rollout occurred during this aggregate review. Earlier AGENTS/process documentation edits and Home screenshot remain uncommitted. Marketplace Phase 9 remains M62_RUNTIME_ROLLOUT_AND_CONNECTED_PROOF_PENDING. Active work unit: Clubs publication closeout. Exact next action: user chooses the next Clubs verification or page. No role/venue behavior changes are authorized.

## Manage header separator correction (2026-10-05)
- Replaced the malformed replacement character in the access/meeting-format header with the existing middle-dot convention. This is one display-character correction; no handler, query, mutation, navigation, permission, service or layout change. Added a header-text assertion to the existing Manage regression.
- Independent reviewer `nomination_final_review` approved the scoped source/test diff with no actionable finding. Primary focused Manage tests PASS 42/42; existing Node DEP0040 warning only. TypeScript and one-worker web export PASS; diff hygiene and Phase 9 continuity validator PASS. Running app checked at 1280×720 and 390×844: header reads All members · Hybrid and mobile document width is 390 px. Viewport override restored. Evidence: `C:/Users/LEGION/.codex/visualizations/2026/09/30/01a0f41a-79cd-73b0-a323-1079b03f96ad/manage-separator-mobile-2026-10-05.jpg`.
- This correction caused no external business-data, database/Storage, permission, migration or deployment effects. The nomination created by the preceding authorized live test remains. Commit scope: Manage screen/test, this current entry and scoped pre-PR record. Older mixed tracker changes and existing AGENTS/process documentation/Home screenshot remain uncommitted. No push. Marketplace Phase 9 status is unchanged.
- Active work unit: Clubs verification closeout. Exact next action: ask the user to choose the next verification scope, preferably successful manual nomination and remaining eligible-role checks; unavailable invitation/application manager access remains a blocker. Venue placeholder/primary-selection and historical authorization findings require separate scope decisions before implementation. No additional page redesign is authorized.

## Nominate a Book review and local commit closeout (2026-10-05)
- The user authorized independent review, correction, successful live nomination verification, documentation, and a scoped local commit. Independent reviewer `nomination_final_review` found a P2 recovery regression: global error feedback hid valid search results after a nomination failure or blank manual title. Result suppression now applies only to short-query validation; two recovery regressions were added. The reviewer confirmed the finding closed with no remaining actionable source issue and independently passed 10/10 focused tests. Shared SearchBar defaults/callers, permission gate, handlers, payloads, deadlines, and redirects remain compatible with HEAD.
- Fresh final checks: focused nomination suite 10/10 PASS; TypeScript `--noEmit --incremental false` PASS; Expo web export with one worker to a temporary directory PASS; diff hygiene and Phase 9 continuity validator PASS (86 Markdown files / 62 required; existing size advisories). Prior desktop/mobile layout verification remains recorded below; it is not a newly repeated complete responsive pass after this one-line recovery correction.
- Connected proof: reverified healthy `Bookconnect_reactexpo` / `ahntbtktjjmvfosgkmgn` through Supabase MCP. In the running app, blank manual-title validation kept ten real Google Books results selectable. Selected `Parable of the Sower` / `Octavia E. Butler`, retained default seven days, and submitted once through the existing app mutation. Pending controls were observed; the automatic nominations redirect occurred. Reload confirmed the new nomination with zero votes and displayed deadline 10/12/2026 (12 October). The short-lived success banner was not captured. Current read remained Critique of Pure Reason. Browser error log query returned none. Evidence: `C:/Users/LEGION/.codex/visualizations/2026/09/30/01a0f41a-79cd-73b0-a323-1079b03f96ad/nomination-persisted-2026-10-05.jpg`.
- External effect: one authorized test-club nomination was created and retained; the existing app may also create/reuse its book record. No direct SQL writes, cleanup/deletion, votes, Storage changes, permission changes, migrations, deployment, push, or marketplace rollout occurred. Successful manual nomination remains unverified; blank-title validation is covered by mocks and browser checks; native and actual assistive-technology checks remain open. The broader historical authorization findings were not re-audited or resolved by this UI commit.
- Commit scope is the nomination screen, shared SearchBar, focused test, nomination-only tracker additions and pre-PR record. Existing AGENTS/process documentation edits, older mixed tracker changes and Home screenshot remain outside scope. Marketplace Phase 9 remains M62_RUNTIME_ROLLOUT_AND_CONNECTED_PROOF_PENDING; no global handoff changed.
- Active work unit: nomination review/verification closeout. Exact next action: inspect and correct the Manage header's malformed separator as a separate presentation-only follow-up, then independently review and browser-check that correction before any further scoped commit. No venue or authorization behavior change is authorized.

## Nominate a Book UI refresh (2026-10-05; historical pre-commit verification)
- Self-critique and implementation: mapped the current nomination route and handlers, then refreshed the screen directly as the user requested. The old page separated its club context, search, manual entry, and selected-book confirmation; the selected-book controls appeared after the manual form, and the screen used the app's changing legacy theme. The new layout uses the Clubs V2 ivory/burgundy palette, Newsreader headings and Inter controls, a bounded reading column, compact result rows, an inline selected-book summary immediately after search results, and a clear manual fallback. Search feedback and authorization gates have distinct visual treatments. The shared `SearchBar` gained optional palette/compact props; all defaults remain unchanged for other callers.
- Preserved route and behavior: active-membership gate; debounced and explicit trimmed Google Books search (3-character minimum, 10 results); cached, error, rate-limit and no-match handling; result selection; shared 7-day default and 3/7/14-day voting choices; clear-search reset semantics (including preserving `votingDays`); manual required-title/optional-author entry; local-calendar end-of-day deadline calculation; both existing `useNominateClubBook` calls, haptics, error/success feedback, 1.5-second nominations redirect, and back fallback. No hook, service, RPC, schema, permission, or route implementation changed.
- Browser review exposed the old no-match card persisting beside a short-query error. The page now suppresses stale results and the empty state while that validation error is present. No Google Books request is made for a short query. The same review found the shared selected-book card's accent border was overridden by its neutral card style; the override was removed and a regression assertion now checks the burgundy border.
- Focused verification after those corrections: `npx.cmd jest src/features/clubs/screens/__tests__/ClubNominateBookScreen.test.tsx --runInBand` **8/8 PASS**; `npx.cmd tsc --noEmit --incremental false` PASS; `npx.cmd expo export --platform web --max-workers 1` PASS. Final `git diff --check` and Phase 9 continuity validator results are recorded in the pre-PR review document. Tests cover successful mutation only through the existing mocked hook; no live nomination was submitted.
- Running-browser verification used the authenticated active-member test club at 1280×720 and 390×844. Search for `Parable of the Sower` returned 10 Google Books results; selecting the first showed `Parable of the Sower` / `Octavia E. Butler`. All 3/7/14-day choices toggled; checked states were exposed in the web accessibility tree. Clear removed the query, results, selected summary, feedback, and duration controls; after re-search and selection, the previously chosen 14 days remained selected. A short query showed its validation error without stale result cards. Blank manual submission showed `Enter a book title before submitting a manual nomination.` and caused no mutation. Back navigation reached `/clubs/{clubId}?tab=nominations`; its Nominate a book action returned to the nomination route. At 390×844 there was no horizontal overflow (390 px scroll width); fixed tabs began at y=795.8. After scrolling, the 48 px selected-book submit action occupied y=340.8–388.8 and the 48 px manual action y=682.2–730.2, both above the tab bar. At 1280×720, tabs began at y=671.8; at the bottom of the scroll area, the selected-book action occupied y=235.2–283.2 and the manual action y=558.6–606.6. Browser console error query returned none.
- This review did not re-audit live authorization policies. No database/Storage mutation, migration, permission change, deployment, or external Stitch/Astra message occurred. Successful server submission remains unverified; native-device and actual assistive-technology checks remain open. Git remains on `feat/clubs-v2`; the screen, shared search component, test, and Clubs documentation are uncommitted. The pre-existing unrelated tracker edits and untracked `clubs-home-390x844-authenticated-dedup.png` remain preserved. Nothing was staged, committed, or pushed.
- Exact next action: user reviews the verified local diff and requests a local commit if accepted. Any commit must isolate these UI/test changes and only this nomination record; `TRACKER.md` also contains earlier unrelated Reading Progress and Members documentation edits. No additional page is authorized in this step.

## Nominate a Book source map and design checkpoint (2026-10-05; historical, superseded by implementation above)
- Mapped the dedicated `/(tabs)/clubs/[clubId]/nominate` route, `ClubNominateBookScreen`, its hooks/services, and existing screen tests. Only active members can use the nomination form. Search starts explicitly or after about 400 ms of inactivity for a trimmed query of at least 3 characters, requests 10 Google Books results, and lets the member select one. The selected-book flow supports 3/7/14-day voting (7 by default), submits through the existing nomination mutation/RPC, shows success, then returns to `/clubs/{clubId}?tab=nominations` after 1.5 seconds. Manual nomination remains a visible fallback for a missing/rate-limited book; title is required, author optional, and it uses the shared votingDays state (initially 7, but changed by the selected-book 3/7/14 presets) without its own duration picker. Clearing search does not reset that state. Both submission paths calculate the deadline at the end of the local calendar day N days later. Existing membership gates, validation, errors, draft behavior, and back fallback are preserved. No implementation is authorized until the visual proposal is reviewed and the user approves it.
- Browser mapping used the authenticated active-member test club at desktop and 390×844. A public Google Books query returned 10 results; selecting `Parable of the Sower` exposed the existing duration choices. A no-match query showed the empty-state copy. Submitting the manual form blank showed title validation. No nomination, other mutation, database/Storage write, or server-side behavior was exercised.
- A new eight-state proposal was requested in the existing Stitch project. Stitch claims all eight were created, but independent canvas inspection found materially inaccurate output: inspected selected frames measured 390×1601 (results), 390×1186 (active/empty), 390×1303 (no matches), and 390×1295 (rate limited), not the requested 390×844. The rendered result concept adds unsupported `Cycle № 14` / `Autumn Salon` / `Dystopian Fiction` copy, a third search result not present in the live query, and “international indices”; the empty concept includes a non-source “2 days before cycle voting starts” sentence, and the no-match concept adds a synthetic result-count-style line and Club Wishlist advice. Stitch's own response also describes an invented prefilled rate-limit example, redirect copy, and both signed-out and active-membership gates together. Do not rely on Stitch's generated summary as proof of frame size or source accuracy. Four other screen contents and their dimensions remain unverified; visible frame labels still say `Generating Screen...`.
- The Astra selector was confirmed as GPT-6 Astra / Light, but the review could not be sent: the composer is disabled by the displayed Codex/Work usage limit (reset shown at 3:10 AM). The Astra conversation still contains a separate unsent Venue Picker critique draft with nine attachments; it was not edited, removed, or sent with this nomination work. No Nominate-a-Book screenshots or critique request were sent, and no Astra verdict exists.
- No app source or tests changed or ran in this checkpoint. No hook, service, RPC, route, permission, schema, migration, database/Storage record, or global theme changed. No staging, commit, push, deployment, or Supabase mutation occurred. The pre-existing dirty tracker content and untracked `clubs-home-390x844-authenticated-dedup.png` remain preserved.
- Follow-up refinement: submitted a correction to Stitch targeting only the latest eight nomination artboards, removing invented rules and correcting shared votingDays semantics. Stitch reported completion, but the visible selected-book frame still measures 390x940; the empty preview appears to expose voting presets without a selected book. This is not accepted as source-faithful. Saved canvas evidence outside the repo as nomination-stitch-review.jpg. Astra Send remains disabled; its existing Venue Picker draft and attachments remain untouched. No nomination implementation or new runtime test was performed.
- Historical next action at this checkpoint: correct and verify the eight Stitch artboards, then request an Astra critique. The user later directed me to critique the proposal myself and proceed, superseding that design-tool/review gate; see the implementation record above.

## Club Venue Picker visual refresh (2026-10-04 to 2026-10-05; independently reviewed, local commit)
- Scope is the separate club-specific route `/(tabs)/clubs/[clubId]/venues`, routed to `ClubVenuePickerScreen`. `returnTo=manage-venues` selects the manager-link mode; otherwise the screen is an event venue selector. Public venue discovery (`/clubs/venues`) and public venue detail (`/clubs/venues/:venueId`) are separate pages.
- Event-selection contract: load only this club's linked event venues, ordered primary first. A card tap immediately returns the selected `preselectedVenueId` to the existing create/edit event editor; create/edit route parameters and the URL-serialized editor draft are carried through. The event is not submitted by selecting a venue. Back fallback preserves editor mode and draft. Legacy return destinations remain supported.
- Manager-link contract: load up to the first 50 approved venues, alphabetically ordered, without search, filters, or pagination. The existing `useAddClubVenueLink` mutation creates a non-primary club-venue link; a duplicate/RLS/network/generic error is mapped inline. The selected row says `Linking...`, other rows are disabled while the mutation is pending, and success replaces the route with Manage Club > Venues. The list does not currently exclude already-linked venues, so a duplicate can reach the existing duplicate-error path. No mutation was submitted for this mapping.
- Source-mapped states and copy: initial loading is a centered spinner; club-load errors use `Unable to load club` plus entitlement/fallback copy; venue-load errors use `Unable to load venues` plus entitlement/fallback copy. Event empty state is `No venues registered` / `This club does not have any linked venues yet. Admins can add venues from the Manage Club screen.` Manager empty state is `No approved venues available` / `Approved venues will appear here when they are ready to link.` Link-write errors stay above the manager list (including `You do not have permission to link venues to this club.`). Global five-tab navigation remains supplied by the app shell.
- Design critique: the local nine-state review mock has a clear split between `Link a venue` and `Select a venue`, a calm ivory/white/burgundy palette, and an information hierarchy that works for the short venue-selection task. I found no material design blocker and proceeded under the user's instruction to make the design decision. I refined the pending manager state so other disabled venues remain readable on a muted surface rather than being washed out. Astra was not consulted for this pass.
- Read-only live authorization evidence was collected only on the verified development project `Bookconnect_reactexpo` (`ahntbtktjjmvfosgkmgn`, `ACTIVE_HEALTHY`). The visible Manage UI allows the club owner or a membership-role `admin`; the live `club_venues` ALL write policy currently checks only `book_clubs.admin_id = auth.uid()`, so a membership-admin who is not the owner can be shown the link flow yet be rejected by the policy. Live policy readback also showed broad table grants including `TRUNCATE` for `anon` and `authenticated` on `club_venues` and `venues`; RLS does not filter PostgreSQL `TRUNCATE`, but no direct API exploitability was tested. The tracked local migration `20251228114444_008_rls_policies_venues_clubs.sql` defines a different membership-role write policy, and no later local venue-policy migration was found; the origin of this live/local discrepancy is unresolved. Treat both points as a separate authorization/security audit before any live link proof or permission change. No link, database/Storage write, migration, policy change, or deployment occurred here; no database-mutation authority is granted by this design task.
- Browser mapping and implementation check used the existing test club without submitting data. Manager mode showed 11 approved test records in alphabetical order (query remains capped at 50); event mode showed two linked records with Primary/Verified markers. At 390×844 both picker modes rendered without horizontal overflow, and manager cards retained address line 2. Selecting a linked venue returned to the event editor with the unsaved title, date, time, description, meeting link, manage return context, and selected venue ID in the existing route flow. No venue link or event save was submitted. The earlier desktop mapping was 1280×720.
- Stitch project inspection confirmed the public venue discovery/detail boards already exist. A separate seven-board Venue Picker brief was submitted with preservation and 390×844 requirements. Stitch's text response claimed creation, but the project canvas showed blank `Generating Screen...` placeholders with a measured 390×1277 selection; after reload, none of the 30 frame contents contained Venue Picker copy. The claimed render/cache status is therefore unverified and is not design approval. A review-only standalone mock was created outside the repository with nine 390×844 captures: event populated, manager populated, manager pending, event empty, manager empty, loading, venue-query error, club-load error, and link-permission error. The first attachment was opened and visually confirmed as the event-mode populated screenshot; the composer contains all nine mapped captures.
- Implemented only presentation and accessibility changes in `ClubVenuePickerScreen.tsx` and additive shared-card props in `VenueCard.tsx`: local Clubs palette, Newsreader/Inter typography, bounded responsive content, 44 px labeled Back control, alert-styled inline link errors, editorial venue/type treatments, descriptive event-selection labels/hints, and accessible busy/disabled/subdued feedback while a manager link is pending. Existing `VenueCard` callers retain their defaults; palettes without `bgSecondary` fall back to their existing card surface. Existing queries, mutations, immediate selection, draft serialization, return routes, venue fields, permissions, and global theme remain unchanged.
- Verification: `ClubVenuePickerScreen`, `VenuesBrowseScreen`, and `VenueDetailScreen` Jest suites passed (3 suites / 22 tests); `npx.cmd tsc --noEmit --incremental false` passed; `npm.cmd run export:web -- --max-workers 1` passed; `git diff --check` passed; Phase 9 continuity validation passed (86 Markdown files / 62 required files, no traceability gaps; existing document-size advisories only). The first parallel export attempt hit host `spawn EPERM`; the single-worker export completed successfully.
- Independent review: the read-only `venue_picker_review` subagent found no actionable issue in event routing/draft preservation, manager-link states, shared `VenueCard` defaults, or accessibility. It made no edits and did not run tests. The unresolved live/local authorization discrepancy remains outside review scope and prevents connected manager-link proof.
- Browser check: the running app rendered manager mode at desktop and 390×844, and event-selection mode at 390×844; the earlier mapping pass inspected both modes at 1280×720. Selecting a linked venue opened the existing Create Event page with the restored draft and selected venue ID. The manager pending visual was reviewed in the local design mock; the connected link action was not submitted. The browser viewport override was reset and the temporary verification tab closed.
- No hook, service, RPC, route, permission, schema, migration, database/Storage record, event, or club-venue link changed. The live/local `club_venues` authorization discrepancy above remains unresolved and blocks connected manager-link write proof. This work is recorded in a scoped local commit; nothing is pushed or deployed. Other pre-existing tracker edits and the unrelated `clubs-home-390x844-authenticated-dedup.png` remain outside that commit.
- Exact next action after the scoped local commit: inventory the remaining Clubs routes against the tracker and recommend the next untouched page. Resolve the separately documented live/local venue-link authorization discrepancy before attempting a real link write.

## Public venue detail refresh (2026-10-04; independently reviewed, local commit approved)
- Source-mapped the public `/(tabs)/clubs/venues/[venueId]` route through `VenueDetailScreen`, `useVenueDetail`, and the read-only approved-venue service query before implementation. Existing fields remain venue type/name, optional description, formatted address, capacity, booking requirement/drop-in label, amenities, and the existing Clubs and events placeholder. Loading remains spinner-only; the existing error title/body are unchanged. The manager venue picker is a separate route.
- Implemented the source-mapped visual pass with warm ivory/white/burgundy surfaces (`#FAF6EE`, `#FFFEFC`, `#8B322C`, `#E7DCD1`), near-black and muted text (`#1A1412`, `#6E645F`), Newsreader headings and Inter body/control text. Added the visible “Club venues” back link and “Venue” page title, compact bounded cards, and clearer metadata/amenity treatments. The error state now includes the proposed 48 px “Back to venues” control, which replaces to the existing `/(tabs)/clubs/venues` route. The populated back control still uses `navigateBackOrFallback` to the existing venues destination.
- No hook, service, request, filter, route, permission, schema, global theme, or business behavior changed. No new data fields or venue actions were introduced. No database/Storage mutation, migration, deployment, or external-data mutation occurred.
- Verification: focused `VenueDetailScreen` Jest suite passed 1 suite / 3 tests, covering populated fields, error-state recovery routing, and the spinner-only loading state. `npx.cmd tsc --noEmit --incremental false` passed; `npm.cmd run export:web -- --max-workers 1` passed.
- Independent review: subagent `venue_detail_review` found no blocking behavior, routing, data-preservation, or accessibility issue. It noted that automated assertions do not directly activate the populated back link or assert spinner visibility; browser navigation exercised the populated back link, and spinner-only presentation was visually inspected. The reviewer made no edits and ran no tests.
- Running-browser checks: the approved test record `ZZ_TEST Central Reading Library` rendered its mapped address, description, capacity, booking label, four amenities, and placeholder. A non-existent ID rendered the expected error; clicking “Back to venues” returned to `/clubs/venues`. Clicking the existing library card opened the detail route, and “Club venues” returned to the list. The available in-app browser viewport was 583×668; a 390×844 device-emulation check and browser-console audit were not available in this pass and are not claimed. No live detail mutation was submitted.
- Astra was not asked for a separate critique in this bounded presentation pass; the user authorized implementation from the source-mapped Stitch direction. The page remains subject to user review.
- Local commit scope: `src/features/venues/screens/VenueDetailScreen.tsx`, `src/features/venues/screens/__tests__/VenueDetailScreen.test.tsx`, and this tracker section only. Pre-existing tracker edits and `clubs-home-390x844-authenticated-dedup.png` remain outside the commit. No database/Storage mutation, migration, deployment, or push is authorized or included.
- Exact next work unit: map the separate manager Club Venue Picker route `/clubs/[clubId]/venues`, including its linked-venue selection, event-editor draft return, Manage Club return, and loading/empty/error states. Then prepare its design for review before any implementation.

## Public venue discovery refresh (2026-10-04; current, implemented locally)
- Authorized work unit: the public `/clubs/venues` presentation refresh. This supersedes the Authors milestone's next-action handoff below. The existing behavior was mapped before design: approved-only venue queries, search by venue/city/address, six type filters, alphabetical results limited to 20 from offset 0, initial loading, empty/error feedback, pull-to-refresh, Back to Clubs, and venue-card navigation. The manager venue picker and venue-detail screen are separate destinations.
- Design approval: the user approved the standalone four-state venues preview at `http://127.0.0.1:8765/venues-design-review.html`. The critique conversation's selected model was visually confirmed as GPT-6 Astra with Light effort; populated, empty, loading, and error screenshots were attached with source-mapped context, and the response was APPROVE. No new design-project or critique message was sent during implementation.
- Completed: applied the approved ivory (`#F7F3EB`), white (`#FFFDFA`), burgundy (`#793E46`), warm-border (`#E8DFD5`), and muted-text palette with Newsreader headings and venue names, Inter controls/body text, compact cards, a labeled Back to Clubs row, and a bounded 760 px desktop column. Filters retain horizontal scrolling with a partially visible next option at phone width and 44 px touch targets. Added explicit search/venue button labels and stronger placeholder contrast. The shared card/badge use an optional editorial variant only on discovery; the default picker/detail visuals remain intact.
- Files: `src/features/venues/screens/VenuesBrowseScreen.tsx`, `src/features/venues/components/VenueCard.tsx`, `src/features/venues/components/VenueTypeBadge.tsx`, and `src/features/venues/screens/__tests__/VenuesBrowseScreen.test.tsx`. Existing hooks, service requests, filter values, routes, refresh callback, page-state copy, permissions, schema, and global time-based theme are unchanged.
- Verification actually run: focused Browse, Detail, service, and manager-picker Jest passed **4 suites / 25 tests**, including the refresh callback/refreshing-state regression. `npx.cmd tsc --noEmit --incremental false` passed, and the final `npm.cmd run export:web -- --max-workers 1` passed. The final Jest run emitted the Node `punycode` deprecation warning; an earlier intermediate run also emitted a VirtualizedList `act(...)` warning, which did not recur in the final run. `git diff --check` and the Phase 9 continuity validator passed; the validator emitted existing document-size advisories only.
- Running-browser verification: inspected the actual app at **390×844** and **1280×720**. Checked all six filters, horizontal filter reach, name/city/address search, unmatched-search empty feedback, query-loading feedback, keyboard filter activation, card activation through its address area, detail return, Back to Clubs, the directory's Find club venues entry, and scrolling to the final venue above the fixed tabs. No captured browser console errors were present. Saved the mobile screenshot outside the repo at `C:/Users/LEGION/.codex/visualizations/2026/09/30/01a0f41a-79cd-73b0-a323-1079b03f96ad/venues-implemented-390x844.jpg`; temporary viewport overrides were restored. The backend error state and native pull-to-refresh binding were verified with mocks; no live backend failure, native-device gesture, or screen-reader audit is claimed.
- Effects and residual risk: no business-data, database/Storage, migration, permission, or deployment changes. Marketplace Phase 9 remains `M62_RUNTIME_ROLLOUT_AND_CONNECTED_PROOF_PENDING`, so DOC-13 and phase routing are unchanged. Existing tracker edits and `clubs-home-390x844-authenticated-dedup.png` are preserved. The user subsequently authorized a scoped local commit and the next page; this commit has no push or deployment.
- Exact next authorized action: map the existing public venue-detail route, screen states, data reads, and back control before proposing its redesign. No venue-detail implementation is authorized yet.

## Author Clubs screen and directory entry (2026-10-04; local commit scope)
- Applied the established warm Clubs palette (`#FAF6EE`, `#FFFEFC`, `#8B322C`, `#E7DCD1`, `#1A1412`, `#6E645F`) and Newsreader/Inter hierarchy to the existing Authors page. Its empty state has a restrained book icon and centered layout; the existing header and cards are more compact and bounded on wide screens. Replaced the results-dependent author spotlight with a prominent “Explore author clubs” button available in All and My scopes, hidden in Archived. No unsupported author claims, extra controls, routes, or card fields were introduced. The previously drafted Stitch request remains unsent; no Astra message was sent.
- Preserved the author-only `useBrowseClubs` filters, loading/empty/error states and copy, pull-to-refresh handler, Back to Clubs fallback, and ClubCard navigation. The directory button retains the existing `/clubs/authors` route. Hooks, services, permissions, backend, schema, and global theme are untouched.
- Verification: focused Directory, Authors route, and Authors screen tests passed 3 suites / 30 tests. TypeScript `npx.cmd tsc --noEmit --incremental false` and `npm.cmd run export:web -- --max-workers 1` passed. The first TypeScript attempt overlapped the export and reported a transient missing generated bundle; the standalone rerun after export passed. `git diff --check` and the Phase 9 continuity validator are recorded in the commit review. In the running app, `/clubs/authors` rendered at 1280×720, Back to Clubs returned to `/clubs`, and Explore author clubs opened `/clubs/authors`. The live test account has no author-club records, so populated cards were checked with mocks. No narrow-width Authors check or browser-console inspection is claimed.
- No business-data, database/Storage, migration, or deployment changes occurred. The scope is committed locally; nothing was pushed. The untracked `clubs-home-390x844-authenticated-dedup.png` and unrelated pre-existing tracker changes are preserved outside the commit. Marketplace Phase 9 remains `M62_RUNTIME_ROLLOUT_AND_CONNECTED_PROOF_PENDING`.
- Exact next work unit: map the public venue discovery route `/clubs/venues`, including current search, type filters, refresh/error/empty/loading states, card navigation, and the separate venue-detail destination. Then prepare its page design through the established Stitch/Astra review path and obtain implementation approval before editing app code.

## Author Clubs route mapping and Stitch proposal (2026-10-04; historical, superseded by implementation above)
- Mapped the existing `/(tabs)/clubs/authors` route to `ClubAuthorsScreen`, `useBrowseClubs`, `getPublicClubs`, and the shared `ClubCard`. The route requests `club_type: author_club`, 50 records from offset 0, newest first. Existing states are initial loading (“Finding author clubs…”), empty (“No author clubs yet” with its current explanatory copy), query error feedback, pull-to-refresh, Back to Clubs with a fallback, and card navigation to the club detail route. Cards may show the existing club/author fields, meeting format, member count, current book, access level, and city. There is no Authors-specific search, filter, pagination, sort action, or create action. Preserve the current directory “Explore author clubs” button and all routes, query/service behavior, permissions, and data contracts.
- Earlier live browser inspection followed that button to `/clubs/authors` and showed the empty state. The page used the dark `midnight` values from the global time-based `useTheme`, unlike the warm palette used by refreshed Clubs screens; the shared `ClubCard` already uses fixed Clubs theme tokens. On 2026-10-04, the local route returned its Expo HTML but the browser stayed blank after bundling. The temporary Expo process has been stopped. Therefore no new live screenshot, current browser-render check, or live behavior verification is claimed.
- The Stitch conversation referenced populated `ba5ecba1e9c846e184cdadfb34850cf3` and empty `f26cfbe664324e2c9362dd8ff5337ab1` concepts. The first draft had unsupported credentials, salon claims, and an extra modal/action; a later response removed those and restored source-mapped labels and exact empty-state copy. However, current project accessibility inspection did not surface Authors artboards, and direct previews for these IDs rendered blank. Prior measured bounds were 390×964 and 390×255, not the requested 390×844. Stitch stated it cannot directly set native canvas node bounds through its editing tool; manual resize in the canvas UI remains unverified. Do not treat its 390×844 prose claims as proof.
- GPT-6 Astra with Light effort was visually confirmed in the named critique conversation, but no Authors critique prompt or screenshots have been sent and there is no Astra verdict. The IAB connection is available again, but canvas selection/panning did not bring the referenced Author frames into view. A source-mapped four-state design brief is drafted in the Stitch composer and awaits the user’s action-time confirmation before submission. Nothing in the repository was staged or committed, and no database/Storage action occurred.
- This proposal checkpoint was superseded by the user’s later direction to implement the simple Authors page directly. The brief remains unsent, and no Astra review was requested. The implementation and its verification are recorded above; the directory CTA remains intact.

## Clubs directory Author Clubs entry (2026-10-04; implemented locally)
- The running `/clubs` page initially showed three active test clubs and the Archived clubs footer, but no Author clubs spotlight. The existing spotlight required at least one author-club result, no selected club-type filter, and the All clubs scope; the seeded list had no author-club result. The destination `/clubs/authors` currently shows its designed empty state, “No author clubs yet.”
- Added a full-width burgundy “Explore author clubs” button below venue discovery and above the directory scope tabs. It remains available in All clubs and My clubs even when results or filters contain no author club; Archived hides this discovery action. It uses the same existing `/clubs/authors` route. Removed the old conditional footer spotlight so the destination has one clear entry point. No query, service, authorization, backend, schema, or permission change.
- Verification: directory Jest suite 26/26 passed; TypeScript `--noEmit --incremental false` passed; `git diff --check` exited 0 (Git printed its Windows LF/CRLF normalization notices only). In the running browser, the new button was visible in the first viewport, opened `/clubs/authors`, and Back to Clubs returned to `/clubs`. No console errors were returned. No business-data mutation occurred.
- No database/Storage mutation, migration, staging, commit, push, or deployment. Existing tracker work and `clubs-home-390x844-authenticated-dedup.png` remain preserved. This directory entry-point change was browser-checked again during the Authors implementation above and remains intact.

## Reading Progress refinements (2026-10-04; implemented locally)
- Applied the current mobile Stitch direction to `ClubReadingProgressScreen`: warm ivory/burgundy palette consistent with other refreshed Clubs pages, Newsreader headings, Inter body and controls, smaller book cover/card, a two-by-two metric grid below 600 px and four metrics across on desktop, and tighter card/timeline spacing. Status labels remain fully visible. The status controls, back action and milestone actions have 44 px minimum targets; the scroll content reserves 96 px below its final content for bottom-navigation clearance.
- The user authorized proceeding with these refinements. This pass used the assistant's direct visual critique; it did not obtain or claim a separate Astra response. The source-mapped Stitch mobile concept is `e229610f668a41b2ad7dbcba4c4ab7d9`.
- Independent review: subagent `review_reading_progress_commit` found no behavior regression and flagged missing automated coverage for the 600 px layout breakpoint (P3). The 390 px/1280 px responsive regression was added; the reviewer reran the focused suite (7/7 passed) and confirmed the finding closed with no further finding.
- Presentation-only implementation: club/status/schedule query hooks, authorization, handlers, status values, milestone payloads, mutation hooks, error states and route are unchanged. No backend, schema, permission, migration, dependency or global theme change.
- Running-app check: authenticated Reading Progress route rendered at 390×844 and 1280×900. At 390 px all labels fit, the four metric cards form two rows, each status and milestone action is 44 px high, and document width remains 390 px. At 1280 px metrics form one row and controls remain 44 px high. No browser console errors were observed. No status or milestone mutation was submitted during this visual check.
- Verification: Reading Progress screen tests pass (7/7), including the 390 px and 1280 px metric-layout breakpoint regression; TypeScript `--noEmit --incremental false` passes, Expo web export passes, `git diff --check` passes, and the Phase 9 continuity validator passes (86 Markdown files / 62 required; no continuity errors; existing document-size advisories only).
- No database/Storage mutation, migration, or deployment. This screen, its regression test and the scoped documentation are being committed locally; no push is part of this action. Pre-existing tracker edits and the untracked `clubs-home-390x844-authenticated-dedup.png` are preserved outside the commit. Marketplace remains at Phase 9 M62 runtime rollout/connected proof pending; no global phase handoff changed.
- Exact next authorized action: wait for the user to select the next Clubs page or request additional Reading Progress changes; no further page implementation is authorized by this task.

## Members and applications implementation (2026-10-03; complete locally)
- Final design review: GPT-6 Astra / Light was visibly selected. Four current screenshots (Members, Timed Mute, corrected Applications list, standalone Application Review) were attached after the earlier link-only review. Astra returned APPROVE. The Applications editor screenshot supports composition review only; its small text was not individually verified by Astra. References: Krug's Don't Make Me Think and WCAG 2.2 Target Size (Enhanced). The user subsequently explicitly authorized implementation here after the read-only OpenCode assessment; OpenCode was not used to implement.
- Implemented the approved layout in ClubManageMembersSection, ClubManageApplicationsSection and ClubApplicationsScreen, plus the shared ManageTabBar styling. Warm ivory/white/burgundy, Newsreader headings, Inter text, bounded desktop content, compact cards, 44 px controls and matching rectangular management tabs. Members uses one Manage disclosure at a time (first reader initially open), separates role/status, moderation, removal and recent history, preserves drafts across disclosure changes, and hides immediate Mute while a timed-mute draft is open. Unmute remains available for an already-muted reader. The review route separates applicant identity, answers and optional decline reason/actions.
- Source comparison verified the original query/mutation-handler prefixes are unchanged after accounting for the new presentation state and local palette. Existing authorization, callbacks, payloads, ordering, failures, feedback and confirmations remain. No hook, service, route, permission, backend, schema, migration, dependency or global-theme changes. Source clarification: Warn/Timed mute/Ban require reasons; Remove retains its existing exact confirmation and has no reason field. Numeric durations require whole hours >=1; the pre-existing blank-duration-to-null handling is preserved, not silently tightened.
- Browser: Members rendered at desktop and 390×844; Manage disclosure switching, timed-mute default 24, draft preservation, Cancel restoration, empty-reason and zero-duration rejection, keyboard focus and scroll clearance for draft/actions/second member were checked without submitting a valid moderation mutation. Checked controls measured >=44 px high and >=44 px wide; no horizontal overflow. Public-club and approval-club non-manager review notices rendered in the new palette; Go back navigation worked. No browser error log entries were observed in the inspected tab. The checked live members have no moderation records, so three-record layout/scroll clearance is not live-proven. History count is covered by mocked regression.
- Application list and full standalone review form remain unavailable to the supplied account: it manages only the public club, and the user previously confirmed no other eligible manager test session. Successful Approve/Decline and moderation writes were not performed. Mocked tests cover existing confirmation semantics, direct review/optional decline reason, fallback answers/location, pending controls, timed mute payload/validation, latest three records and existing management workflows. Native keyboard/device, screen reader, enlarged text and full application-form responsive checks remain unrun.
- Independent review: read-only scoped sub-agent review found no blocking behavior regression, then identified an Admin membership no-op control edge and a role-change stale-draft edge. Both were closed: all role/mute/moderation/remove controls are disabled with an explanatory message for Admin rows; an already-open moderation draft is hidden, and submission now rejects an Admin row. Reviewer confirmed both findings closed with no remaining finding.
- Verification: final focused Jest 4 suites/61 tests PASS; Final TypeScript --noEmit --incremental false, Expo web export with one worker, git diff --check and Phase 9 continuity validator PASS (86 Markdown files/62 required files; existing document-size advisories). An initial new confirmation test emitted act warnings; it was corrected with async act and the final run emitted only the existing Node DEP0040 warning. An initial TypeScript run found an optional profile spread in the new fixture; the fixture was corrected before the final check.
- Screenshots in C:/Users/LEGION/.codex/visualizations/2026/09/30/01a0f41a-79cd-73b0-a323-1079b03f96ad/: members-mobile.jpg, members-timed-mute-mobile.jpg, members-desktop.jpg, applications-public-guard-mobile.jpg and applications-manager-guard-mobile.jpg. Temporary viewport override restored; temporary design inspection tab closed. Temporary web export output removed after verification.
- No database/Storage/business-data mutations, migration, deployment or push. The reviewed screen/test changes and this implementation record are authorized for a local commit. Earlier tracker additions and the untracked clubs-home-390x844-authenticated-dedup.png are preserved outside that commit. Marketplace Phase 9 remains M62_RUNTIME_ROLLOUT_AND_CONNECTED_PROOF_PENDING; no global handoff changed.
- Active work unit: Members and applications presentation refresh implemented with the verification limits above. Exact next authorized action after local commit: map the existing Club Reading Progress page and its behavior before proposing its redesign; an eligible approval-club manager session is still needed for the deferred live application-form/action checks.

## Invitation inbox and Invite Readers implementation (2026-10-03; complete locally, uncommitted)
- The user authorized reapplying the Invitations Inbox and Invite Readers refresh after confirming their undo was complete. Before editing, Git was inspected and existing dirty work was preserved. A source comparison against HEAD confirmed both screens' auth, query, state, and mutation-handler blocks were unchanged by this implementation.
- Restyled only the Inbox and Invite Readers screen presentation and their screen tests. Both use the Clubs ivory/burgundy/white palette, Newsreader headings, Inter body/control type, compact spacing, clear hierarchy, and accessible action sizing. The Inbox retains its existing pull-to-refresh and adds a visible refresh control wired to the same refetch; pending count, card actions, invitation history/status, inviter/book/context, and fixed tabs remain represented. Invite Readers retains the existing manager gate, username plus optional note submission, feedback, draft-clearing-on-success, refetch, and invitation history. No revoke, read, accept, or send behavior was added or changed.
- Backend and behavior boundary: no hook, service, route, RPC, schema, RLS/permission, migration, or dependency changes. No database/Storage writes or external mutations occurred. No invitation was sent, accepted, revoked, or marked read.
- Verification after final screen changes: focused screen/hook/service regression run passed 5 suites / 114 tests; TypeScript --noEmit --incremental false passed sequentially after web export; Expo web export passed; git diff --check passed. The existing Node DEP0040 punycode deprecation warning appeared during tests.
- Browser checks covered the Inbox at desktop and 390×844, visible and keyboard-operated refresh, settings/back navigation, the public-club invite guard, and the invite-only manager-access guard. The tested account has access only to a public club; the user confirmed no eligible manager test login or club is available. Therefore the Invite Readers form and live send flow could not be checked in an authenticated browser session; mocked screen/service tests cover the form and mutation states. No successful live invite or backend write is claimed. Checked viewports showed no horizontal overflow and visible controls met 44 px minimum sizing.
- Screenshots: C:/Users/LEGION/.codex/visualizations/2026/09/30/01a0f41a-79cd-73b0-a323-1079b03f96ad/invitations-inbox-desktop.jpg, invitations-inbox-mobile.jpg, invite-readers-public-guard-mobile.jpg, invite-readers-access-guard-mobile.jpg, and invite-readers-access-guard-desktop.jpg.
- Marketplace Phase 9 status remains unchanged at M62_RUNTIME_ROLLOUT_AND_CONNECTED_PROOF_PENDING; this Clubs-only change makes no claim about its deployment or connected proof.
- Files changed for this task: the two screen files, their two screen test files, and this tracker. The pre-existing untracked clubs-home-390x844-authenticated-dedup.png and prior tracker edits were preserved. Nothing was staged, committed, pushed, or deployed.
- Exact next action: user review of the uncommitted Inbox and Invite Readers refresh. A live form/send-flow browser check remains contingent on an eligible manager test session; no such session is currently available.

## Invitation inbox and Invite Readers design checkpoint (2026-10-03; historical)
- Mapped the existing `/clubs/invitations` and `/clubs/[clubId]/invite` screens,
  routes, UI state, mutation hooks/services, manage-page revoke overlap, and
  invitation RPC/RLS boundaries before design. Existing actions, ordering,
  history statuses, fields, and manager boundary are the design contract.
- Added two invitation visual-refresh concepts in the existing Stitch project.
  After source checks, the inbox’s premature “Invitation accepted” toast and
  unsupported pending-card category labels were removed; pending actions are
  labeled View club and Accept. Invite Readers now uses single-line Username
  and optional Note fields and shows reader identity plus current status. No
  revoke action, invented note limit, delivery promise, or extra history date
  is proposed. The screens remain proposals, not app implementation.
- Verified Stitch’s accessible screen trees after correction. The selected
  inbox frame reports 390 × 884 px and Invite Readers reports 390 × 774 px;
  Stitch’s generated summary claimed 390 × 844 px for both, which is not
  supported by the measured canvas sizes. Keep this mismatch explicit in
  review. The concept uses the requested ivory/burgundy/white palette and
  Newsreader/Inter direction. Do not treat generator summaries as pixel proof.
- Astra: the invitation critique and initial screenshot were sent in the
  specified conversation after confirming GPT-6 Astra with Light effort. Astra
  returned NEEDS REFINEMENT twice: consolidate the pending count, use the
  intended 390 × 844 inbox frame, and inspect lower-scroll actions/history;
  it confirmed the optional book and note are supported after source
  clarification, and found no material Invite Readers blocker. Stitch was
  refined to one pending count, a compact reminder notice, and a lower Inbox
  view using the exact second-invitation and history records. The latest canvas
  visibly shows all three history rows and View club actions above the fixed
  tabs, but the selected lower frame still measures 390 × 884; Stitch's summary
  claiming 390 × 844 is not measurement evidence. No final Astra critique of
  the latest canvas has been sent. At this design checkpoint, the next step was
  to resolve or explicitly accept the frame-size discrepancy and request final
  Astra review before app approval; the user later explicitly authorized
  implementation. No final Astra critique of the implementation is claimed.
- Scope/effects: the Stitch project now contains the two visual concepts and
  corrections described above. No application source or tests changed; no
  invitation was sent, accepted, or revoked; no database rows, migrations,
  permissions, or services changed. Supabase review remained read-only.
  Nothing was staged, committed, pushed, or deployed. The existing untracked
  `clubs-home-390x844-authenticated-dedup.png` remains untouched.

## Create Club main publication (2026-10-03; current)
- User explicitly requested direct main publication after independent review. The original Create Club banner behavior was checked again: it accepts an optional cover URL; PRODUCT-14 prohibits file upload until the club exists, and Manage Club Settings retains upload. No upload option was removed by this redesign.
- Full local pre-publication Jest passed 315 suites / 2,752 tests, with the existing 1 suite / 4 test skips (316 / 2,756 total), normal exit 0 in 374.371 seconds. Final source TypeScript, web export, focused screen/general mutation 41/41, targeted creation/limit service 2/2 and desktop/mobile browser checks were completed before publication. Exact coverage limits remain below; no live club was created and no native/screen-reader proof is claimed.
- Independent subagent `review_create_club` cleared the production/test diff. Its two minor documentation findings (stale next action and ambiguous mocked/connected wording) were corrected and independently approved. Exactly four authorized paths were staged and committed as `bfb2b86ab165aa3ef2343f71441551a710a10f2f` (`feat(clubs): redesign create club form`): Create screen, its tests, tracker and pre-PR review record. The unrelated Home screenshot was preserved.
- Final fetch kept remote main at `fd30911`; ancestry was verified and normal dry run passed. Normal push advanced remote main from `fd30911` to `bfb2b86`; `ls-remote` returned the exact committed SHA and the local remote ref is 0 behind / 0 ahead. No PR, force push, protection bypass, local-main change, external runtime deployment, database/Storage mutation or migration occurred. Marketplace Phase 9/rollout authority remains unchanged.
- [GitHub Actions run 37054264088](https://github.com/mdasheef99/Bookapp_reactexpo/actions/runs/37054264088) targets the exact published source SHA. The completed run is successful: clean Ubuntu/Node 22 locked dependency install, full repository Jest, TypeScript, production web export and cleanup all pass. This is remote CI evidence, distinct from the local Windows results; job steps were read, not the full downloadable test log. This subsequent closeout changes only the two Clubs documents. Exact next authorized action: independently review and commit/publish this documentation closeout, verify its remote SHA/CI, then return Clubs page selection to the user.

## Create Club implementation (2026-10-03)
- The user approved implementing Create Club with its existing functionality preserved. The earlier design requirement was mapped against `ClubCreateScreen.tsx`, `useCreateClub`, the creation service, eligibility/limit checks and read-only live authorization evidence before design. One continuous form retains required trimmed name (minimum 3 characters), optional description/HTTP(S) cover URL/member cap (integer at least 2; blank unlimited), Public/Approval/Invite-only type, verified-author-only Author Club, All/Pro/Pro+ access and optional Online/Venue/Hybrid meeting type. Defaults remain Public, All members and Not set. No pre-creation banner upload is introduced; banners remain managed after creation.
- Stitch references: [upper form](https://stitch.withgoogle.com/preview/12334872055044206539?node-id=78a6bead0f4544e48d674f1a26c954cc) and [lower form](https://stitch.withgoogle.com/preview/12334872055044206539?node-id=30a24b635f8b4346a69bb968bd33e994). They represent scroll views of one page. Generated extras were removed and the palette corrected to exact warm ivory `#FAF6EE`, burgundy `#8B322C`, white `#FFFEFC`, border `#E7DCD1` and muted `#6E645F`. After correction, Stitch's preview capture became blank while its styled DOM remained present; this was a design-preview limitation, not a verified visual app result.
- Astra review is incomplete: GPT-6 Astra / Light was confirmed in the user's critique conversation before sending the complete behavior/philosophy brief and four baseline/design screenshots. The session reached its five-hour usage limit before producing a substantive critique or verdict. The earlier unsent Events draft was preserved and restored. No Astra approval is claimed. The user subsequently explicitly authorized this implementation.
- Restyled only `ClubCreateScreen.tsx`: established ivory/burgundy palette, Newsreader headings, Inter fields/body, 760 px content limit, required/optional guidance, full-width club-type choices, three-column access choices and two-column meeting choices. Choice checkmarks and selected accessible labels identify selection without relying on color. Back/choice targets are at least 44 px; submit is 48 px. Existing fields, test IDs, validation, profile loading/author gate, payload, query/mutation flow, pending/sign-in disabling, success/error handling, banner URL preview, keyboard scroll behavior and navigation remain intact. No hook/service, route, permission, schema, migration or dependency change.
- Fresh verification after the final production edit: Create screen and existing mutation suites pass **2 suites / 41 tests** (15 screen, 26 mutation); TypeScript `--noEmit --incremental false` and final Expo web export with one worker pass. New regressions cover defaults, trimming, cap/name/URL validation, selection payloads, cover-preview show/clear, verified Author identity, signed-out/pending submission, mutation errors/draft retention and section-specific Back navigation regardless of prior tab history. Initial new-test failures were unsupported matcher and history-expectation errors; those assertions were corrected to the actual shared navigation contract without modifying production behavior. Existing dependency/CSS/Browserslist warnings remain; the export recovered from a stale cache by a full crawl, and the final cached export passed.
- Running-browser verification passed at default width, measured 1280x720 and 390x844: directory Create entry, Back to directory, all ten selectable non-author choices, keyboard Enter selection and Tab focus, multiline draft, cover-preview show/clear, blank/short-name, invalid/fractional-cap and invalid-URL validation, draft retention through selections, submit clearance above the existing five-tab navigation and no horizontal page overflow. Measured choice heights are 44 px except the mobile access row (about 60 px to accommodate the wrapped All members label); Back is 44 px and submit 48 px. No browser error entries observed. Temporary drafts were discarded; viewport override reset; the clean Create route remains open. No valid live creation was submitted. Creation success/errors and verified-author UI were covered by mocks/source preservation; connected creation and live server denial remain unverified. Native devices, native keyboard and screen-reader behavior remain unverified.
- Screenshots: `C:/Users/LEGION/.codex/visualizations/2026/09/30/01a0f41a-79cd-73b0-a323-1079b03f96ad/create-club-desktop.jpg`, `create-club-mobile.jpg`, `create-club-mobile-lower.jpg` and `create-club-validation-mobile.jpg`. The identified Clubs Expo process on 8081 was restarted to replace a stale bundle. The first restart could not spawn an external browser under the sandbox; restarting with browser auto-open disabled succeeded. No other worktree's server was stopped.
- Refreshed `origin/main` is `fd30911`, matching this branch's committed HEAD (0 behind / 0 ahead). Screen, tests and this tracker remain uncommitted; unrelated untracked `clubs-home-390x844-authenticated-dedup.png` is preserved. Nothing staged, committed, pushed or externally deployed; no database/Storage mutation or migration. Marketplace Phase 9 remains `M62_RUNTIME_ROLLOUT_AND_CONNECTED_PROOF_PENDING`, with its separate rollout authority unchanged. Phase 9 continuity validator and `git diff --check` pass with existing document-size advisories. Active work unit: Create Club visual implementation complete with bounded web/mocked verification. The user subsequently authorized direct main publication. Full repository pre-publication Jest subsequently passed 315 suites / 2,752 tests, with the existing 1 suite / 4 test skips (316 suites / 2,756 total), normal exit 0 in 374.371 seconds. The local run used dummy/offline workflow configuration and installed Windows dependencies; clean Linux CI remains pending publication. Exact next action: inspect and commit the independently reviewed four-file scope, refresh main, normally push and verify CI. No force push, protection bypass or runtime/database rollout is authorized.

### Independent Create Club review (2026-10-03)
- User explicitly requested a subagent review. `review_create_club` independently inspected the uncommitted screen/test/tracker diff, route font provider, creation service and existing flow. Verdict: **no actionable findings**. The form state, profile/verified-author gate, validation and submission/error-handling block remains text-identical to HEAD. The reviewer inspected the saved desktop/mobile screenshots and found no visible clipping or overlapping controls; it did not independently repeat browser interaction or web export.
- Independent checks passed: Create screen plus general mutation suites **41/41**; targeted `clubsService.test.ts` cases matching `creates a club through the transactional rpc|checks membership limits through the edge function` **2/2**, with 49 other service cases intentionally filtered; TypeScript `--noEmit --incremental false`; and `git diff --check`. The 26 general mutation cases are broader regression coverage and do **not** directly exercise `useCreateClub`. Screen success/error and transactional creation/Edge limit checks use mocks. Connected creation/live denial, verified-author browser flow, native keyboard/enlarged text and screen readers remain unverified. No new live proof or Astra verdict is claimed.
- Reviewer edited no files and performed no business-data mutation, staging, commit or push. This parent update records the result only; screen/tests/tracker remain uncommitted and the unrelated Home screenshot is preserved. Active work unit is reviewed Create Club publication; exact next action is the authorized full-suite/staged-scope gate, commit, normal main push and CI verification. Independent source review is complete for this diff; both minor documentation handoff findings were corrected and approved on follow-up. Refresh main compatibility immediately before publication.

## Direct main publication and CI (2026-10-02)
- User explicitly authorized adding missing automated app checks and directly pushing the independently reviewed Clubs history to remote main. This supersedes earlier PR-only sequencing and the next-action/no-push wording in the historical checkpoints below. No force push, branch-protection bypass, database/Storage mutation, migration or runtime deployment is authorized.
- Pre-publication `origin/main` was `7cab645667bd5cdf4756f42cab0248cf8c139ad5`, an ancestor of `6fa062f` (0 behind / 9 ahead before CI), unchanged on the final refresh. Normal push dry run passed; GitHub API confirmed push permission and unprotected main. Local stale main and the unrelated untracked Home screenshot are preserved.
- Added `.github/workflows/clubs-app-validation.yml` for main/feature pushes, main PRs and manual runs: locked install, full Jest, TypeScript and Expo web export on Ubuntu/Node 22. Actions are pinned, repository token is read-only, checkout credentials are not persisted, and build configuration is dummy/offline with auth bypass disabled. No live database or deployment command is included. YAML and trigger/permission/command assertions pass locally.
- Independent subagent `review_clubs_ci` found no actionable blocker in the workflow/final handoff. Fresh exact workflow-environment local checks pass: full Jest 315 suites / 2,740 tests, with 1 suite / 4 tests skipped (316 / 2,744 total), normal exit 0; TypeScript; production web export; YAML/trigger/permission/revision/command assertions; Phase 9 continuity validator and whitespace checks. Existing warnings/advisories remain. These local checks use installed Windows dependencies; separate clean Linux evidence follows. Details and enduring coverage limits are in [PRE-PR-REVIEW.md](./PRE-PR-REVIEW.md). Marketplace Phase 9 remains `M62_RUNTIME_ROLLOUT_AND_CONNECTED_PROOF_PENDING`; its rollout authority is unchanged.
- CI committed as `a70dd7c` (`ci(clubs): validate shared app on main and pull requests`), with exactly the workflow and two Clubs documents staged. Normal push advanced remote main from `7cab645` to `a70dd7c8f21ee405111ae2ca5f5a100a73aa92f4`, publishing all 10 reviewed commits. GitHub branch API and local remote ref match, 0 behind / 0 ahead. No PR, force push, protection bypass, database/Storage operation, migration or manual service deployment occurred.
- Remote [Actions run 37022023576](https://github.com/mdasheef99/Bookapp_reactexpo/actions/runs/37022023576) completed successfully for the exact pushed main SHA: clean Ubuntu 24.04 / Node 22.23.3 locked dependency install, full Jest, TypeScript, production web export and cleanup all pass. Downloaded job log confirms 315 suites / 2,740 tests pass and the same existing 1 suite / 4 test skips; web export finished. Native, accessibility and connected-role coverage gaps remain, as documented in the review record.
- Active work unit: reviewed Clubs source history published and CI verified. This closeout changes only the two Clubs handoff documents. Exact next authorized action: independently review, commit and normally publish the documentation closeout, verify its remote SHA/CI, then return page selection to the user. Refresh remote main before further implementation. The unrelated untracked Home screenshot is preserved.

## Local pre-PR commit review (2026-10-02)
- User authorized committing the Manage palette and completing independent review, local main compatibility checks, fixes, and verification for every local Clubs commit before PR creation. This is the review gate because the user does not review PRs.
- Manage palette committed as `ea54406` (`feat(clubs): align manage page palette`), after independent review and fresh Manage/Settings 2-suite / 47-test PASS. This supersedes the uncommitted/next-action wording in the historical palette entries below.
- Refreshed `origin/main` remains `7cab645667bd5cdf4756f42cab0248cf8c139ad5`, including the final refresh; it is an ancestor of this branch. No main-side changes need integration and no conflicts exist at this checkpoint. Local `main` at `15243d8` is 53 commits behind with one separate library-documentation commit; preserved, not used as the baseline and not given duplicate Clubs commits.
- Each of the eight pre-existing local commits received independent source review, plus historical focused checks at their exact revisions. Details and the process required for every future commit are in [PRE-PR-REVIEW.md](./PRE-PR-REVIEW.md). Three reviewers cleared all scoped corrections after follow-up review. Earlier commits remain intact; this subsequent correction commit fixes the historical thread-test failures.
- Corrections: font pending/error handling; readable 44 px Authors/Venues Back controls; member-visible leave/admin-transfer feedback; thread metadata/editor placeholder contrast; expected web-picker activation error handling; event update omission preserves capacity while explicit null/number still updates it; realistic typed vote fixtures and actual per-viewer invalidation/isolation assertions. Hooks, schema and permission policies were not changed by these corrections. Newly strengthened regressions reproduced their defects before correction.
- Fresh final verification: full Jest 315 suites / 2,740 tests PASS, with 1 suite / 4 tests skipped (316 / 2,744 total), normal exit 0; TypeScript PASS; production Expo web export with one worker PASS. Earlier intermittent Venues/Events/Editor default-timeout failures during concurrent historical checks passed on focused reruns; no timeout was raised. The original three vote failures now pass with 29/29 focused mutation/optimism tests. Existing warnings remain.
- Fresh running-browser checks cover directory/My Clubs, Authors/Venues Back and Authors keyboard Enter, Home leave-dialog Cancel, discussion listing/thread Back, inline draft/quote/target switching and blank guard, anchored topic emoji popup/Escape, Events Create/Edit navigation, blank-title validation, Edit prefill and retained date/time drafts across formats, all ten available Manage tabs, and Marketplace empty cart/request navigation with five primary tabs. Measured 390x844/1280x720 page widths had no observed horizontal overflow in the checked views. The known Clubs server was restarted after an initial stalled reload; latest bundle rendered. No browser error entries observed. Drafts discarded and viewport restored; screenshots/logs are linked in the review record.
- Supabase project identity, nullable capacity column, UPDATE policies and role helper definitions were verified read-only on `ahntbtktjjmvfosgkmgn` (`Bookconnect_reactexpo`). Aggregate: 3 admin memberships, 0 differing from the authoritative club admin id. No database/Storage mutation, migration, deployment, or manually submitted app business mutation occurred in this review. No push or PR was performed. Marketplace Phase 9 remains `M62_RUNTIME_ROLLOUT_AND_CONNECTED_PROOF_PENDING`; its source/trackers/rollout authority are unchanged.
- Native devices, screen readers/enlarged text, conditional Applications/Invitations live tabs, and the connected role/tier denial/rollback matrix remain unverified; the existing event admin-role drift edge is documented, with no current drift found by the aggregate. The existing Manage metadata replacement-character separator is a cosmetic follow-up. Comment deletion remains deferred. Old handoff collapse/expand claims are unsupported by reviewed source and are not verification evidence.
- Active work unit: per-commit local pre-PR review and bounded corrections completed in this commit (`fix(clubs): address pre-PR review findings`). Exact next authorized action: prepare a role-by-role connected event verification matrix against the verified live policies, identifying the required test accounts before any PR request; native/accessibility proof remains a separate coverage gap. Refresh `origin/main` and rerun affected integration checks if it changes. The unrelated untracked Home screenshot is preserved.
- Close checks: Phase 9 continuity validator and `git diff --check` PASS, with existing document-size and LF/CRLF advisories. The staged set is restricted to the reviewed correction/test/Clubs-documentation paths. This tracker remains a cohesive chronological evidence log above 500 lines; current handoff is at the top, and the stable future commit-review process has its own linked document. No historical evidence was pruned for line count.

## Manage Club palette refresh (2026-10-02)
- User explicitly approved a palette-only refresh after asking whether the complex management page could retain its behavior. Inspected the live page, shared screen, tab visibility/handlers, section color usage, existing tests, and React Native Web Switch source before implementation. No layout redesign was proposed or implemented.
- Added typed `manage/managePalette.ts` and routed `ClubManageScreen`, `ManageTabBar`, and their Manage-only section components to it. Venues continues receiving the same color object through its existing prop. Warm ivory background, white cards, burgundy controls, neutral supporting text/borders, and separate red danger/error colors now match the Clubs V2 pages. Global `useTheme` is unchanged. Layout, spacing, typography, labels, queries, mutations/payloads, permission gates, confirmations, drafts, validation, disabled/pending guards, and routing are unchanged.
- Question switches have matching on/off tracks and white thumbs; the web-only `activeThumbColor` prop handles the installed React Native Web implementation's separate active-thumb color without passing that prop on native platforms. Lifecycle separators use the neutral border color and its existing admin warning uses a pale red surface. These are visual props only.
- Verification: existing Manage/Settings Jest suites passed 2 suites / 47 tests. After the final switch/Lifecycle color corrections, the affected Manage suite passed 42/42 again. Final TypeScript (`tsc --noEmit --incremental false`) and Expo web export with one worker passed. No new tests were added. Jest emitted the existing dependency `DEP0040` warning.
- Browser checked all ten tabs available to the seeded public-club admin (Current Book, Schedule, Analytics, Events, Venues, Reports, Members, Settings, Join Questions, Lifecycle) at normal 1280×720 and measured 390×844 widths; no horizontal overflow was observed. Verified blank-name validation and the disabled Save state (`aria-disabled=true`, pointer events blocked), Reset, question draft/Add guard and Required/Optional switch round-trip, member warning draft/Cancel, short-query override validation/Cancel, Create/Edit navigation and Back to Manage Events, and Add venue/Back to Manage Venues. No browser error log entries were observed. Temporary drafts were discarded and the viewport override was reset.
- Applications/Invitations are conditional tabs absent from this public club; their shared palette is covered by source inspection and the existing mocked management tests, not live-tab verification. Native device, screen-reader, upload, destructive management, report resolution, settings-save, schedule-save, and invitation/application live mutations were not exercised. No database/Storage writes, migration, provider search, or other business-data mutation was performed.
- Evidence: `C:/Users/LEGION/.codex/visualizations/2026/09/30/01a0f41a-79cd-73b0-a323-1079b03f96ad/manage-*.jpg`, including `manage-current-book-desktop.jpg`, `manage-current-book-mobile.jpg`, `manage-settings-mobile-lower.jpg`, `manage-join-questions-mobile.jpg`, `manage-lifecycle-mobile.jpg`, and `manage-override-validation-mobile.jpg`.
- Screen/section/palette/tracker changes remain uncommitted; nothing was staged, committed, pushed, or deployed in this task. The unrelated Home screenshot is preserved. Marketplace Phase 9 status and its existing rollout gates are unchanged. Phase 9 continuity validator and `git diff --check` PASS with existing document-size advisories. Active work unit: Manage Club palette refresh completed. Exact next action: user review of the implemented palette; commit on explicit request.

- Re-verification (2026-10-02): full repository `npm.cmd test -- --runInBand` completed with 312 suites passed, 1 skipped, and 1 failed (314 total); 2,723 tests passed, 4 skipped, and 3 failed (2,730 total). The only failing suite is `src/features/clubs/hooks/__tests__/useClubs.mutations.test.tsx`. A focused rerun reproduced 23 passing / 3 failing tests: one assertion expects explicit invalidation of the user-specific discussion-topic cache key, and two reply-vote tests throw because their seeded cache fixture has no `replies` array before the optimistic hook calls `.find`. This failure is outside the Manage palette components; it remains an unresolved Clubs discussion-vote follow-up. The ClubManageScreen, settings section, discussion screens, event editor, and optimistic-vote screen suites passed in the full run. TypeScript (`tsc --noEmit --incremental false`) and production Expo web export with one Metro worker passed. The Expo web server now serves the Manage route at localhost:8081; the browser rendered and navigated all ten available management tabs without saving or mutating live data. Initial Metro startup required offline mode and one worker because child-process worker startup returned `spawn EPERM`; the one-worker bundle completed. No backend writes, migrations, deployment, staging, commit, or push occurred. `git diff --check` had no whitespace errors; Git reported existing LF-to-CRLF working-copy warnings.
- Updated next action: user review of the Manage palette and decision on whether to resolve the three reproducible discussion-vote test failures before any commit. The palette implementation and unrelated Home screenshot remain uncommitted/preserved; marketplace Phase 9 status is unchanged.

## Create/Edit event visual refinement (2026-10-02)
- User explicitly requested palette and beautification of both forms after Stitch rendering problems. This authorizes bounded visual implementation of the shared editor using the established Clubs V2 styling; no model-confirmed Astra verdict was received. The earlier design-only checkpoint below is superseded for this bounded scope.
- Restyled `ClubEventEditorScreen.tsx` with warm ivory, white surfaces, burgundy controls, Newsreader heading and Inter fields/body. Added club context, a clearer Create/Edit introduction, a 760 px desktop content limit, compact borders/radii, a single mobile row for the three format choices, a selected checkmark, explicit button selection states, 44 px Back/Clear/action targets, and a visible web picker focus outline.
- Existing effects, drafts, picker handlers, title/start/end/link/location validation, format-dependent fields, permission gates, venue navigation/query serialization, mutation payloads, pending/error handling and exit routing are unchanged. No hook, service, schema, migration, permission or dependency changes. Existing capacity-clearing and authorization-drift concerns from the behavior map remain deferred.
- Verification: final editor Jest suite passed 9/9 and final Expo web export passed after the selected checkmark addition. TypeScript passed in the preceding run; the only later production edit was the selected checkmark and its row/gap styling. `git diff --check` passed. Browser confirmed Create/Edit at normal and measured 390×844 widths, all three format choices and their dependent fields, manual/linked location switching, selection highlight for either linked venue, Browse all venues navigation, venue selection returning with the draft intact, blank-title validation, Edit prefill, optional-end Clear, Back, lower submit clearance and no horizontal overflow. Measured Back/format/save buttons are 44 px high. Temporary drafts were discarded; viewport override reset. One live test event was created, edited, and reloaded successfully in the Events/Edit routes on verified Supabase project `ahntbtktjjmvfosgkmgn` (`Bookconnect_reactexpo`): ID `95cc20a4-4795-4cf8-a883-8366518a5728`, scheduled 2026-10-10 at 18:30 local, title `TEST - Create/Edit verification UPDATED`. It remains scheduled in the seeded club so the live result is observable. No RSVP, cancellation, or deletion was submitted.
- Initial automated date/time `fill()` triggered the existing `showPicker` focus handler’s user-gesture error; the normal click-to-focus plus keyboard date entry and accessibility-set time entry succeeded for the authorized live test. A reload during parallel build verification briefly produced a 6000 ms font-loading timeout; another reload restored fonts/icons. Native device and screen-reader operation remain unverified.
- Evidence in `C:/Users/LEGION/.codex/visualizations/2026/09/30/01a0f41a-79cd-73b0-a323-1079b03f96ad/`: `event-create-mobile.jpg`, `event-edit-mobile.jpg`, `event-edit-desktop.jpg`, `event-editor-mobile-lower.jpg`.
- No schema/Storage changes, migration, or external deployment. The editor and tracker changes are committed locally; nothing was pushed. The unrelated Home screenshot remains untracked and preserved. Marketplace Phase 9 status unchanged; continuity validator PASS with existing size advisories. Active work unit: bounded Create/Edit visual refinement. Exact next action: user review of the implemented forms; date-picker focus error remains a separate follow-up before claiming complete web interaction verification.

## Create/Edit event editor design checkpoint (2026-10-02)
- The next page is the shared `ClubEventEditorScreen.tsx`, represented in Stitch by “Clubs V2 — Create Event (Virtual)” and “Clubs V2 — Edit Event (Hybrid)” frames at 390 × 844. This remains design-only; implementation is not authorized yet.
- Read the user-designated “Redesign Clubs UX” ChatGPT conversation. The critique supports one conventional operational form for both routes and the existing title → when → format → conditional how/where → description → submit sequence. It recommends explicit Start-required and End-optional groups; one mutually exclusive Format control; conditional meeting/location fields immediately beneath Format; physical venue/manual choice nested under location; restrained grouping rather than many cards; and Create/Save in normal scroll flow above the fixed tabs. Keyboard visibility, validation, focus and mutation feedback are implementation acceptance checks.
- The critique’s design gate is to show Start versus optional End and Format versus conditional location clearly, and remove or verify any implication of behavior the current app does not support. Code inspection confirms Create defaults to Virtual; changing format updates the selected type without clearing hidden location/link draft values; the existing “Clear” action clears both optional end fields and closes the active picker. Keep Clear attached to End and preserve these semantics. The selected option should also remain apparent without color alone. No new form fields or actions are proposed.
- The earlier feedback in “Redesign Clubs UX” was text-only and is not an Astra verdict. When checked directly, its model menu showed GPT-5.6 Sol selected with High thinking effort, not GPT-6 Astra, so do not label that response as Astra’s. The current Stitch editor canvas and a fresh Create preview still render blank white frames while their accessibility/DOM trees expose the form. The saved Edit capture predates the blank rendering; there is no current visual Create capture. The generated Create narrative mentions a title counter, RSVP helper and Cancel action that are absent from the actual Create frame DOM; treat that narrative as stale. No artboard content was changed during inspection.
- Accessibility references supplied by the reviewer: [Android Developers accessibility guidance](https://developer.android.com/guide/topics/ui/accessibility/apps), [WCAG 2.2 SC 2.5.8 target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html), and [WCAG 2.2 SC 3.3.2 labels or instructions](https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html). The critique also invokes Norman’s mapping and consistent Create/Edit task models; no stable bibliographic link was present in the captured response.
- No app code, tests, services, routes, permissions, database/Storage state, migration, or live event data changed in this checkpoint. Marketplace Phase 9 status is unchanged. Exact next action: restore/recapture both Stitch frames so their visuals can be reviewed, settle only the verified hierarchy/behavior discrepancies, then request critique from a model-confirmed Astra session and present the concrete screens for user approval. No implementation before that approval.

## Create/Edit event behavior map (2026-10-02)
- Before further Stitch design, traced both Expo routes to the single shared `ClubEventEditorScreen`: `/clubs/[clubId]/events/create` and `/clubs/[clubId]/events/[eventId]/edit`. Create starts blank with Virtual selected; Edit loads the event and hydrates title, description, format, local start/end date and time, meeting link, manual place, and linked venue. The editor stays in the existing five-tab navigation and scrolls above it.
- Existing form order is title → required start date/time → optional end date/time → format → conditional physical place and/or meeting link → optional description → Create/Save. Formats are Virtual (meeting link required), In person (physical place required), and Hybrid (both required). Meeting links must use HTTP(S); title and start are required; end must be after start. Supplying either end field requires an end time; Clear empties both end values and closes the active native picker. Date/time controls are native pickers on iOS/Android and browser date/time inputs on web; values are combined in the device/browser local zone and stored as ISO timestamps.
- Format changes only change the selected format; currently hidden link/place values remain in local draft state. On submit, the payload includes only fields required by the selected format and sends the other location/link fields as null. Description is trimmed by the service and blank becomes null. There is no editor field for `max_attendees`.
- Physical-place behavior: where linked venues exist, the manager chooses an already-linked venue or enters a manual meetup place. The editor’s “Browse all venues” route is a selector for this club’s linked venues only. When none are linked, the editor exposes the manual place field; adding a new approved venue requires leaving the editor through Manage Club → Venues. Venue selection returns to the same Create/Edit route, carries a serialized query-string draft and preselects the chosen venue. Back from the venue selector restores the draft without selecting another venue. This selection flow does not write to the database; linking a new venue in Manage Club does.
- Create/Edit opened from Manage Club returns to its requested tab on Back or after save; otherwise Back falls back to the club Events page and successful save replaces the route with that page. Save controls are disabled while the mutation is pending. Client validation errors render in the top feedback card; failed service/mutation errors use the entitlement-aware message. Successful save navigates away; the success-banner state is not used.
- Frontend gate: signed-in, Pro/Pro+ and club-access-eligible admin or active moderator can create. The admin can edit any event; an eligible active moderator can edit only events they created. The form is hidden behind sign-in/manager notices otherwise. `club_events` RLS is enabled in verified live project `ahntbtktjjmvfosgkmgn` (`Bookconnect_reactexpo`): SELECT is limited to active/muted club members; INSERT requires actor-owned `created_by`, scheduled status, and eligible-manager authorization; UPDATE/DELETE are authorized for eligible admins or eligible event creators. `club_venues` RLS permits member reads and admin venue management. Live helper definitions also require Pro-or-higher and the club access tier for privileged roles. One permission edge to keep in view: the frontend helper also accepts `membership.role === 'admin'`, while live privileged-admin authorization is anchored to `book_clubs.admin_id`; if those values ever diverge, the UI could expose a form that RLS denies. No live membership rows were read to test that condition. The edit query is also gated by RLS member visibility and the screen does not surface the event query error separately, so an inaccessible/missing event can fall through to the generic manager notice.
- Live `club_events` columns include `max_attendees` (nullable integer), `manual_location`, status/cancellation fields, and timestamps; format constraints require link/place according to format, and a trigger maintains `updated_at`. The existing service payload always writes `max_attendees: input.maxAttendees ?? null`; since this form omits that property, saving any event currently clears a pre-existing attendee limit. This is a pre-existing data-handling edge case, not a design change; resolve it explicitly before implementation rather than silently changing backend behavior.
- Save uses the existing `createClubEvent`/`updateClubEvent` services and mutations. Create sets `club_id` and the authenticated `created_by`; both use the shared validation/payload builder. Create invalidates the event list and public club detail; Edit invalidates event lists and that event’s detail. No route, hook, service, database policy, schema, or RLS behavior should be changed by this visual redesign.
- Inspected existing screen, venue-selector, service, hook-mutation, and editor/selector tests. They cover create, gate, date ordering, missing hybrid link, manage return, draft round-trip, venue choice/linking, pending duplicate venue-link prevention, and query invalidation. They do not currently assert Edit prefill/save, every validation branch, or the `max_attendees` preservation issue. Tests were read, not run, during this map.
- Verification for this map: exact branch/worktree checked; Supabase project identity confirmed with `get_project`; read-only policy/helper, column/RLS, and constraint queries run against that project; no SQL writes, event/venue row reads, app code changes, or tests. Fresh Stitch inspection confirms the selected Create frame's content in its accessibility tree but white canvas/preview screenshots; no Stitch content was modified. A temporary `data:` URL render was blocked by the browser's HTTP(S)-only navigation policy, and no workaround was attempted. `git status` still includes the tracker edit and untracked home screenshot; both are preserved. Next: restore visually renderable Create/Edit Stitch frames; confirm a GPT-6 Astra model selection in the critique session and share the mapped behavior plus actual screenshots; then present the concrete design for user approval before app implementation.

## Events listing implementation (2026-10-01)
- User explicitly approved implementation of the current Stitch Events design after being told Astra critique was still blocked by its usage cap. This authorizes the layout implementation; it is not an Astra approval. No independent Astra verdict was received.
- Restyled only `ClubEventsScreen.tsx`: warm ivory/white/burgundy palette matching the existing Clubs V2 pages, Newsreader headings and Inter text, club-context back row, compact event cards, clear RSVP selection, and quiet management actions with 44 px minimum heights. Dates retain the year and local time, suppress a repeated same-day date, and show both dates for a multi-day event. Removed misleading upcoming wording because past scheduled events remain visible in the existing service order. The existing tab navigator is reused.
- Preserved existing view/RSVP/create/manage eligibility helpers, query and mutation calls/payloads, confirmations, feedback, read-only and Maybe RSVP visibility, loading/empty/error/retry states, scheduled Edit/Cancel and cancelled Edit/Delete. No hook, service, permissions, schema, migration, dependency, or create/edit form changes.
- Final verification: focused Events suite 7/7, TypeScript (`tsc --noEmit --incremental false`), Expo web export with one worker, `git diff --check`, and Phase 9 continuity validator PASS. Browser inspected desktop and a measured 390×844 CSS viewport, including long test title/meeting URL wrapping, selected Not going state, lower-card scroll clearance and all ten displayed page buttons measured at 44 px high. Create and Edit opened the existing forms; neither form was submitted. Back returned to the club route. No browser error entries were observed. Continuity emitted existing document-size advisories only.
- Server verification initially showed a stale Metro bundle; restarted the identified Clubs server. A concurrent cache-clear attempt failed with ENOTEMPTY while export was running; ordinary restart then bundled successfully and the current layout was visibly confirmed. Existing development CSS/Browserslist/deprecation warnings remain.
- Evidence: `C:/Users/LEGION/.codex/visualizations/2026/09/30/01a0f41a-79cd-73b0-a323-1079b03f96ad/events-390x844.jpg` and `events-mobile-lower.jpg`. Temporary viewport override reset. Native devices, screen readers, enlarged text, and connected mutation success/rollback were not exercised; existing behavior is preserved by code and bounded mocked tests, not a live write proof.
- No event/RSVP mutations, database/Storage changes, migration, push, or external deployment. Screen and tests committed as `1337cd8` (`feat(clubs): redesign events listing`); no unrelated paths were staged. The tracker remains a local uncommitted edit alongside its earlier Events/Marketplace notes and the untracked Clubs Home screenshot. Marketplace Phase 9 global status unchanged.
- Active work unit: Events listing implementation complete. Next page task has begun: inspect the shared Create/Edit event editor before proposing its joint Stitch design. No implementation or migration authority for the forms is granted by the Events commit.

## Events listing design checkpoint (2026-10-01; superseded by implementation above)
- User selected Events as the next Clubs page. A new “Clubs V2 — Events” artboard is in the existing Stitch project: https://stitch.withgoogle.com/projects/12334872055044206539?pli=1. It proposed an editorial schedule with two event cards, existing Going/Not going RSVP and manager actions, and the five-tab shell. At this historical checkpoint it was design-only and implementation approval was pending.
- The original target was 390 × 844. The selected canvas frame visibly measures 390 × 884. Stitch said its inner document CSS was clamped to 390 × 844, but the outer frame measurement did not change. Do not report 390 × 844 fold-fit as verified. At 42% zoom the full artboard and navigation are visible; fine text, contrast, and touch-target size cannot be judged reliably from this capture.
- Current-app screenshot is a structural baseline only: it shows the existing dark theme and seeded Playwright records, and the captured browser image is 581 × 668. The user plans a future two-theme redesign; the dark theme and test copy are not design direction.
- Astra review is pending. GPT-6 Astra Light was visually confirmed as selected in the existing “Critique Product Philosophy” conversation. The app displayed an exhausted usage limit with a reset at 11:21 PM local time; two screenshots and the full review brief are staged there but remain unsent. No model switch, usage reset, or upgrade was selected.
- No app code, services, permissions, schema, or migrations changed; no test suite was run and no live event mutation was submitted. The temporary browser viewport override was reset. Marketplace Phase 9 status and Supabase/database state are unchanged.
- Next action at that checkpoint: choose whether to wait for Astra or authorize a different reviewer. The user subsequently approved implementation directly; current scope and evidence are recorded above.

## Marketplace navigation verification (2026-10-01)
- User authorized live verification of the marketplace navigation included in `origin/main..feat/clubs-v2` after the independent branch review. Discussion refinements are committed as `6fe1f8c`; this verification changes no application code.
- Live web at `127.0.0.1:8081`: Marketplace home, empty cart, empty order-request list, existing bookstore catalogue, and existing `Thinking, Fast and Slow` listing rendered. Browser Back returned cart/requests to Marketplace and book to store to Marketplace. All inspected routes retained exactly five primary tabs with Marketplace selected; switching Clubs then Marketplace also worked. Returning from the store to Marketplace cleared the search input; observed, not attributed to the new layout.
- Limitation: the authenticated account has no order requests, so an existing request-detail route could not be exercised. No cart additions, orders, payments, or inventory changes were submitted. Normal searches can invoke the existing unavailable-search logging RPC when no stores are found; telemetry persistence was not independently verified, so this is not a claim of zero database writes.
- Fresh verification: tabs layout Jest suite passed 1/1; browser console showed no error entries during the checked flows, with existing web/deprecation/Sentry configuration warnings. Server initially failed the Expo network check and sandbox worker spawning; restarted successfully with offline CLI mode and one Metro worker. Native device navigation remains unverified.
- No staging, commit, push, migration, or external deployment in this verification. The unrelated untracked screenshot remains preserved. Marketplace Phase 9 rollout status is unchanged. Next authorized action at that checkpoint: user selects the next Clubs page for inspection and design; the current selection is recorded in the Events checkpoint above.

## Anchored reaction popover (2026-10-01)
- Replaced the emoji bottom sheet with a compact 272 px maximum-width popover measured from the clicked topic/reply reaction button. Placement chooses below/above and clamps within 12 px viewport margins; constrained heights scroll. Resize and account/route changes dismiss stale positioning, and stale measurement callbacks are ignored. Existing report/reaction-user sheets are preserved.
- Added option accessibility labels, 44 px targets, initial option focus, outside-tap/Escape/native-back dismissal and trigger-focus restoration. Selection uses the unchanged reaction mutation and closes after success; options are disabled while saving. Reaction emoji size and existing services/permissions remain unchanged.
- Verification: final thread suite passed 21/21, including selection payloads, outside dismissal, and left/right/bottom bounds. Initial picker tests failed because native mock measurement did not invoke its callback; a scoped measured-button helper corrected the test setup without adding production fallback behavior. Web export and diff check passed. Initial visual inspection revealed an unnecessary scrollbar and four-column wrapping from border sizing; corrected width/height calculations and confirmed a five-column grid. TypeScript closeout follows.
- Browser inspected normal and 390×844 widths: topic popover below, lower reply popover above, all options in bounds, Escape/outside dismissal, and focus restored. No votes/reactions/comments were submitted. Viewport reset. Evidence: `C:/Users/LEGION/Documents/Codex/2026-09-27/use-this-as-a-projectless-chat/inline-thread-evidence/reaction-popover-mobile.png` and `reaction-popover-above.png`.
- Final `tsc --noEmit --incremental false` passed. No service/backend/schema/migration changes, database writes, commit, push, or external deployment. Existing uncommitted changes preserved. Next action: user review of the anchored emoji picker; native device/status-bar placement remains outside browser verification.

## Compact thread and inline editor (2026-10-01)
- Implemented the approved density refinement: reply vertical padding 12→8 px, internal gaps 8→4 px, branch indentation capped at 28 px (14 px per level), tighter branch/heading/card spacing, and reaction badges within the reply action row when space allows. Read-only/muted and deleted-topic reaction visibility remains supported separately. Font sizes and 44 px touch targets are preserved.
- Editor now starts at 64 px, grows up to 180 px with scrolling for longer drafts, uses a one-line quote preview, and combines Quote, “To topic” (accessible label “Reply to topic instead”), and Post reply in a wrapping footer. No draft/posting/target/service contracts were changed.
- Edge-case investigation found a new web resize loop when clearing a long draft: scrollHeight follows assigned height but excludes borders, repeatedly shrinking until React's update-depth guard. Corrected with a stable callback, monotonic growth while nonempty, and explicit reset to 64 px when empty. Added a regression for capped growth, smaller measurements, clearing, and blank-submit disabled state; updated capped indentation assertion.
- Verification: final focused thread/optimistic-vote suites passed 22/22 tests, web export passed with one worker, and diff hygiene passed. Earlier pre-correction suites passed 21/21 but did not cover the resize defect; the browser check exposed it. First correction export hit filesystem EPERM; renewing the turn-scoped worktree write permission allowed the final passing export. TypeScript result recorded below.
- Browser checks at normal and 390×844 viewport: compact comments/editor/footer fit, long draft grows and scrolls, clearing resets without error, Cancel/reopen preserves draft, switching to topic preserves draft, empty submission remains disabled. Temporary test drafts were cleared; no votes/reactions/comments submitted. Viewport reset. Evidence: `C:/Users/LEGION/Documents/Codex/2026-09-27/use-this-as-a-projectless-chat/inline-thread-evidence/thread-compact-mobile.png`.
- Final `tsc --noEmit --incremental false` passed. No backend/service/schema/migration changes or database writes; no staging, commit, push, or external deployment. Existing uncommitted work preserved. Next action: user review of compact thread layout. Native keyboard/device checks remain outside this browser verification.

## Optimistic voting and thread typography consistency (2026-10-01)
- Implemented user-approved immediate vote feedback for topic/reply set, switch, and remove through the existing hooks. Updates only the acting user's exact thread cache; cancels an in-flight thread read before projecting counts/selection, rolls back only the affected vote fields on failure, and reconciles discussion/thread caches on settlement. Removed overlapping viewer-key invalidation. Service payloads, server authentication, RLS, schema, and migrations remain unchanged. Screen voting is serialized with a ref guard, and remove-vote pending state now disables conflicting interactions.
- Further reduced selected emoji to 12/16 px and picker emoji to 18/24 px. Body/input/quoted preview are Inter 14/21; topic/reply metadata 13/19; composer controls, attribution, action labels/counts 12/18. Larger Newsreader headings retain the approved hierarchy. Minimum 44 px interaction targets remain.
- Verification: 3 focused Jest suites / 33 tests passed, including deferred-server optimistic topic vote, reply down-to-up switch with failure rollback, remove-vote feedback, account cache isolation, preservation of unrelated updates, existing hook contracts, and thread interactions. Final TypeScript, Expo web export (one worker), and diff checks passed. Initial TypeScript context inference error was corrected before the passing run; the first Jest launcher failed from shell quoting, then the direct Node launcher ran the suites successfully.
- Browser verification: reloaded the existing development thread; removed/restored its original topic upvote using the existing UI. Count changed while the mutation was visibly pending and remained correct after reconciliation. This made two authorized development vote mutations through unchanged services; final selection/count restored. No reaction/comment writes. Final typography screenshot: `C:/Users/LEGION/Documents/Codex/2026-09-27/use-this-as-a-projectless-chat/inline-thread-evidence/thread-consistent-type.png`. Server request duration was not benchmarked; this change removes the network wait from displayed selection/count, not server completion time.
- No migrations, service changes, database permission changes, staging, commits, push, or external deployment. Existing user work preserved. Scope complete; next action is user review of the thread refinement. Astra consultation was optional and not performed for this bounded implementation.

## Selected emoji refinement and vote-delay investigation (2026-10-01)
- Reduced selected reaction emoji from 16 to 14 px (matching comment text), their visible pill minimum from 30 to 28 px, and picker emoji from 24 to 20 px inside 44 px options. Selected reaction touch targets remain at least 44 px.
- Read-only vote investigation: both vote hooks lack optimistic cache updates; service awaits `auth.getUser()` before vote write; success awaits broad discussion plus thread invalidations (including overlapping thread-root/viewer keys). Thread fetch reads topic, then replies, then votes/reactions/read state in parallel, then profile summaries. The displayed count/selection comes from this refreshed topic. This explains why visual feedback includes network/refetch latency, but individual request timing was not measured and no exact server-latency attribution is claimed.
- Git history: `cf31fbe` fixed reply-target cache invalidation by passing `parentTopicId`; it did not implement immediate optimistic vote feedback. No optimistic voting implementation was found in accessible history for the thread screen or discussion hooks. Vote behavior is unchanged in this step. Recommended next change: frontend optimistic vote selection/count with rollback and reconciliation, preserving server permissions and service contracts.
- Verification: Expo web export passed; browser reload showed smaller selected emoji, and reaction picker opened/dismissed correctly without submitting reactions/votes. Evidence: `C:/Users/LEGION/Documents/Codex/2026-09-27/use-this-as-a-projectless-chat/inline-thread-evidence/thread-smaller-emoji.png`. No tests run, database mutations, migrations, commits, or external deployments.

## Discussion thread control proportions (2026-10-01)
- Refined the existing inline thread action styling: retained 14/21 px comment text, standardized action icons and reaction emoji at 16 px, and used 12/18 px medium action labels/counts. Removed the large outlined vote/utility surfaces; selected votes and reaction summaries use compact 30 px minimum visual surfaces inside targets of at least 44 px. Actions wrap and text remains scalable.
- Preserved vote/reaction/report/reply handlers, permissions, services, and backend contracts. Delete remains deferred. No database writes, migrations, staging, commit, push, or external deployment occurred.
- Verification: final Expo web export passed with one worker; diff whitespace check passed. Reloaded the existing localhost 8081 thread, visually inspected root/nested replies and reaction proportions, and opened/cancelled a nested inline reply without posting. Screenshot: `C:/Users/LEGION/Documents/Codex/2026-09-27/use-this-as-a-projectless-chat/inline-thread-evidence/thread-proportions-refined.png`. An initial intermediate export failed on a missing JSX closing tag; corrected before the passing export. No Jest tests were run for this styling-only step.
- TypeScript verification: `tsc --noEmit --incremental false` passed. Scope complete; next action is user review of the refined control proportions. Existing uncommitted inline-thread implementation and unrelated screenshot were preserved.

## Clubs V2 follow-up (2026-09-29)
- User-approved Club Home treatment: Discuss is a blush destination button below the current-book card; Readers remains a disclosure row; Events is a quieter matching button below Readers.
- Existing Discuss and Events routes are preserved. No backend, API, database, or schema behavior changed in this UI follow-up.
- Verification on `feat/clubs-v2`: full Jest passed (312 suites, 1 skipped; 2,700 tests, 4 skipped); `ClubDetailScreen.test.tsx` passed 44/44; `tsc --noEmit` passed; web export succeeded with one worker; Club Home was visually inspected in the browser at a mobile viewport.
- This is a scoped V2 UI follow-up and does not advance or replace the older overhaul phases recorded below.

## Clubs V2 Discussion screen follow-up (2026-09-29)
- Implemented the user-selected Stitch artboard “Clubs V2 — Discussion (browse first)” in the existing discussion route, with its inline composer-open companion state. The screen now uses the approved warm ivory/burgundy palette, white topic and composer surfaces, Newsreader titles, and Inter labels/body/metadata. The default view leads with recent topics; topic titles lead, body and attributed first reply previews remain visible, reply count and score are separated, and Open thread stays explicit. Author/time metadata omits the redundant “Started by” prefix so it stays on one line at 390 px.
- The existing title/body fields and posting mutation are reused. Start/Hide only expand or collapse the composer; local draft values survive collapse/reopen. Existing routes, access gates, loading/error/empty/retry states, feedback, and topic ordering remain unchanged. No service/API/schema code or migrations changed.
- Verification: the Clubs suite passed 23 suites / 334 tests before the final metadata shortening; after that change, the focused screen suite passed 7/7, `npx tsc --noEmit` passed, and web export passed with `--max-workers 1`. The running page was inspected at a measured 390×844 CSS viewport: two topic rows scan cleanly, the author/time line stays on one line, the lower reply preview and footer clear the fixed navigation, and the composer fields and Post topic action remain visible when expanded. The viewport override was reset after inspection.
- Astra’s independent screenshot review approved the implementation at both the captured desktop width and 390×844. It found no blocking page-local visual issue; it noted that keyboard, touch-target, screen-reader, enlarged-text, and posting/access behavior still require interaction checks. No external references were consulted.
- Browser data note: during visual interaction checking, a coordinate click intended for “Hide composer” activated the existing “Post topic” control instead. The app confirmed one development topic write through the existing create-topic service for “ZZ_TEST MANAGE BASICS CLUB” by “ZZ Test Playwright”: title “A thought about chapter four”, body “The ending changed how I read the opening.” No further discussion-data action was taken; cleanup awaits the user’s direction.
- No code was staged, committed, pushed, deployed, or migrated. The existing untracked `clubs-home-390x844-authenticated-dedup.png` was left untouched.

## Clubs V2 Discussion Thread inline reply implementation (2026-09-30)
- Implemented the approved Stitch “Discussion Thread (inline reply)” direction in `src/features/clubs/screens/ClubDiscussionThreadScreen.tsx` and the new `DiscussionReplyComposer.tsx`. A single editor appears within the selected topic or reply, shows the exact reply target and quoted preview, retains its draft across Cancel and target changes, keeps failed drafts available to retry, and prevents double submit or retargeting while posting. A plain text quote inserts into the draft. Topic switching, keyboard dismissal, native back, and web Escape are supported. Missing/deleted targets retain their parent ID, show an unavailable message, and block posting. Reply branches render in chronological order with a globally capped indentation; each parent attribution remains visible.
- Preserved service and hook contracts, mutation payloads, active/muted/deleted participation and reporting gates, vote/reaction/report/unread behavior, and existing routes. Fixed Back to discussion to return to the discussion list route. Vote controls now announce target, counts, and selected state. No service, hook, route configuration, database, migration, or backend code changed; no live writes were made during browser verification.
- Verification on `feat/clubs-v2`: Clubs Jest 23/23 suites and 347/347 tests PASS (focused thread suite 18/18); `tsc --noEmit --incremental false` and `git diff --check` PASS; Expo web export PASS with one worker. Live 8081 development page reloaded after implementation; opened an existing nested reply and confirmed its inline editor, preview, blank-submit disabled state, target switching, draft retention, and no browser errors. The submit action was not activated. Independent code review completed; the vote-label/accessibility issue and missing stale-account test were addressed. Native device keyboard presentation remains outside the browser check. Screenshot evidence is saved outside the repo in the task evidence folder.
- Nothing staged, committed, pushed, deployed, or migrated. Existing unrelated tracker edits and `clubs-home-390x844-authenticated-dedup.png` were preserved.

**Branch:** `feat/clubs-ui-overhaul` from `origin/main` `c5e9714`
**Environment:** two-worktree split — this desk `C:\Users\LEGION\Desktop\Bookconnect4_expo` (clubs), sibling `C:\Users\LEGION\Desktop\Bookconnect4_library` @ `feat/library-shelf-motion` (library, live session). `stash@{0}` holds the library tracked-edit backup — leave it alone, do not pop or drop.
**SOT:** `ahntbtktjjmvfosgkmgn` `Bookconnect_reactexpo`
**Status:** `SDD-01-ui-overhaul` audit complete, docs only — no implementation yet
**Next:** Phase 1 shared-primitives implementation after user approval

## Scope
UI/UX aesthetic overhaul only. No service/API/schema behavior changes, no Supabase
mutations, no new dependencies. All existing contracts preserved.

## Baseline (2026-08-22, branch creation day)
- `npx jest --runInBand --testPathPattern "clubs"` → **18 suites / 190 tests PASS**
- Feature surface: 17 stack routes (`app/(tabs)/clubs/_layout.tsx`), ~6,900 LOC in
  `src/features/clubs/` (33 non-test files), thin route wrappers only.
- Test coverage holes: `ClubCard`, `ClubMemberList`, `ManageTabBar`, 12 of 13 manage
  sections, `clubEvents.shared.ts`, `manageUtils.ts`.

## Audit verdict (full evidence in SDD-01 §2)
1. Hardcoded semantic hexes bypassing `useTheme()` in 9+ screens (feedback banners,
   danger buttons, image placeholders) — breaks golden/midnight phases.
2. Copy-pasted StyleSheets instead of shared primitives; drift across screens.
3. Sub-44px touch targets: browse filter chips, ManageTabBar pills, discussion
   vote/reaction chips, bare-text moderation buttons.
4. Missing UX states: retry on error in authors/reading/venue-picker/manage,
   empty state in invite inbox, skeletons nowhere.
5. Dead code: unused styles, mojibake `�` at `ClubManageScreen.tsx:466`,
   `'Not going' : 'Not going'` ternary at `ClubEventsScreen.tsx:129`,
   triplicated label maps, duplicated nomination/application helpers.

## Phases (all pending authorization)
| Phase | Scope | Status |
|---|---|---|
| P1 | Shared primitives (`FeedbackBanner`, `ClubScreenHeader`, label maps, placeholder cover, state components); hex purge | docs only |
| P2 | Browse + `ClubCard`: GlassCard recipe, tinted tags, staggered motion, skeletons, 44px chips | docs only |
| P3 | Detail + member screens (events, reading, discussion, invite, applications, nominate, venues): primitives, retry/empty/pull-to-refresh | docs only |
| P4 | Manage console: tab bar targets, moderation buttons, mojibake/dead-style cleanup | docs only |
| P5 | Motion layer: staggered entrances, press-lift + haptics, all behind `useReducedMotion()` | docs only |

## Verification ledger
- 2026-08-22 baseline: clubs Jest 18/18 suites, 190/190 tests, branch created clean.
- 2026-08-22: P0 product decisions RESOLVED — all 7 blockers adopted per user sign-off,
  recorded in `docs/user/clubs/DECISIONS.md` (PRODUCT-05/10/11/12/14, TYPE-03-d,
  PRODUCT-HIER-P04). Remediation program unblocked for the P1 backend stream.
  Full register context: ChatGPT remediation thread, archived at
  `C:/Users/LEGION/Documents/BookConnect-records/chatgpt-clubs-remediation-full.txt`.
- 2026-08-22 Wave 1 COMPLETE (client-only, no DB): CACHE-01 fixed (`useUpdateClub`
  now invalidates `manageDetail`; TEST-03 test corrected to enforce it) · FUNC-02
  un-vote toggle (PRODUCT-11) · FUNC-03 un-react toggle (PRODUCT-12) · FUNC-01
  report overflow menu wired to existing hook (PRODUCT-10). New hooks:
  `useRemoveClubDiscussionVote`, `useRemoveClubDiscussionReaction`. Files:
  useClubs.ts (+2 hooks), ClubDiscussionThreadScreen.tsx (toggle handlers, ⋯
  report button, report reason sheet), useClubs.test.ts (CACHE-01 contract),
  ThreadScreen.test.tsx (mock surface only). Verification: clubs Jest
  18/18 suites 190/190 PASS post-change; global tsc --noEmit = 0 errors;
  no deps/migrations/deploy; nothing staged or committed.
- 2026-08-22 Wave 2 CONFIRMATION + migration DRAFTED (NOT applied):
  live evidence via Supabase MCP read-only (5/5 CONFIRMED-DEFECT):
  B03 resolved_by unpinned (no trigger/default on club_complaints) ·
  B04 cancelled_by client-suppliable via RLS UPDATE policy ·
  HIER-02 no target-membership check in issue_club_member_action ·
  HIER-03/P04 no self-target guard · BACKEND-05 club_invitations has NO
  expires_at column and accept_club_invitation never checks expiry.
  Draft migration: `supabase/migrations/20260822230000_clubs_wave2_attribution_guards_expiry.sql`
  (two BEFORE UPDATE pin triggers, issue_club_member_action rewrite with
  membership+self guards, expires_at column+backfill+default,
  accept_club_invitation synchronous expiry gate). Client side pre-staged:
  cancelClubEvent no longer sends cancelled_by. Awaiting user approval to
  apply; application checklist embedded in migration header.

- 2026-08-22 Wave 2 APPLIED TO LIVE (user-approved, project ahntbtktjjmvfosgkmgn):
  B03 resolved_by now server-pinned via trg_enforce_club_complaint_resolution ·
  B04 cancelled_by pinned via trg_pin_club_event_cancellation (+ client
  cancelClubEvent no longer sends cancelled_by) · HIER-02 target-membership
  guard + P04/HIER-03 self-moderation guard in issue_club_member_action ·
  BACKEND-05/PRODUCT-05 expires_at column added (default now()+14d, legacy
  pending backfilled — 1 row), accept_club_invitation synchronous expiry gate.
  Post-apply readback (all PASS): both triggers present on correct tables; all
  4 functions SECURITY DEFINER with search_path=public; expires_at timestamptz
  default confirmed; 1/1 pending invitation stamped; 0 closed complaints with
  null resolved_by; 0 cancelled events with null cancelled_by. Local migration
  file `20260822230000_clubs_wave2_attribution_guards_expiry.sql` matches live.
  Note: applied via MCP execute_sql per-statement rather than db push (fn body
  rewrites + backfill); ledger entry records this deviation. Verification:
  clubs Jest 18/18 suites 190/190 PASS; global tsc --noEmit = 0 errors;
  nothing staged or committed.
- 2026-08-22 B01 banner Storage lockdown APPLIED TO LIVE (user-approved,
  project ahntbtktjjmvfosgkmgn). Evidence: bucket had 7 policies incl. 3
  fully unconstrained ("Allow authenticated uploads/updates/select") —
  permissive-OR made any authed user able to write any object. Applied:
  all 7 old policies dropped; 4 club-scoped created (admin INSERT/UPDATE/
  DELETE gated by is_active_eligible_club_manager on {clubId} first path
  folder; public SELECT retained). Readback: exactly 4 club_banners_*
  policies, ZERO unconstrained policies remain, 2 existing objects under
  a club folder unaffected for reads. Client: ClubCreateScreen pre-creation
  upload removed per PRODUCT-14 (URL paste only, hint text added);
  ClubManageSettingsSection already uploads {club.id}/cover.ext — matches
  new policy model. Local migration file:
  `20260822233000_clubs_b01_banner_storage_lockdown.sql`. Verification:
  clubs Jest 190/190 PASS, tsc 0 errors post client changes. Nothing
  staged or committed. BACKEND-07 closed NO-ACTION (live-vs-replay RSVP
  policy drift audit returned zero drift — replay reproduces live exactly).
- 2026-08-22 BACKEND-02 creation-cap race fix APPLIED TO LIVE (user-approved).
  Evidence: cap check was non-locking COUNT(*) — concurrent same-admin
  inserts could both pass and exceed tier caps. Fix:
  pg_advisory_xact_lock(hashtextextended('club-cap:' || admin_id, 0))
  taken BEFORE the count inside enforce_book_club_entitlement; rest of
  function verbatim. Lock key namespaced 'club-cap:' after conflict audit
  found marketplace/phase9 functions share the advisory hash space
  (their keys are 'phase6-cart:...'/scope-composites — no structural
  collision, prefix eliminates theoretical hash collision; all existing
  usages xact-level, one key per tx). Readback PASS: prosecdef true,
  search_path=public, namespaced lock present in live prosrc (body_len
  1486), trigger attached, zero-arg identity preserved. Residual: true
  parallel-insert race test deferred to L01 harness as its first entry.
  Local migration file:
  `20260822234500_clubs_b02_creation_cap_race_fix.sql` (matches live,
  modulo lock-key prefix hardening applied during application).
- 2026-08-22 TYPE-03/TYPE-03-d emoji canonical set APPLIED TO LIVE
  (user-approved). Evidence: emoji column had only a non-blank CHECK;
  live data held 7 distinct values, 2 of them double-encoded mojibake
  (corrupted 👍/😂). Applied: (1) deleted the 2 mojibake rows by exact
  id after evidence showed each was a duplicate of an existing
  canonical row by the same user on the same reply (repair-by-update
  was blocked by unique constraint reply_user_emoji; deletion loses no
  reaction data); (2) added CHECK club_discussion_reactions_emoji_canonical
  enforcing exactly the 11 canonical emojis matching REACTION_OPTIONS in
  ClubDiscussionThreadScreen. Readback PASS: constraint present alongside
  emoji_present + target_check; DISTINCT emoji all canonical (❤️👍👏🔥😂);
  negative INSERT with 'x' rejected at CHECK layer (23514). Scope note:
  message_reactions (chat domain) intentionally untouched. Residual:
  TS union ClubDiscussionReactionEmoji still declares 5 — widening to
  the same 11 is client-side follow-up under T-stream. Local migration
  file: `20260822235000_clubs_t03_emoji_canonical_set.sql`.
- 2026-08-23 small-items batch COMPLETE (committed 3d671f9, pushed):
  TYPE-03 client follow-up — emoji union widened 5→11 matching DB CHECK,
  REACTION_OPTIONS typed directly (no cast) · CLUB-TYPE-04 —
  ReactionSummary.users now plain enumerable field (defineProperty trap
  removed; clubsService test asserts users content) · CLUB-TYPE-05 —
  replyId! assertions replaced with guarded casts · CLUB-CACHE-02 — new
  shared useViewerMembershipTier hook (React Query, staleTime 5min)
  replaces imperative getProfileSummary effects in ClubDetail/
  ClubEventEditor/ClubEvents screens; screen tests mock the hook.
  Verified: clubs Jest 18/18 suites 190/190 PASS, tsc --noEmit 0 errors.
- 2026-08-23 HIER-01 CORRECTION (user-challenged, Muse Spark re-check):
  club_members_role_check already existed live since ~March 2026 via
  untracked manual DDL — register finding was stale. Today's earlier
  club_members_role_canonical is a redundant duplicate (harmless;
  candidate to drop). BACKEND-06 also closed NO-ACTION: transfer_club_admin
  does not exist live and has zero references. Tooling note: OpenCode Go
  free quota exhausted mid-session ("Insufficient balance" on ox-alpha-free);
  DB work continued on opencode/muse-spark-1.2-contributor-free.
- 2026-08-26 CLUB-WU-L01-A IMPLEMENTED (B02 slice only; L01-B/C/D open).
  New disposable real-PostgreSQL-17 Docker harness `supabase/tests/clubs/`
  (`clubsL4Runner.mjs` orchestrator, `actors.mjs`, platform bootstrap +
  FLAGGED replay bridge fixtures, `contracts/b02_creation_cap.test.mjs`);
  pinned image `postgis/postgis:17-3.5`; npm scripts
  `test:clubs:l4{,:b02,:f04}`; `pg` added to devDependencies (8.23.0).
  B02 deterministic race GREEN across 5 whole-harness runs: A holds the
  transaction advisory lock while uncommitted (observer-verified via
  pg_locks/pg_stat_activity, identical objid, wait_event=advisory),
  COMMIT A ⇒ B resumes and rejects SQLSTATE P0001
  'Membership tier club creation limit reached', final count exactly 5,
  no orphan membership rows. RED-proof PASS: runtime temp overlay of the
  REAL B02 file minus only the advisory-lock statement (never written to
  repo, deleted after run) makes the contract fail 5 assertions incl.
  B settling before A commits. REPLAY GAPS FOUND AND FLAGGED (live-
  verified read-only against ahntbtktjjmvfosgkmgn, restored only as
  historical schema substrate in `fixtures/clubs_l4_replay_bridge.sql`,
  no behavior under test copied): book_clubs `lead_id→admin_id` rename +
  `meeting_type`/`author_id` columns + club_members role CHECK
  ('member','moderator','admin') exist live via untracked manual DDL but
  no tracked migration performs them (same class as HIER-01 above);
  repository migration chain cannot replay past 010 without them.
  F04 REGRESSION ANCHOR PARTIAL/BLOCKED: existing F04 files unchanged;
  through the new runner `f04_fixture.sql`, F04 migration
  `20260824100000`, and `f04_concurrency.mjs` all PASS, but
  `f04_contract_tests.sql` aborts at CASE 7 (bare
  `SELECT set_config(...)` inside DO block — invalid plpgsql in any PG
  version; WU-F04 doc lists this file under "Not run here", so it was
  never executed before). Per instruction F04 was NOT modified — owner
  decision required (one-line SELECT→PERFORM candidate fix).
   Verification: B02 suite exit 0 ×5; mutation demo detects removal;
   clubs Jest 19 suites / 198 tests PASS; `tsc --noEmit` 0 errors.
   Nothing applied to Supabase; nothing staged or committed.
- 2026-08-26 CLUB-WU-L01-A BOUNDED CLOSEOUT — **NOT CLOSED** (Owner
  Decisions 1 & 2 executed; stop condition hit).
  DECISION 1 (F04 harness repair): authorized minimal syntax fix applied
  to `supabase/tests/f04_contract_tests.sql` — TWO bare side-effect-only
  `SELECT set_config(...)` statements inside PL/pgSQL DO blocks changed
  to `PERFORM` (CASE 7 line 86 + CASE 13 line 146 pre-repair; CASE 13
  has the identical defect shape and would abort the script under
  ON_ERROR_STOP). No semantics/fixtures/assertions/indexes/RPC/SQLSTATEs/
  counts touched.
  REAL EXECUTION RESULT (first actual execution of this script ever):
  fixture PASS · F04 migration PASS · contract cases 1–13 execute clean ·
  script FAILS at CASE 14 — its seeded-duplicate INSERT violates
  `club_discussion_reactions_topic_user_unique`, the NON-deferrable
  partial unique index created by the same F04 migration Step 3; script
  and migration share commit e213977, so the suite was never executable
  end-to-end. STOP rule honored: no assertion rewritten; CASE 14 needs a
  new bounded owner decision (drop-and-reseed around the repair CTE vs
  delete the case are candidate shapes — NOT chosen here). F04
  concurrency A–D not reached (runner aborts before probe).
  RECORD CORRECTED: PRODUCT FIX remains CLOSED; TEST-HARNESS DEFECT =
  syntax portion fixed during L01-A + deeper CASE 14 design defect newly
  confirmed; AUTOMATED SQL CONTRACT = now actually executed, RED pending
  owner decision (see WU-F04-implementation.md assurance-record
  correction).
  B02 RECONFIRMED this session: deterministic lock-wait evidence intact
  (A holds granted advisory xact lock objid=3642800262 while uncommitted;
  B blocked on identical objid across 3 stable polls; COMMIT A ⇒ B
  resumes, rejects P0001 'Membership tier club creation limit reached';
  final qualifying clubs = 5, no orphan membership); RED sensitivity
  reconfirmed via temp --mutation no-lock overlay (contract failed 5
  assertions incl. B settling while A uncommitted); real B02 migration
  untouched. Combined `test:clubs:l4` exits 2 solely on the F04 CASE 14
  abort.
  DECISION 2 (replay gap) LOGGED: repository/live migration drift
  CONFIRMED as real finding — tracked chain lacks lead_id→admin_id
  rename, meeting_type + meeting_type_check, author_id, and club_members
  role CHECK ('member','moderator','admin') transitions that later
  migrations (004/010 onward) assume and live dev DB contains; bridge
  header now states TEMPORARY L01-A TEST SUBSTRATE / NOT TEST-07 CLOSURE
  / NOT AUTHORITATIVE MIGRATION HISTORY / TO BE RESOLVED BY L01-D /
  migration replay reconciliation. CLUB-TEST-07 remains OPEN; migration
  replay remains OPEN; L01-B/C/D remain OPEN; no production migration
  created or altered; zero live Supabase mutations (read-only evidence
  only).
   LOCKFILE: `pg@^8.23.0` consistent across package.json devDependencies,
   package-lock.json root deps (`node_modules/pg` 8.23.0); npm ls clean.
   Verification rerun this session: jest clubs 19 suites / 198 tests PASS;
   `tsc --noEmit` 0 errors. Nothing staged or committed (closure criteria
   #5 unmet ⇒ no commit per instruction).
- 2026-08-26 CLUB-WU-L01-A FINAL CLOSEOUT COMPLETE — **CLOSED** (Owner
  Decision F04 CASE 14 executed verbatim; every closure criterion green).
  CASE 14 RESTRUCTURED AT THE MIGRATION BOUNDARY (repair coverage NOT
  retired; repo F04 migration untouched): historical post-migration CASE 14
  removed from `supabase/tests/f04_contract_tests.sql` with an in-file
  pointer comment (number 14 retired, not reused; remaining post-migration
  contracts = CASE 1–13 unchanged) because its seeded-duplicate INSERT was
  correctly rejected by the same-migration non-deferrable unique index and
  its "proof" re-ran a COPY of the repair CTE instead of the migration.
  NEW ARCHITECTURE through the L01 runner: f04_fixture.sql →
  `f04_pre_migration_duplicate_seed.sql` (dedicated actor …3333/topic …0003;
  3 legal pre-F04 rows 👍❤️🔥, DISTINCT created_at, newest=❤️ id …ccc-0002;
  ordering mutually exclusive with id DESC so created_at DESC alone decides)
  → ACTUAL F04 migration 20260824100000 unchanged →
  `f04_migration_repair_contract.sql` (zero repair SQL duplicated; asserts
  exactly-1 survivor, winner id/emoji/created_at preserved, losers deleted
  by exact id, both partial UNIQUE indexes exist+enforcing, immediate
  duplicate INSERT rejected 23505) → existing CASE 1–13 → concurrency A–D.
  REAL EXECUTION (disposable PG17, exit 0 ×3 runs incl. combined): all seven
  required items PASS. RED PROOF (--mutation no-repair, temp copy of the
  REAL migration with only Step-1 loser filters → WHERE FALSE and Step-2
  fail-loudly guard → IF FALSE; indexes/RPC verbatim; never written to repo,
  deleted after run): mutated migration FAILED at CREATE UNIQUE INDEX
  club_discussion_reactions_topic_user_unique on the surviving duplicates —
  repair step proven load-bearing via owner-named outcome #1. First attempt
  bypassing Step 1 only was ruled out: Step-2 guard fired first, masking the
  specified index-creation outcome. B02 RECONFIRMED green (deterministic
  lock-wait evidence intact; P0001 cap rejection; final count 5, no orphans)
  + B02 RED sensitivity reconfirmed via --mutation no-lock (contract failed
  5 assertions incl. B settling while A uncommitted); real B02 migration
  untouched. Combined `npm run test:clubs:l4` exit 0. Clubs Jest 19 suites /
  198 tests PASS; `tsc --noEmit` 0 errors. NO new product/database behavioral
  discrepancy found; no assertion rewritten to pass. L01-D/REPLAY GAP NOT
  expanded into: bridge remains TEMPORARY L01-A TEST SUBSTRATE / owned by
  L01-D; CLUB-TEST-07 OPEN. Single bounded commit
  `test(clubs): establish L01-A backend contract harness` (L01-A-owned files
  only; unrelated dirty files excluded); nothing pushed; zero live Supabase
  mutations (local disposable Docker PostgreSQL only).
- 2026-08-30 CLUB-WU-TC02 COMPLETE — Clubs Edge Function contract tests
  landed on top of the passed TC02 context gate (0 material unknowns; both
  live deployments ACTIVE with verify_jwt=true). NEW test-only files:
  `supabase/functions/__tests__/check_membership_limits_function.test.ts`
  (22 tests) and `supabase/functions/__tests__/
  club_downgrade_grace_period_function.test.ts` (26 tests) plus recording
  stub `supabase/functions/__tests__/support/edgeFunctionHttpStubs.ts`
  (Deno `serve` capture without a server, controlled `Deno.env` shim,
  scriptable record-only `createClient` exposing auth/table/rpc call
  instrumentation; support filename deliberately avoids the literal
  `clubs` substring so the `--testPathPattern "clubs"` sweep does not
  execute it as a suite). Tests import and execute the REAL Edge handler
  source (serve callback captured, real Request/Response objects, real
  handler decisions) — no handler logic duplicated in tests. package.json
  modified: ONLY two test-only `moduleNameMapper` entries for the exact
  `https://deno.land/std@0.168.0/http/server.ts` and
  `https://esm.sh/@supabase/supabase-js@2` URL imports; no dependency,
  package-lock, preset, script, or runtime changes. Coverage pinned for
  check-membership-limits: self-request 200 with full entitlement body;
  cross-user 403 with ZERO privileged DB calls and only the anon client
  constructed (self-check-before-service-read, load-bearing); missing
  Authorization 401 before any client construction; invalid/expired JWT
  401; invalid user_id / invalid action 400 with no DB access; missing
  action defaults to create_club; free 0/0 upgrade reason; pro 4/5 vs 5/5;
  pro_plus 14/15 vs 15/15 (`<` create boundary); unknown tier and missing
  profile row treated as free; check_downgrade `<=` boundary (5/5 allowed,
  6/5 denied); privileged query shape (user_profiles select membership_tier
  + eq user_id + maybeSingle; book_clubs select('*', count exact, head
  true) + eq admin_id + or is_archived.is.false,is_archived.is.null on the
  service-role key with persistSession false); profile/count DB errors →
  400 with error field and no allowed=true (raw text not frozen); missing
  env → 500 naming the variable; OPTIONS 200 ok with the four CORS allow
  headers (no Allow-Methods demanded); malformed JSON 400. Coverage pinned
  for handle-club-downgrade-grace-period: OPTIONS 200 ok including
  x-cron-secret; GET 405 before env/client work; missing SUPABASE_URL /
  SUPABASE_SERVICE_ROLE_KEY → 500 with zero RPC; configured-secret gate
  (missing header 403 / wrong header 403 — both with zero client and RPC
  calls — vs correct header proceeding to RPC, P0 safe invariant);
  default RPC args exactly process_club_downgrade_grace_period with
  p_user_id null / p_grace_days 14 / p_dry_run false; explicit user_id
  forwarded unchanged; grace_days classes 1→1, 90→90, 0→14, 91→14,
  'abc'→14, '14'→14; dry_run classes true/'true'→true, false/'false'/1/
  missing→false; success wrapping {processed, results} with rows passed
  through unchanged; empty data → 0/[]; RPC error → 400 without freezing
  raw message; unexpected rejection → 500 generic 'Internal server error';
  malformed JSON falls back to default args (tolerance pinned as current
  behavior, not endorsed). Secret-unset runs are fixture setup only —
  no test frames unset-secret access as desired authorization policy.
  DEF-1 (optional CLUB_DOWNGRADE_CRON_SECRET policy, MEDIUM) and DEF-2
  (raw DB error exposure, LOW-MEDIUM) remain OPEN for their separate
  reviews; TC02 is not a security review. Load-bearing evidence is
  reasoned counterfactual: removing the self-check, flipping `<`→`<=` on
  create, `<=`→`<` on downgrade, removing the secret comparison, or
  renaming the RPC/args each flips a directly asserted observable in a
  named test. Verification: targeted Edge run 2 suites / 48 tests PASS;
  combined `npx jest --runInBand --testPathPattern
  "clubs|check_membership_limits_function|club_downgrade_grace_period_function"`
  21 suites / 246 tests PASS (previous 19 suites / 198 tests still green);
  broad `supabase/functions/__tests__` sweep 678/678 tests PASS with 7
  zero-test pseudo-suites reported by jest's default `__tests__` testMatch
  (6 pre-existing phase9 fixtures/support files + the new stub, same
  established pattern as `phase9MetadataComposition.ts`); `npx tsc
  --noEmit` exit 0. PRODUCTION EDGE SOURCES UNCHANGED (SHA256 of both
  index.ts files identical pre/post); no Edge deploy, no migration, no
  live writes, no secret/verify_jwt/cron/config.toml changes. Nothing
  staged or committed; nothing pushed.

- 2026-08-30 WU-TC03 PAIRED FIX + DB CONTRACTS COMPLETE (migration drafted locally,
  applied live 2026-08-30 as ledger version 20260830153413 — see TC03 CLOSEOUT below): context gate proved `accept_club_admin_transfer_request`
  broken by construction (demote-before-admin_id-flip trips
  `enforce_single_club_admin_membership` on every invariant-satisfying club)
  plus missing accept-time revalidation, RLS-legal direct INSERT bypass, and
  self/archived/access request gaps. Fix design approved (minimum-safe scope;
  expired-status lifecycle, multi-pending index/lock, repo-only
  `transfer_club_admin`, notifications, app error mapping DEFERRED).
  Implemented locally: NEW forward migration
  `20260830153413_clubs_tc03_admin_transfer_accept_revalidation.sql`
  (repository filename renamed to live ledger version; SQL byte-stable;
  CREATE OR REPLACE both RPCs with approved guard set + required write order
  flip-admin_id-first; DROP direct-INSERT policy "Admins can create transfer
  requests"; grants re-stated; identity/return/SECURITY DEFINER/search_path
  preserved); NEW `supabase/tests/clubs/contracts/admin_transfer.test.mjs`
  (RED phase on pre-fix chain reproduces the invariant failure with full
  no-mutation readback; GREEN matrix: happy path, authorization, invalid
  successors incl. access-level, wrong acceptor, expiry, admin-changed,
  membership/tier/access drift, archived drift, RPC-only creation (42501),
  author-club semantics, cap-trigger rollback, function-contract
  preservation incl. ACL/EXECUTE matrix); MODIFY `clubsL4Runner.mjs` (tc03
  suite: B02 chain + 20260529154500 + documented TEMPORARY author_club CHECK
  live-parity step (REC-1 gap, L01-D/TEST-07 owns replay repair) + RED to
  GREEN sequencing on one disposable DB). Verification: targeted TC03 suite
  PASS (RED 3 evidence groups + GREEN 13 contract groups); FULL Clubs L4
  runner PASS (b02 + f04 + wave2 + rls + downgrade + tc03); clubs Jest
  17 suites / 190 tests PASS; `npx tsc --noEmit` exit 0. NO live migration
  applied, NO live RPC calls, NO app/Edge/config changes, historical
  migrations untouched. Nothing staged or committed; nothing pushed.
  TC03 CLOSEOUT 2026-09-13: migration live-applied (ledger 20260830153413;
  repository filename renamed to match; stored SQL semantically exact — sole
  delta vs draft is comment whitespace). Admin-flip-before-demotion invariant
  fix confirmed in the live `accept_club_admin_transfer_request` definition;
  structural verification passed read-only (both RPC identities, SECURITY
  DEFINER, search_path=public, plpgsql). CLOSED. (The 'NO live migration
  applied' note above describes the pre-deployment contract-verification
  session only.)
- 2026-09-13 WU-TC01 CLOSEOUT — downgrade/grace ambiguity fix (2026-08-30 work,
  now recorded): forward migration
  `20260830090435_clubs_fix_downgrade_grace_archived_club_ids_ambiguity.sql`
  (repository filename renamed to live ledger version; SQL byte-exact match to
  the stored ledger statement modulo trailing-newline convention). Original
  defect: the RETURNS TABLE OUT parameter `archived_club_ids` collided with
  `club_downgrade_grace_events.archived_club_ids`, failing every non-dry-run
  existing-warning UPDATE with 42702 and rolling back remediation. Fix qualifies
  the column reference; identity/return/SECURITY DEFINER/search_path/EXECUTE
  contract preserved (live structural check:
  `process_club_downgrade_grace_period(p_user_id uuid, p_grace_days integer,
  p_dry_run boolean)`, secdef, search_path=public, plpgsql). Live applied
  (ledger 20260830090435, 2026-08-30 09:04 UTC). Retrospective cron health
  verified read-only: job `club-downgrade-grace-period` (`0 2 * * *`, active);
  the 2026-08-30 02:00 UTC run was pre-deployment (NOT post-fix); first true
  scheduled post-fix run 2026-08-31 02:00 UTC succeeded; all retained post-fix
  runs healthy with zero 42702 recurrence (100/100 retained runs `succeeded`,
  zero failures). CLOSED.
- 2026-09-13 WU-TC04 CLOSEOUT — book-workflow concurrency/write-boundary fix:
  migration `20260912200746_clubs_tc04_book_workflow_write_boundary.sql`
  (renamed to live ledger version; SQL byte-exact). Nomination concurrency
  23505 repaired with bounded conflict-safe re-evaluation (targeted ON CONFLICT
  plus retry loop, first-writer-wins); direct nomination/vote INSERT bypasses
  closed (REVOKE plus policy drops); authenticated direct
  `book_clubs.current_book_id` UPDATE closed (column-level boundary, legitimate
  selection RPCs preserved); function/ACL preservation verified live
  (`nominate_club_book` 7-arg identity, SECURITY DEFINER, search_path=public).
  Independent adversarial review passed; live applied (ledger 20260912200746);
  structural verification passed. CLOSED. The migration body's historical
  'LOCAL ONLY — NOT APPLIED LIVE' comment is superseded by this entry; the SQL
  was left byte-stable as production provenance.
- 2026-09-13 WU-TC05 CLOSEOUT — useClubs mutation invalidation contracts
  (client-only, no backend/live operation, no DB migration): `eventRoot` key
  hierarchy fix (event invalidations now fan out to all users); `manageDetail`
  invalidation added after current-book selection
  (`useFinalizeClubBookNomination`, `useSetClubCurrentBookFromNomination`);
  `currentBookStatusRoot` invalidation added to member-status/member-action
  mutations; admin-transfer invalidation extended to status overview plus
  successor membership. NEW
  `src/features/clubs/hooks/__tests__/useClubs.mutations.test.tsx` with 21
  mutation tests (count verified). Broader Clubs result at
  implementation/review checkpoint: 20 suites / 219 tests; dual adversarial
  review passed. Cross-feature `user_books.reading_status` / Library cache
  coupling deferred separately. CLOSED.
- 2026-09-13 WU-TC06 CLOSEOUT — Clubs books/discussion service coverage
  (client-only, no backend/live operation, no DB migration): CONFIRMED
  PRODUCT DEFECT — `setClubDiscussionReaction()` sent incorrect PostgREST
  named RPC arguments (OLD/BROKEN: `p_topic_id`, `p_reply_id`, `p_emoji`;
  CORRECT live/applied contract: `in_topic_id`, `in_reply_id`, `in_emoji`).
  Production fix in `src/features/clubs/services/clubsDiscussionService.ts`
  (argument names only; RPC name `set_club_discussion_reaction` unchanged, no
  `user_id` argument, actor identity remains server-derived). NEW
  `src/features/clubs/services/__tests__/clubsBooksService.test.ts` (44 tests)
  and `src/features/clubs/services/__tests__/clubsDiscussionService.test.ts`
  (39 tests); `clubsDiscussionReactionRpc.test.ts` corrected to `in_*` with
  `p_*`/`user_id` regression guards. All 11 active Clubs book service exports
  and all 12 active Clubs discussion service exports covered materially; no
  dead exports found in scope. Verification: targeted TC06 3 suites / 91 tests
  PASS; all Clubs service tests 4 suites / 138 tests PASS; broad Clubs 20
  suites / 294 tests PASS; `npx tsc --noEmit` exit 0. Mutation sensitivity
  independently verified (each RED then GREEN): M1 reaction RPC named
  arguments, M2 current-book reading-status `p_status`, M3 reading-schedule
  `book_id` filter, M4 discussion vote target/onConflict, M5 discussion report
  club filter. Independent adversarial review PASS: 0 blockers, 0 majors,
  0 unresolved material unknowns. Scope: no DB migration, no live DB writes,
  no live mutating RPC invocation, no RLS change, no Edge change, no hook
  change, no screen change, no Library change, no `user_books` cache change.
  Non-blocking deferred items: optional Google `smallThumbnail` fallback test
  coverage; missing-target guard coverage asymmetry for remove discussion
  vote; current-book-overview defensive empty-result handling; known
  Library/Clubs `user_books.reading_status` cache coupling; other previously
  documented deferred Clubs hardening items. CLOSED.

- 2026-09-13 MIGRATION RECONCILIATION DEFERRED — migration-history
  reconciliation was audited on 2026-09-13 and intentionally deferred because
  the shared Supabase project has active parallel feature work. Authoritative
  details: `docs/deployment/MIGRATION-RECONCILIATION-2026-09.md`. Normal
  production migration deployment remains frozen until reconciliation is
  resumed and completed. This does NOT block Clubs commit/push/PR/merge
  because repository merge does not automatically deploy database migrations.
  Clubs implementation status unchanged by this entry.
- 2026-09-30 DISCUSSION THREAD UI REDESIGN — implemented the approved Stitch
  conversation-first direction in `src/features/clubs/screens/ClubDiscussionThreadScreen.tsx`:
  warm editorial palette and Newsreader/Inter typography; club context, topic
  kicker, serif title, avatar/byline and relative time; topic report menu beside
  the kicker; a prominent reply action with compact score/vote controls; and a
  grouped reply stream with parent attribution. Reply count, unread count and
  mark-read action now sit in the Replies heading; the reply sheet also uses
  the approved response label and preview hierarchy. Existing hooks, services,
  mutations, routes and backend schema were not changed. Added a focused
  structure assertion and retained the existing interaction-contract tests in
  `src/features/clubs/screens/__tests__/ClubDiscussionThreadScreen.test.tsx`.
  Verification: focused thread suite 6/6 PASS; `npx tsc --noEmit` exit 0;
  Expo Web bundled and served the running V2 checkout at localhost:8081. Opened
  the seeded thread in the browser and inspected the page plus the topic menu,
  reaction picker and reply sheet (opened/cancelled; no writes sent). No backend
  mutation, migration, or service change. Nothing staged or committed; nothing
  pushed.

## Rules
- Existing 18 suites must stay green after every phase; new primitives get tests.
- Any phase may be shipped independently; order P1→P5 recommended.
