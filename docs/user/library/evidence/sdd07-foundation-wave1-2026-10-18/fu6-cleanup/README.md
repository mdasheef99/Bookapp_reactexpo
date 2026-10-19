# SDD-07 FU-6a / FU-6b / FU-6c cleanup receipt

Date: 2026-10-18. Worktree: `C:/Users/LEGION/Desktop/Bookconnect4_fu1a`.
Branch, verified with `git status --short --branch`: `sdd07/fu1a-fu3`.
Scope: exactly the three foundation cleanup units requested by the owner.
Implementation is locally verified; independent owner/reviewer acceptance remains next.

## FU-6a

Deleted:
- `src/components/notes/NoteEditor.tsx`
- `src/components/notes/NotesList.tsx`
- `src/components/notes/TagSelector.tsx`
- `src/components/notes/__tests__/NoteEditor.ocr.test.tsx`

Edited:
- `src/components/notes/index.ts`: removed the three legacy exports; retained `NoteCard`.
- `src/features/books/services/__tests__/ocrService.test.ts`: moved two helper-level cases before deletion (see coverage table).
- `src/components/library/__tests__/LibraryAppearance.test.ts`: removed only the assertion reading the deleted `TagSelector.tsx` and adjusted its comment. The three surviving component-radius assertions and all 190 tests remain.

Reference evidence: [pre-deletion search](./fu6a-references-before-deletion.log),
[barrel consumers](./fu6a-barrel-consumers-before.log),
[all test-file matches](./fu6a-all-test-references-before.log).
Searches used `rg -n 'NoteEditor|NotesList|TagSelector' app src e2e scripts flows`,
plus repository-wide `*test*` / `*spec*` files excluding dependencies and this receipt's logs.
The initial and immediate pre-deletion scans covered all four deleted files and the export/assertion removals.

Production references were confined to the three deleted components and their barrel exports.
The only consumers of the notes barrel in routes import `NoteCard`; no namespace/dynamic consumer or forwarding barrel uses the deleted exports.
The additional radius assertion was found by searching tests, rather than by a failing post-deletion test.
An E2E smoke-test comment mentions the old editor but does not import it; historical evidence also records old test names. These are untouched.
`ManualNoteJourney.test.tsx:297` keeps its exact `NoteEditor|Save to Vault` absence assertion.

### OCR coverage audit before deletion

| Legacy case | Retained module coverage or disposition |
|---|---|
| Saved null / Question categories (2 cases) | Deleted with the editor UI; live manual-note category tests remain unchanged. |
| One-word, 20,001-character extraction | Moved to `ocrService.test.ts`: direct `boundedReview` asserts exactly 20,000 characters and overflow. Existing emoji overflow coverage is also retained. The editor's banner/save gate is deleted UI. |
| Partial acceptance and stale acceptance | Deleted with the editor's confirmation/revision state. No corresponding retained OCR-helper state. |
| Preserve 600 words for editing | Already covered by `ocrService.test.ts`'s real default-export/600-word result test. |
| Vault partial acceptance / 4,001-character destination limit | Acceptance is deleted UI; `ocrWordCap.test.ts` already covers unchanged text and 4,001-character single-word trimming, word limits, word boundaries and Unicode. `userBookPagesService.test.ts` retains its own caps and write-payload checks. |
| Partial acceptance cannot bypass 501-word limit | Acceptance is deleted UI; word-count/501-word behavior remains covered by `ocrWordCap.test.ts`, plus unchanged live manual-note validation/journey tests. |
| Local scan without upload / do not enlarge small photo | Local no-upload already covered by `ocrService.test.ts`; legacy image-manipulator wiring is deleted UI. Live capture-adapter tests remain unchanged. |
| Cloud confirmation/cancel | Service consent/no-transmission already covered by `ocrService.test.ts`; modal behavior is deleted UI. |
| Keep local text on cloud failure / safe error display | Local draft retention is deleted UI. Moved raw-error display case to `ocrService.test.ts`: `ocrErrorMessage(new Error('secret provider error'))` returns the exact safe text and excludes provider details. |
| Ignore result after close | Local cancellation already covered by `ocrService.test.ts`; editor close/adoption state is deleted UI. |
| Ignore output on logout | Cloud account-change cancellation already covered by `ocrService.test.ts`; editor subscription/image state is deleted UI. Live capture account/cancellation tests remain unchanged. |

Both moved cases passed in their destination **before** deleting the legacy suite:
[2 suites / 30 tests](./ocr-preservation-before-deletion.log).
No existing OCR-service or word-cap assertion was weakened or removed.

Kept without an application caller, intentionally unchanged:
- `userBookPagesService.upsertPage`, including its `capToVaultLimits` use; SDD-10 owns the Saved Pages decision.
- `ocrService.recognizePageViaCloud`, including its named export; the undeployed cloud fallback remains.

`captureAdapter.ts:87` still calls `recognizePageText` from the OCR module.
`captureAdapter.ts:43-45` still imports/requires `expo-image-manipulator`.
See [retained-service readback](./retained-services-after.log). No dependency was removed.

Test counts: legacy editor 12 -> 0; OCR service 16 -> 18; word caps 12 -> 12;
LibraryAppearance 190 -> 190. FU-6a net test-count change: -10.

## FU-6b

Edited `src/features/books/services/notesService.ts` and its `__tests__/notesService.test.ts`.
Deleted `getNotesForBook`, `getNotesCount`, `createNote`, `updateNote`, `deleteNote`,
the resulting empty service object, unused runtime imports and method-only test scaffolding.
Retained `ReadingNote`, `NoteTag`, the imported `NoteCategory` type and its unchanged
definition in `manualNoteContract.ts`, and all of `NOTE_TAG_CONFIG`.
The configuration test body/assertions remain unchanged.

Evidence: [immediate pre-deletion scan](./fu6b-references-before-deletion.log),
[all test-file matches](./fu6b-all-test-references-before.log).
Searched `notesService` and every method name across app/src/e2e/scripts/flows,
including `notesService.` and bracket access, imports and `index.ts` re-exports.
Only definitions and the method's own tests used the object/methods; no dynamic accesses or forwarding exports existed.
The surviving `NoteCard` import uses only the retained types/configuration.

No cases moved; all 13 removed cases tested only the removed methods.
Tests: 14 -> 1, with the retained five-tag/property assertions passing.
No additional kept-without-caller paths arose in this unit.

## FU-6c

Edited only `src/features/books/notes/useManualNotes.ts`: removed exactly three
`notesCount` invalidations, from operation confirmation, refresh and removal refresh.
No test file changed for this unit, and no existing test asserted those calls.

Evidence: [immediate pre-deletion scan](./fu6c-references-before-deletion.log),
[all test-file matches](./fu6c-all-test-references-before.log),
[query declarations](./fu6c-query-producers-before.log).
Across app/src/e2e/scripts/flows, `notesCount` appeared exactly five times:
the three invalidations and Book Details' variable/JSX display.
There was no `useQuery` producer for the key, direct or through a named key constant.
Book Details derives the displayed value from `notes?.length ?? 0`.
`noteKeys.collection` remains `['notes', actor, book]`; record/collection invalidations and all cache safety logic are unchanged.

No cases moved or deleted. `ManualNoteJourney.test.tsx` remains byte-for-byte
unchanged and passes all 21 tests, including real collection refresh after save/delete,
retained-reader deletion, version ordering and late-result protection.
No additional kept-without-caller paths arose in this unit.

## Verification and handoff

Commands ran offline (`npm_config_offline=true`) using Windows `npx.cmd --no-install`:

```text
npx --no-install jest --runInBand "app/\(tabs\)/library" src/components/library src/components/notes src/features/books src/prototypes
npx --no-install tsc -p tsconfig.library-notes.json --noEmit
```

The after-Jest run additionally writes JSON using `--json --outputFile` for per-suite counts.

| Check | Before | After |
|---|---|---|
| Required Jest set | 44 suites / 815 tests PASS | 43 suites / 792 tests PASS |
| Scoped TypeScript | Exit 0, zero errors | Exit 0, zero errors |
| Snapshots | 0 | 0 |

Count reconciliation: `815 - 12 legacy UI - 13 dead-method tests + 2 moved helper cases = 792`.
The scoped tsconfig exists; the full-repo 36-error fallback was not needed or run.
Logs: [Jest before](./jest-before.log), [Jest after](./jest-after.log),
[focused baseline counts](./focused-before.json), [after counts](./jest-after.json),
[TypeScript before](./tsc-before.log), [TypeScript after](./tsc-after.log).

Post-cleanup source search: [remaining references](./references-after.log).
Only the retained absence assertion and historical comments mention the deleted components;
the count remains only as the Book Details derived value/display.

No outstanding implementation scope in FU-6a/b/c. Browser/E2E/native captures,
full-repository TypeScript, lint, other foundation units and independent review were not run.
No dev server, install, network, Supabase read/write, database/storage mutation,
migration, stage, commit, push, deployment or application occurred.
Only `git status`/`git diff` were used. `git diff --check` passed.
The required local [continuity validator](./continuity.log) exited 0:
`PHASE9_CONTINUITY_CHECK=PASS`, 76 Markdown files checked; repository/WU1/WU2
diff checks and documentation-size regression passed. No marketplace file was edited.
Pre-existing changes to package files, eslint config, `.spec/` and `.spec-out/swatches.md` were preserved.
Library tracker updated solely with this bounded handoff; marketplace status/authority unchanged.

Active work unit: `library_sdd07_fu6abc_local_verified_review_pending`.
Exact next action: independent reviewer/owner reviews this FU-6a/b/c diff and receipt;
no further implementation or external action is authorized by this handoff.
