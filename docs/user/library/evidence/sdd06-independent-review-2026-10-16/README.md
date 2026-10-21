# Complete after-book-entry Library review — 2026-10-16

**Verdict: PARTIAL, with confirmed defects. Persistence is intentionally gated; full native/release acceptance is unverified.** Manual and capture state machinery is substantially implemented, but this is not an accepted production scan-to-saved-note feature. Review only: no fixes, migration/dependency edits, gate changes, or shared writes.

## Baseline

Reviewed the current working tree, including uncommitted source, at `C:/Users/LEGION/Desktop/Bookconnect4_library`, branch `codex/library-cover-shelf`. Existing tracked/untracked changes were preserved. The worktree-split branch name in AGENTS is historical; Git supplied the actual branch.

Read AGENTS, ACTIVE, DOC-13, Phase 9 SESSION-START/TRACKER/master invariants/implementation tracker, Library TRACKER, SDD-06 rev 0.20, supporting SDD-02/03, Option-B navigation, manual persistence/forward-correction plans, and the three supplied capture/native receipts. SDD-06 and the latest owner decision govern Library behavior. Earlier four-category/non-null claims and full-image-default diagrams are superseded history, not current live-schema proof. Older next-action paragraphs do not renew authority.

Marketplace remains Phase 9, M46/resumed canary completed, unit `unit7c_resumed_connected_canary_pass_main_integrated`; further work needs separate authority. This independent Library review does not advance Marketplace. Library review unit: `library_sdd06_complete_independent_review_complete_findings_open`.

Persistence is ON HOLD. Four `MANUAL_NOTE_WRITE_GATES` at `src/features/books/notes/manualNotesGateway.ts:8` are false. Create/update fail before dispatch; note deletion is also gated. These are intentional release switches, not database authorization controls or failed-save defects.

## Confirmed findings

### F01 — P1: failed privacy change still claims the review is private

Location: [Book Details optimistic change](<C:/Users/LEGION/Desktop/Bookconnect4_library/app/(tabs)/library/[bookId].tsx:296>), error handler line 133.

Starting with a confirmed public book review, reject `booksService.addRating` and press the privacy toggle. After the Error alert, the fixture remains `review_is_public=true`, but UI says **Private Review** and hides Public Review. Local visibility changes before confirmation; onError only alerts. A reader can believe public text has become private when it has not. The closed reading-note gates do not protect this retained book-review path.

Fresh mounted current-component fault injection reproduced this: scratch `privacy-rejection.test.tsx`, 1/1 PASS asserting the defective behavior, three skipped. No real review write occurred. Recommended correction: distinguish confirmed visibility from pending intent, confirm on success, and roll back/reconcile on failure. Add rejection and stale-response regressions.

### F02 — P2: B01 notes-first hierarchy is missing

Location: [management block](<C:/Users/LEGION/Desktop/Bookconnect4_library/app/(tabs)/library/[bookId].tsx:227>), Community Reviews line 331, My Notes line 404, Add note line 457.

SDD-06 B01 requires primary Add note, visible My review, named Book options, and explicit community/metadata destinations. The actual long ownership/condition/rating/review/metadata/community stack still precedes notes; no Book options entry exists. Source and actual 390×844 browser with a long title confirm the order. Functions remain present, but the primary task is pushed down. Recommended correction: implement B01's hierarchy while retaining management and Saved Pages responsibilities.

### F03 — P2: Book Details Back is unnamed and 40×40

Location: [Back control](<C:/Users/LEGION/Desktop/Bookconnect4_library/app/(tabs)/library/[bookId].tsx:201>), sizing line 514.

Fresh 390×844 browser measurement: `DIV`, role null, aria-label null, width/height 40. Source is icon-only without explicit name/role or expanded hit area. SDD-06 §7 requires accessible controls and 48dp targets. Native screen-reader behavior was not executed. Recommended correction: name Back, supply button semantics and at least 48×48 activation area; audit other retained management controls.

### F04 — P2, existing held blocker: live creation metadata is editable

Fresh read-only MCP verified `Bookconnect_reactexpo` / `ahntbtktjjmvfosgkmgn`, ACTIVE_HEALTHY, PostgreSQL 17.6.1.063. Ledger: `20261010221843 library_manual_note_persistence`, stored SQL MD5 `d187c32b7b0846e735d6696adff6a7ed`.

Live `library_manage_note_revision` updates version/updated_at but does not restore OLD.created_at. Authenticated has table-wide INSERT/UPDATE/SELECT/DELETE. Owned-book RLS does not restrict metadata columns. The documented integrity defect therefore remains. No live exploit/write was attempted; the prior disposable reproduction is historical, with unchanged prerequisites freshly confirmed.

Reference: [forward plan](../../MANUAL-NOTE-FORWARD-CORRECTION-PLAN.md:35). The [original candidate](<C:/Users/LEGION/Desktop/Bookconnect4_library/supabase/migrations/20261010172118_library_manual_note_persistence.sql>) is not the applied definition; no current local source line represents the live function. Do not replay that candidate. Recommended correction: separately resume the forward-correction unit, then require disposable and real authenticated API/concurrency acceptance before opening gates. PUBLIC-targeted policies still check actor/owned parent; they do not alone establish anonymous exposure. No anon table grant was returned.

### F05 — P2: crop interface change breaks full TypeScript through archived evidence

Location: [archived diagnostic](<C:/Users/LEGION/Desktop/Bookconnect4_library/docs/user/library/evidence/sdd06-native-crop-emulator-2026-10-15/native/diagnostic-route-source.tsx:72>).

Full `tsc` reports TS2739: NoteCrop now requires `cropMode`, `autoDetected`, `onReset`; this call supplies none. Scoped compilation excludes the archived evidence. This failure relates to automatic cropping; broader compiler failures are not all unrelated. Recommended correction: preserve immutable historical source as noncompiled evidence or explicitly exclude the evidence tree from app compilation without weakening runtime checks. Do not silently rewrite old proof.

### F06 — P3: Library regression fixtures lag behind current behavior

Locations: [Book Details assertion](<C:/Users/LEGION/Desktop/Bookconnect4_library/app/(tabs)/library/__tests__/[bookId].test.tsx:141>), [route assertion](<C:/Users/LEGION/Desktop/Bookconnect4_library/src/components/library/__tests__/LibraryShelf.test.tsx:620>).

The first expects Private Note while required/current copy is Private Review; its notesService mock predates manualNotesGateway. The second expects no sibling animation override, while notes/reader/composer explicitly use `animation: 'none'`. Both failures relate to Library changes, although the assertions alone do not prove runtime regressions. Isolated Book Details rerun: 1 failed, 2 passed. Recommended correction: reconcile fixtures with approved contracts and retain meaningful privacy/navigation coverage.

## R01–R21 acceptance matrix

“Local verified” means current source plus fresh tests/browser actions. Mounted services/OS effects are simulated. No row implies connected persistence or complete native acceptance.

| Requirement | Assessment and evidence | Remaining boundary |
|---|---|---|
| R01 identity/entry | Partial: mounted identity and browser book→chooser→blank editor pass; F02 | B01 organization, native retained behavior |
| R02 collection/context | Local verified: mounted errors/cache/count/version and browser populated/filter-empty/reader | Native list anchor; actual write refresh |
| R03 true empty | Local verified: successful-empty distinguished from failed load in source/tests | Fresh browser empty/error fixture not run |
| R04 categories | Local verified: five choices, null/Skip; browser Space selects Question; fresh Forward chooser | Live category round-trip gated |
| R05 manual/validation | Blank browser editor, disabled empty Save; 24abc rejected; 501 words retained with feedback | Native keyboard/footer; confirmed Save gated |
| R06 intake | Adapter permission/dismissal/late-picker tests; browser synthetic photo preparation without OCR | Real native camera/gallery/permission UI |
| R07 OCR review | Mounted editable/category/mode/checkpoint checks pass; no forced edit/autosave | Native production-composer route unverified; web OCR unavailable |
| R08 reader | Mounted body-copy/cache/identity; actual fixture reader and edit/discard same noteId | Actual clipboard and native long-reader position |
| R09 editing | Intentionally gated; simulated rejection/cache/version-aware submission pass | Real save/readback/atomicity |
| R10 load error | Mounted scoped reads/wrong-book rejection; failure distinct from empty | Fresh browser retry/fault matrix |
| R11 save failure | Local verified: definite versus unknown, preserved fields, retry semantics | Real transport classification/reconciliation |
| R12 exits | Browser Back/Keep/Discard/Forward and scan-specific discard; mounted races | Native hardware Back/gestures; unsupported browsers |
| R13 no text | Mounted recovery retains origin/checkpoint, no empty overwrite | Fresh native no-text UI |
| R14 incomplete | Mounted code-point cap, revision-bound acknowledgement, non-saving dialog actions | Native modal/TalkBack/large-text |
| R15 crop | Current-source isolated native evidence applicable; fresh independent frames/pixels and tests pass | Fresh emulator/system intake/OEM behavior |
| R16 OCR failure | Mounted technical/unavailable/no-text distinctions; actual web unavailable feedback | Real native failure/recovery UI |
| R17 uncertain save | Intentionally gated; immutable payload, bounded recheck, Leave/reopen/account reset simulations pass | Actual unknown-write reconciliation/restart outcomes |
| R18 replacement | Mounted B05/B07/B09 sole-checkpoint/identity/partial state; browser exact B05 restoration | Native connected replacement paths |
| R19 families/a11y | Partial/defective: shared forms present; F02/F03; narrow long-title actions exercised | Full contrast/dark/reduced-motion/200%/native matrix |
| R20 retained functions | Partial/defective: management/Saved Pages remain; simulations cover error/excerpt/delete; F01 | Real management/delete/privacy transport acceptance |
| R21 concurrency | Intentionally gated; conditional version predicate and stale normal/replacement simulations pass | Actual authenticated atomic races/denial |

## B01–B16 state coverage

| State | Current review evidence |
|---|---|
| B01 details | Source/actual browser; retained functions; F01–F03 prevent acceptance |
| B02 collection | Actual populated/filter-empty/reader; mounted refresh/cache/context |
| B03 true empty | Mounted successful-empty distinction; browser true-empty not run |
| B04 chooser | Actual five categories/keyboard Question/Forward reset; null/Skip tests |
| B05 manual | Actual blank/validation/history/replacement; saving gated |
| B06 intake | Actual web unavailable and synthetic gallery selection; native system intake unverified |
| B07 review | Mounted editable/checkpoints; applicable isolated native receipt; no fresh native composer journey |
| B08 reader | Actual fixture/category/page/edit/discard/same noteId; delete intentionally disabled |
| B09 edit | Actual dirty discard/identity; simulated saves/conflicts; real writes gated |
| B10 load error | Mounted/current source; browser injected-error variant not run |
| B11 save failure | Mounted definite/unknown outcomes; real transport unverified |
| B12 exit | Actual new/edit/capture scopes; hardware Back unverified |
| B13 no text | Mounted recovery; fresh native UI unverified |
| B14 incomplete | Mounted revision acknowledgement; native modal a11y unverified |
| B15 crop | Actual web fallback/hidden controls/edge/reset/rotate/discard; native receipt below |
| B16 technical failure | Mounted distinctions and actual web unavailable copy; native error UI unverified |

## Crop/native evidence applicability

No confirmed defect found in reviewed crop/session/OCR/resource handling. Geometry uses validated-frame union plus 2% image-dimension padding in oriented coordinates. `captureSession.ts:126–138` transforms before caching; `:156–158` reuses matching automatic text; `:168–180` transforms manual crop then recognizes its URI. Rotation invalidates text. Generation/session identity fences cancellation/account/book/mode/note changes. Transform references and native leases delay owned-input deletion until processing settles; gallery originals are excluded. Fresh overlapping cancellation/disposal tests pass.

Latest `sdd06-auto-crop-2026-10-15/NATIVE-RUN.json` exactly matches all six current production-file SHA256s (geometry, adapter, session, OCR service, NoteCrop, composer) and archived harness. Fresh Pillow 11.3.0 calculations did not import production geometry helpers:

| Saved native image | Literal source rectangle | Fresh check |
|---|---|---|
| Automatic 983×1815 | (168,134)–(1151,1949) | All RGBA bytes identical |
| Manual 983×1705 | (168,134)–(1151,1839) | All RGBA bytes identical |
| Older manual 1280×1100 | (160,440)–(1440,1540) | All RGBA bytes identical |

Seven saved native frames independently yield `[168,134,1151,1949]` with 32/44px padding. Saved receipts show one automatic OCR call, then a second transformed-input manual call excluding the bottom sentinel. Fixture SHA256 `2e0f576fa2b2e3617d531f7b1b6f0e727a56dbc4dd52f6efb47c86a912df897e`.

These are fresh evidence-integrity/calculation checks, **not fresh device execution**. The older manual receipt has drift in five capture files; its pixels remain historical proof and its compiled harness causes F05. `adb devices -l` returned no devices. `emulator -list-avds` listed BookConnect_Pixel5_API36 then failed `CreateNamedPipe: Access is denied (5)`. No emulator launched. System picker/camera, live capture, EXIF/OEM/physical devices, hardware Back, TalkBack and iOS remain unverified. No temporary production app route was created.

## Fresh verification

Full failed filenames/messages: [jest-failures.json](./jest-failures.json). Compiler output: [tsc-full.log](./tsc-full.log). Export identity: [build-identity.json](./build-identity.json). Diagnostic privacy test: [privacy-rejection.test.tsx.txt](./privacy-rejection.test.tsx.txt).

| Command | Result |
|---|---|
| `npx jest --runInBand --no-cache --json --outputFile=.tmp/sdd06-review-20261016/jest.json` | 295 suites passed/34 failed/1 skipped; 2,522 tests passed/4 failed/4 skipped; 544.605s; open-handle warning after completed JSON, exit 1 |
| `npx tsc -p tsconfig.library-notes.json --noEmit --pretty false` | PASS, exit 0 |
| `npx tsc --noEmit --pretty false` | FAIL: 37 diagnostics, related archived crop call plus existing store-view E2E typing and Supabase .ts-extension imports; no active Library application-path error |
| `npx expo export --platform web --output-dir .tmp/sdd06-review-20261016/web` | Initial default-worker failure: EPERM spawn/transformFile |
| Same export with `--max-workers 1` | PASS; current build/served hash matched |
| Eight manual suites below | PASS 110/110, 92.679s; mocked services/OS |
| Four capture suites below | PASS 51/51; OCR-service suite also passed in full run |
| Scratch privacy test below | PASS 1/1 proving F01, 3 skipped, 30.469s |
| Isolated original Book Details below | FAIL 1/3, two pass, 25.817s; stale Private Note assertion |
| Clubs timeout rerun below | PASS 1/1, 40 skipped, 3.61s with default timeout |
| Phase 9 documentation validator | PASS before closeout: 195 definitions, zero duplicates/missing traceability, regression probes pass, 76 Markdown files; final rerun recorded below |

Exact focused commands (workspace root):

```powershell
npx jest --runInBand --no-cache --runTestsByPath src/features/books/notes/__tests__/manualNotes.test.ts src/features/books/notes/__tests__/manualNotesGateway.test.ts src/features/books/notes/__tests__/manualNotePersistenceAdapter.test.ts src/features/books/notes/__tests__/manualNoteDeleteGate.test.ts src/features/books/notes/__tests__/noteNavigation.test.tsx src/features/books/notes/__tests__/composerBrowserHistory.test.ts src/components/notes/__tests__/ManualNoteFlow.test.tsx src/components/notes/__tests__/ManualNoteJourney.test.tsx
npx jest --runInBand --no-cache --runTestsByPath src/features/books/notes/__tests__/captureSession.test.ts src/features/books/notes/__tests__/captureAdapter.test.ts src/components/notes/__tests__/NoteCaptureJourney.test.tsx src/components/notes/__tests__/NoteCrop.test.tsx
npx jest --runInBand --no-cache --runTestsByPath .tmp/sdd06-review-20261016/privacy-rejection.test.tsx --testNamePattern 'reproduces retained Private Review' --testTimeout 30000
npx jest --runInBand --no-cache --runTestsByPath 'app/(tabs)/library/__tests__/[bookId].test.tsx' --testTimeout 30000
npx jest --runInBand --runTestsByPath src/features/clubs/screens/__tests__/ClubManageScreen.test.tsx --testNamePattern 'saves updated club settings through the manage-club settings mutation'
powershell.exe -NoProfile -ExecutionPolicy Bypass -File docs/multi-tenant-bookstore-marketplace/implementation/phase-9-image-inventory/scripts/validate-phase9-continuity.ps1
```

Both initial isolated Book Details/privacy attempts exceeded the default 5s during cold React Native initialization; diagnostic 30s reruns exposed actual behavior. Full run's Clubs timeout passed in isolation. Marketplace `marketplacePhase9Unit7cPrivateSaveRevisionCorrection.test.ts` fails an exact source-string expectation for ELSE/newline/v_revision; no migration changed. F06 accounts for the two Library assertions. Thirty other failed suites are collectors: 24 temporary Playwright specs picked up by Jest and six fixture/support modules with no tests. All names/messages are in the JSON. Historical 2,523/3 counts are not this fresh result; F05/F06 contradict a blanket “all failures unrelated” description.

## Actual browser execution

Used the in-app browser at `http://127.0.0.1:8083`, fresh export with synthetic transport injected only in scratch-served HTML. Unchanged application JS ran; all remote fetches were intercepted and no external request/write forwarded; real-time WebSockets disabled in the harness. This is actual application UI with synthetic responses, not authenticated persistence. Existing app source/dependencies were unchanged; no secret values printed.

Entry `entry-855189382e117a59bfc6adf52572bc4b.js`, 5,541,785 bytes. Local and HTTP SHA256 both `640940AF8F5FF92693C008D147DF40B898A139453424AD484189D5D12D8362CB`. Export/server root establishes current-checkout identity; bundle size alone is not proof. First server attempt preceded finished export and exited on missing index; restarted after export/hash verification.

At 390×844 with long book title exercised: Book Details→chooser→Space/Question→blank editor; invalid page/501-word guards; browser Back/Keep/Discard/Forward; replacement confirmation→intake→synthetic photo→full-image fallback→Adjust crop→edge/reset/rotation→Discard scan→exact checkpoint; saved reader→edit→dirty discard→same noteId/confirmed body; collection→Thought filtered-empty→Show all→reader. A strict text locator encountered hidden retained routes; visible-only lookup confirmed the correct body, not data loss. File selection returned slowly but completed; no picker-performance acceptance claimed.

Fresh full CSS-200%/large-text, contrast, dark/reduced-motion, clipboard, browser failed-load variants, native camera/UI checks were not run. Historical browser checks are not counted as fresh passes. Viewport override reset and synthetic drafts discarded; review tabs/server closed/stopped at closeout.

## Remaining risks and corrective order

Unconfirmed risk: review blur/privacy toggles issue independent unconditional writes (`[bookId].tsx:290,298`, `booksService.ts:822`); out-of-order responses could restore older privacy/text. F01 proves rejection dishonesty, not this race. Browser history guard requires Navigation API (`composerBrowserHistory.ts:51`); other browsers need evidence or a scope/fallback decision.

1. Correct F01 confirmation/rollback; add rejected-write and out-of-order-response regressions.
2. Implement B01 hierarchy and accessible retained controls (F02/F03), preserving management/Saved Pages.
3. Resolve F05/F06 and Jest collection routing; retain meaningful tests and separate Marketplace/Clubs ownership.
4. Complete current-source native composer/picker/camera/permissions/cancel, orientation/OEM, hardware Back, physical-device, TalkBack/large-text/keyboard/contrast acceptance and fresh pixel expectations.
5. Keep persistence ON HOLD until separately resumed; verify the forward correction and real Auth/PostgREST denial/compatibility/concurrency/reconciliation before gate enablement.
6. Re-review corrected scope. SDD06-07 and production scan-to-saved-note acceptance remain open.

Exact next action: **owner reviews F01–F06 and selects a bounded correction scope; this review request does not authorize implementation.** Review report, scratch harness/test and continuity records are uncommitted. Nothing staged, committed, pushed, deployed or applied. Database/Storage/provider mutation: none; read-only Supabase metadata only. Marketplace global handoff and mutation authority unchanged.

Closeout verification: after tracker/SDD/audit updates, Phase 9 continuity PASS (195 definitions, zero duplicate/missing traceability, regression probes PASS, 76 Markdown files); `git diff --check` PASS, with pre-existing LF/CRLF advisory warnings only. Staged diff empty (`git diff --cached --quiet`, exit 0). Active trackers re-read and exact next action confirmed. Browser viewport reset, review tab closed, scratch HTTP server stopped. Emulator enumeration failed without launching a device; its crash-handler probe may remain pending after interruption, and no process cleanup outside the owned server was attempted. The report remains one cohesive lifecycle review; its length preserves required acceptance/evidence detail.
