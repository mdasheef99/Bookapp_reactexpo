# Independent retained-review correction review — 2026-10-16

**Verdict: CHANGES REQUESTED.** RR01 blocks acceptance of these bounded corrections. RR02 reproduces a component-level authenticated-generation isolation gap when the screen remains mounted. No application fixes were implemented.

Reviewed worktree: `C:/Users/LEGION/Desktop/Bookconnect4_library`, actual branch `codex/library-cover-shelf`. The supplied AGENTS workspace branch note is historical. Extensive existing modified/untracked work was preserved; the entire HEAD diff is not attributed to this correction. All seven source/config hashes match the latest correction receipt, including Book Details, new service, both test files, scoped TS, gateway and legacy service. Read AGENTS, ACTIVE, DOC-13, Phase 9 session/current trackers, master invariants/continuity and relevant planning/traceability/complexity context, current Library tracker, SDD-06 rev 0.23 B01/R20/D06-17, triage and implementation receipts. Marketplace Phase 9 Unit7C/M46 remains complete; no global phase/authority change.

## Confirmed findings

### RR01 — P2: consume successful text reconciliations once

Location: [Book Details lines 116–123](<C:/Users/LEGION/Desktop/Bookconnect4_library/app/(tabs)/library/[bookId].tsx:116>).

The own-editor success condition compares editor ID and edit revision, but never marks that success record consumed. Clearing `inheritedRequest` does not affect that branch. The mutation observer keeps its last successful mutation alive; successful records therefore remain eligible after the editor has become clean. The effect also runs when confirmed query text changes.

Fresh reproduction using the real component, QueryClient, auth store, new service and installed SDK:

1. Change confirmed A to B, blur and resolve the successful update. The editor is clean.
2. Change the synthetic server's confirmed text to C and invalidate/refetch the exact book query.
3. The query cache contains C, but the input still displays B. Acceptance expectation fails: expected `Later server C`, received `Saved B`.
4. Blur the untouched input. A new text-only request writes B back; synthetic server C is overwritten by B. A separate diagnostic confirms this consequence.

Impact: stale display and destructive overwrite of a later confirmed change, including another mounted editor/device's update. This does not require a failed request or newer local typing. It is distinct from providing cross-device transaction concurrency: the client already received C and then ignored it.

Recommended correction: reconcile each submission once, recording consumption separately from edit revision. After a matching success cleans the draft, a clean editor must follow confirmed query data. Continue preserving newer dirty edits. Add permanent clean-refetch and untouched-blur regressions.

### RR02 — P2: validate inherited submissions against the current generation

Location: [Book Details lines 95–112](<C:/Users/LEGION/Desktop/Bookconnect4_library/app/(tabs)/library/[bookId].tsx:95>), especially pending inheritance at 109–112.

Changing the mutation filter does not synchronously replace `useMutationState`'s retained result in the installed implementation. `useMutationState.ts` initializes a result once, updates filter options in an effect, and recalculates on mutation-cache notifications. Book Details trusts the resulting pending submission without independently checking its actor revision/book against the new identity.

Fresh same-mount reproduction: start A's pending text request containing `Actor A secret pending`; batch auth-store transitions A→logout→A with a new token; refetch confirmed current-session text. The exact query cache contains `Current session confirmed`, but the editor inherits `Actor A secret pending`. The acceptance expectation fails after waiting for rendering. The old request is deliberately held pending even after abort, as allowed by the review harness. An identity revision changes correctly; the defect is draft adoption, not the service's dispatch guard.

Impact: old-generation submitted text becomes the new session's dirty draft. A further explicit blur can submit it under the new generation. This contradicts generation separation even though queued old service dispatch/late cache adoption remain fenced.

Recommended correction: independently require matching actor ID, actor generation and entry ID for every inherited mutation record, and ensure selected queue/busy snapshots reset with identity. Add a same-mounted-session transition regression, not only unmount/reopen cases.

Limits: this is a reproduced component/auth-store integration defect. The root auth layout/router and real coordinator were inspected but are not mounted in the diagnostic. Root routing may unmount the screen during ordinary logout and avoid this path; the exact rapid-transition route lifecycle remains unverified. The A→B same-mount diagnostic passes after proper render waits; no cross-account disclosure, wrong-token request or live RLS bypass is claimed.

## Contract assessment

| Contract | Assessment and evidence |
| --- | --- |
| 1. Field writes/failures | PASS in bounded synthetic execution. Actual PATCH bodies contain one field. Existing tests cover rejected text→rating/Private and rejected Private→text; added tests cover rejected rating/Public→text, explicit failed-text retry and unsaved retention. Successful earlier fields persist in later full confirmed rows. Text remains editable; no automatic rollback. |
| 2. Draft/reconciliation | CHANGES REQUESTED: RR01; RR02 under same-mount generation change. A→B→A, arbitrary newer typing, repeated submissions, multiple waiting texts, pending reopen and explicit failure retry pass. Two simultaneously mounted editors preserve another editor's dirty draft and share busy feedback. Changed-book identity passes. Short-GC stress fails as qualified below. |
| 3. Account/session | Dispatch/response fencing passes the existing switch/logout/return tests, pinned Authorization, abort signal, same-actor token refresh, cancellation-await guard and added independent new-generation queue test. RR02 concerns inherited local draft state while remaining mounted. The real store and service execute; coordinator/root routing are source-traced, not connected acceptance. Abort is not rollback of an accepted server transaction. |
| 4. Affected row | PASS in local SDK/synthetic HTTP. Body is one field; `id=eq.entry`, `user_id=eq.reader`, selected `id,user_id,rating,review,review_is_public`; PATCH, return=representation, object Accept, pinned Bearer header. Null, empty array/zero rows, missing fields, wrong identities, malformed rating/text/privacy and transport/API errors reject. Nullable retained fields are accepted. Cache is seeded from validated returned fields, not submitted patch. |
| 5. Queue/B01 | Exact actor/book/generation scope serializes all three actions. Confirmed rating/privacy display, shared pending feedback after reopening, consistent queueing and independent new-generation queues pass. Hierarchy, named destinations, management/removal and named minimum-48dp Back pass the retained suite. Saved Pages and community loading/error/empty/populated branches remain in source. Native geometry, TalkBack and real saved-page deletion were not freshly exercised. |

Input validation permits exactly one own enumerable allowed key, string text (including empty), integer rating 0–5 or boolean visibility; invalid patch cases reject before HTTP. Blank entry IDs reject. It does not validate UUID syntax or cap review length; neither is a newly established requirement here. Null patches are outside the typed API and would throw rather than dispatch. Response fields may be null per the historical schema receipt; UI retains its existing null-rating→0 and null-visibility→Public defaults. No new schema inference, schema change or live write test was needed.

Installed SDK trace: `@supabase/supabase-js/src/lib/fetch.ts` awaits access-token lookup but preserves an explicit Authorization header. PostgREST constructs the update/filter/return/single/abort request exercised by the diagnostics. TanStack `mutationCache.ts` serializes by scope and runs the next paused mutation; `mutation.ts` retains pending unobserved mutations through GC and calls success/cancellation/adoption hooks before success publication. `src/lib/queryClient.ts` exports a module-lived default QueryClient. Session coordinator clears commerce/inventory identity state and publishes an unauthenticated/initializing store state on identity transitions; the review service's store subscription independently increments its revision and aborts current requests. No global auth implementation change was made.

## Fresh verification

From the workspace root:

```powershell
node node_modules/jest/bin/jest.js --runInBand --runTestsByPath "app/(tabs)/library/__tests__/book-details-corrections.test.tsx" src/components/notes/__tests__/ManualNoteJourney.test.tsx src/features/books/services/__tests__/booksService.test.ts src/features/books/notes/__tests__/manualNoteDeleteGate.test.ts src/features/books/notes/__tests__/manualNotesGateway.test.ts src/features/books/notes/__tests__/noteNavigation.test.tsx
node node_modules/typescript/bin/tsc -p tsconfig.library-notes.json --noEmit --pretty false
```

Fresh baseline: **6 suites / 116 tests PASS**, exit 0, Jest 16.889s, including all 27 correction cases. Scoped TypeScript **PASS**, exit 0/no diagnostics. Clipboard/punycode warnings and intentional legacy-service console errors remain; no warning-free claim. No full TypeScript/full Jest/export/browser/native check was run. The prior 37 full-compiler diagnostics are historical, not a newly verified count.

Diagnostic fixture is a copy of the existing real-component/SDK suite plus `DIAG` cases. External HTTP/native/feature surfaces are simulated. Final source is archived as [diagnostics.test.tsx.txt](./diagnostics.test.tsx.txt), with [JSON](./diagnostics.json) and [log](./diagnostics.log). To reproduce, copy the archived file to `app/(tabs)/library/__tests__/retained-review-independent.diagnostic.test.tsx`, run the following command, then remove that copied executable fixture. It must live at that documented path because it imports `../[bookId]`.

```powershell
node node_modules/jest/bin/jest.js --runInBand --runTestsByPath "app/(tabs)/library/__tests__/retained-review-independent.diagnostic.test.tsx" --testNamePattern DIAG --json --outputFile=.tmp/retained-review-independent-complete.json
```

Diagnostic results and closeout validation are appended below after execution. These diagnostics assert desired acceptance behavior: their expected failures are proof of gaps, not a green acceptance suite. Earlier exploratory multi-instance tests incorrectly addressed separate render roots, and transition tests initially failed before awaited rendering/refetch; those harness failures were corrected and are not findings. Final JSON/source are authoritative.

## Unverified risks and acceptance limits

- A real GC timer stress (`mutations.gcTime=1ms`, unmount pending submission, reopen, resolve) retains text and busy while pending but can remove the terminal mutation before the inherited editor consumes its success. Text then remains incorrectly marked unsaved. This is a reproduced stress configuration, not the app's default timeout. Default browser/native GC is five minutes (server-side SDK default Infinity); no default-timeout boundary reproduction was run. Treat this as a reconciliation robustness risk, not a separately confirmed default-production defect. Success consumption should not depend solely on a transient mutation-history record.
- Root-level rapid auth routing/coordinator acceptance for RR02 is unverified. Real auth refresh/network failures, PostgREST/RLS enforcement, native release accessibility, F04–F06 and complete release acceptance remain open.
- Historical exact-project metadata/RLS readback is in the previous receipt. This review made no fresh Supabase call and claims no fresh live schema, grants or effective-role acceptance. All new findings are client-local; all HTTP writes are synthetic. No live business rows were read or written.
- No durable drafts/restart recovery, cross-device write arbitration or rollback of already accepted writes is claimed.

These corrections can be reviewed independently of F04–F06 and other release blockers, but **cannot be accepted as complete now** because RR01 is within the bounded correction contract. Address RR01 and the same-mounted-generation adoption gap, then independently rerun the relevant acceptance diagnostics. Persistence remains **ON HOLD**, all four MANUAL_NOTE_WRITE_GATES false; no gate, migration, dependency or product-spec behavior changed.

## Continuity

Library work unit: `library_sdd06_retained_review_independent_changes_requested`. Exact next action: owner authorizes a bounded correction for RR01 consumed-success reconciliation and RR02 exact-generation draft adoption, followed by independent review; investigate GC-safe confirmation as part of that correction. This review itself authorizes no implementation.

Changes made by this review: this new receipt/noncompiled diagnostics/results/hash metadata and continuity overlays in Library TRACKER, Phase 9 TRACKER and implementation/verification log. Existing receipts are preserved. DOC-13/ACTIVE/global Unit7C/M46 handoff unchanged. No application source/config/dependency/migration file changed by this review. No database/Storage/provider mutation, staging, commit, push, deploy or apply.

### Final execution and closeout

- Final DIAG run: **15 passed / 4 failed / 27 baseline cases excluded by name filter**, exit 1, 19.723s. Four failing acceptance expectations: RR01 clean refetch, RR01 untouched-blur overwrite, RR02 same-mounted return, and qualified 1ms GC stress. The extra changed-book case passes. This is 19 added cases, not 46 newly executed tests.
- [Continuity validator](./continuity.log): **PASS**, exit 0, 195 definitions, zero duplicate/missing traceability, regression probes PASS, 76 Markdown files checked. [Whitespace check](./diff-check.log): **PASS**, exit 0; existing LF/CRLF advisories remain.
- Re-read Library/Phase9 trackers and implementation log: current unit and exact bounded-correction authorization next action agree. DOC-13/ACTIVE global handoff unchanged; no phase transition or new behavior/acceptance decision was made.
- Final seven-source hash readback: all unchanged and matching the prior correction receipt. Four write-gate source flags remain false. Executable diagnostic fixture removed; only `.tsx.txt` evidence remains. The final archived source includes the additional changed-book case. Receipt/diagnostic/continuity links resolve.
- Review changes and pre-existing changes remain uncommitted. Staged diff empty. No stage, commit, push, deployment, migration application, database/Storage/provider mutation, browser/emulator/server launch or dependency change occurred.
- Document cohesion assessed: report has one bounded review/evidence responsibility; original specifications and receipts were preserved, without pruning for line counts.
