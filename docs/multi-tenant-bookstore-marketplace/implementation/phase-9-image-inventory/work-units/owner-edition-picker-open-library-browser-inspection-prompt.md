## 2026-10-12 - M74 applied and verified; Open Library disabled; Render held

Current status: open_library_m74_applied_verified_render_held. Phase 9 / Unit 6G remains active. The Owner explicitly requested completion of M74 preflight/application after the approved bounded correction. That application authority supersedes the earlier local-only gate for M74; publication, provider activation and Render deployment remain held.

Fresh preflight matched the reviewed file and both M73 function bodies/permissions on Bookconnect_reactexpo / ahntbtktjjmvfosgkmgn; the focused full-M74 SQL/security suite passed 20/20. M74 is APPLIED_VERIFIED as live version 20261012140853. Archived SQL SHA-256 FE0B13B7D10DA09AFFF71E031E6330F8568C5D05638F079551A7652172EF2FF3 matches the unchanged local file; both installed function bodies match the reviewed definitions.

Only the two private completion/registration functions changed. Their signatures/owners/ACLs/search paths and 17 other checked functions remain intact; provider-call columns/RLS/ACLs/policies, provider flags and observed business/job counts are unchanged. Open Library remains disabled with no unresolved OL attempt. One existing in_progress edition job has an expired lease; it was observed and preserved.

Exact next authorized action: independent read-only GPT-6 Luna/max aggregate prepublication review of the final Open Library diff and evidence. Compatible client/worker/Owner API rollout, separately authorized provider activation and controlled shared operational acceptance remain pending. STOP before Render deployment. No commit, push, runtime deployment, provider request, Auth/inventory/Storage write or account/configuration change occurred. [Application ledger, exact readback and scope](../trackers/37-owner-edition-picker-open-library-local.md) (§15). Earlier dated checkpoints are historical.

## 2026-10-12 - Author isolation corrected locally; M74 unapplied; Render held

Current status: open_library_author_corrections_local_verified_m74_pending. Phase 9 / Unit 6G remains active. The Owner authorized "Yes, fix both and create local M74". Both aggregate P2 findings were reproduced, corrected and regression-tested; GPT-6 Luna/max approved the bounded correction. This does not replace the aggregate prepublication review.

The adapter validates edition facts before allocating complete own-author sets within the four-author budget. Nonretryable author-content failures leave only dependent rows unavailable; local M74 permits truthful finalized receipts to continue and complete without weakening mandatory-stage, retryable, egress or authority guards. Google ranking/cover and Owner UI behavior are preserved.

M65-M73 remain applied and byte-preserved. M73's archived live SQL matched its reviewed hash in this session's read-only exact-project check; OL remains disabled. M74 is CREATED_LOCAL / NOT_APPLIED. No shared mutation, provider request, browser action, staging, commit, push or deployment occurred in this correction.

Exact next authorized action: independent read-only GPT-6 Luna/max aggregate prepublication review of the final Open Library diff and evidence. M74 application needs a separate decision and fresh preflight; compatible client/worker/Owner API rollout, provider activation and authenticated operational acceptance remain gates. STOP before Render deployment. [Exact scope, commands, migration ledger and evidence](../trackers/37-owner-edition-picker-open-library-local.md) (§14). Earlier dated checkpoints are historical.
# Independent predeployment browser inspection: Owner edition picker

Copy the prompt below into a new browser-testing session. This handoff does not start browser testing in the preparation session. Return the browser report here before the final Free-plan/configuration preflight.

---

Test the rendered Phase 9 Owner edition-picker UI before deployment. Inspect both the compact scan card/metadata sheet and the full candidate review flow. Produce screenshots and actual interaction evidence. This is a browser workflow task; do not replace it with another backend code review.

## 1. Exact checkout and authority

- Use ONLY C:\Users\user\.codex\worktrees\edition-picker-research\Bookconnect. Pass that absolute workdir to every repository command. Branch codex/edition-picker; recorded HEAD d3bda38d179e0d7a8b3ed877df0a4bd5239a0a8e. Reverify branch/HEAD/status; preserve all existing dirty files. Do not use the Desktop checkout.
- Read AGENTS.md, implementation/ACTIVE.md, DOC-13, Phase 9 SESSION-START/TRACKER, picker §§3/6–9/13.14 and tracker 37 (37-owner-edition-picker-open-library-local.md). State current status and limits.
- The local fallback, native PostgreSQL/accounting tests and request-spacing correction have evidence. M65–M72 are applied and preserved; M73 is local/unapplied. Reverify recorded status rather than assuming a later rollout occurred.
- This prompt authorizes local app startup, browser interactions with isolated fixtures, test-only temporary fixture support, screenshots and logs. Leave production source, migrations, existing tests/docs and unrelated user files unchanged.
- NO commits/pushes, shared migrations, deployed worker/API changes, provider-registry/config/secret/billing changes, paid services, shared inventory/Storage writes or deletes, or Auth administration changes. No final Free-plan/configuration preflight here: return results to the preparation session for that step.
- Test support must remain local and identifiable. Do not create CJS helpers. Record any temporary files/processes and clean up only resources you created.

## 2. Verify the browser and app first

Reuse a verified preview serving this worktree; otherwise use its existing web startup/export scripts and approved environment. Record origin, port, process, checkout and build identity without exposing secrets. Do not assume localhost:8083 still serves this branch.

Use Codex browser control first: inventory surfaces, select/open the local preview, read the page, take a screenshot and perform a harmless click. Read the computer-use skill if using its capabilities. If control fails, attempt one supported reset/retry and record the exact error. Existing Playwright infrastructure is an authorized fallback for actual local browser tests/screenshots, with the fallback clearly disclosed. Do not claim browser evidence from HTTP 200, source code or bundle markers.

The existing development test login is phone 1234567890 / OTP 123456. Use real login only against the verified development environment and only for observation; do not create users or print tokens. In the isolated fixture lane, use explicitly synthetic Auth responses instead.

Earlier development route:
http://localhost:8083/inventory/scan/93567d47-3874-4576-b3b4-1adb044b552b?sessionId=93567d47-3874-4576-b3b4-1adb044b552b
Treat it as a historical route; confirm it exists and use the verified preview origin.

## 3. Separate two evidence lanes

A. Existing development app, observation only:
- Inventory → Resume scan; inspect compact cards, open/close Change edition and inspect the full review route.
- Capture the chosen cover/title/authors, current suggestion, source-neutral search label, empty/disabled/error state, navigation and responsive layout.
- Do not click Search Books/select/Save/Add against the shared project. M73, compatible deployed runtimes and OL activation are separate prerequisites; this inspection must not deploy them to obtain results.
- Report exactly what this lane can and cannot show.

B. Isolated browser fixture workflow, before deployment:
- Exercise the actual application routes, components, hooks and outgoing command payloads using fixture responses at the service boundary. Do not substitute a recreated demo picker.
- Inspect the existing e2e/Playwright patterns (playwright.config.ts, e2e/store-view-wu4-harness.ts) and imageInventory mounted fixtures/contracts for reuse. There is no claim that an edition-picker browser fixture harness already exists.
- If necessary, create minimal test-only fixture wiring in an approved temporary/artifact directory. Do not change product behavior, disable production authentication, broaden URL allowlists or insert fake choices into the shared database.
- Isolate the browser context and intercept ALL provider/Supabase/Auth/data requests in this lane; fail unexpected external requests. Synthetic data must not reach the shared project.
- Use strict current DTOs, real command names and coherent versions/confirmation IDs. Model pending, success, authoritative rejection and uncertain outcomes at the boundary. Count outgoing requests.
- Reopening/reloading may verify fixture state restoration, but call it fixture persistence. The separate native PostgreSQL proof establishes database behavior. Do not call their combination a deployed end-to-end test.
- If isolated fixture wiring cannot be established, complete lane A and report the specific blocker for lane B. Never manufacture a PASS.

## 4. Required fixture sets

Prepare at least:
1. Ten ordered OL positions with selectable results at ordinals 7/8, after unavailable/ineligible positions; repeated positions remain repeated. Cover the first-five/Show all path.
2. A coherent own-cover edition and a different no-cover edition, including long title, multiple authors and partial publication dates.
3. Current suggestion, already Owner-confirmed edition, pending lookup/selection/reconciliation, empty, failed and expired alternatives.
4. Two independent unfinished cards with different selling values; a local-match/older-card case with no stored alternatives.
5. Save/Add success, authoritative rejection, uncertain response/reconciliation and per-card bulk partial success. Do not fake database proof from these responses.

Use normalized factual OL data only; no raw provider bodies/descriptions. Missing authors/identity facts must not become selectable. Google fixtures retain relevance order and separate permission denial; OL fixtures retain returned edition-page order, not an invented newest-first ordering.

## 5. Check both compact and full flows

Run at desktop (about 1440 px) and narrow mobile (about 390 px) widths. Record actual viewport and route.

- Open/close: no automatic provider lookup or selection on mount/open/Show all. One card remains one identified book, with one chosen cover.
- Search Books: one explicit tap issues one logical request; loading is source-neutral; repeated taps are controlled. Locally matched, cached and older cards can explicitly search. Denied permission/disabled provider is explained without fabricated results.
- List: first five returned positions, Show all up to ten, original order and duplicates preserved. Ineligible rows are visible but disabled; unavailable positions have placeholders. Eligible late rows 7/8 become reachable/selectable.
- Each row: own cover or placeholder, title, ALL authors, supplied publication date with its precision, supplied publisher/ISBN/language/edition statement, selected/eligibility indication. Do not claim every API result is a distinct or numbered edition.
- Attribution/link: actual-provider label and safe book-page link adjacent to choices. OL links use https://openlibrary.org/books/OL<id>M; own covers use https://covers.openlibrary.org/b/id/<id>-M.jpg. Do not make live link/provider requests in the fixture lane; verify the outgoing target safely.
- Covers: an automatic Google suggestion can retain its separately labelled representative cover. Selecting an explicit own-cover option uses that cover. Selecting a no-cover edition displays a placeholder and never borrows the previous cover.
- Selection: test busy state and Close/back locking through BOTH command completion and reconciliation. Confirm dismissal/focus is restored afterward. Owner confirmation and selection reference survive reopen/fresh resume in fixture state.
- Selling edits: enter test price, quantity, condition, shelf/location and notes; change edition; preserve those values through Save and resume. Capture actual outgoing payloads and returned versions.
- Existing corrections: “Use matched details” preserves confirmed edition_option and its reference; “Use detected details” resets replaced title/author confirmations; stale detected details are hidden and rejected. Author confirmation count follows the replacement array.
- Shared locking: Save/select/single Add/bulk Add cannot use stale selection/version while another action/reconciliation holds the shared guard. Authoritative Add rejection releases the uncertainty guard; unresolved response loss keeps recovery protected.
- Add: fixture success clears only the committed card’s unused options, retains its chosen facts and produces one visible inventory effect. Failed/uncertain Add keeps choices until resolved. Bulk partial success leaves unsuccessful cards intact.
- Expiry: alternatives become unavailable after their recorded deadline; chosen facts and selling details remain. Explicit refresh is available. Use fixture clocks/expired DTOs; never alter shared clocks/TTL or wait 24 hours.
- Accessibility: keyboard order/selection, visible focus, close/back/focus return, button labels, scroll/overflow, cover failure fallback and polite empty-result announcement. Distinguish inspected accessibility attributes/keyboard behavior from an actual screen-reader or native-device test.
- Network evidence: show sanitized command counts/payload fields. The backend local timing proof covers default 1-second actual-start spacing across three jobs; do not claim mocked browser calls independently prove live Render spacing. Batch15/concurrency3 remains unchanged.

## 6. Report and stop

Lead with UI_VERIFIED_LOCALLY, UI_CHANGES_REQUIRED or BLOCKED, bounded to evidence actually obtained.

Include:
- Exact checkout/branch/HEAD, preview/build identity and browser/control method.
- A matrix: lane | compact/full route | viewport | scenario/action | PASS/FAIL/UNRUN | screenshot/trace | persistence boundary.
- Screenshots of first-five and expanded choices, own-cover/no-cover, late selectable rows, selection/busy state, saved/resumed selling values and narrow layout.
- Actionable findings only: reproduction, expected source section, observed control/payload, impact and evidence. Do not fix production code in this inspection.
- Exact local fixture/test-support changes, commands, external requests actually made (normally none in fixture lane), and process teardown.
- Separate UI fixture findings, native DB evidence supplied by context, and unrun shared/deployed/device gates. Missing shared prerequisites are not UI defects.
- Return this report to the preparation session. STOP before final Free-plan/configuration preflight, M73 application, provider activation, publication or deployment.
