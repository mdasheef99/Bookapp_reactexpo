# FR01 queue-lifetime correction — 2026-10-16

**FR01 fixed locally and verified.** The owner explicitly requested this correction after the [independent follow-up review](../sdd06-f01-f03-followup-review-2026-10-16/README.md). Pending Private visibility, rating and submitted text now survive Book Details unmount/reopen within the existing actor/book/QueryClient queue. No remaining failure was found in the bounded verification below; complete Library release acceptance remains open.

Worktree `C:/Users/LEGION/Desktop/Bookconnect4_library`, branch `codex/library-cover-shelf`; existing mixed changes preserved. Library unit: `library_sdd06_fr01_queue_lifetime_fixed_local_verification_complete`. Marketplace remains Phase 9 at completed Unit7C/M46, with DOC-13/ACTIVE/global handoff and database-mutation authority unchanged.

## Change and traceability

Source: [Book Details queue access](<C:/Users/LEGION/Desktop/Bookconnect4_library/app/(tabs)/library/[bookId].tsx:88>), [submission-bound settlement](<C:/Users/LEGION/Desktop/Bookconnect4_library/app/(tabs)/library/[bookId].tsx:177>).

The prior queue lived in TanStack Query while pending visibility/rating lived in component refs. Reopening created fresh refs and built a later full payload from stale confirmed data. The correction removes those refs and reads the latest pending submission from the installed mutation cache using the exact actor/book mutation key. This includes paused submissions waiting behind earlier requests. No separate store, queue, dependency or durable-draft behavior was added.

New submissions inherit pending visibility/rating; without a pending submission, they read the latest confirmed query cache. A reopened editor hydrates from the latest pending review text. Existing baseline comparison still preserves subsequently typed text during confirmations/refetches. Public/Private labels continue to show confirmed data, never unconfirmed intent. Rejected submissions stop being pending and therefore cannot leave a stale visibility intent after the queue settles. Settlement refreshes the immutable submission's actor/book/catalogue identity rather than the screen's possibly changed identity.

This corrects existing B01/R20 retained-review behavior in SDD-06 revision 0.22. F02/F03 layout/accessibility corrections are retained. F04–F06, native/SDD06-07 release acceptance and the held note-persistence correction remain outside this pass. There is no cross-device concurrency guarantee or recovery after process/QueryClient loss.

## Behavioral RED → GREEN

Before application edits, four permanent mounted regressions failed for the expected payload differences:

| Pending action → reopen → later action | Required | Former result |
|---|---|---|
| Private → edit/blur | visibility false | true |
| Rating 4 → visibility toggle, initial rating 2 | rating 4 | 2 |
| Submitted text → visibility toggle | Pending review text | Confirmed review |
| Private → visibility toggle | visibility true | false |

RED: one suite, four failed/nine skipped tests, exit 1, 5.315 seconds. After the fix, all four and the original nine correction tests passed. Four additional safety checks cover the latest of multiple waiting writes, separate actors, separate books, and a rejected pending visibility request followed by a fresh Private retry. All use the real Book Details component and QueryClient; service/native effects are mocked. Literal payload expectations and confirmed cache/UI state are asserted.

The first expanded run had 60 passes/one failure because its final synchronous label assertion preceded batched React notification. Waiting for the visible label resolved that test timing issue; application code was unchanged. Act/Clipboard/punycode warnings remain visible in the logs and are not presented as a warning-free result.

## Final verification actually run

| Check | Fresh result |
|---|---|
| Five focused suites, including 17 Book Details correction tests | **61/61 PASS**, exit 0, 18.315 seconds |
| Exact unchanged archived FR01 reproduction from the follow-up review | **1/1 PASS**, exit 0, 3.591 seconds; previously failed |
| Scoped Library TypeScript | **PASS**, exit 0, no diagnostics |
| Single-worker Expo web export | **PASS**, exit 0; [bundle identity](./build-identity.json) |
| Full TypeScript, including the new app test file | **FAIL**, exit 2; same 37 diagnostic headers as the prior correction, no added/removed diagnostic header |

[Focused results](./focused.json), [focused log](./focused.log), [exact reproduction results](./original-reproduction.json), [reproduction log](./original-reproduction.log), [full compiler output](./tsc-full.log), [export log](./export.log), [source hashes](./source-hashes.json).

Commands from the workspace root:

```powershell
node node_modules/jest/bin/jest.js --runInBand --runTestsByPath 'app/(tabs)/library/__tests__/book-details-corrections.test.tsx' src/components/notes/__tests__/ManualNoteJourney.test.tsx src/features/books/notes/__tests__/manualNoteDeleteGate.test.ts src/features/books/notes/__tests__/manualNotesGateway.test.ts src/features/books/notes/__tests__/noteNavigation.test.tsx --json --outputFile=.tmp/sdd06-fr01-fix-20261016/focused.json
node node_modules/typescript/bin/tsc -p tsconfig.library-notes.json --noEmit --pretty false
node node_modules/typescript/bin/tsc --noEmit --pretty false
node node_modules/expo/bin/cli export --platform web --max-workers 1 --output-dir .tmp/sdd06-fr01-fix-20261016/web
```

The exact archived reproduction was copied temporarily to its documented `.tmp/f01-independent-20261016/remount.test.tsx` path, run with `--runTestsByPath`/`--testTimeout 30000`, then removed. Its immutable `.tsx.txt` archive remains unchanged. No new executable scratch test remains to add a collector/compiler failure.

Full compiler failures remain the historical archived NoteCrop call (F05), Store View E2E typing, and Supabase `.ts` import-extension diagnostics. The new application source/tests have no compiler diagnostic. Whole-repository Jest was not rerun for this bounded follow-up: its classified failures remain open in the [prior correction receipt](../sdd06-f01-f03-corrections-2026-10-16/README.md). No whole-repository-green claim is made.

Export used development configuration, a dummy localhost backend and `EXPO_NO_DOTENV=1`; no real backend/provider write occurred. Browser/native interactions were not rerun. Mounted lifecycle execution proves the reproduced queue bug, not physical-device, real transport or complete accessibility acceptance.

## Closeout and next action

Exact next action: independently review the bounded FR01 queue-lifetime diff and these receipts. F04–F06 and native/release work require their own selected scope. Persistence remains **ON HOLD**, all four MANUAL_NOTE_WRITE_GATES false; the gateway hash matches the prior correction. No schema/RLS/service contract changed, so no live Supabase audit or migration was needed.

Application changes are limited to Book Details and its permanent correction tests. SDD-06, Library interaction/inventory/tracker and Phase 9 separate-Library continuity records reflect the correction. Original review receipts remain historical and immutable. All work is local/uncommitted alongside existing changes. Nothing staged, committed, pushed, deployed or applied. Database/Storage/provider mutations: none.

Final [continuity run](./continuity.log) PASS: 195 definitions, zero duplicate/missing traceability, validator regression probes PASS, 76 Markdown files. Relative file-link scan across the receipt, SDD, Library tracker, interaction map and inventory found no missing target. `git diff --check` PASS; existing LF/CRLF advisories only. All three final source hashes match; write-gateway source still has four false gates and its hash is unchanged. Staged diff is empty, exit 0. Library and Phase 9 current trackers re-read with the exact FR01 review next action; original temporary executable reproduction absent. These cohesive documents preserve their existing responsibilities; no requirement/evidence was pruned to meet a line count.
