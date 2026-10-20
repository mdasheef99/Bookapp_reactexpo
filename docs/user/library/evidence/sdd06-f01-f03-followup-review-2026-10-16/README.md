# F01–F03 independent follow-up review — 2026-10-16

**Verdict: changes requested for F01; F02/F03 addressed in reviewed source and focused tests.** The original optimistic privacy-label defect is corrected, but a mounted lifecycle regression can make a review public again after a Private request. Complete release acceptance remains open.

Reviewed current uncommitted Library worktree at `C:/Users/LEGION/Desktop/Bookconnect4_library`, branch `codex/library-cover-shelf`, against [SDD-06](../../SDD-06-after-book-entry-ui.md) revision 0.21 and the [correction receipt](../sdd06-f01-f03-corrections-2026-10-16/README.md). This pass changed review evidence/continuity only, with a temporary test runner file removed after archival. No application fixes were made.

## FR01 — P1: reopening Book Details loses pending private visibility

Responsible source: [component-local intent](<C:/Users/LEGION/Desktop/Bookconnect4_library/app/(tabs)/library/[bookId].tsx:74>), [review submission](<C:/Users/LEGION/Desktop/Bookconnect4_library/app/(tabs)/library/[bookId].tsx:207>), and [shared serial queue](<C:/Users/LEGION/Desktop/Bookconnect4_library/app/(tabs)/library/[bookId].tsx:151>).

Reproduction with the actual component and QueryClient, mocked services, and deferred responses:

1. Begin with a confirmed public review. Request Private and hold its response.
2. Unmount Book Details, then mount it again with the same actor, book and QueryClient while the request is pending.
3. Edit the review and blur the field. The new write correctly waits behind the first request.
4. Complete the Private request successfully, then inspect the queued second write.

Expected second payload: `['entry', undefined, 'Later text after reopening', false]`.
Actual second payload: `['entry', undefined, 'Later text after reopening', true]`.

After the second simulated successful write, the confirmed fixture is public again. No second visibility action was taken. Serialization preserves request order but cannot preserve an intent held only in the unmounted component. The new instance constructs its full payload from cached public visibility before the first request settles. This is a same-client lifecycle defect, independent of cross-device server concurrency.

Recommended correction: make pending review intents survive screen instances within the existing actor/book queue, or submit field-specific intent and derive untouched fields after preceding writes settle. Preserve explicit visibility/rating changes, failure handling, newer text and actor/book isolation. Add permanent unmount/reopen privacy and rating regressions; rerun existing overlap tests. No schema or persistence-gate change is required for this correction.

[Archived executable reproduction](./remount-regression.test.tsx.txt) is stored as noncompiled evidence. To rerun from the workspace root, copy it to `.tmp/f01-independent-20261016/remount.test.tsx`, then execute:

```powershell
node node_modules/jest/bin/jest.js --runInBand --runTestsByPath .tmp/f01-independent-20261016/remount.test.tsx --testTimeout 30000
```

Fresh result: **one failed test / one suite, exit 1**, 4.727 seconds. The assertion received `true` where `false` was required. This demonstrates the defect; it is not a passing acceptance test or real external write. Services and native primitives are mocked; QueryClient mutation ordering and the current Book Details component execute.

## Independent verification

Fresh focused rerun: **five suites / 53 tests PASS**, 19.173 seconds, exit 0:

```powershell
node node_modules/jest/bin/jest.js --runInBand --runTestsByPath 'app/(tabs)/library/__tests__/book-details-corrections.test.tsx' src/components/notes/__tests__/ManualNoteJourney.test.tsx src/features/books/notes/__tests__/manualNoteDeleteGate.test.ts src/features/books/notes/__tests__/manualNotesGateway.test.ts src/features/books/notes/__tests__/noteNavigation.test.tsx
node node_modules/typescript/bin/tsc -p tsconfig.library-notes.json --noEmit --pretty false
```

Scoped TypeScript completed successfully with no diagnostics. Existing act/Clipboard/punycode warnings appeared in focused Jest. B01 source retains status → Add note → Notes → Saved Pages → named review/options/community/information entries; permanent tests cover retained handlers and destinations. Back has button semantics, an explicit name, minimum 48×48 styling and retained Library navigation. No additional F02/F03 defect was confirmed in this bounded pass. Browser export and native checks were not rerun; the prior correction receipt owns those claims and limits. Full Jest/full TypeScript were not rerun; their existing failures remain open.

## Handoff and authority

Current Library unit: `library_sdd06_f01_f03_followup_review_f01_reopened`. Exact next action: return FR01 to the F01 implementer for the bounded queue-lifetime correction and permanent lifecycle regression, followed by independent review. No fix implemented in this review. F04–F06 and complete native/SDD06-07 acceptance remain outside this pass. Persistence remains ON HOLD; all four MANUAL_NOTE_WRITE_GATES remain false.

Marketplace stays Phase 9 at completed Unit7C/M46; DOC-13/ACTIVE/global next action and mutation authority are unchanged. No database, Storage, provider or migration mutation; no dependency changes, staging, commit, push, deployment or migration application. Existing unrelated edits preserved. Review evidence and continuity updates remain uncommitted.

Final continuity validator PASS: 195 requirement definitions, zero duplicate/missing traceability, regression probes PASS, 76 Markdown files. `git diff --check` PASS (existing LF/CRLF advisory warnings); staged diff empty, exit 0. Four source hashes in the correction receipt (Book Details, permanent correction tests, ManualNoteJourney and write gateway) still match exactly. Gate source readback confirms four false flags. Temporary executable reproduction was moved to the linked `.tsx.txt` evidence, avoiding another collector/compiler fixture. Current trackers were re-read with FR01 reopened and the exact next action above. The receipt remains one cohesive bounded review.
