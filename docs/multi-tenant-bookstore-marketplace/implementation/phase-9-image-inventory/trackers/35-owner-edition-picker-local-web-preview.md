## 2026-10-10 - Browser-rendered UI inspection; live edition reader unavailable

The Owner requested a local UI check before Git publication. I started the Expo web preview from C:/Users/user/.codex/worktrees/edition-picker-research/Bookconnect, branch codex/edition-picker, HEAD ee3a8c79429ca401d468861f2861721082ba955e, on localhost:8083. Preview terminal session: 49752. Project identity was freshly checked with Supabase MCP as Bookconnect_reactexpo / ahntbtktjjmvfosgkmgn / ACTIVE_HEALTHY. The local client received only the process-scoped project URL and enabled legacy anon key; the inherited foreign SUPABASE_URL and service credential variables were removed from the preview process.

Fresh delivery checks:
- Scan HTML: HTTP 200.
- Exact Expo web bundle: HTTP 200, 15,031,973 characters, 2,410 modules.
- Bundle markers: CandidateEditionPicker, EditionOptionList, Search Books, and target project origin present.
- Source provenance: 290 references to edition-picker-research; zero Desktop Bookconnect/src references.
- Expo emitted a patch-version compatibility warning but rendered the page successfully.

The Codex in-app browser opened the existing scan route at 409x800. The persisted scan displayed 5 detected, 1 in review, 4 added. Book 5 was Confessions of a Philosopher by Bryan Magee, marked Needs attention, with No cover; its Change edition button was visible. Pressing Change edition opened the Book metadata sheet. The actual rendered sheet showed Multiple possible matches, no selected metadata details, Google Books search results, and detected title, authors, and language. Its saved-choice read failed and the sheet displayed Edition choices are unavailable. Retry the saved choices read, a Retry choices control, Use detected details, Edit manually, and Close metadata. No edition rows, individual covers, publication dates, publishers, ISBNs, or Search Books control rendered. The mobile sheet and its fallback controls were visible in the browser screenshot; the sheet stayed open after inspection.

The choices read is automatically triggered on sheet open and is read-only. Fresh Supabase MCP readback confirms phase9-owner-ingestion is ACTIVE version 14 with verify_jwt enabled. The deployed source does not contain the local client's read_candidate_edition_choices, request_candidate_edition_options, or select_candidate_edition action names. This compatibility gap is consistent with the visible saved-choice read error and prevents an end-to-end choice-list check. The local frontend entry surface renders; edition option display and selection remain unverified.

No Search Books action was clicked, so no Google Books request or provider retention occurred. No option was selected; no new Auth/OTP request, Save, Add, inventory, Storage, database, or migration write occurred. The browser had an existing authenticated session. No source/configuration/dependency/test/migration file changed; nothing was staged, committed, pushed, merged, deployed, or applied. No new tests ran. M65-M71 remain applied as previously recorded. Existing provider-retention permission, browser/device, compatible deployed runtime, security/cleanup, disablement/rollback, and rollout gates remain pending.

Exact next action: Owner reviews the visible local result and decides whether to authorize publishing the branch and deploying a compatible development Edge function. Once compatible, repeat the browser check for Search Books, option metadata/covers, confirmed selection, Save/resume, and Add. Keep live provider retention separately gated.

## 2026-10-09 - Tracked preview restored; working Codex comparison pending

The Owner reports that Codex works in another setup and asked whether this app
is running. Fresh home/scan checks initially returned connection refused with
no listener on 8083. The earlier preview's exit cause has not been established.

The authorized preview was restored in a tracked terminal session, 88962,
rather than another detached launch. Current server PID: 14844. The same
process-only Metro/dependency/client configuration was used in the existing
edition-picker checkout. Fresh home and scan HTML returned HTTP 200. The
complete bundle returned HTTP 200 with 14,986,671 characters, the edition-picker
marker and exact project origin, and zero Desktop app/src source paths.
This proves current delivery/source provenance, not rendered UI acceptance
or guaranteed survival across later app/machine restarts.

The Owner also reports seeing a login page open in a browser. This is an
Owner-reported display observation; the exact setup/URL and successful agent
browser control there have not been established. This chat's fresh getState
attempt timed out after approximately 30 seconds, before tab/DOM access.
No screenshot, agent browser login or live edition selection is claimed.

Do not infer that all Codex environments are broken or that Git branching
caused this failure. The recorded blocker is this environment's browser-control
startup. Compare the working setup's app/runtime/permissions and actual
browser read/click capability before choosing a broader sandbox repair.

Ignored evidence: .phase9-dist/edition-picker-tracked-preview-check.json and
.phase9-dist/edition-picker-tracked-preview-bundle-check.json. The running
terminal session can be monitored for an exit; no preview exit cause or
complete browser repair is claimed. No other helper was reset in this check.

Only the local preview process and four handoff documents changed. Product
source/configuration/tests/migrations were not edited; no Auth, inventory,
database, Storage, provider, deployment or Git-publication write occurred.
Product tests were not rerun. Phase 9 / Unit 6G, prior local approvals and
applied M65-M70 remain unchanged. Status stays
local_web_bundle_verified_browser_runtime_blocked.

Closeout verification: continuity PASS, exit 0 (195 definitions; zero
duplicates/missing traces); git diff --check PASS. Product tests were not rerun.

Exact next authorized action: compare the Owner's working Codex setup and its
browser-control capability, then inspect this existing local scan preview
through a working supported browser connection. Git publication/deployment
remain deferred behind the Owner's UI inspection.

## 2026-10-09 - App restart checked; preview restored, sandbox failure persists

The Owner reported a complete desktop-app restart and requested verification.
Fresh process identities confirm a new Codex desktop/backend process tree.
Browser getState timed out after approximately 33 seconds. A later direct
createBrowserTab request failed before page access with trusted Node process
exited unexpectedly. Fresh sandbox log lines 668-672 report Windows error 32
on node_repl.exe during runtime permission refresh. The app restart did not
resolve browser control; no screenshot, login or displayed UI PASS is claimed.

The previous preview had stopped: no listener on 8083 and connection refused.
The existing process-only launch was restored from the exact edition-picker
checkout after read-only verification of Bookconnect_reactexpo /
ahntbtktjjmvfosgkmgn and its public client configuration. New preview PID 7016.
Initial checks occurred during cold Metro startup/compilation: a refused
connection and one HTML timeout. After compilation finished, fresh scan HTML
and its exact JavaScript bundle both returned HTTP 200. The bundle contains
14,986,671 characters, CandidateEditionPicker and the target project origin,
with zero Desktop app/src source paths. The process remained listening.

Ignored runtime evidence: .phase9-dist/edition-picker-background-process.json,
its current uniquely named stdout/stderr logs, and
.phase9-dist/edition-picker-after-restart-preview-check.json. Keys/tokens are
not included in the evidence summaries. No source/configuration file was
edited, no extra helper reset was performed, and no Auth/business database,
Storage, provider or deployment write occurred. Product tests were not rerun.

Closeout: documentation continuity PASS, exit 0 (195 definitions, zero
duplicates/missing traces); git diff --check PASS. Four existing handoff
documents were updated; product tests were not rerun.

Phase 9 / Unit 6G, prior local approvals and applied M65-M70 remain unchanged.
Status remains local_web_bundle_verified_browser_runtime_blocked.
Next authorized work is diagnosis of the recurring Windows sandbox runtime
permission refresh failure, then browser UI inspection once startup succeeds.
A restart is now tested and unsuccessful; repeated helper kills or branch
changes are not an established repair. Git publication and compatible backend
rollout remain deferred behind the Owner's local UI inspection.

## 2026-10-09 - Authorized runtime reset; browser connection remains blocked

The Owner explicitly authorized resetting processes. Fresh exact-path/name,
creation-time and PID checks preceded termination. Six node_repl.exe runtimes
were stopped: 21728, 12920, 15896, 6864, 18788 and 7540. The BookConnect preview
was preserved and remained listening on port 8083 under PID 5636.

The sandbox log identifies Windows error 32 while opening Codex runtime files
for permission refresh. After the JavaScript runtimes stopped, the next
ordinary sandbox-startup probe no longer reported node_repl.exe; it reported
the computer-use helper's VCRUNTIME140_1.dll. Module inspection confirmed that
codex-computer-use-swift.exe PID 16860 had that exact DLL loaded. That verified
helper was also stopped. Codex's desktop parent automatically launched a
replacement, PID 936, which loaded the same DLL; a second sandbox probe still
failed. This supports a runtime-file sharing conflict during sandbox setup,
not a Git-branch cause. No stale-process diagnosis is claimed for every helper.

The browser js_reset and getState calls returned Transport closed after the
runtime termination. Browser connection reinitialization remains necessary;
no successful reconnect, page/DOM access, login or visual acceptance occurred.
Do not repeat helper termination while the desktop parent keeps respawning it.
A complete app/browser connection reinitialization is the next repair step;
a full restart is not yet proven to resolve the sandbox permission failure.

Read-only evidence: C:\Users\user\.codex\.sandbox\sandbox.2026-10-09.log
(lines 600, 613 and 625), setup_error.json, process identities and module
inspection. Windows 10 Pro build 19045 and windows.sandbox = elevated were
read back; no sandbox mode, global configuration or isolation policy was
changed. Normal sandbox startup attempts may update setup logs/state.

Only seven verified local helper processes and this documentation were changed.
Product source, tests, migrations and client configuration were not edited.
No Auth, database, inventory, Storage, provider, deployment or Git-publication
action occurred. M65-M70 remain applied; prior local review provenance remains
unchanged. Product tests were not rerun for this process-only diagnosis.

Closeout verification: documentation continuity PASS, exit 0 (195 definitions;
zero duplicates or missing traces); git diff --check PASS. Product tests
were not rerun. Only three existing handoff documents were edited.

Phase 9 / Unit 6G and local_web_bundle_verified_browser_runtime_blocked remain
current. Exact next authorized action: reinitialize Codex's app/browser
connection and establish successful sandbox startup, then inspect the existing
scan UI before Git publication/deployment. This records operational evidence
under SESSION-START §§6/8 and preserves picker §§6-11/13.2 gates.

## 2026-10-09 - Fresh scan-route delivery; browser retry blocked

The existing preview was already healthy on port 8083 (PID 5636), so it was reused without restart. The requested scan route returned HTTP 200 as HTML. Its actual Expo JavaScript bundle at `/node_modules/expo-router/entry.bundle` returned HTTP 200 as JavaScript (14,986,671 characters). The bundle contains the edition-picker checkout marker, `CandidateEditionPicker`, `EditionOptionList`, `Search Books`, and the verified development project origin; it contains zero Desktop checkout `app/src` source-path markers.

Codex browser `getState()` failed before tab access with `node_repl kernel exited unexpectedly` and `windows sandbox failed: helper_unknown_error: setup refresh had errors`. One supported `js_reset` followed by one `getState()` retry produced the same failure. No browser page, DOM, screenshot, login, rendered state, or live edition choice was observed. This delivery/provenance evidence is not a visual browser PASS.

No app/source/configuration, migration, database, inventory, Storage, provider, Auth, or preview-process state changed in this check. The exact next authorized action remains restoring Codex browser control, then logging in through the UI and inspecting the scan flow before Git publication or deployment. See SESSION-START §§6/8 and picker SDD §§6-11/13.2.

# Owner Edition Picker: Local Web Preview and Runtime Handoff

## 2026-10-09 - Browser failure clarified; background preview restored

Fresh readback confirmed codex/edition-picker at
ee3a8c79429ca401d468861f2861721082ba955e, with 74 modified / 86 untracked /
zero staged paths. The prior preview had stopped: no listener on port 8083
was present. The reason it stopped has not been established. Prior HTTP 200
results were observations while that earlier process was running.

The authorized preview was relaunched with Start-Process -WindowStyle Hidden,
using the same process-only Metro dependency fix and exact verified development
client configuration. The source/configuration files were not changed. The
new process survived its launching shell's exit and subsequent independent
commands. PID at this checkpoint: 5636. This proves survival of the launcher,
not a guarantee of survival across desktop or machine restarts.

Fresh scan HTML and bundle requests both returned HTTP 200. The bundle has
14,986,671 characters, contains CandidateEditionPicker and the target project
origin, and has zero Desktop app/src source paths. The process remained alive
and listening after that full bundle check.

Fresh Supabase MCP readback on ahntbtktjjmvfosgkmgn confirmed
phase9-owner-ingestion v14 ACTIVE, verify_jwt=true. The previously inspected
v14 source lacks the new edition actions; compatible backend rollout remains
pending. M65-M70 remain applied and were not reapplied.

Codex browser initialization still fails before reading a tab. The observed
default-shell and browser-helper setup errors, while escalated shell commands
work, point to an execution-environment problem. No Git-branch cause has been
established. Neither the last 57 passing mounted UI tests nor bundle delivery
is a live visual browser test. No browser login or live edition search is
claimed. No additional Jest/TypeScript/provider tests were run for this repair.

Ignored runtime evidence: .phase9-dist/edition-picker-background-process.json,
its uniquely named stdout/stderr logs, and
.phase9-dist/edition-picker-background-preview-check.json. Public client
configuration is confined to the process environment; keys/tokens are not
printed or stored in these summaries.

This repair changed only the local preview process and documentation evidence.
No product source, test, configuration, migration, inventory, Storage, provider
permission, Git publication, or deployment was changed.

Exact next authorized action: diagnose/restore browser runtime control and
perform the local visual UI inspection before Git publication. Compatible
development backend rollout and live-provider permission remain later gates.

## 2026-10-09 - Mounted UI verification

The Owner requested a UI presence check against the local scan route.

- The scan route returned HTTP 200, and its 14,986,671-character web bundle
  returned HTTP 200 with CandidateEditionPicker, EditionOptionList, and Search
  Books markers. The bundle contains zero Desktop checkout app/src paths.
- Source wiring: CandidateMetadataSheet renders CandidateEditionPicker when
  commandSlot/onSelection are available; CandidateReviewScreens connects the
  full review edition sheet; BatchReviewCard reads edition choices. This
  confirms code integration and bundle inclusion; visibility for this
  particular card still depends on its loaded state and user action.
- Existing mounted UI tests: six suites, 57/57 passed. Covered
  CandidateReviewScreens, unit6gMountedRouteComposition,
  ownerEditionPickerFullReview, ownerEditionPickerMounted,
  ownerEditionPickerSheetStates, and EditionOptionList.
- The Codex browser request again exited before tab access with
  `windows sandbox failed: helper_unknown_error: setup refresh had errors`.
  No visual screenshot, real browser interaction, or browser login is claimed.
  The earlier successful OTP/verify API check is not a browser login.
- The currently deployed owner-ingestion Edge function remains v14, which lacks
  the edition-choice/request/selection actions. Live edition lookup and
  selection are not verified by the mocked mounted tests.

No product source, tests, configuration, migration, database, Storage, provider,
or deployment state changed in this check. The local preview remains available
at `http://localhost:8083`. Exact next action: restore browser-runtime
control and visually inspect this scan route; deploy compatible development
backend only after the Owner has reviewed the UI and approved that next stage.

## 2026-10-09 - Restart verification and workspace recovery

The Owner retried after restarting Codex. Browser startup still failed before
tab access, including a fresh browser reset, with "trusted Node process exited
unexpectedly". The default sandboxed shell also reported "setup refresh had
errors"; the authorized escalated shell remained available. No causal link
between Git branch choice and the browser startup failure has been established.

Fresh read-only checkout verification confirmed both dirty worktrees intact,
at the selected ee3a8c79429ca401d468861f2861721082ba955e commit: edition-picker
74 modified / 86 untracked / zero staged; Desktop saved-books branch 59 modified /
47 untracked / zero staged. Neither checkout has unmerged files.

The local server had stopped during the restart. The same process-only launch
was restarted successfully. Latest listener PID: 19080; command session: 98451.
Fresh HTML and bundle requests returned 200; the edition picker and verified
project origin are present, with zero Desktop app/src path matches. The public
client configuration was retrieved read-only from the exact project again.
No new Auth request or business-data mutation occurred in this retry.

Immediate workspace recovery: add this existing edition-picker folder to the
Codex local project, make it primary, and start a Local chat in its current
checkout. [Official OpenAI project documentation](https://learn.chatgpt.com/docs/projects)
confirms that new chats use the primary folder for their working directory,
Git and automatic project-instruction discovery. This corrects workspace
alignment; it is not proof that the browser runtime failure will disappear.
If browser control remains unavailable, manual Chrome inspection of the local
preview can establish displayed UI while automated browser proof stays pending.

No branch was switched, worktree moved, file copied over the other checkout,
source/configuration/migration edited, or code staged/committed/pushed/deployed.
Git publication, compatible backend deployment, provider permission and the
remaining operational tests retain the earlier gates.

## 2026-10-09 - Current bounded checkpoint

**Status:** `local_web_bundle_verified_browser_runtime_blocked`.
Phase 9 / Unit 6G baseline complete. Task 8's independent LOCAL approval remains
valid. M65-M70 remain APPLIED / catalog-verified on Bookconnect_reactexpo /
ahntbtktjjmvfosgkmgn; [the application ledger](34-owner-edition-picker-m65-m70-application.md)
owns the six live versions and prior database readback. No migration was
reapplied in this preview task. This is a web bundle and Auth checkpoint,
not browser interaction or full operational acceptance.

Checkout: `C:\Users\user\.codex\worktrees\edition-picker-research\Bookconnect`.
Branch: `codex/edition-picker`.
HEAD: `ee3a8c79429ca401d468861f2861721082ba955e`.
The Desktop application checkout was not used as the application source.
Shared installed dependencies are a junction to its node_modules directory.

### Authorized scope and traceability

The Owner authorized development runtime/browser work, then explicitly chose
to inspect the locally changed app before committing, pushing or deploying.
The Owner supplied the existing development test login. Publication and
development deployment are deferred under that latest instruction.

This work records verification/status under repository AGENTS.md and
SESSION-START §§6/8, picker §§6-11 and §13.2, and the existing Task 8 operational
gates. It introduces no product, schema, selection or retention requirement.

### Preview startup diagnosis and correction

The worktree's node_modules junction initially made Expo emit a browser script
path outside the project. Its normalized URL returned 404. Preserving symlinks
made the entry URL valid, but Metro still needed to watch the real dependency
directory. An inline launcher initially leaked Node's -e argument to worker
processes; the owned process tree was stopped and that launcher corrected.

A subsequent 200 bundle contained some application routes from the Desktop
checkout. It was stopped rather than accepted as the correct preview.
The final launch preserves symlinks on the main CLI process only, clears
process.execArgv before Metro workers fork, adds the real dependency directory
to the in-memory Metro watchFolders, and clears the Metro transform cache.
Worker processes use normal Node resolution. The final bundle has zero Desktop
app/src source-path matches and contains the edition-picker worktree source.

All changes are process-only: no Metro, Babel, TypeScript, package, dependency,
application-source or environment file was edited. No custom CJS runner was
created. Only explicitly verified preview-owned process trees were stopped.

Client environment was set in the preview process to the verified project
origin and its public legacy anon key, development mode, and
EXPO_PUBLIC_DEV_SKIP_AUTH=false. Inherited shell Supabase values pointed at
another project and were not used for this app. Keys and Auth tokens were not
printed or written into the evidence documents.

### Verification actually run

| Check | Observed result | Limit |
| --- | --- | --- |
| Local /library HTML | HTTP 200 | No rendered UI assertion |
| HTML's exact Expo script URL | /node_modules/expo-router/entry.bundle | No outside-project browser path |
| Web JavaScript bundle | HTTP 200; 14,986,671 characters; 2,410 modules | Build/delivery, not browser execution |
| Application provenance | Zero Desktop Bookconnect app/src path matches; edition-picker-research root present | Shared dependency paths remain valid |
| Edition UI markers | CandidateEditionPicker, EditionOptionList, Search Books, confirmedByOwner present | Does not prove mounted interaction |
| Target origin in bundle | ahntbtktjjmvfosgkmgn.supabase.co present | No provider enablement |
| Supplied existing test account | Read-only existence query true | No account created |
| Auth OTP request | HTTP 200; SMS request; create_user=false | Auth API check |
| Auth OTP verification | HTTP 200; valid session returned | No browser session was created/injected |
| Codex browser control | Startup failed repeatedly | Browser test remains BLOCKED / NOT RUN |

The browser runtime failed before DOM access or credential entry with
`setup refresh had errors`, and later `trusted Node process exited unexpectedly`.
Reset/documentation restoration and fresh tab selection did not restore
control. The general trusted Node runtime also failed before code execution.
No screenshot, navigation, displayed-state, accessibility, Save/resume,
single/bulk Add, expiry, cleanup or recovery browser PASS is claimed.

The preview is left running on [localhost:8083](http://localhost:8083).
Verified listener PID at checkpoint: 23928; node.exe; owned inline Expo launch.
The command session identifier is 25197. These are session-local identities,
not reusable process identifiers after restart.

Ignored summaries: .phase9-dist/edition-picker-local-web-bundle-check.json and
.phase9-dist/edition-picker-test-login-check.json. They contain outcome
summaries, not tokens or provider payloads.

### Compatible backend and provider gates

Read-only exact-project Edge readback found phase9-owner-ingestion v14 ACTIVE,
with JWT verification enabled. Its 31 returned files contain none of the new
edition choices/request/selection action names. The preview's new UI therefore
does not prove successful live edition RPC operations; compatible Edge runtime
deployment remains required after the Owner's preview-first checkpoint.

Render's existing phase9-metadata-worker service is srv-d9sqfdvqj5pc73dc66fg.
Readback showed branch main, automatic deployment off, and live commit
bb91428048ca9028c5592cbbc52c982bd6843946. The reviewed edition-picker branch
has no published remote head. Triggering that current main deployment would
not deploy the uncommitted edition-picker source. No deployment was triggered.

Production edition-result retention remains disabled/unverified. Public
provider documentation review, existing automatic registry flags, and
synthetic local fixtures do not establish configured-provider permission.
No live Books request or alternative storage occurred. Picker §13.2 retains
the configured-provider and chosen-snapshot retention gate.

### External effects and preservation

Only the Owner-authorized OTP request/verification changed Auth session state.
Other Supabase and Render actions were read-only. No shared schema, candidate,
inventory, Storage, provider registry, secret, worker or deployment mutation
occurred. No staging, commit, push or merge occurred.

Existing source, test, migration and configuration bytes are preserved.
The handoff changes nine existing documentation files plus this evidence
record. Historical dated approvals and application evidence remain intact.
All implementation work remains uncommitted on codex/edition-picker.

Documentation continuity, whitespace, migration hash and preservation readback
results are recorded below after closeout. Prior Jest, TypeScript, PGlite and
native race gates were not rerun for this process-only preview task.

### Exact next authorized action

Restore Codex browser control and retry the local test login and scan UI
inspection before any Git publication or deployment. Then review the observed
UI with the Owner. Compatible Edge/worker deployment and configured-provider
permission remain the later prerequisites for live edition lookup/selection,
Save/resume/Add, expiry, cleanup and recovery proof.

### Closeout verification

- Phase 9 continuity: PASS, exit 0; 195 requirement definitions, zero duplicates
  or missing traceability; 93 Markdown files / 62 required phase files.
- git diff --check: PASS, exit 0; new evidence has zero trailing-whitespace lines.
- All six M65-M70 hashes match the recorded applied checkpoint.
- Preservation readback: all 1,437 original paths outside the prior 21-document
  application allowlist remain byte-identical; no missing or unexpectedly
  changed source/test/configuration path. The only new nonignored paths versus
  that earlier baseline are the already-created application ledger (34) and
  this new preview evidence record (35).
- Final checkout: codex/edition-picker at ee3a8c79429ca401d468861f2861721082ba955e;
  74 modified / 86 untracked / zero staged. No commit, push or deployment.
- Document-size and LF/CRLF advisories were nonblocking. Existing dependency
  compatibility, Browserslist and CSS warnings were observed; dependencies
  were not upgraded. No Python tests were run.
