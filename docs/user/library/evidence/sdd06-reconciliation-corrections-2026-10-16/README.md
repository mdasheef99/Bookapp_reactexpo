# Bounded retained-review reconciliation corrections — 2026-10-16

**RR01/RR02 confirmed and corrected locally; final focused verification PASS.** The owner requested “first confirm the changes please and make bounded corrections” after the [independent review](../sdd06-retained-review-independent-2026-10-16/README.md). No new product decision or persistence authority was inferred.

Worktree `C:/Users/LEGION/Desktop/Bookconnect4_library`, actual branch `codex/library-cover-shelf`. Existing extensive mixed work preserved; the entire HEAD diff is not this correction. Marketplace remains Phase 9 at completed Unit7C/M46. DOC-13/ACTIVE/global handoff and mutation authority unchanged. Library unit `library_sdd06_reconciliation_corrections_locally_verified`; SDD-06 revision 0.24 clarifies implementation of existing B01/R20/D06-17 obligations.

## Confirmation before correction

- Original Book Details SHA-256 matched the reviewed candidate exactly: `9EB3F5599718DDC4CFC5185B52959F6283FDD889ACB96538E7E9B16900312D29`.
- Promoted the archived independent diagnostics into the existing permanent correction suite, using the real component, QueryClient, auth store, new review service and installed Supabase SDK with synthetic HTTP/native effects. Initial unchanged production run: **4 failed / 15 passed**, 27 original cases excluded by name filter, exit 1, 11.073s. [RED JSON](./red.json), [RED log](./red.log).
- Initial patch fixed generation/GC cases, but the two refetch assertions still failed because they read before React notification rendered. Strengthened both to await displayed refetch text, rather than weakening acceptance. Reinstalled only the original reviewed reconciliation region for a bounded RED rerun, restoring corrected source in `finally`: **2 failed / 44 excluded**, exit 1, 7.203s. Both remained `Saved B`, not `Later server C`, after waiting. [Awaited original RED](./refetch-red-awaited.json), [log](./refetch-red-awaited.log). Against the correction the same awaited pair passed **2/2**, exit 0; [JSON](./refetch-green.json).
- The first patch's dirty-only consumption passed the 135-test set but did not fully represent one-time consumption. Added a same-mounted book A→other→A/revision-reset/new-dirty/refetch regression. It failed **1/1**, exit 1, 5.297s: expected `New dirty C`, received `Saved B`. [Revisit RED](./revisit-red.json), [log](./revisit-red.log). Final patch uses exact request identity, not dirty state alone.

The earlier review receipts and their original diagnostic limitations remain historical; none were overwritten. `component-green.json/log` are the initial patch's **44 passed / 2 failed** timing-sensitive run despite the filename; they are not claimed as green evidence. The stronger awaited RED and final focused run govern acceptance here.

## Final bounded implementation

Production changes: [Book Details](<C:/Users/LEGION/Desktop/Bookconnect4_library/app/(tabs)/library/[bookId].tsx>) only.

1. Observe the stable `book-review` mutation prefix, then synchronously select records by current actor ID, authenticated revision and book-entry ID. This avoids stale dynamic-filter snapshots being inherited into a later session or supplying incorrect busy feedback. Actual mutation dispatch keys and serial scopes remain exact actor/book/generation.
2. Track the exact text request in the current draft. Set it on each explicit text submission or pending inheritance, reset it on identity changes and new input, and require that ID plus an unchanged edit revision (or untouched inherited draft) before confirmation can clean/replace the draft. Clear it after confirmation. Revision-number reuse after a book revisit cannot revive an old success.
3. Consume matching success synchronously from the QueryClient mutation-cache notification, before an unobserved terminal mutation can be garbage-collected. The effect returns the unsubscribe cleanup. Only `book-review` successes enter this path; actor/current-draft checks still apply. Retained-history reconciliation is a fallback and uses the same exact-request guard.
4. Once clean, the editor follows confirmed query text; it does not replay an already consumed payload. A later untouched blur therefore submits the currently displayed confirmed text rather than overwriting it with stale history. Newer dirty text remains editable and unsaved.

No changes to one-field request bodies, failed-field retry policy, rating/privacy confirmed displays, service validation/token pin/abort/account fences, auth coordinator, notes gateway, dependencies, migration files or write gates. B01 hierarchy, named destinations, management actions, Saved Pages and accessible Back remain.

Permanent test changes: [existing correction suite](<C:/Users/LEGION/Desktop/Bookconnect4_library/app/(tabs)/library/__tests__/book-details-corrections.test.tsx>) grows from 27 to **47 cases**. The 20 additions cover awaited clean refetch, untouched blur, same-mount session transition, arbitrary newer text/repeated submissions, explicit retry, rejected rating/Public isolation, malformed/nullable affected rows and generated SDK HTTP, transport failure, two mounted editors, independent new-session queues, short-GC inheritance, changed-book isolation and consumed-history/book-revisit collision. Prior tests remain; external HTTP/native effects remain simulated.

## Final verification actually run

| Check | Result |
| --- | --- |
| Six requested affected suites | **6 suites / 136 tests PASS**, exit 0, 24.418s |
| Current Book Details corrections | **47/47 PASS**, included above |
| Scoped Library TypeScript | **PASS**, exit 0, empty diagnostic output |
| Focused reviewer | **No actionable finding** after exact-request refinement; static source/test/installed-SDK-order review |
| Continuity, whitespace, hash and gate readback | Final results appended below |

```powershell
node node_modules/jest/bin/jest.js --runInBand --runTestsByPath "app/(tabs)/library/__tests__/book-details-corrections.test.tsx" src/components/notes/__tests__/ManualNoteJourney.test.tsx src/features/books/services/__tests__/booksService.test.ts src/features/books/notes/__tests__/manualNoteDeleteGate.test.ts src/features/books/notes/__tests__/manualNotesGateway.test.ts src/features/books/notes/__tests__/noteNavigation.test.tsx --json --outputFile=docs/user/library/evidence/sdd06-reconciliation-corrections-2026-10-16/focused.json
node node_modules/typescript/bin/tsc -p tsconfig.library-notes.json --noEmit --pretty false
```

[Final JSON](./focused.json), [focused log](./focused.log), [scoped compiler log](./tsc-scoped.log), [final hashes](./source-hashes.json), [focused review](./REVIEW.md). Final suite counts: Book Details 47, ManualNoteJourney 21, booksService 45, delete gates 7, gateway 10, navigation 6. Existing punycode/Clipboard warnings and intentional service error-path logging remain. No warning-free or full-repository-green claim.

## Verification limits and residual risks

- All new HTTP writes are synthetic; no connected Auth/PostgREST/database/Storage acceptance was run. No Supabase schema uncertainty was introduced or live assumption needed, so no new MCP audit was performed. The previous schema readback remains historical.
- Same-mounted A→logout→A is tested with the real auth store and generation subscription. Root layout/coordinator/browser/native routing are source-traced only; their connected lifecycle remains unverified. No live cross-account/RLS exploit is claimed.
- The previously failing real-timer `gcTime=1ms` stress now passes. This verifies the terminal-history race locally; it is not a five-minute real-device endurance run. Pending retention and confirmed cleanup are both asserted.
- Full TypeScript, broad Jest, web export, browser, physical-device, native accessibility and release acceptance were not rerun. The earlier 37 full-compiler diagnostics remain historical, not a new count.
- Aborting still cannot undo a write already accepted by the server. Durable drafts, restart recovery and cross-device transaction arbitration are not introduced.
- F04–F06 and full release/native/SDD06-07 acceptance remain open. Persistence remains **ON HOLD**, all four MANUAL_NOTE_WRITE_GATES false.

## Handoff and scope

Exact next action: independent review of the final bounded RR01/RR02 reconciliation correction and its 47-case Book Details suite. Local static review is recorded; it does not substitute for connected/native release acceptance or the owner's final acceptance.

Application/config scope this turn: Book Details and its existing correction test file. Documentation: owning SDD/traceability, Library tracker/interaction inventory, Phase 9 separate-Library tracker and implementation log, this new receipt. No behavior/acceptance expansion, schema/storage change or global phase transition; no DOC-13/ACTIVE update is needed. Documentation remains cohesive by responsibility; historical receipts and mandatory contracts were preserved.

All changes remain local/uncommitted alongside existing work. Nothing staged, committed, pushed, deployed or applied. Database/Storage/provider mutations: **none**. No new dependency, service/auth change, migration, server/browser/emulator launch or executable scratch test was introduced.

### Final closeout readback

- Continuity validator **PASS**, exit 0: 195 definitions, zero duplicates/missing traceability, validator regression probes PASS, 76 Markdown files. [Log](./continuity.log).
- `git diff --check` **PASS**, exit 0, with existing LF/CRLF advisories. [Log](./diff-check.log).
- Re-read active Library tracker, Phase 9 tracker and implementation log: exact work unit and independent-final-review next action agree. SDD-06 is rev0.24. DOC-13/ACTIVE/global handoff unchanged.
- Source readback confirms unchanged service, mounted journey, scoped TS configuration, gateway and legacy service hashes versus the reviewed candidate. All four write gates remain false. Final production/test source hashes are recorded above; auth coordinator/store and QueryClient were not edited.
- Staged diff empty (`git diff --cached --quiet`, exit 0). Worktree still has 77 modified/untracked status entries, including preserved earlier work; that count does not represent this patch's scope. Current changes remain uncommitted. No stage, commit, push, deploy, apply or external mutation occurred.
- The 20 new cases live in the existing permanent suite; no executable scratch fixture remains. Original receipts preserved. No additional checks were run merely to imply broader release acceptance.
