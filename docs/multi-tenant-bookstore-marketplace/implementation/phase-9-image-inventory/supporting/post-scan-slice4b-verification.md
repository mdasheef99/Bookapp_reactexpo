# Post-scan slice 4b — local verification, 2026-10-21

Authority: [SDD-1 §§2/6](../work-units/post-scan-rework/01-review-screen-sdd.md)
(D2-3, D2-5, D2-6; AC4-7, AC4-10, AC4-11), the Owner's approved small-4b
implementation brief, and [SDD-0 §15](../work-units/post-scan-rework/00-overview-sdd.md#15-process-rules-for-every-slice).
Checkout: `claude/phase9-psr-slice4b-sdd-ffa027`, starting at `39b993a`.

## Scope and boundaries

- Script recomputation occurs only in `validateCompactReview`, after the
  existing metadata-choice decision. Inputs are normalized first. Both app and
  server-mirror rules must accept the chosen script; no match remains null.
- Saved scripts remain stable when normalized identity is unchanged. Chosen
  editions keep their script and choice, including a null script.
- Kannada, Telugu and Malayalam share the existing scan/card language list.
- The unused variant client, schemas, types, constants, error branch and cases
  are removed. Existing query keys contained no variant entry to remove.
- `compactReviewScript`, card identity comparisons and edit tracking, and every
  production file under `commit/` remain unchanged. No stale-wording handling,
  customer search-filter change, migration, SQL-function or Edge-function change.
- No Supabase MCP/CLI, database, Storage, provider, deployment, stage, commit,
  push or branch-change action. The pre-existing untracked `.claude/` is preserved.

## Red proof before product code

All tests below were written and run before product changes. Regression controls
that already passed are identified rather than described as red.

```text
Test Suites: 5 failed, 5 total
Tests:       34 failed, 164 passed, 198 total
Snapshots:   0 total
Time:        260.615 s

# tests 25
# suites 0
# pass 12
# fail 13
# cancelled 0
# skipped 0
# todo 0
```

The database count includes the failed parent plus twelve failed fixture
subtests. Every failure was an assertion about behavior, not an import or syntax
failure. Initial Node startup attempts failed with `EPERM: lstat C:\Users\user`;
those attempts are excluded from red proof. The successful runs used
`NODE_OPTIONS=--preserve-symlinks --preserve-symlinks-main`. The existing parent
`node_modules/.bin` was added to the command's PATH; no dependency was installed.

### Every new test (60 parameterized app cases, 24 SQL fixtures plus parent)

| File / exact test family | Cases | Initial red reason or existing control |
| --- | ---: | --- |
| `compactReviewDraft.test.ts`: `recomputes script from title, authors and language: $name` | 24 | Twelve choices received null instead of the expected script; each fixture is listed below. Other twelve passed. |
| `keeps a null script when nothing fits` | 1 | Already passed: mixed-script review remains valid and manual. |
| `keeps a null script when only the app rule fits: $name` | 3 | Already passed: Vietnamese, Cyrillic and Alphabetic-denominator fixtures remain null. The tests prove the existing app rule alone accepts Latn. |
| `follows the language tag's script subtag: $name` | 6 | `hi-Latn`, `en-Latn-US`, `HI-latn`, Kannada and `kn-IN` received null; explicit-script mismatch already passed. |
| `keeps the saved script when nothing changed` | 1 | Initially passed. Strengthened separately, before the corrective product edit, to include an incidental `script: Deva` with unchanged normalized identity: received a null review instead of the saved Latn review. |
| `keeps the edition's script and choice: %s` | 2 | Already passed for `edition_option` and `selected`; each exercises both null and Latn edition scripts. |
| `recomputes after an identity edit switches to manual` | 1 | Retained the incoherent old Latn script, so validation returned a null review instead of manual/Deva. |
| `recomputes each changed saved identity field: %p` | 3 | Title and authors edits retained Latn and returned null reviews. Language-only control already passed. |
| `does not need another save after saving the recomputed script` | 1 | `Expected: "Deva" / Received: null` on the first validation. It then verifies the saved result needs no second save. |
| `lets the schema report invalid normalization without recomputing: %p` | 3 | Already passed for unsafe title, bidi author and invalid language; no thrown validation failure. |
| `Kannada title with kn gets Knda (and regional/South Indian peers): $name` | 4 | Kannada, `kn-IN`, Telugu and Malayalam received null instead of Knda/Knda/Telu/Mlym. |
| `batchReviewCard.test.tsx`: `a recomputed script is not an edit: $name` | 2 | Devanagari Add callback received null instead of Deva. Mixed-script null control already passed. Both assert Ready, no edit marker, unchanged draft callback and all unsaved-edit reports false. |
| `card language chooser finds Kannada, Telugu and Malayalam: $name` | 3 | `Unable to find an element with accessibility label: Kannada` (and Telugu/Malayalam respectively). Tests search by name, select and submit the real card's review. |
| `ScanSetupForm.test.tsx`: `scan setup offers Kannada, Telugu and Malayalam: %s` | 3 | `Unable to find an element with role: button, name: Kannada` (and Telugu/Malayalam respectively). |
| `inventoryCommitCoordinator.test.ts`: `adds after saving a recomputed script: $name` | 2 | Devanagari: `Expected: "Deva" / Received: null`. Mixed-script null control already passed. Tests execute the production coordinator, including save-before-commit order. |
| `ownerCorrectionArchitecture.test.ts`: `no variant decision client remains` | 1 | Non-test source violations: `api/ownerCorrectionService.ts` and `contracts/ownerCorrectionSchemas.ts`. The test also preserves both server function definitions. |
| `phase9CompactReviewScript.integration.test.mjs`: `app script choice is accepted by phase9_owner_ux_language_script` | 24 + parent | Same twelve missing script choices below; parent reports `12 subtests failed`. Loads real TS validation and current migrations through M77, with no copied app logic or model/SQL stub. |

### Shared fixture outcomes in the initial red run

The two fixture-driven test families above use exactly this list. Every non-null
final choice is sent to the real SQL helper. Non-Latin fixtures include an ASCII
component with enough native letters that acceptance holds whether `[:alpha:]`
counts ASCII only or Unicode alphabetic text; no SQL locale is rewritten.

| Fixture | Expected script | Initial outcome |
| --- | --- | --- |
| Devanagari | Deva | null — failed |
| Latin-majority author | Latn | null — failed |
| mixed script | null | passed |
| Vietnamese beyond U+024F | null | passed |
| Cyrillic in Latin | null | passed |
| hi-Latn | Latn | null — failed |
| en-Latn-US | Latn | null — failed |
| HI-latn | Latn | null — failed |
| explicit script mismatch | null | passed |
| Kannada | Knda | null — failed |
| kn-IN | Knda | null — failed |
| Telugu | Telu | null — failed |
| Malayalam | Mlym | null — failed |
| Tamil | Taml | null — failed |
| Arabic | Arab | null — failed |
| observed Meetei | Mtei | passed, existing observed script |
| 60 percent boundary | Latn | null — failed |
| below 60 percent | null | passed |
| Alphabetic denominator (U+0345) | null | passed |
| blocked range Ω | null | passed |
| blocked range א | null | passed |
| blocked range ก | null | passed |
| blocked range 中 | null | passed |
| blocked range 한 | null | passed |

The strengthened saved-script check separately reproduced:

```text
FAIL src/features/imageInventory/__tests__/compactReviewDraft.test.ts
  ● script recomputation › keeps the saved script when nothing changed
    Matcher error: received value must be a non-null object
    Received has value: null
Test Suites: 1 failed, 1 total
Tests:       1 failed, 81 skipped, 82 total
```

The 81 skips above are the name-filtered diagnostic run, not newly skipped tests.

## Existing tests updated rather than removed

Three stale-choice cases in `compactReviewDraft.test.ts` now expect manual/Latn
after identity correction, rather than preserving the observed null script.
The first focused implementation run exposed these three assertions and one
leftover operation-alias violation: `4 failed, 202 passed, 206 total`.

The first full feature run exposed two more superseded null-script expectations:

```text
FAIL src/features/imageInventory/__tests__/ownerEditionPickerCommit.test.ts
  ● compact review preserves unsaved notes and explicit null script before Save
    expect(received).toMatchObject(expected)
    - Expected  - 1
    + Received  + 1
    -   "script": null,
    +   "script": "Latn",

FAIL src/features/imageInventory/__tests__/ownerEditionPickerDrafts.test.ts
  ● compact builder preserves supplied null script and unsaved notes
    expect(received).toMatchObject(expected)
    - Expected  - 1
    + Received  + 1
    -   "script": null,
    +   "script": "Latn",

Test Suites: 2 failed, 1 skipped, 65 passed, 67 of 68 total
Tests:       2 failed, 4 skipped, 829 passed, 835 total
```

Both notes checks remain, with manual/Latn now asserted under SDD-1 §6. The
four variant-only service cases and M24/M25 identity-transition rows are removed
as required by D2-5. The C06 identity-transition row and its transport fencing
remain. No existing language-option enumeration test was deleted.

## Final command evidence

| Command | Result |
| --- | --- |
| `npx tsc --noEmit` | Exit 2; 10 diagnostics, reproduced on the HEAD overlay. No error remains in image inventory. Raw errors below. |
| `npx jest src/features/imageInventory --silent --runInBand` | Exit 0; 67 suites passed, 1 skipped; 831 tests passed, 4 skipped, 0 failed; 0 snapshots. Runtime 350.343 s. Non-exit warning below; process subsequently exited naturally. |
| `node --experimental-vm-modules --test supabase/tests/phase9/phase9CompactReviewScript.integration.test.mjs` | Exit 0; 25 tests, 25 passed, 0 failed/cancelled/skipped/todo; 0 suites. Current disposable migrations through M77. |
| Eight affected Jest suites, `--runInBand --silent --detectOpenHandles --runTestsByPath` | Exit 0; 8 suites, 229 tests, all passed; 0 snapshots; 207.112 s. No open-handle report or non-exit warning. |
| Phase 9 continuity validator | Exit 0; `PHASE9_CONTINUITY_CHECK=PASS`, `MARKDOWN_FILES_CHECKED=105`, `REQUIRED_PHASE_FILES=62`; existing document-size advisories, no acceptance failure. |
| `git diff --check` | Exit 0; no output. |

The full-folder command was rerun serially after the two updated picker
expectations, to reduce parallel resource contention. The first full command's
two failures and raw counts are retained above. The full successful run emitted:

```text
Jest did not exit one second after the test run has completed.

'This usually means that there are asynchronous operations that weren't stopped in your tests. Consider running Jest
with `--detectOpenHandles` to troubleshoot this issue.
```

The affected-suite handle run exited cleanly and reported no handles. The full
suite process also exited naturally with code 0. The warning is not suppressed
or claimed fixed. Expo/Node emitted the existing `DEP0040` punycode deprecation
warning. No `--forceExit` was used.

### Ordinary TypeScript errors, verbatim

```text
e2e/library-a11y.spec.ts(1,28): error TS2307: Cannot find module '@axe-core/playwright' or its corresponding type declarations.
e2e/library-a11y.spec.ts(52,52): error TS7006: Parameter 'node' implicitly has an 'any' type.
e2e/library-a11y.spec.ts(54,14): error TS7006: Parameter 'part' implicitly has an 'any' type.
src/components/library/LibraryShelf.tsx(84,79): error TS2307: Cannot find module 'expo-audio' or its corresponding type declarations.
src/features/books/notes/captureAdapter.ts(43,64): error TS2307: Cannot find module 'expo-image-manipulator' or its corresponding type declarations.
src/features/books/notes/captureAdapter.ts(44,97): error TS2307: Cannot find module 'expo-image-manipulator' or its corresponding type declarations.
src/features/books/notes/captureAdapter.ts(45,73): error TS2307: Cannot find module 'expo-image-manipulator' or its corresponding type declarations.
src/features/books/services/__tests__/ocrService.test.ts(3,29): error TS2307: Cannot find module '@react-native-ml-kit/text-recognition' or its corresponding type declarations.
src/features/clubs/theme/Fonts.tsx(10,8): error TS2307: Cannot find module '@expo-google-fonts/inter' or its corresponding type declarations.
src/features/clubs/theme/Fonts.tsx(17,8): error TS2307: Cannot find module '@expo-google-fonts/newsreader' or its corresponding type declarations.
```

These are eight resolution failures for six distinct missing packages and two
implicit-any failures. They occur outside the changed area. Dependencies were
not installed and declarations were not stubbed to hide them.

### Files changed

Five production files, eight test files, two shared test fixtures, one SQL parity
test and eleven map/continuity/evidence documents (27 task files total):

```text
CODEBASE_MAP/03-backend.md
CODEBASE_MAP/04-features.md
CODEBASE_MAP/06-testing.md
docs/multi-tenant-bookstore-marketplace/DOC-13-implementation-tracker.md
docs/multi-tenant-bookstore-marketplace/implementation/ACTIVE.md
docs/multi-tenant-bookstore-marketplace/implementation/phase-9-image-inventory/SESSION-START.md
docs/multi-tenant-bookstore-marketplace/implementation/phase-9-image-inventory/TRACKER.md
docs/multi-tenant-bookstore-marketplace/implementation/phase-9-image-inventory/supporting/post-scan-slice4b-verification.md
docs/multi-tenant-bookstore-marketplace/implementation/phase-9-image-inventory/supporting/requirements-traceability.md
docs/multi-tenant-bookstore-marketplace/implementation/phase-9-image-inventory/trackers/02-implementation-and-verification.md
docs/multi-tenant-bookstore-marketplace/implementation/phase-9-image-inventory/trackers/38-post-scan-rework-evidence.md
src/features/imageInventory/__tests__/ScanSetupForm.test.tsx
src/features/imageInventory/__tests__/batchReviewCard.test.tsx
src/features/imageInventory/__tests__/compactReviewDraft.test.ts
src/features/imageInventory/__tests__/inventoryCommitCoordinator.test.ts
src/features/imageInventory/__tests__/ownerCorrectionArchitecture.test.ts
src/features/imageInventory/__tests__/ownerCorrectionService.test.ts
src/features/imageInventory/__tests__/ownerEditionPickerCommit.test.ts
src/features/imageInventory/__tests__/ownerEditionPickerDrafts.test.ts
src/features/imageInventory/api/ownerCorrectionService.ts
src/features/imageInventory/contracts/ownerCorrectionSchemas.ts
src/features/imageInventory/contracts/ownerUxValidation.ts
src/features/imageInventory/review/compactReviewDraft.ts
src/features/imageInventory/scanSetup/scanSetupForm.ts
src/features/imageInventory/testing/compactReviewDraftFixtures.ts
src/features/imageInventory/testing/compactScriptFixtures.ts
supabase/tests/phase9/phase9CompactReviewScript.integration.test.mjs
```

No file was staged. All 27 task files remain uncommitted; `.claude/` was already
untracked at session start and is excluded from the task file count. No commit,
push, deployment, migration application or external-state mutation occurred.
There is no unimplemented 4b product requirement or SDD wording change. The
ordinary TypeScript gate remains open for the existing dependency installation;
medium/pre-merge reviews and browser checks are not claimed complete.

### HEAD and no-unused comparison

A temporary compiler-API script read the existing `tsconfig.json`, overlaid each
changed tracked TS/TSX file with `git show HEAD:<path>` in memory, and excluded
the two new fixture files from the baseline roots. It did not change the
checkout, branch, dependencies or source declarations. Ordinary diagnostics on
that HEAD overlay are exactly the same ten errors above. A second compilation
of the working tree used `noEmit: true, noUnusedLocals: true`; diagnostics were
compared as multisets by filename, code and message so moved lines did not look
like new failures.

The initial comparison found one leftover variant-test import:

```text
src/features/imageInventory/__tests__/ownerCorrectionService.test.ts
TS6133: 'OwnerCorrectionClientError' is declared but its value is never read.
```

It was removed. The final comparison exited 0 and reported:

```json
{
  "baselineOrdinaryCount": 10,
  "baselineNoUnusedCount": 54,
  "currentNoUnusedCount": 54,
  "newDiagnostics": []
}
```

Those 54 are the ten ordinary diagnostics plus 44 existing unused declarations;
this is zero new diagnostics, not a claim that the repository's no-unused build
is globally clean. The ordinary `npx tsc --noEmit` gate remains failed.

Final test-only cleanup was verified separately without changing production:
`ownerCorrectionService.test.ts` passed 1 suite / 8 tests with
`--detectOpenHandles` and exit 0 (16.522 s), and
`ownerCorrectionArchitecture.test.ts` passed 1 suite / 9 tests, exit 0 (14.203 s).
The latter also explicitly forbids `Alert.alert` in its correction/card/compact
sources; accessible-name and Ready live-region assertions remain in the new UI
coverage. No further product code changed after the successful full-folder and
SQL runs.

The first ordinary type-check attempt had 13 diagnostics: the ten baseline
ones plus three widened-string errors in the new saved-card fixture. Giving
that fixture the existing `OwnerBatchReviewCard` type removed all three.

Final handoff: `post_scan_rework_slice4b_script_languages`; the next authorized
action is the orchestrating session's SDD-0 section 15 medium review of the
uncommitted diff. No clean repo-wide TypeScript build, live acceptance, review
approval or Git publication is claimed.
