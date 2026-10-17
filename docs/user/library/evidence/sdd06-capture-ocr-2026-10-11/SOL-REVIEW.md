# Independent capture/OCR review — Sol

Date: 2026-10-11. Reviewer: requested `gpt-6.1-sol`, medium, no fork; agent `/root/ocr_sol_review_corrections`. This initial pass is read-only for production source. Subsequent correction verification in this same session will not be described as another independent audit.

**Verdict: Needs bounded corrections.** Two P2 implementation defects are reproduced below. No P0/P1 is established by this scoped review. This verdict does not close native, persistence or release acceptance.

Current same-session correction closure: SOL-01/02 fixed; **Ready for browser verification within gated scope**. Detailed correction scope, RED/GREEN evidence and pending acceptance are appended below; the initial independent verdict remains historical evidence.

## Scope and checkout

Reverified root `C:/Users/LEGION/Desktop/Bookconnect4_library`, branch `codex/library-cover-shelf`, HEAD `1b743a13328ec30280a524aaeea15e364fc3d6c5`; index empty. Significant modified/untracked work predates this task. Inspected the actual untracked composer, capture files, shared form, service and tests, not Git diff alone. Compared the pre-existing composer, shared UI, OCR service and startup against [baseline/](./baseline/) and inspected [BASELINE.json](./BASELINE.json), [SOURCE-MANIFEST.json](./SOURCE-MANIFEST.json) and [BUILD-MANIFEST.json](./BUILD-MANIFEST.json). Implementation/test/tsconfig hashes match the supplied source manifest at review time.

Authority: root AGENTS → ACTIVE → DOC-13 → Phase 9 SESSION-START/TRACKER/master and implementation tracker; Library TRACKER, SDD-06 page/session/accessibility contracts, SDD-02/03, relevant SDD-05 theme direction, Interaction Map, Option B navigation reference, held manual persistence/forward plans and linked manual correction evidence. Marketplace remains Phase 9 Unit7C/M46 complete; the separate Library unit is `library_sdd06_capture_ocr_local_verification`.

Owner-authorized scope is SDD06-05/06 and direct note integration. Persistence correction is ON HOLD. All four `MANUAL_NOTE_WRITE_GATES` are false. No migration, database/Storage/account mutation, real CRUD, cloud OCR/provider upload, dependency upgrade, EAS service, sibling worktree edit, stage/commit/push/merge/deploy or durable draft/Vault expansion occurred in this review. No browser/native UI control was performed; Luna owns final browser verification. Parent's temporary synthetic native diagnostic route is separate evidence and must be removed before the shipped export.

## Reproduced findings

### SOL-01 — P2: overlapping canceled transforms can release their shared source early

- **Location:** `src/features/books/notes/captureSession.ts:26`, `:70–72`, `:99`, `:117–118` (also rotation ownership at `:89–94`).
- **Evidence:** [disposable reproduction source](./sol-resource-race-repro.txt). Initialize manual A; begin scan and select app-owned source; start recognition with transform 1 pending; Cancel recognition; start recognition/transform 2 on the same source; Cancel scan; settle transform 1 while transform 2 remains pending. The production session calls `adapter.release(source)` before transform 2 settles. RED assertion: expected `prematurelyReleased=false`, observed `true`; one test failed in 7.166 s. This reproduces the premature release call with isolated adapters, not an actual native filesystem deletion/failure.
- **Cause:** `working` is a Set. Both transforms add the same URI; either `finally` deletes its single entry. The source is no longer in current/checkpoint state after Cancel scan, so collection releases it despite the other transform still using it. The adapter's recognition lease protects actual ML Kit work on transformed outputs, but does not lease source inputs for image rendering.
- **Violated requirement:** SDD-06 §5 rules 4/11 and B15/R15 safe app-owned resource lifetime; user cancellation must invalidate adoption while retaining resources until actual work settles.
- **Reader impact:** rapid cancel/re-recognize/discard can delete an image still needed by native image preparation, causing intermittent transform errors. Late-result adoption is fenced; this finding is resource lifetime, not a reproduced overwrite or persisted-data loss.
- **Bounded correction:** reference-count working URI uses, or use per-operation leases, including rotation/recognition inputs and outputs. Release only when no retained state and no outstanding use remains. Preserve native recognition leases and never delete picker originals.
- **Required verification:** RED/GREEN permanent regression for two overlapping transforms and out-of-order settlement; cancellation followed by dispose/account change; adjacent rotation and actual-native-work lease tests. Confirm each source remains retained through its last user and is released once afterward; no stale result adoption.

### SOL-02 — P2: restored clean B07 disables native removal protection despite retained photo

- **Location:** `app/(tabs)/library/note-compose.tsx:120`; compare `:90`, `:99`, `:115` and session `cancelScan`/`returnToCrop`.
- **Evidence:** [mounted disposable reproduction](./sol-native-guard-repro.txt), based on the production `NoteCaptureJourney` harness. B09 baseline is Saved A; Scan 1 recognizes exactly Saved A; Scan 2 starts from that B07; Back from intake cancels Scan 2 and restores B07. Text/category/page equal the saved baseline, checkpoint is cleared, but the prior photo and Back to photo remain. The last production `usePreventRemove` enabled argument is `false`, expected `true`. Focused RED rerun failed in 749 ms (23.361 s total including setup), with React Native primitives initialized before test timing. This is a mounted hook-registration reproduction; hardware Back itself was not run on a device.
- **Cause:** the native removal predicate includes dirty fields/locked save/checkpoint/new manual write, but omits `capture.meaningfulCapture`. The explicit exit and browser predicates already include it. Restoring B07 deliberately clears the prior checkpoint, exposing this gap.
- **Violated requirement:** SDD-06 §5 rules 9/10, §5.1, B07 Back→B15 and R12/R18 protection of retained capture work across native Back/exit paths.
- **Reader impact:** hardware or stack removal can abandon the retained photo/crop instead of returning to B15 or invoking contextual protection, while the visible Back behaves differently.
- **Bounded correction:** include meaningful retained capture in the native removal guard and preserve existing retained-step routing, save/Leave handling and blank/category-only behavior. Do not alter the checkpoint rule to retain an undo stack.
- **Required verification:** permanent mounted regression for clean saved-edit B07 after Scan 2 cancellation, asserting protection and callback return to crop; continued re-recognition/restoration; unchanged clean saved-edit exit without photo; adjacent create/manual/native recognition Back and browser guard regressions. Actual native Back remains a device acceptance item.

## Source and test assessment

| Requirement | Observed implementation/evidence | Review result |
|---|---|---|
| B04 initial / B05/B07/B09 replacement | One `NoteCaptureSession`; sole immediate checkpoint; Scan 2 from B restores B; restored B07 recreates a checkpoint when returning to its crop | Source and local session/mounted tests support it; SOL-02 exit gap |
| Identity and original saved baseline | Actor/book/mode/edit ID scope; generation invalidation/disposal; saved baseline not replaced by candidate; coordinator receives original version | Source/tests support local behavior; persistence held |
| Metadata and validation | Optional five categories/null and optional page carried; shared form; 500-word validation distinct from 20,000-code-point service boundary; no silent note truncation/minimum length | Source/local tests support; no actual persistence claim |
| Partial review | Exact text revision acknowledgement; text edit invalidates; complete result clears; unaccepted Save opens warning; acceptance never saves | Source and mounted test support |
| Intake | System Expo SDK54 picker, camera permission vs unavailable/invalid/dismissal; no OCR on selection; prior crop retained on picker dismissal | Source/adapter tests support; native picker/camera UI NOT_RUN |
| Pixel transform | Decodes oriented pixels; normalized crop mapped/clamped in actual dimensions; full default transformed; render failure has no original-image fallback | Source/tests support; parent native receipt separately supplies actual binary evidence |
| Crop UI | Contained-image letterbox mapping; clockwise crop mapping; reset current orientation; edge controls as gesture alternative; 48dp controls | Source supports; rendered large text, gestures, contrast/accessibility need Luna/native evidence |
| No-text/technical/engine recovery | Prior fields retained; distinct steps; engine recovery does not offer another photo as a cure; browser/Expo Go availability truthful | Source/mounted tests support; no fake browser recognizer |
| Cancellation / resources | Request generation plus abort invalidates adoption; owned URI cleanup excludes originals; adapter counts native-work leases until actual settlement | Adoption tests support; SOL-01 shared-source race |
| Save/reader/conflict/uncertain lifecycle | Existing operation coordinator/gateway/navigation/query logic retained; composer submits reviewed current fields through validated save; original reader-return context preserved | Baseline/source and existing receipt support; no real CRUD or API acceptance |
| Cloud/legacy/privacy | Mounted entry is composer/shared form; NoteEditor has no mounted caller in inspected app path; no capture cloud/Vault/autosave dispatch or body/URI logging found; local error copy neutralized | Source review supports within mounted slice; retained cloud service is not invoked by it |
| Browser history / native startup | Existing early web dispatcher stays web-only; non-DOM window ignored; browser guard protects meaningful capture | Source/history tests support; final browser Back/Forward delegated to Luna |

No additional actionable source-inferred defect is recorded in this pass. Passing existing tests does not disprove SOL-01/02: the original suites cover single transform lifetime and dirty/candidate native Back, not the reproduced overlapping-use or clean-restored-B07 cases.

## Verification actually run by this reviewer

- `node node_modules/jest/bin/jest.js --runInBand --no-cache --runTestsByPath src/features/books/notes/__tests__/captureSession.test.ts src/features/books/notes/__tests__/captureAdapter.test.ts src/features/books/notes/__tests__/composerBrowserHistory.test.ts src/features/books/services/__tests__/ocrService.test.ts`: **4 suites / 49 tests PASS**, 13.553 s.
- `node node_modules/typescript/bin/tsc -p tsconfig.library-notes.json --noEmit --pretty false`: **PASS**, exit 0/no diagnostics.
- SOL-01 disposable test: **RED**, expected false/observed true premature source release.
- Initial copied mounted run: **6 passed / 2 failed**; one failure is SOL-02, the other is the first existing test exceeding 5 seconds during cold React Native initialization (17.775 s). Do not treat that timeout as an additional production defect or a passing journey. Focused SOL-02 rerun preinitialized primitive exports outside test timing and reproduced the assertion in 749 ms without timeout override.
- Parent's recorded 16-suite/204-test run, expanded TS, web export and initial continuity/link checks were read as **parent evidence**, not relabeled as this reviewer's rerun. The separate export does not identify running Metro.
- Reviewer closeout: Phase 9 continuity **PASS**, 76 Markdown / 55 required files ([log](./sol-continuity.log)); `git diff --check` **PASS** with existing CRLF warnings; staged diff remains empty. Report local links **PASS**. Archived reproduction sources remain in this receipt; the two reviewer-owned `.tmp` test files were removed after archiving so failing exploratory tests do not enter normal test discovery.

## Unverified acceptance and closeout

Parent native evidence inspected: the independent Pillow oracle uses literal source crop rectangles/clockwise transpose, not production geometry; six actual binary comparisons report zero pixel error, including non-square/EXIF6/rotation/printed-page selection. Recorded on-device English OCR excluded outside sentinels and retained Question/page/edit identity. This reviewer did not rerun ADB or native OCR. The first recorded cancellation was during transform; parent is separately qualifying cancellation after ML Kit dispatch. A canceled transform result alone does not prove an in-flight native recognition lease.

Native camera/picker UI, actual hardware Back/keyboard, large text/safe areas, assistive focus/dialog trapping and restoration, physical devices, iOS, other languages, representative degraded pages, latency benchmark and actual persistence remain NOT_RUN/unaccepted here. Browser layouts/console/Back/Forward/focus and isolated review/partial fixtures remain Luna's next-stage work after confirmed corrections. Current capture source does not establish SDD06-07 or complete SDD release.

Only this report, archived disposable reproduction sources and reviewer-owned `.tmp` tests were written. Production source remains unchanged by reviewer; all mixed prior work retained. No external mutations or Git publication. Parent owns the coordinated tracker/evidence update. **Exact next action:** parent validates SOL-01/02, then sends confirmed IDs to this same Sol session for bounded correction/regressions before Luna browser verification. Persistence remains held and four gates remain false.

## Same-session bounded correction verification — 2026-10-11

Parent independently reproduced and confirmed both IDs, then authorized only capture URI lifetime/native removal corrections and corresponding regressions. This section is **correction verification**, not another independent audit; the initial report and RED evidence above remain unchanged.

**Correction verdict: Ready for browser verification within gated scope.** SOL-01 and SOL-02 are fixed and locally verified. No remaining actionable defect is identified in this bounded correction pass. Parent's separate source/acceptance checks, updated native recheck and rebuild precede Luna's browser verification; this is not release acceptance.

### Exact correction scope

Only four production/test files changed. [SOL-CORRECTION-MANIFEST.json](./SOL-CORRECTION-MANIFEST.json) records initial-manifest and corrected SHA256 values; [SOL-CORRECTIONS.diff](./SOL-CORRECTIONS.diff) is the exact delta. Before generating the diff, all four reconstructed pre-correction contents were SHA256-verified against the initial source manifest. Those temporary reconstruction files were removed afterward.

| Finding | Correction | Permanent verification |
|---|---|---|
| SOL-01 | `captureSession.ts` changes working URI ownership from Set membership to per-URI counts. Each rotation/recognition acquires its input; recognition also acquires transformed output; each finally releases only its own use. Collection retains every nonzero working key. Existing state references, generation fencing and adapter actual-native-work lease remain unchanged. | Six new session cases: two transform settlement orders × Cancel scan/dispose; two rotation settlement orders across cancel/restore/restart/dispose. Assert no source release after first settlement, exactly one release after last use, output cleanup, no recognition dispatch/adoption from obsolete transforms, cleared disposed account scope. Existing late-result/account/picker/lease tests stay green. |
| SOL-02 | `note-compose.tsx` adds `capture.meaningfulCapture` to the native removal predicate. Retained Back routing and single-checkpoint behavior stay unchanged. | New mounted clean saved-edit B07/Scan2-cancel case asserts guard enabled; invokes native-removal callback and reaches crop without navigation dispatch; re-recognizes C, cancels to B, then confirms isolated submission still uses original note ID/version/category/page. A second case confirms unchanged saved edit without photo remains unguarded. |

The mounted suite initializes the lazy RN primitives during suite setup, matching the established manual journey approach; no timeout was increased. This prevents cold module compilation consuming the first behavioral test's default timeout. Simulated writes remain isolated test adapters; no production gate was opened.

### RED/GREEN and actual checks

- Permanent pre-fix run: **7 failed / 27 passed**, two suites, 43.662 s. Six resource-lifetime variants and the restored B07 guard failed for the confirmed reasons; unchanged saved-edit control and all existing cases passed. [RED log](./sol-corrections-red.log).
- Final affected/adjacent capture run: **5 suites / 64 tests PASS**, 51.391 s. Command: `node node_modules/jest/bin/jest.js --runInBand --no-cache --runTestsByPath src/features/books/notes/__tests__/captureSession.test.ts src/components/notes/__tests__/NoteCaptureJourney.test.tsx src/features/books/notes/__tests__/captureAdapter.test.ts src/features/books/notes/__tests__/composerBrowserHistory.test.ts src/features/books/services/__tests__/ocrService.test.ts`. [GREEN log](./sol-corrections-green.log).
- Preserved manual lifecycle regression: **4 suites / 66 tests PASS**, 77.841 s. Same Jest options, explicit paths `ManualNoteJourney.test.tsx`, `ManualNoteFlow.test.tsx`, `manualNotes.test.ts`, `noteNavigation.test.tsx` under their existing component/notes directories. [Log](./sol-corrections-manual-regression.log) retains existing React Native Clipboard deprecation output; no failure or timeout override.
- `node node_modules/typescript/bin/tsc -p tsconfig.library-notes.json --noEmit --pretty false`: **PASS**, exit 0/no diagnostics. [Success log](./sol-corrections-typecheck.log).
- Correction closeout: Phase 9 continuity **PASS**, 76 Markdown / 55 required files ([log](./sol-corrections-continuity.log)); `git diff --check` **PASS** with existing CRLF warnings; report local links **PASS**; index empty. Initial source manifest comparison shows changes only in the four authorized source/test paths; adapter/geometry/OCR/startup/history helpers and all other manifest source paths remain at initial hashes. No temporary capture proof route remains under `app/`.

### Provenance, limits and handoff

Parent's fresh [NATIVE-RUN.json](./NATIVE-RUN.json) now records cancellation after actual native-adapter dispatch, six selected-pixel PASS cases and preserved identity. It predates these corrections and names the original captureSession hash; it is not final-source native verification. Adapter/geometry/OCR service and actual-native-work lease code are unchanged by this pass. Both temporary native proof routes were removed by parent. This agent did not run native UI or browser controls; native hardware Back, camera/picker UI, keyboard/large text/TalkBack, physical/iOS/languages and real persistence still require the explicitly recorded acceptance.

All four production write gates remain false; held persistence/backend artifacts and original reader/save/conflict/history/coordinator behavior preserved. No migration, Supabase/Storage/account/provider mutation, dependency install/upgrade or Git publication. Four corrected source/test files and receipt artifacts remain local/uncommitted; index empty. Parent owns coordinated tracker/log updates.

**Exact next action:** parent inspect the correction diff/hashes, independently run affected acceptance and final-source native diagnostic, rebuild/verify bundle identity, then dispatch the requested separate Luna/max browser verification. Retain this Sol session for any confirmed bounded browser corrections. Persistence remains ON HOLD.

## Same-session bounded browser corrections — 2026-10-11

Parent confirmed LUNA-WEB-01/02 from Luna's frozen-build DOM/geometry evidence and its independent installed-converter reproduction. Luna explicitly paused before this authorized correction. This is correction verification in the same Sol/medium session, not a new independent audit. Initial review and SOL-01/02 evidence remain preserved.

**Correction verdict: Ready for browser verification within gated scope.** Both confirmed source issues are addressed; no remaining actionable source issue is identified within these two IDs. Final rendered DOM and Back geometry acceptance remain Luna's post-rebuild work.

### Exact scope and evidence

Only `src/components/notes/ManualNoteUi.tsx` changed in product source: CategoryPicker adds the installed supported `aria-checked` prop derived from the current selection while retaining native `accessibilityState.checked/selected`, labels, visible check, optional no-category and All-filter behavior. Shared Back adds `minWidth: 48` beside its existing `minHeight: 48`; navigation, theme and labels remain unchanged. No style-property-only test was added for the measured Back issue.

The only new test is `src/components/notes/__tests__/CategoryPicker.web-semantics.test.tsx`. It renders the actual shared CategoryPicker, maps its actual radio props through the installed RN Web `createDOMProps`, and checks role/label/checked output for no category, every category selection, clearing category, and the separate All filter. It also checks unchanged native accessibility state, selection callbacks and visible check. This is an installed DOM mapping regression, not browser acceptance.

[SOL-BROWSER-CORRECTIONS.diff](./SOL-BROWSER-CORRECTIONS.diff) contains the exact two product lines and new test. [SOL-BROWSER-CORRECTION-MANIFEST.json](./SOL-BROWSER-CORRECTION-MANIFEST.json) records before/after SHA256:

- ManualNoteUi before `A0ED5A5C2186D753367C7A81B651E2FA4AB9ACFE4C7760F1202252AD9B8BD801`; after `367475F06BBF5BD15B7254D25A97CBAC3679C703CDC0940C86CF04120877A917`.
- New test before absent; after `37FCBD0F1A742389F1B9DC0880AE24033FF22B003287FCF08E1CEF2FA2D34E3D`.

Comparison against every existing BUNDLE-SOURCE-MANIFEST entry found only ManualNoteUi changed. SOL-01/02 source and regressions, capture/adapter/geometry/OCR/history/coordinator/gateway/navigation and scoped tsconfig retain their prior hashes. Temporary pre-correction UI copy was removed after the exact diff was saved.

### Verification actually run

- Meaningful pre-fix regression: **3 failures / 0 passed**, 11.699 s, expected Boolean aria-checked but received undefined. Command: `node node_modules/jest/bin/jest.js --runInBand --no-cache --runTestsByPath src/components/notes/__tests__/CategoryPicker.web-semantics.test.tsx`. [RED log](./sol-browser-corrections-red.log). Two preceding test-harness setup failures are separately retained in [setup log](./sol-browser-corrections-test-setup.log); they are not defect evidence.
- Affected GREEN: **5 suites / 71 tests PASS**, 53.657 s. Same Jest options with explicit paths `src/components/notes/__tests__/CategoryPicker.web-semantics.test.tsx`, `src/components/notes/__tests__/ManualNoteFlow.test.tsx`, `src/components/notes/__tests__/NoteCaptureJourney.test.tsx`, `src/components/notes/__tests__/ManualNoteJourney.test.tsx`, `src/features/books/notes/__tests__/captureSession.test.ts`. [GREEN log](./sol-browser-corrections-green.log).
- Initial scoped typecheck exposed two test callback implicit-any diagnostics. Added a test-only RadioInstance type; no product change. Fresh final `node node_modules/typescript/bin/tsc -p tsconfig.library-notes.json --noEmit --pretty false`: **PASS**, exit 0/empty [log](./sol-browser-corrections-typecheck.log).
- Final typed-test rerun using the explicit RED command: **1 suite / 3 tests PASS**, 10.191 s. [Final log](./sol-browser-corrections-final-semantics.log). Existing Clipboard/punycode warnings in affected runs remain recorded.
- Phase9 continuity: **PASS**, 76 Markdown / 55 required files; repository diff check **PASS** with pre-existing CRLF warnings. [Log](./sol-browser-corrections-continuity.log). Receipt local links checked; index remains empty.

### Boundaries and next action

No browser/native UI control, server startup, real record/account/Storage/provider calls, migration, dependency or Git publication occurred. Four write gates remain false; persistence stays ON HOLD. Earlier native evidence is parent-owned and predates these UI changes; this pass makes no native/hardware or actual rendered-browser acceptance claim. The two source/test paths plus separate receipt artifacts remain uncommitted. Parent owns coordinated tracker/receipt updates.

**Exact next action:** parent inspect this bounded diff/hashes, independently accept regressions, refresh final-source build identity and rebuild, then resume paused Luna for installed DOM checked state and measured Back target verification. Native/UI/backend acceptance and held persistence remain as previously documented.

## Same-session bounded keyboard correction — 2026-10-11

Parent confirmed **LUNA-WEB-03/P2** from genuine focused Space input in isolated Edge and independently reproduced the installed responder's radio Space omission. Luna remained paused. This is bounded correction verification in the same Sol/medium session, not another independent audit. Earlier review, SOL-01/02, WEB-01/02 and their RED/GREEN evidence remain preserved.

**Correction verdict: Ready for browser verification within gated scope.** The confirmed source defect is corrected and verified locally; no remaining actionable source issue is identified within WEB-03. Genuine rendered keyboard acceptance remains Luna's next-build retest.

### Exact correction and regression

Only `src/components/notes/ManualNoteUi.tsx` and its existing `src/components/notes/__tests__/CategoryPicker.web-semantics.test.tsx` changed. CategoryPicker supplies the installed supported custom `onKeyDown` only on web. Focused Space prevents page scrolling and activates the existing category callback once unless the event is a repeat. Enter remains owned by the installed PressResponder; unrelated keys and descendant-target Space do not invoke the custom selection. Native receives no custom keyboard handler and retains onPress. Radio role, accurate checked state, labels/check, optional null/All filter, pointer behavior and 48px Back correction remain unchanged.

The regression renders the actual CategoryPicker, takes its actual outer radio props, and composes their keyboard handler with the installed RN Web PressResponder in the same responder-first ordering used by installed Pressable. Real library keydown/keyup logic verifies Space once, Enter once without duplicate selection, unrelated keys and repeated Space ignored. A separate native case checks omitted web handler and preserved null All-filter onPress. This deterministic component/library regression is not a browser-event claim.

[SOL-KEYBOARD-CORRECTIONS.diff](./SOL-KEYBOARD-CORRECTIONS.diff) is the exact delta; [SOL-KEYBOARD-CORRECTION-MANIFEST.json](./SOL-KEYBOARD-CORRECTION-MANIFEST.json) records hashes and the comparison against the current pre-correction bundle source manifest:

- ManualNoteUi before `367475F06BBF5BD15B7254D25A97CBAC3679C703CDC0940C86CF04120877A917`; after `0CCB6D804CB24C633DBFBCBF32F7CFC5CC43700D94C51D543B39ED61F323FE7F`.
- Existing semantics test before `37FCBD0F1A742389F1B9DC0880AE24033FF22B003287FCF08E1CEF2FA2D34E3D`; after `B7E031DF86585EE4C13744F41877531190D4D02AA150C45AE17EA793BE28559B`.

Only those two bundle-manifest paths differ. No new test path or tsconfig change. All earlier corrected capture/session/coordinator/history/navigation/adapter/OCR paths retain their prior hashes. Product/test source is now frozen; temporary pre-correction copies were removed after diff generation.

### Actual verification and provenance

- Meaningful pre-fix keyboard RED: **1 failed / 4 passed**, **11.970 s**, expected one callback after focused Space, observed zero. Exact keyboard command: `node node_modules/jest/bin/jest.js --runInBand --no-cache --runTestsByPath src/components/notes/__tests__/CategoryPicker.web-semantics.test.tsx`. [Keyboard RED log](./sol-keyboard-corrections-red.log). This directly reproduces WEB-03 before product editing.
- First post-fix affected run: **1 failed / 72 passed**, 50.745 s. Space did call once, but the new assertion mistakenly expected the display-derived key `thought` rather than canonical `reflect`. Corrected only the test expectation and added the same canonical-value assertion after Enter. [Preserved initial post-fix log](./sol-keyboard-corrections-initial-postfix.log). This harness expectation failure is not an additional product defect.
- Final affected GREEN: **5 suites / 73 tests PASS**, 51.659 s. Command: `node node_modules/jest/bin/jest.js --runInBand --no-cache --runTestsByPath src/components/notes/__tests__/CategoryPicker.web-semantics.test.tsx src/components/notes/__tests__/ManualNoteFlow.test.tsx src/components/notes/__tests__/NoteCaptureJourney.test.tsx src/components/notes/__tests__/ManualNoteJourney.test.tsx src/features/books/notes/__tests__/captureSession.test.ts`. [GREEN log](./sol-keyboard-corrections-green.log). Existing Clipboard/punycode warnings retained; no timeout adjustment.
- Fresh final `node node_modules/typescript/bin/tsc -p tsconfig.library-notes.json --noEmit --pretty false`: **PASS**, exit 0/no diagnostics. [Typecheck log](./sol-keyboard-corrections-typecheck.log). Earlier 40/213 runs are not verification of this patch.
- Phase9 continuity **PASS**, 76 Markdown / 55 required files, repository diff check **PASS** with pre-existing CRLF warnings. [Continuity log](./sol-keyboard-corrections-continuity.log). Report local links pass; staged diff empty.

Four gates remain false; persistence stays ON HOLD. No browser/native control, server startup, real record/account/Storage/provider call, migration/dependency change or Git publication. The prior export entry SHA `CA65B1DC34CFEA7D8ED092CB82B5E7965CF4D4F2FC7531723CA994D763C40870` predates this keyboard correction and does not prove its rendered acceptance. All native/UI/backend acceptance limits remain as recorded. Files remain local/uncommitted; parent owns coordinated tracker/receipt updates.

**Exact next action:** parent independently inspect and accept the bounded diff/regressions, rebuild with a fresh verified identity, then resume the same paused Luna for genuine Space/Enter, checked-state/Back geometry, history/recovery/layout and midnight retests.

## Same-session bounded enlarged-layout correction — 2026-10-11

Parent confirmed **LUNA-WEB-04/P2** from the full-title 390×844 / CSS zoom 2 screenshot and actual clipping/hit-test measurements. Luna is paused. This is same-session Sol/medium correction verification, not a new audit. Phase9 Unit7C/M46 remains complete with no new mutation authority; separate Library capture/OCR is the bounded work. Earlier source/review/keyboard/native/browser epochs remain preserved.

**Correction verdict: Ready for browser verification within gated scope.** The zero-height layout cause has been corrected in source and affected regressions pass. Actual enlarged-rendering GREEN is pending parent independent acceptance/rebuild and Luna's same-session retest. No remaining actionable source issue is identified in this confirmed finding; browser reachability must not be declared accepted from Jest or source alone.

### Confirmed RED and chosen layout

Read [LUNA-WEB-04-RED-EPOCH.json](./LUNA-WEB-04-RED-EPOCH.json), current Luna report and [actual screenshot](./browser/final-2026-10-11/css-zoom-200-narrow-crop.png). Copied the original browser RED output without rerunning it to [sol-layout-browser-red.log](./sol-layout-browser-red.log), SHA256 `5D8F89DD0E3D9A049ED25208468F790834F3B644BF41E032951CAA009472A919`. It records one failed real browser reachability test: only two of seven tested actions hittable; the crop ScrollView clientHeight was zero, scrollHeight 1478, and the Left edge inward center hit the footer. This is Luna-owned initial RED evidence, not this reviewer's browser execution. The CSS-only fixture used the truthful unavailable web OCR path; fake OCR was not needed for the failure. CSS zoom is not native text scaling. Retained global/tab 9px horizontal overflow is outside this confirmed correction.

SDD06 §7 requires reachable controls, full usable context, keyboard-aware forms and large text without font reduction. Installed RN Web ScrollView has flex grow/shrink and vertical auto overflow: its fixed sibling header/footer can exhaust the parent, so content growth alone cannot fix a zero clipping viewport. The bounded correction removes those non-scrollable siblings only for capture steps. One existing composer ScrollView now contains full Back/title/book header, padded capture content and contextual footer. Its content may grow beyond the screen and scroll naturally; no font/zoom reduction, title truncation or masking overflow was introduced.

### Exact scope and preservation

- `ManualNoteUi.tsx` exposes an optional `scrollChrome` render-content path so the existing screen header and safe-area footer can be placed in the owner's ScrollView. Default NoteScreen behavior remains unchanged for existing reader/list/loading consumers.
- `note-compose.tsx` uses that path only for intake/crop/no-text/failure. It retains the same ScrollView ref and scroll callback. Editor/review still place header/footer outside scrolling content; their existing field focus/selection/scroll capture and restoration remain owned by the same session. Dialog remains outside the ScrollView, retaining its existing focus trap/restoration. Header and footer handlers, identity/baseline, partial acceptance, cancel/Back/history/save/conflict/coordinator logic are unchanged. Crop geometry/adapter/native-work leases are unchanged.

No new source/test path, dependency or scoped configuration change. Existing substantive mounted manual/capture regressions cover the preserved journey semantics; no style-property unit test was added to claim browser layout acceptance. The actual browser RED/GREEN owner remains Luna.

Exact delta: [SOL-LAYOUT-CORRECTIONS.diff](./SOL-LAYOUT-CORRECTIONS.diff). Before/after hashes and paused-source comparison: [SOL-LAYOUT-CORRECTION-MANIFEST.json](./SOL-LAYOUT-CORRECTION-MANIFEST.json):

- ManualNoteUi before `0CCB6D804CB24C633DBFBCBF32F7CFC5CC43700D94C51D543B39ED61F323FE7F`; after `C5FB126D6AA65F65C1F22C17238BBC94D56210E4FBD5D552239E15A601F79FCB`.
- Composer before `26AA6E22B0AC3D965FDE9ADB586CEB1E0D795AFC044567D1D412092238225225`; after `62237C0DC0603D7076CCDFD5C5ADD8E6A3CEC9D0647D6128AC49834B70BF203E`.

Only these two paths differ against the immutable [paused bundle source manifest](./LUNA-LAYOUT-RED-BUNDLE-SOURCE-MANIFEST.json). SOL-01/02 and WEB-01/02/03 behavior/regressions remain preserved. Temporary exact pre-correction copies were removed after diff generation. Source is frozen for parent acceptance.

### Checks actually run and limits

- `node node_modules/jest/bin/jest.js --runInBand --no-cache --runTestsByPath src/components/notes/__tests__/CategoryPicker.web-semantics.test.tsx src/components/notes/__tests__/ManualNoteFlow.test.tsx src/components/notes/__tests__/NoteCaptureJourney.test.tsx src/components/notes/__tests__/ManualNoteJourney.test.tsx src/features/books/notes/__tests__/captureSession.test.ts`: **5 suites / 73 tests PASS**, 44.792 s. [Regression log](./sol-layout-corrections-regression.log). Existing Clipboard/punycode warnings retained; no timeout increase.
- Fresh `node node_modules/typescript/bin/tsc -p tsconfig.library-notes.json --noEmit --pretty false`: **PASS**, exit 0/no diagnostics. [Typecheck log](./sol-layout-corrections-typecheck.log).
- Phase9 continuity **PASS**, 76 Markdown / 55 required files, repository diff check **PASS** with existing CRLF warnings. [Continuity log](./sol-layout-corrections-continuity.log). Exact diff inspected; receipt local links pass; index empty.
- Browser GREEN, normal 390/1280 layout, long-title CSS200 crop/rotation/reset/photo-selection/footer/Back hit-testing, recognition-available footer variant, keyboard/dialog rendering and native large-text/hardware behavior remain pending actual acceptance. This agent ran no browser/native UI or servers. Prior browser/native epochs predate this layout patch.

No record/account/DB/Storage/provider mutation, migration, native build, dependency or Git publication occurred. Four gates remain false; persistence remains ON HOLD. Two source paths and receipt artifacts remain local/uncommitted; five owning documentation files remain parent-owned/frozen.

**Exact next action:** parent inspect the bounded diff/hashes, independently accept regression/TS, rebuild with verified source/entry identity, then resume the same paused Luna to repeat the actual narrow CSS200 full-title crop hit-test and normal-layout/keyboard/dialog acceptance. Record browser GREEN only after that measured retest; retain this Sol session for any confirmed bounded follow-up.
