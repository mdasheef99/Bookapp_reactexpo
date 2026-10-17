# Edition picker four corrections — implementation plan

> Execution: implement inline, red tests before production, one independent review after verification. The Owner explicitly requested planning then implementation and clarified all four corrections. No further product approval is needed. Keep SQL as a proposal under the earlier decision; no migration-file creation, application, staging/commit/push or deployment.

**Goal:** help the Owner find selectable editions, understand blocked choices and recover failed selections while seeing genuine edition details.

**Context:** Phase 9 / Unit 6G; codex/edition-picker worktree C:/Users/user/.codex/worktrees/edition-picker-research/Bookconnect, base76348f3. Preserve the local title helper/test and two-file scroll patch. Supabase MCP reverified ahntbtktjjmvfosgkmgn / Bookconnect_reactexpo / ACTIVE_HEALTHY / ap-southeast-2 and the live owned-read, identity and confirmation functions. No database writes. M65-M74 remain immutable, M75 deferred; title SQL remains uncreated/unapplied.

**Architecture:** change the existing list and picker; do not create another selection workflow or matcher. Counts and edition/format use current safe rows. Recovery uses existing registered error codes and authority rereads; uncertain retries retain exact command IDs. Diagnostic SQL derives a bounded reason from the immutable saved row/query during the existing owned fresh read, without persisting reasons or changing eligibility. Opt-in uses the already allowed x-client-info header with exact value bookconnect/edition-reasons-v1, passed through only to the authenticated RPC client. Legacy callers keep their exact row shape; new callers tolerate old API/SQL responses. No request-body/version/RPC signature change or added provider call.

**Spec:** Owner decision2026-10-13; DOC-3 §5.2.1; owner-edition-picker SDD §§3/4.1/6-7/9/13.2; master §3 MAS-02/03/04/05/06/15/16. Amend these owning requirements before production edits and link this plan from tracker37 §33.

**Tech:** existing React Native/Expo, React Query, Zod, Jest and disposable PGlite/M65-M74 fixtures. No dependency added.

## Constraints and review focus

- Keep original five/ten positions, IDs, attribution, unavailable rows and ordering; never promote an ineligible result. Cover absence remains selectable.
- Display editionStatement/format only when supplied; Google printType/books is not binding evidence.
- Preserve selling drafts, coherent selection, confirmation/version/expiry locks and once-only Add. No automatic Search Books.
- Reasons are enum-only: title_differs, author_differs, language_unknown, language_differs, volume_differs, identity_unverified, result_unavailable; null/absent for eligible or legacy unknown. Unknown reasons and inconsistent eligible reason payloads fail schema validation.
- Result language unknown is distinct from a known mismatch. Exact-ISBN unknown-query-language exception and the already-proposed known-English leading-The comparison stay intact. Additional or unavailable evidence uses an honest generic fallback.
- Legacy API/client/direct RPC responses stay byte-equivalent unless the reason capability is explicitly requested. A header never grants ownership or changes store/query/selection authority.
- Empty/all-blocked/first-five-blocked sets, a replacement set after Show all, command-busy selection, stale/expired/nonretryable errors and successful-but-superseded responses need relevant tests.
- Reasons on expired/query-invalid/post-Add alternatives must not recreate or expose them. Confirmation and private selected snapshots must remain unchanged.

## Task 1 — discoverability and supplied edition details

**Files:** components/EditionOptionList.tsx; __tests__/EditionOptionList.test.tsx.

- [x] RED: ten original positions with first five blocked and one later eligible show a selectable count and remaining-result hint before expansion; Show all reveals the same positions and clears the hint. Count zero honestly; busy state never enables a row.
- [x] RED: render provider editionStatement and format, omit absent values, preserve date precision and coverless selection.
- [x] GREEN: compute counts from the safe current rows and render simple text; retain the existing Show all button and original order.
- [x] Verify the result-list suite; inspect the actual rendered labels.

## Task 2 — error-specific selection recovery

**Files:** review/editionSelectionRecovery.ts (new); components/CandidateEditionPicker.tsx; __tests__/ownerEditionPickerSheetStates.test.tsx.

**Interface:** editionSelectionRecovery(error: unknown) returns {kind: 'retry'|'refresh'|'stop', message: string}.

- [x] RED: P9_STATE_CONFLICT/P9_VERSION_CONFLICT/P9_CANDIDATE_VERSION_CONFLICT and OWNER_CANDIDATE_AUTHORITY_CHANGED show changed-choice guidance plus a read-only Refresh edition choices action, without frozen-command Retry selection.
- [x] RED: known nonretryable errors show the existing safe registered message and no retry. Unknown transport/internal failures retain uncertain-result guidance and the exact-command retry; a reread alone never reports selection success.
- [x] GREEN: classify the existing errors once; keep lookup behavior, command identities, hook reconciliation, draft adoption and locks unchanged.
- [x] Verify mounted/query/full-review/draft/confirmation cases relevant to recovery and preserved selling fields.

## Task 3 — authoritative disabled reasons with compatible wire

**Files:** client/server contracts/ownerEditionPicker.ts; components/EditionOptionList.tsx; api/ownerUxTransport.ts; api/ownerEditionPickerService.ts; runtime/ownerEditionPickerGateway.ts; phase9-owner-ingestion/index.ts; client/server contract/service/gateway tests. SQL and its regression harness stay external in this evidence directory.

**Interfaces:** optional rejectionReason enum/null on the public row; EDITION_REASONS_CLIENT_INFO constant on both contracts; editionPickerRpcHeaders(authorization: string, clientInfo: string|null) returns only Authorization and the exact supported x-client-info marker. No request DTO or RPC argument changes.

- [x] RED: schemas accept safe optional reasons for blocked rows, reject arbitrary strings/eligible non-null reasons, and preserve legacy fixtures. UI renders specific messages and a truthful legacy fallback.
- [x] RED: new client adds the allowed capability header only to edition-choice reads, preserving the body/signal; authenticated gateway headers ignore unsupported client-info and preserve caller authorization.
- [x] RED SQL baseline: fresh opt-in owned read lacks the reason field, with legacy, ownership, confirmation and retention controls preserved.
- [x] Write external SQL-PROPOSAL.md: private diagnostic helper (postgres-only), capability-gated existing choices projection, same ACL/signatures/search_path/confirmation logic. Reuse stored query/rows; title/auth/language diagnostics plus reliable exact-ISBN volume evidence; fallback identity_unverified. Keep eligibility unchanged. No schema/state/queue/job/receipt write.
- [x] GREEN: wire optional enum and display; header uses existing CORS allowance. Old API ignores it safely; new SQL emits reasons only for exact opt-in, including direct RPC compatibility.
- [x] GREEN SQL: disposable current full M74 database plus the retained title predicate proposal; test reason cases, legacy equality, wrong-owner/store denial, expired/query-invalid/post-Add cleanup, private snapshots/confirmation and no authority changes. No live SQL execution.

## Task 4 — integrated proof and handoff

- [x] Run only affected client contract/service/list/sheet/mounted/query/full-review/draft/confirmation tests and server contract/gateway tests. Run related explicit worker guards because their shared row schema changes; do not rerun unrelated application tests.
- [x] Run external diagnostic SQL regression and the existing actual M74 gate, root tsc --noEmit, metadata-worker compilation and a new web export if needed for UI proof.
- [x] Browser: inspect counts, original order, supplied details, legacy fallback and coverless controls in the actual local built client. Controlled uncertain/conflict recovery is proved by mounted and actual-HTTP fixtures; no fake live page state or shared rollout is used. Do not invoke another provider lookup or Add without a separate live workflow direction. Real detailed reasons remain pending compatible API/SQL publication.
- [x] One independent focused review of final code/proposals/verification; resolve material findings with red/green proof. Keep unrelated minors deferred.
- [x] Update root/owning specs, traceability, security/current-vs-target notes, planning/implementation trackers and current handoff. Run continuity and git diff --check. Report actual tests, local/uncommitted state and that SQL/release remains held.

Future release scope, separately authorized: combine reviewed title and reason SQL proposals into a forward migration; compatible SQL → one metadata-worker release for the existing title patch, Owner API header/schema update and client publication → separately authorized current-scan refresh and controlled browser acceptance. Reason display itself needs no new worker/provider behavior. No rollout is performed by this plan.

## Execution receipt, 2026-10-13

All four tasks completed locally. RED39 missing-feature failures/202 controls; focused GREEN241, surrounding client/actual-HTTP115 and explicit worker/title135:491 Jest tests in19 suites passed. Diagnostic SQL25, existing author isolation20 and existing Open Library SQL32:77 disposable SQL cases passed,568 total local checks. TypeScript, worker compilation and fresh web export PASS. Actual browser five-to-ten ordering/count/hint/supplied format/coverless control/ordinary scrolling PASS. Specific reasons and controlled recovery are fixture/SQL proof while live backend remains legacy; no native or deployed-reason acceptance claim.

Independent read-only review APPROVED with no Critical/Important findings. Four suggested language/article diagnostic cases added and passed, without production/proposal changes. Tracker37 §34 and external C:/Users/user/.codex/visualizations/2026/10/12/01a1320a-fcf2-73b2-8517-f2ddd4d6256d/edition-picker-four-corrections-20261013/REPORT.md own receipts/rulings. SQL remains external PROPOSED / NOT_CREATED / NOT_APPLIED; earlier title migration creation declined, refresh held, M75 deferred. No Git publication/shared mutation/deployment. Next authorized action: Owner review of local picker and retained proposals. Continuity/diff/index/status gates are run after final documentation updates.
