# Manual-note review correction receipt

Date: 2026-10-10 (Asia/Calcutta)
Work unit: `library_sdd06_manual_cache_corrections_complete_persistence_gated`
Behavior authority: SDD-06 revision 0.4 baseline and recorded owner clarifications, unchanged by revisions 0.6/0.7's technical evidence.

**Current cache correction — 2026-10-10:** the owner accepted the independent review, independently reran both diagnostics and requested this bounded correction/regression/timing pass. The two additional cache findings are corrected locally; the five previous corrections remain verified. SDD revision 0.8 preserves the revision 0.4 behavior baseline. Current evidence is in the retained-reader cache section below; earlier 99/100-test receipts are historical. All four manual save gates remain false.

**Previous follow-up — 2026-10-10:** the independent rereview correctly narrowed the first pass to four fixed findings and finding 2 partly open. Its 99 passing tests did not cover repeated retry/re-entry. The owner then explicitly authorized that narrow correction and Interaction Map/receipt reconciliation. [Follow-up evidence](#repeated-pending-edit-re-entry-follow-up--2026-10-10) below records the mounted RED reproduction, fix and 100-test GREEN result. The first-pass claims below are retained as historical evidence, not evidence that its missing repeated cycle had passed.

## Authorization and review provenance

The owner accepted the local implementation review as sufficient for a bounded correction pass: reproduce its five findings, fix them, add the missing behavioral coverage, preserve the Save/Leave race as a repeatable regression test, and keep saving gated. This continues the already-authorized local manual slice; it does not authorize migrations, database test writes, OCR integration, another design cycle, deployment or Git publication.

Input: the completed Codex chat **Review manual-note slice**, ID `01a12222-6203-7d51-9efc-c56bd3b8c407`, read without messaging or changing that chat. Its source-branching findings were initially **source-inferred**, not device reproductions. The review's simulated-hook Save/Leave probe was not treated as an existing repeatable test. The table below records the new local reproductions. No additional broad review was started.

Repository/worktree: `C:/Users/LEGION/Desktop/Bookconnect4_library`; branch `codex/library-cover-shelf`. Existing mixed changes preserved. Marketplace Phase 9 remains `unit7c_resumed_connected_canary_pass_main_integrated`, Unit7C/M46 complete; DOC-13/ACTIVE and marketplace authority unchanged.

## Five findings: first-pass reproduction, correction and evidence (historical 99-test checkpoint)

| Finding and SDD contract | Initial evidence and local RED | Correction | Repeatable GREEN and limit |
|---|---|---|---|
| 1. Save confirmation races approved Leave; sections 5/5.2/10, R17 | Review supplied a simulated probe. New mounted-composer test failed: one Back was followed by reader Replace when Leave and confirmation reached the same render | Mark departure synchronously before allowing navigation; suppress automatic reader navigation after departure and reject further submission; retain the confirmed operation/cache result | `ManualNoteFlow`: **honors informed Leave when confirmation reaches the same render, without reopening the reader**. Asserts one Back, no Replace, retained confirmed operation, disabled departed Save and one write. Component/adapter simulation; native scheduling remains unproved |
| 2. Duplicate Book Details / wrong pending-edit return; sections 5/5.1/5.2/10, R02/R08/R09/R17 | Initially source-inferred. Route-state tests reproduced duplicate Book Details, pending preview-origin reader landing in Notes, and incorrect return to another book. A continuation test also failed when Keep editing/retry changed a reopened preview edit's origin to collection | Match book/note identifiers and the originating reader key in the actual navigation state; Back/pop to the intended existing destination, otherwise replace with that destination. Retain original edit origin/key through pending reopening, conflict Keep editing and retry | `noteNavigation` exercises the real React Navigation StackRouter reducer. Mounted journey reopens a pending preview edit from Notes, positively reconciles the same record, removes the composer and returns to the original Book Details key. `ManualNoteFlow` retry test preserves origin and the exact reader among normal browsing entries. Expo/native history, scroll and focus still require device proof |
| 3. Refetch failure hides an initialized dirty editor; sections 5/5.1/10, R09/R11/R12 | Initially source-inferred. Two real QueryClient component tests failed when book or record refetch errors replaced the retained form with an unavailable screen | Separate initial availability from initialized editor state; retain working fields and original edit baseline, show inline refresh failure and Retry refresh; account changes still clear former-account fields/operations | `ManualNoteJourney`: book and record refresh failures retain editable text, Question and page, show failure feedback and do not navigate. The QueryClient/refetch transitions are real; transport/database results are mocked |
| 4. Saved Pages read errors appear empty; sections 2/6 B01/10, R01/R20 | Initially source-inferred. Mounted tests reproduced false empty on initial failure and absent refresh-error feedback with cached excerpts | Distinct initial error with Retry, retained cached excerpts plus refresh feedback, neutral successful-empty copy; preserve confirmation, pending deletion and invalidation | Real QueryClient tests cover initial failure -> retry -> empty, cached refresh failure, and confirmed simulated deletion -> refetch -> empty. This does not prove live page ownership/deletion or the rest of book management |
| 5. Private book review labeled Private Note; section 6 B01/10, R20 | Pre-existing source label; initially source-inferred. Mounted Book Details toggle test failed to find Private Review | Change only the label to Private Review; preserve the rating/review/privacy mutation arguments | Mounted public/private toggle checks both labels and exact `addRating(bookId, rating, review, isPublic)` arguments. Persistence is mocked; no live review write |

Source corrected in this pass: `note-compose.tsx`, `note.tsx`, `notes.tsx`, `noteNavigation.ts`, `VaultPagesList.tsx`, and the private-review label in `[bookId].tsx`. The gate configuration, legacy OCR/editor/service behavior and dependencies were not changed.

## Added behavioral coverage

- Mounted production adapter rejection through the composer, before Supabase dispatch: blank category, over-limit text retained without write, valid text/page retained with honest gating feedback. No simulated success adapter was added to the product.
- Invoke the actual callback supplied to `usePreventRemove`: Keep editing retains the draft; confirmed discard dispatches the removal action once. Native gesture/back interception is not proved by invoking the callback.
- Mount the reader: missing/error states, omitted absent metadata, selectable body, body-only clipboard confirmation/failure, protected deletion and actual collection-cache invalidation/refetch after a simulated successful deletion.
- Actual QueryClient collection refresh after simulated Question creation: total changes 1 -> 2, Thought remains selected, the Question is hidden under Thought and appears under All. No database/scroll-restoration acceptance is inferred.
- Mounted pending leave/unmount retains an account-scoped entry and suppresses late reader navigation; mounted account change clears former-account submission/draft state and ignores a delayed status result.
- Positive create and edit reconciliation fixtures at both adapter/coordinator boundaries confirm identity/payload and the edit operation marker/exact next version, without replay. Rejected status reads remain unknown and retain submitted payload.
- Conflict cancellation and Keep editing preserve fields and issue no extra write; a retry preserves its original return context. Existing protected Use saved version, failed saved-version read and two-version-conflict tests remain.

All eight focused suites use simulated service/database/clipboard responses. QueryClient and StackRouter reducer state are exercised directly, with OS/router effects simulated. They verify local application behavior, not real database atomicity, ownership, native navigation or accessibility.

## Final verification

| Check actually run | Result |
|---|---|
| Eight focused Jest suites: ManualNoteJourney, noteNavigation, ManualNoteFlow, manualNotes, manualNotesGateway, notesService, NoteEditor.ocr, userBookPagesService | PASS: 99/99; 8/8 suites; no snapshots; normal exit, no forced exit |
| `node node_modules/typescript/bin/tsc -p tsconfig.library-notes.json --pretty false` | PASS, exit 0 |
| Final `expo export --platform web --max-workers 1` after the retry-context correction | PASS, exit 0: 2,350 modules; 5.51 MB entry bundle |
| Phase9 continuity/traceability; scoped Library local links and retained page contracts | PASS: 195 requirement definitions, zero duplicates/missing traceability, regression probes PASS, 76 Markdown files; local links valid and B01–B16 16/16 unique |
| Repository and scoped new/untracked-file whitespace; index | PASS after removing one extra blank line at the SDD EOF; index empty, mixed changes preserved |
| Real database persistence, atomic edit races, reconciliation and denial | NOT_RUN; no write/migration authority; all create/update gates remain false |
| Actual native stacks/scroll, keyboard, large text, focus/TalkBack, visual consistency and clipboard | NOT_RUN; not established by these tests or the web export |

Jest emitted the existing Node punycode and React Native core Clipboard deprecations. The earlier asynchronous VirtualizedList act warning was resolved by allowing the tested list batching to finish inside `act`; the final aggregate did not emit that warning. No package was installed. Whole-repository TypeScript was not rerun during this correction; the initial implementation's outside-scope WU4/Deno-import failures remain recorded, with no repository-wide PASS claim.

Final temporary export: `C:/Users/LEGION/AppData/Local/Temp/bookconnect-sdd06-corrections-final-web-558349330e4144938088ccd504c531d0`. It was not served or published. No fresh live database read was performed in this pass; the original receipt's catalog evidence remains dated to the initial preflight.

Continuity command: `powershell.exe -NoProfile -ExecutionPolicy Bypass -File docs/multi-tenant-bookstore-marketplace/implementation/phase-9-image-inventory/scripts/validate-phase9-continuity.ps1`, exit 0. Established dated trackers remain cohesive history; document-size notices are advisory and caused no content pruning. This separate correction receipt has a stable review/reproduction responsibility; it does not split the normative SDD or originate behavior.

## First-pass handoff and remaining gates (historical; superseded below)

The five findings now have local runtime/reducer reproductions and passing regression evidence. The bounded correction pass is complete locally; SDD06-04/manual release remains unaccepted. `ownedBookWrites`, `stableCreateReconciliation`, `optionalFiveCategories` and `serverManagedEditVersion` remain false. Device acceptance and separately authorized backend changes/proof remain required before functional saving and before OCR integration.

Exact next action: owner reviews this corrected local manual slice and the remaining evidence gates. Any subsequent narrow migration-file preparation requires separate authorization; migration application, database test writes, deployment and Git publication remain separate actions. No migrations, database/Storage/provider writes, dependency install, native rebuild, Stitch/browser modifications, staging, commit, push or deployment occurred. All changes remain local and uncommitted.

## Repeated pending-edit re-entry follow-up — 2026-10-10

Scope: only the remaining finding-2 retry/remount defect and conflicting current Interaction Map rows. Category-only exit remains a specification ambiguity, not another established defect; no stricter confirmation policy was introduced. SDD-06 revision 0.7 preserves the revision 0.4 behavior baseline and adds implementation traceability to R08/R09/R17.

RED: added **retains the exact original reader after a reopened edit retries, becomes uncertain, leaves and reopens again** in `ManualNoteJourney.test.tsx`. It mounts reader/composer/Notes using a real QueryClient and StackRouter reducer, with simulated transport/router effects. The first save resolves to conflict after informed Leave; pending re-entry, Keep editing and retry produce an unknown result; a second re-entry places another reader for the same note before the composer. Before the fix, approved Leave returned the competing reader key instead of the original key. The first diagnostic run exceeded the default five-second test timeout; the multi-mount test now allows fifteen seconds, and the next pre-fix run failed on the destination assertion itself. No old repository source was restored.

Correction: `note-compose.tsx` registers the resolved `returnContext` for every edit attempt and stores its identifier in the operation's existing `sessionId`. Reopened editors recover the original reader key from that account-scoped context rather than depending on a prior mounted ref. Create session identity, save gates, payload/version rules, account clearing and fallback navigation are unchanged. No new durable state, route parameter payload, schema or migration was introduced.

GREEN: the mounted regression returns to the original reader after both Leaves; retains draft text, Question and page 42; asserts exactly two write attempts, unknown outcome retained, one reader and zero composers. Existing exact-reader, first-re-entry, Save/Leave, account-clearing, conflict and production-gate tests also pass. Simulated uncertain/conflict responses verify local routing and fields only, not server atomicity or native reading position.

Documentation: Interaction Map current route table/diagram, Book Details preview/review/Notes access, collection filters/pending/error controls and Saved Pages error/empty rows now match source. The retained NoteEditor overlay section is explicitly historical. SDD, Library tracker, implementation receipt and separate Phase9 Library continuity entries point to this follow-up; marketplace Unit7C/M46, DOC-13/ACTIVE/global next action remain unchanged.

| Follow-up check actually run | Result |
|---|---|
| New mounted regression before implementation | RED: wrong same-note reader key on second re-entry |
| Exact eight-suite command from the rereview, `--runInBand --no-cache --runTestsByPath` | PASS: 100/100 tests, 8/8 suites, zero snapshots; normal exit, 37.167 seconds |
| `node node_modules/typescript/bin/tsc -p tsconfig.library-notes.json --noEmit --pretty false` | PASS, exit 0 |
| Phase9 continuity | PASS: exit 0; 195 requirement definitions, zero duplicates/missing traceability, regression probes PASS, 76 Markdown files; size notices advisory |
| Repository/scoped whitespace, local links and page inventory | PASS: `git diff --check`, all nine edited files including untracked composer/test/receipts, index empty; 215 local links valid; B01–B16 16/16 unique |
| Web export/full-repository compiler/database/native acceptance | NOT_RUN in this follow-up; prior checkpoints remain historical |

Existing Node punycode and React Native core Clipboard deprecation warnings appeared. All `MANUAL_NOTE_WRITE_GATES` values remain false. No live read, database/Storage/provider write, migration creation/application, dependency install, native rebuild, browser/Stitch change, staging, commit, push or deployment occurred. Existing mixed edits remain local/uncommitted; only composer, journey regression and the named continuity/documentation files changed in this follow-up.

Final continuity command: `powershell.exe -NoProfile -ExecutionPolicy Bypass -File docs/multi-tenant-bookstore-marketplace/implementation/phase-9-image-inventory/scripts/validate-phase9-continuity.ps1`. The final scoped link/whitespace inventory covers nine files. SDD-06 remains cohesive at approximately 461 lines: one normative page/state authority plus dated implementation evidence; no semantic split or content pruning is needed. Phase9 dated trackers remain cohesive historical logs; validator size notices remain advisory. Fingerprints of the other inspected source/tests/configuration remain unchanged from the independent review. Final branch/HEAD remain `codex/library-cover-shelf` / `1b743a13328ec30280a524aaeea15e364fc3d6c5`; nothing is staged.

Current local disposition: the original five findings have local corrections and regression evidence including the formerly missing repeated cycle. Manual release/SDD06-04 remains unaccepted; database/security and native acceptance are separate gates. Exact next action: owner reviews this local retry-context correction and evidence; any subsequent migration-file preparation, live application/test writes or native acceptance activity requires its own scoped authorization.

## Retained-reader cache correction and timing investigation — 2026-10-10

Authorized scope: two independently reproduced cache defects; permanent mounted regressions; investigate initialization/waits before changing timeout; run eight focused suites and scoped TypeScript; review only these corrections afterward. No agents/delegation, product-policy change, OCR integration, migration/backend/native work or external mutation.

| Finding | RED reproduction before implementation | Correction and GREEN evidence |
|---|---|---|
| Confirmed deletion leaves another retained reader displaying deleted content | New mounted test reached `0 saved notes` but could not find the missing-note state in the other reader | `useNoteRemovalRefresh` cancels the exact actor/book/note query and publishes null to all observers, retires existing confirmed receipts for that note and refreshes collection/count. Shared in-memory deletion marker prevents later confirmation seeding. Regression asserts no deleted body/Edit/Copy, null record cache, retired receipt and safe remount/unrelated operation |
| Retained confirmation overwrites a newer record on unrelated operation | New mounted test expected version 3 but found version 2/old body in the QueryClient | Confirmation effects apply once per immutable submission per QueryClient/account lifetime. Both operation effects and composer refresh use version-aware record seeding. Regression asserts version-3 body/cache, retained receipt, unrelated rejection and safe remount |

Two additional mounted race checks cover (1) a stale record read cancelled at deletion, then a late matching save confirmation; and (2) an older first-time confirmation through composer refresh while the reader already holds version 3. These exercise real QueryClient cancellation/notification/cache updates with mocked transport; no database or native guarantee is inferred. Cache bookkeeping is memory-only, resets on auth identity change and introduces no durable recovery or server state.

### Timing evidence and resolution

The independent review's exact cold command failed twice at the default five-second record-refresh test timeout; all assertions passed with an extended diagnostic timeout. This pass instrumented an isolated temporary copy, retaining the real mounted editor and query behavior. Under cold initialization, initial render took 3,976 ms and editor fields appeared at 14,422 ms; changing fields/category and refetching then completed by 14,522 ms. The next book case rendered in 9 ms, reached fields at 76 ms and completed refetch at 147 ms. This local timing evidence places the delay in first UI initialization, not a hung refresh/retry. Concurrent local compilation during diagnosis means these durations are observations, not a stable performance benchmark.

React Native UI exports are lazy getters. The Journey suite now loads its actual ActivityIndicator/FlatList/KeyboardAvoidingView/Modal/Pressable/RefreshControl/ScrollView/TextInput/View exports at suite initialization, moving cold Babel/native-module dependency initialization out of the first behavioral test. No native primitive is replaced, no waits/production code are weakened, no test order is changed and no timeout is increased. A cold isolated original record/book run passes at 206/137 ms with the default timeout. The complete no-cache eight-suite command passes without a timeout override.

### Verification actually run

```text
node node_modules/jest/bin/jest.js --runInBand --no-cache --runTestsByPath "src/components/notes/__tests__/ManualNoteJourney.test.tsx" "src/features/books/notes/__tests__/noteNavigation.test.tsx" "src/components/notes/__tests__/ManualNoteFlow.test.tsx" "src/features/books/notes/__tests__/manualNotes.test.ts" "src/features/books/notes/__tests__/manualNotesGateway.test.ts" "src/features/books/services/__tests__/notesService.test.ts" "src/components/notes/__tests__/NoteEditor.ocr.test.tsx" "src/features/books/services/__tests__/userBookPagesService.test.ts"
node node_modules/typescript/bin/tsc -p tsconfig.library-notes.json --noEmit --pretty false
```

Eight suites PASS 104/104, zero snapshots, normal exit 0, 57.084 seconds; scoped TypeScript PASS, exit 0. The original five correction regressions, including repeated re-entry, remain green. The pre-fix targeted first-two regressions were RED on the intended assertions; after implementation both were GREEN. The isolated original refresh tests pass with no timeout override. Existing Node punycode/core Clipboard deprecations remain; the final eight-suite output contains no act warning. Legacy OCR is regression coverage only.

Narrow review: only the changed hook/reader/test paths and their cache/timing consequences were reviewed. Verified one-time shared effects, equal/newer-version guard at both seed callers, exact-query cancellation/null propagation, receipt retirement, deleted-record suppression and auth-lifetime clearing. Simulated services remain the evidence boundary; database/security/native acceptance is NOT_RUN. The two original independent temporary diagnostics were rerun against corrected production source as a separate narrow check; their result is recorded in closeout below.

Documentation: SDD verification rows/revision receipt, Interaction Map, Library tracker, implementation README, this receipt and separate Phase9 local tracker/log. Marketplace Unit7C/M46, DOC-13/ACTIVE/global handoff and mutation authority remain unchanged. No schema/storage/acceptance-policy change; no data-dictionary or migration-ledger mutation.

Exact next authorized action: owner reviews only these cache/timing corrections and evidence. All four gates remain false; SDD06-04/manual release remains unaccepted. Backend/migration creation/application/test writes and native acceptance require separately scoped authorization. No live audit, database/Storage/provider write, migration, dependency install, native rebuild, browser/Stitch action, staging, commit, push or deployment. Web export and full-repository TypeScript were not rerun. Existing mixed changes remain local/uncommitted; source scope is `useManualNotes.ts`, `note.tsx` and `ManualNoteJourney.test.tsx`.

Closeout: both unchanged independent review diagnostics PASS against corrected production source (2/2, 22.960 seconds; temporary probe retains its diagnostic 15-second timeout). Deletion output is `cache:null`, `retainedBody:false`; replay output keeps version 3/`Fresh saved V3`, with no old body. This is separate from the permanent eight-suite 104/104 default-timeout PASS. Narrow review found no additional actionable issue in these corrections.

Phase9 continuity PASS, exit 0: 195 definitions, zero duplicates/missing traceability, validator regression probes PASS, 76 Markdown files; document-size notices advisory. Scoped checks: all ten changed source/test/document files have zero whitespace errors; 225 local links valid; B01–B16 remain 16/16. SHA-256 comparison to the independent-review baseline changes only these ten authorized files; other 226 monitored files, including save gates, coordinator, configuration and dependencies, are unchanged. Index empty; branch/HEAD unchanged at `codex/library-cover-shelf` / `1b743a13328ec30280a524aaeea15e364fc3d6c5`. Existing mixed uncommitted/untracked work preserved. SDD remains cohesive (one connected lifecycle plus dated receipts); Phase9 trackers remain cohesive historical logs, without content pruning. Final documentation validator/whitespace command is rerun after this closeout entry; no application source changed after the passing code checks.

## Browser-history correction review checkpoint — 2026-10-10

Active scoped unit: `library_manual_note_browser_history_correction_in_progress`. User renewed the bounded correction with “review the work and complete it” and “continue”. Phase9 Unit7C/M46 and global DOC-13/ACTIVE remain unchanged.

Fresh actual signed-in IAB reproduction at http://127.0.0.1:8084: The Black Swan → Notes → Add note → Thought → Write note → synthetic text/page 8 → genuine Browser Back returned to Notes without a discard dialog. Existing saved note remained unchanged. Inline screenshot retained in chat. No live saving/deletion/book-management operation was performed.

Permanent `e2e/library-manual-note-browser-history.spec.ts` uses Edge, genuine page.goBack/goForward, and fully intercepted HTTPS transport fixtures. Baseline RED and attempted local correction RED both failed on missing “Discard this note?” after Back. Installed Expo web history resets the root before the composer popstate callback; diagnostic ordering shows navigate(protect=true), early popstate, composer disposal, then later callback. Temporary diagnostic logging removed. Composer/helper changes remain experimental and do not establish a correction.

Pending scope clarification: original authorization forbids global navigation interception. Requested approval for an early app-start history listener that only acts for the focused dirty/pending-save composer; no root interception change made pending response. Exact next action: resolve this explicit boundary, then implement/retest the scoped integration and A–G/focus/zoom acceptance. No browser acceptance PASS claimed.

Fresh eight-suite baseline: 103/104 tests, 7/8 suites; existing OCR partial-text acceptance test exceeded its default 5-second timeout. Isolated unchanged OCR check is running. Scoped TypeScript and web exports passed before final diagnostic cleanup; final verification remains pending. Current export is served from a temporary directory on 8084; repository dist preserved. All four MANUAL_NOTE_WRITE_GATES remain false. No database/Storage mutation, migration, dependency change, staging, commit, push or deployment. Existing mixed worktree changes preserved.

Checkpoint verification: unchanged isolated OCR suite PASS 10/10, exit 0, default timeouts (66.663 seconds). This does not replace the failed aggregate baseline; final aggregate rerun remains pending. `git diff --check` PASS and staged diff empty. Continuity validator result recorded below when complete. No final correction or A–G/focus/zoom completion claim.

Phase9 continuity PASS, exit 0: 195 definitions, zero duplicate/missing traceability, semantic regression probes PASS, 76 Markdown files. Size notices remain advisory; dated continuity logs remain historical evidence. All changes remain local/uncommitted. Next action remains the pending scope clarification and authorized correction verification.

## 2026-10-10 — Browser Back draft retention (resolved locally)

### Root cause and correction

Before the correction, a signed-in browser run with a synthetic note body/page left Book Details → Add note → Write note and pressed genuine Back. Expo returned to Notes and unmounted the composer without the existing `usePreventRemove` confirmation. A permanent Edge test was first run RED against that exact lost-dialog assertion. Expo Router's web linker listens for popstate and resets root navigation; route-level composer listeners can be removed first.

`src/features/books/notes/composerBrowserHistory.ts` now exposes an app-start popstate dispatcher registered in `app/_layout.tsx` before router effects. It has no active route behavior by default; only mounted composer subscriptions inspect same-document Navigation API traversals, and only a focused composer with dirty fields or pending-save state handles them. It restores the origin entry before calling the existing `leave` flow, suppresses restoration from Expo, and clears/replays the user's original destination once on confirmed Discard. It adds no history entries, durable draft state, URL text, route, product-test mode or write path. Kept web dialogs restore focus after Modal dismissal. Guards coexist for retained composers. An API-unsupported browser receives no protection from this feature; the supported/verified target for this correction is Chromium Edge with Navigation API.

### Verification

- Pre-fix live IAB and pre-fix Edge regression: RED, genuine Back left for Notes without dialog.
- Final real-browser command: `node node_modules/@playwright/test/cli.js test --config playwright.manual-note-history.config.ts --workers=1` — 7/7 PASS; includes dirty create Keep, Discard/Forward blank initialization, saved edit Keep/Discard and original reader, repeated Back, app Back/options/category/Cancel, blank/category-only policy, 200% CSS zoom/layout plus keyboard reachability/focus. All fixture HTTPS requests intercepted; zero fixture writes.
- Dispatcher regression: `node node_modules/jest/bin/jest.js --runInBand --no-cache --runTestsByPath "src/features/books/notes/__tests__/composerBrowserHistory.test.ts"` — 5/5 PASS, covering dormant behavior, restore/replay once, overlapping Back/Keep, overlapping Back/Discard after protection releases and retained subscriptions.
- TypeScript: `node node_modules/typescript/bin/tsc -p tsconfig.library-notes.json --noEmit --pretty false` — PASS, exit 0.
- The exact eight requested suites plus dispatcher regression are running; append their final result after completion.
- Final web export passed: `node node_modules/expo/bin/cli export --platform web --max-workers 1 --output-dir C:/Users/LEGION/AppData/Local/Temp/bookconnect-history-review-20261010` (entry hash `854fa3b1547ff17fd8c28a14b94595cc`, 2351 modules). Export ran outside repository `dist`.
- Phase9 continuity validator, `git diff --check`, and scoped link/whitespace inventory must be rerun after this closeout.

### Read-only app acceptance and evidence limits

Signed-in Codex IAB 511×668: existing The Black Swan record (`asdfsddfasddfasddfasdf`, one Thought note) read only. Synthetic create body `Final source history regression draft`, category Thought, page 8: genuine browser Back showed “Discard this note?” while fields remained visible. Keyboard Shift+Tab/Tab/Enter selected Keep editing; focus returned to Note text and all fields remained. Cancel → Discard returned to book details with the one original saved note and exact original body. A synthetic edit changed text/category/page locally; Back/Keep retained it; Back/Discard returned to the original reader with original body unchanged. Forward is covered end-to-end by Edge fixtures. App Back to options, category change, Cancel/Keep/Discard and blank/category-only exits passed.

Edge 200% CSS-zoom fixture at 511×668 passed editor and dialog action reachability; keyboard traversal between Keep/Discard; Enter Keep; and text focus restoration. Screenshot: `browser-history-zoom-dialog.png`. This is a test-document CSS zoom, not operating-system assistive large text. Sending Ctrl+plus to the in-app browser did not change viewport zoom; actual browser zoom behavior remains unverified. The genuine Back dialog screenshot was captured inline during this run; browser tooling did not provide a file-export route for that live screenshot, so only the automated fixture image is retained on disk.

All four `MANUAL_NOTE_WRITE_GATES` remain false. Synthetic body was discarded using the existing UI; persisted original content/count remained unchanged. No note create/update/delete, book management, review, database/Storage/provider write, migration, dependency change or publication occurred. Browser evidence is not persistence, ownership/security, native or release acceptance. Changes remain uncommitted.

Zoom evidence precision: the retained screenshot uses 150% CSS zoom so the complete dialog can be viewed at once. The same regression increases to 200% before verifying button reachability and keyboard focus. This is a test-document CSS zoom, not browser chrome zoom or assistive text scaling.

## 2026-10-10 — 8083 stale Metro bundle discrepancy closed

The owner's reported failure on `http://localhost:8083` was real at the time of the check: genuine Browser Back left the dirty composer without its discard dialog, and Forward opened a blank composer. The saved note count remained one. The earlier successful Edge/export checks did not verify that running Metro instance, so the earlier report overstated what they proved.

The running Node process (PID 1156) started at 15:25 local time, before `app/_layout.tsx` was last written at 19:07 and `composerBrowserHistory.ts` at 19:17. Its 8083 bundle resolved source paths to this Library checkout but omitted both `initializeComposerHistory` and `guardComposerHistory`, confirming that it was serving a stale transform. PID 1156 was stopped and Metro restarted from this checkout with `npx expo start --port 8083 --clear --localhost --max-workers 1`. The rebuilt web bundle contains both functions.

After that restart, the signed-in Codex in-app browser reproduced the synthetic Thought draft `8083 verification only; synthetic draft`, page 8. Genuine Back showed “Discard this note?”; Keep editing retained the exact text and page; a second Back followed by explicit Discard returned to Book Details with the original saved note and count of one unchanged; Forward opened the blank category chooser. The synthetic draft was discarded. This verifies the fix in the refreshed 8083 Metro build for this Navigation API browser.

No note create/update/delete or other record change, database/Storage/provider write, migration, dependency change, staging, commit, push or deployment occurred. The original failed observation is preserved above as evidence of the stale running build; API-unsupported browsers, native and persistence/security acceptance remain outside this browser check.
