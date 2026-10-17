# F01–F03 correction receipt — 2026-10-16

Owner authorized implementation of F01–F03 from the [independent review](../sdd06-independent-review-2026-10-16/README.md). F04–F06 remain outside this pass. Persistence is **ON HOLD**, all four MANUAL_NOTE_WRITE_GATES false. No migrations, dependencies, external writes or Git publication.

Worktree: C:/Users/LEGION/Desktop/Bookconnect4_library, branch codex/library-cover-shelf; extensive existing changes preserved. Marketplace remains Phase 9, M46 canary completed, unit unit7c_resumed_connected_canary_pass_main_integrated. DOC-13/ACTIVE/global handoff unchanged. Correction unit: library_sdd06_f01_f03_corrected_review_pending.

## Corrected behavior and traceability

**F01 / R20:** Public/Private Review now comes from confirmed query data. Review-blur, rating and visibility writes share the installed TanStack Query actor/book-scoped serial mutation queue. Immutable submissions retain their actor/book/payload. Success cancels exact-book in-flight reads before updating confirmed cache. Refetch waits for the queue to drain. Pending rating and visibility intents feed subsequent queued submissions; blur cannot restore old Public visibility and privacy cannot restore an old rating. Failure retains confirmed visibility and native Error feedback. Newer typed text survives confirmation/refetch. Intents clear after the last settlement with an identity guard. This is local ordering, not cross-device server concurrency protection.

**F02 / B01 / R01/R19/R20:** book attribution and directly reachable reading status → primary Add note → Notes/count/recent saved readers → Saved Pages → named inline My review, Book options, Community reviews and Book information. My review groups rating/text/visibility. Book options retains ownership, conditional lending/condition and confirmed removal. Community loading/error/empty/populated branches and conditional metadata remain. Disclosures expose name, expanded state and ≥48dp targets. No new route or deferred feature. Local page background now uses current theme colors; a visual check caught the old transparent background conflicting with midnight text. Shared theme is unchanged.

**F03 / R19:** Back to Library has explicit button role/name, visible arrow/Library label and minimum 48×48. The existing helper still returns explicitly to Library. Unavailable-book Back also has name/role/minimum target.

Source: [Book Details](<C:/Users/LEGION/Desktop/Bookconnect4_library/app/(tabs)/library/[bookId].tsx>).
Regression suite: [book-details-corrections.test.tsx](<C:/Users/LEGION/Desktop/Bookconnect4_library/app/(tabs)/library/__tests__/book-details-corrections.test.tsx>).
One [ManualNoteJourney test](<C:/Users/LEGION/Desktop/Bookconnect4_library/src/components/notes/__tests__/ManualNoteJourney.test.tsx:311>) now opens My review before its retained mutation assertions. This is necessary for F02's disclosure, not the excluded F06 legacy-suite cleanup. The original stale Book Details and shelf fixtures, historical compiler evidence and database artifacts remain unrepaired.

## Behavioral RED and focused GREEN

Five initial tests failed against unchanged production source: optimistic Private label while pending; two concurrent dispatches instead of one in two overlap cases; missing named destinations; missing accessible Back. Initial test-loader hoisting errors were corrected before accepting behavioral RED.

The first correction passed seven tests. Independent review found queued privacy/blur could restore a previous rating. A new deferred RED proved initial rating 2 → pending selection 4 → queued privacy submitting **2**. Pending rating intent corrects the payload/final cache to **4**.

Final focused run: **5 suites / 53 tests PASS**, including **9 new correction tests**, 30.764 seconds. Cases cover rejection/pending visibility, serial blur→privacy, queue recovery after rejection, retained destinations/confirmation handlers, Back name/size/navigation, newer typed draft, rapid visibility toggles, pending rating and privacy→later text blur. Real QueryClient scheduling executes; services/OS are mocked. Independent reviewer confirmed the rating fix and found no remaining important in-scope source defect; reviewer did not rerun tests.

Exact command:
~~~powershell
npx jest --runInBand --runTestsByPath 'app/(tabs)/library/__tests__/book-details-corrections.test.tsx' src/components/notes/__tests__/ManualNoteJourney.test.tsx src/features/books/notes/__tests__/manualNoteDeleteGate.test.ts src/features/books/notes/__tests__/manualNotesGateway.test.ts src/features/books/notes/__tests__/noteNavigation.test.tsx
npx tsc -p tsconfig.library-notes.json --noEmit --pretty false
npx expo export --platform web --max-workers 1 --output-dir .tmp/sdd06-f01-f03-20261016/web
~~~

Scoped TypeScript completed exit 0; fresh single-worker exports passed. A prior focused command mistakenly named a nonexistent standalone VaultPagesList test and caught the inline-review assumption in ManualNoteJourney: 52 passed, one failed, plus ENOENT collector. The corrected command above passes; Saved Pages coverage resides in ManualNoteJourney. Deprecation/React act warnings are retained in logs. New source has no compiler diagnostic.

## Browser evidence

Actual in-app browser, fresh export served at http://127.0.0.1:8083 with scratch HTML synthetic fetch transport. No remote request/write forwarded; sockets disabled. Production bundle unchanged by the fixture. This is real UI with simulated transport, not connected acceptance.

At 390×844 with a long title, confirmed new B01 order; Enter opened My review, Space opened Book options; ownership/lending/condition/removal/metadata remained reachable. Removal not confirmed in browser (mocked component test exercises confirmation/dispatch). Back measured **100.2875×48 CSS pixels**, role button, label Back to Library, and returned to Library. Rejected synthetic visibility write left Public Review displayed. Community-unavailable and Saved Pages-empty feedback retained. Final current-source bundle hash/readback and visual recheck are recorded at closeout.

No native emulator, physical-device, TalkBack, full contrast/large-text/keyboard matrix or real transport acceptance claimed. Populated/loading community and retained Saved Pages logic were moved intact; no new real deletion/write performed. Browser viewport reset, synthetic review tab/server stopped at closeout.

## Remaining boundaries

F04 metadata correction, F05 historical compiler evidence and F06 stale fixture cleanup remain excluded. Gate source is unchanged and gate-focused tests pass. No database/Supabase inspection was needed because schema/security contracts are unchanged; no external writes occurred. All code/docs remain uncommitted, nothing staged, committed, pushed, deployed or applied.

Exact next action: owner reviews corrected F01–F03 source/evidence. This does not close complete SDD06-07, native acceptance or production scan-to-saved-note release. Separate Marketplace authority is unchanged. Broad-run/compiler/final validation details follow below.

## Broad verification and closeout

Full command: `npx jest --runInBand --no-cache --json --outputFile=.tmp/sdd06-f01-f03-20261016/jest-full.json`. Completed 550.937s: **296 suites passed, 35 failed, one skipped; 2,531 tests passed, eight failed, four skipped**. Completed JSON plus open-handle warning; process stopped/exited after assertions. This run began before the final journey-test adjustment; it is not a claim that every file was frozen throughout the long run. Final corrected focused command above proves affected tests on the final behavior.

Every failed filename/message is in [jest-failures.json](./jest-failures.json). Eight assertions:

1. LibraryShelf route animation expectation (excluded F06).
2. ManualNoteJourney inline Public Review assumption (subsequently corrected solely to open My review; final focused PASS).
3–5. Prior review's historical scratch `privacy-rejection.test.tsx`: old inline review tests and a defect-demonstration assertion expecting the former bug. This is temporary historical evidence picked up by broad Jest, not the new permanent regression suite.
6–7. Original Book Details suite's old inline/terminology/community fixture assumptions (excluded F06; file unchanged).
8. Marketplace M46 source-string assertion (outside Library correction).

Thirty additional suite failures are collectors: 24 pre-existing temporary Playwright specs incorrectly collected by Jest, six fixture/support modules with no tests. No collector configuration or excluded fixture was repaired. New nine-test correction suite passed in the broad run as well. No whole-repository-green claim.

Full `npx tsc --noEmit --pretty false` still fails **37 diagnostics**: archived NoteCrop call (excluded F05), existing store-view E2E typing and Supabase `.ts` import-extension diagnostics. [Full compiler output](./tsc-full.log) contains no diagnostic in corrected source/new tests/journey adjustment. Scoped compiler completed exit 0.

Final export entry `entry-756355eeff9df6797792ead88a97c721.js`, 5,544,151 bytes; local and HTTP SHA256 both `4C3C22CC3D60CEB6AC8E44377266C5680E6EC370D2509C1A9D0484F8156C6A44`. [Identity](./build-identity.json), [final source hashes](./source-hashes.json), [focused output](./focused-corrected.log), [rating RED](./rating-red.log). Reloaded final bundle in browser and rechecked loaded named sections, theme-backed review surface and rejected privacy remaining Public. No native/device result inferred.

Final Phase 9 continuity validator PASS: 195 definitions, zero duplicate/missing traceability, regression probes PASS, 76 Markdown files. `git diff --check` PASS; LF/CRLF advisory warnings only. Local documentation links checked. Active Library/Phase trackers re-read with the exact handoff above; staged diff empty (`git diff --cached --quiet`, exit 0). Code and continuity updates remain local/uncommitted alongside preserved pre-existing changes. Documents remain cohesive; advisory line counts did not prune requirements. Nothing staged, committed, pushed, deployed or applied. External/database/Storage writes: none; gates remain four false. Review browser viewport reset and tab/server stopped at closeout.

