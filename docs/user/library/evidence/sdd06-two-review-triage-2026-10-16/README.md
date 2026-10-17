# Two-review reconciliation — 2026-10-16

**Verdict: original FR01 reopening correction remains verified; further correction is needed for actor transitions, newer typing, and inherited-queue feedback.** This pass evaluates both owner-supplied reviews. No application fixes were implemented.

Current workspace: `C:/Users/LEGION/Desktop/Bookconnect4_library`, branch `codex/library-cover-shelf`. Extensive existing changes preserved, staged diff empty. Read AGENTS/ACTIVE/DOC-13/Phase 9 session/current trackers, current SDD-06 revision 0.22, both supplied reviews, Book Details, review service, root QueryClient, auth store/coordinator and existing tests. Marketplace Unit7C/M46/global authority remain unchanged. Library unit: `library_sdd06_two_review_triage_confirmed_gaps`.

## Confirmed findings

### TR01 — P2: queued review dispatch and confirmation lack an actor-transition fence

[Mutation dispatch and confirmation](<C:/Users/LEGION/Desktop/Bookconnect4_library/app/(tabs)/library/[bookId].tsx:161>) bind cache/queue keys to actor identity, but dispatch calls the shared review service without comparing the current session to `submission.actorId`. [Root QueryClient](<C:/Users/LEGION/Desktop/Bookconnect4_library/src/lib/queryClient.ts:3>) survives navigation. [Session cleanup](<C:/Users/LEGION/Desktop/Bookconnect4_library/src/application/auth/sessionCoordinator.ts:22>) does not clear this review queue. [addRating](<C:/Users/LEGION/Desktop/Bookconnect4_library/src/features/books/services/booksService.ts:822>) currently checks only error, without an affected-row confirmation.

Fresh mounted diagnostic: queue Actor A's text/Private submission behind another request, unmount, change the mocked current actor to B, then finish the first request. The second service-boundary call still carries Actor A's text and book while the observed current actor is B. A simulated zero-result success publishes Actor A's text/Private values into A's confirmed cache. This independently demonstrates missing local fencing/confirmation; it is not a live token/header/RLS exploit or proof of an actual cross-user database mutation. The other reviewer reports fresh own-row RLS evidence; this triage did not repeat a Supabase audit and does not claim RLS is absent.

Recommended correction: fence actor/session identity at queued dispatch and before adopting completion, including logout/transition while work is waiting or in flight. A retained review service must distinguish an affected row from an error-free zero-row response before publishing confirmed cache state. Keep the correction local to the retained review path unless broader auth changes are separately selected. Do not change RLS or open note-write gates.

### TR02 — P2: typing back to the previous confirmed text is overwritten

[Draft baseline comparison](<C:/Users/LEGION/Desktop/Bookconnect4_library/app/(tabs)/library/[bookId].tsx:103>) uses text equality as a proxy for whether a newer edit occurred. Reproduction: confirmed A → submit B → type A again without blurring → response confirms B. The comparison sees current A equal the earlier baseline A and replaces it with B, losing the newer typing.

Fresh mounted diagnostic waited for the component to render B after the user had typed A. Recommended correction: track actual edit/submission revisions or an equivalent explicit dirty marker; string equality cannot establish that no later input occurred. Preserve the existing pending-text hydration and actor/book reset behavior. Add a permanent A→B→A regression.

### TR03 — P3: inherited pending queue is not reflected by busy feedback

[Current observer busy state](<C:/Users/LEGION/Desktop/Bookconnect4_library/app/(tabs)/library/[bookId].tsx:387>) and saving notice track only the reopened mount's mutation observer. Fresh mounted diagnostic verified one pending exact actor/book mutation while the reopened privacy control reports `busy: false` and the saving notice is absent.

Recommended correction: derive busy feedback from the shared exact actor/book pending queue. The rating control's asymmetric disabled policy is a separate interaction choice; this triage does not call that alone a correctness defect. Displaying the last confirmed rating is also consistent with the current narrower pending-payload preservation contract.

## Findings requiring policy interpretation rather than automatic rollback

The attachment also calls retained failed text and later submissions inheriting an earlier failed request's visibility/rating defects. These observations describe reachable behavior, but their asserted expected outcomes are not established by the present specification:

- Keeping unsaved text after a failed write protects input. A later whole-review save may retry that visible text. Discarding it automatically could lose work.
- A queued later submission currently retains the user's latest requested visibility/rating. If an earlier request fails and the later one succeeds, applying that intent can be desirable. Automatically reverting to an earlier confirmed Public setting could undo a requested Private setting.

Do not silently implement those rollbacks. If failure policy is changed, define whether a failed field intent is retained/retried or withdrawn, and make feedback consistent with that decision. These are distinguished from the reproduced actor fence, lost newer typing, and missing busy feedback above. No product decision was made by this triage.

## Fresh verification and limits

[Archived diagnostics](./review-diagnostics.test.tsx.txt), [results](./diagnostics.json), [log](./diagnostics.log).

```powershell
node node_modules/jest/bin/jest.js --runInBand --runTestsByPath .tmp/sdd06-two-review-triage-20261016/review-diagnostics.test.tsx --testTimeout 30000 --json --outputFile=.tmp/sdd06-two-review-triage-20261016/diagnostics.json
```

**Three diagnostic cases PASS**, exit 0, 5.02 seconds: they deliberately assert the defective behaviors to prove reproduction, not acceptance. Real Book Details/QueryClient execute; services/native primitives and the current-actor hook are mocked. No real auth session, external payload, database write or affected-row response was exercised. The executable scratch file was archived as `.tsx.txt` and removed from test collection. Its relative import assumes the documented scratch path if rerun.

Both supplied independent reviewers report 61 focused tests/scoped TypeScript PASS on the prior fix. This pass did not repeat those commands, full compilation, full Jest, browser/native checks or live Supabase reads. Current Book Details/test/gateway hashes were checked against the prior correction receipt. Existing F04–F06 and native/release acceptance remain open.

## Handoff

Exact next action: select a bounded correction pass for TR01 actor/confirmation fencing, TR02 edit-revision preservation and TR03 inherited-queue feedback, then independently review those changes. Preserve the current failed-text/latest-intent behavior unless a different failure policy is explicitly chosen. No implementation authority, migration authority or gate change is added by these review records.

Persistence remains ON HOLD with all four MANUAL_NOTE_WRITE_GATES false. Marketplace remains Phase 9 at completed Unit7C/M46; DOC-13/ACTIVE/global handoff and database-mutation authority are unchanged. Application/dependency/migration files unchanged in this triage. Review evidence/continuity updates remain uncommitted; nothing staged, committed, pushed, deployed or applied. Database/Storage/provider writes: none.

Final [continuity validation](./continuity.log) PASS: 195 definitions, zero duplicate/missing traceability, regression probes PASS, 76 Markdown files. `git diff --check` PASS with existing LF/CRLF advisories; staged diff empty, exit 0. All three prior source hashes (Book Details, correction tests, write gateway) still match exactly. Four gates read back false. Active Library/Phase trackers re-read with this triage and exact next action. Reproduction stored noncompiled; no executable scratch test remains. The receipt remains a cohesive review reconciliation, without pruning prior specifications or proof.
