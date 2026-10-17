# Independent Luna review and bounded guard corrections

Date: 2026-10-10–11 (Asia/Calcutta; review crossed midnight)
Reviewer: GPT-6 Luna, maximum reasoning, agent /root/manual_persistence_luna_review
Authority: owner explicitly requested an independent review, confirmation of findings and necessary local corrections. Shared-project application/test writes, gate enablement and Git publication remain excluded.

## Review scope and method

The assignment required repository continuity startup, source/target comparison, actual SQL/RLS/privilege/ownership/concurrency review, adapter/coordinator/navigation scrutiny, category/legacy compatibility, test quality and evidence/authority accuracy. The reviewer was instructed to reproduce concrete defects, distinguish local from live/native proof, preserve unrelated changes, and make no edits or shared-service writes.

Initial reviewed migration SHA256: 72d78fffd0cd63abe9a661059e9cb7b9dec20b68c7456429e5cdf2b68f176c22.

The first attempt ended at a usage limit before any verdict. After capacity returned, the same requested Luna/max agent completed the review. Its fresh Supabase MCP readback verified ahntbtktjjmvfosgkmgn / Bookconnect_reactexpo and the unapplied candidate. The live helper and historical actor policies matched the expected baseline; neither finding is an observed live mismatch.

The reviewer reported rerunning all 14 original PostgreSQL tests, all 134 focused client tests across ten suites and scoped Library TypeScript successfully. It found no additional actionable issue in the reviewed adapter, coordinator, active routes or SQL concurrency/ownership behavior. This is bounded review evidence, not proof of real PostgREST, production ACLs, response-loss transport or native acceptance.

## Findings and independent confirmation

| Finding | Original defect | Confirmation | Local correction |
|---|---|---|---|
| P2: word-helper drift | The precondition checked that check_note_word_limit(text) existed but not its body or execution attributes. A retained same-name CHECK could silently lose the 500-word rule. | Parent used an isolated real PG17 baseline with consistent book ownership and a helper returning true. Candidate application succeeded; the expected rejection failed. [Diagnostic](./helper-drift-red.txt). | Require the fresh receipt's exact trimmed helper body, SQL/scalar signature, argument shape, immutable/parallel/security/strictness attributes and pinned search_path. Preserve the function rather than replace it. |
| P2: same-name policy drift | Only count, names and permissive status were checked before dropping the four policies. A stricter predicate, changed role/command or explicit check could be overwritten. | Luna's isolated PG17 diagnostic observed 0 visible synthetic rows under a tightened SELECT policy, then 1 after the candidate replaced it. Parent's permanent predicate regression independently failed its expected rejection. | Compare all four historical commands, PUBLIC role set, permissiveness and null-safe USING/WITH CHECK before any policy drop. Unexpected semantics abort the transaction. |
| P2: helper writer-privilege drift | Body/attribute checks did not verify effective EXECUTE. An unchanged helper could be unavailable to a valid writer. | In Luna's isolated PG17 rereview diagnostic, the candidate applied, authenticated EXECUTE was false and a valid INSERT failed with SQLSTATE 42501. Parent's ACL regression independently failed its expected rejection; [RED](./helper-acl-red.txt). | Require effective EXECUTE for authenticated and service_role before migration; reject drift without modifying helper ACLs. |

The original receipt's broad fail-closed catalog claim was unsupported until these gaps were corrected. The migration now intentionally rejects even a harmless internal body rewrite or policy variation; such drift needs a fresh catalog review rather than silent normalization. Outer helper whitespace is ignored. Writer availability is checked through effective privileges, including role inheritance, rather than an ACL text fingerprint; anonymous writes are denied by the new note grants. No shared function, policy or row was changed.

## Permanent regressions and correction proof

The [baseline](../../../../../supabase/tests/library/manualNoteBaseline.sql) now preserves the exact helper from the fresh security receipt. The ownership-inconsistency test no longer substitutes a weakened helper, so it still reaches and tests its intended owner precondition. Each changed-catalog test uses a separate disposable database.

Two new [regression groups](../../../../../supabase/tests/library/manualNotePersistence.postgres.test.mjs) cover:

- Helper body returning true, changed volatility, changed search_path, SECURITY DEFINER, authenticated EXECUTE absent with service_role retained, and service_role EXECUTE absent with authenticated retained.
- Same-name policy predicate, role, command and WITH CHECK drift.

Both initial groups failed before the guard fix with “Missing expected rejection”; [RED output](./review-regressions-red.txt). After the first correction, all 16 PostgreSQL tests passed with eight drift variants; [checkpoint output](./review-postgres-tests.txt). Luna independently confirmed both original fixes, then reproduced the ACL defect. The parent added the two ACL variants, confirmed RED on that checkpoint and fixed the effective privilege guard. Final 16/16 passed with all ten drift variants, transaction rollback/schema preservation, policy preservation, legacy compatibility, privileges, ownership and the actual competing-connection lock race; [final GREEN output](./final-review-postgres-tests.txt).

Commands used the existing PostgreSQL 17 runtime and pg package, with LIBRARY_PG_BIN / LIBRARY_PG_TOOLS_NODE_MODULES set as documented in the [harness instructions](../../../../../supabase/tests/library/README.md):

~~~text
node --test --test-name-pattern "refuses word-limit|refuses same-name policy" supabase/tests/library/manualNotePersistence.postgres.test.mjs
node --test --test-name-pattern "refuses word-limit" supabase/tests/library/manualNotePersistence.postgres.test.mjs
node --test supabase/tests/library/manualNotePersistence.postgres.test.mjs
~~~

First corrected checkpoint SHA256: f056685b442ca5a8aa5030ea44676a92ef6d5aad98f8a8df3b78072d915d3ba8.
Final corrected candidate SHA256: eadd4d8a16d87801735ec59a101a95732a59e64e9902a576000b5cf0aafb291d.

Only the unapplied candidate, projected baseline, SQL harness and supporting documentation changed in this correction. Client/application code is unchanged; the reviewer reran the existing 134/134 and scoped TypeScript on that same code. The earlier web export/browser receipts are retained with their original scope, not represented as new runs.

## Bounded rereview and handoff

The same Luna/max reviewer independently accepted the two original fixes, baseline fidelity and regression isolation; its own corrected-suite rerun passed 16/16. It identified the ACL defect during that rereview. In the final targeted rereview it verified the final candidate hash, independently ran both drift groups (six helper and four policy variants) successfully, confirmed all three findings fixed and found no regression in these corrections. The candidate is coherent for bounded application review; this verdict does not open saving gates or accept the manual release.

Luna's earlier temporary diagnostics were automatically deleted; the generated GUID paths were not retained. Do not claim a durable script artifact. Its exact reported outputs are preserved below; the parent's permanent regression RED/GREEN artifacts independently substantiate rejection behavior.

~~~json
{"beforeCandidateVisibleRows":0,"afterCandidateVisibleRows":1,"expected":"restrictive same-name policy accepted and replaced"}
{"candidateApplied":true,"helperExecutePrivilegeForAuthenticated":false,"insertOutcome":{"status":"rejected","sqlstate":"42501","message":"permission denied for function check_note_word_limit"}}
~~~

Final reviewer commands:

~~~text
node --test --test-name-pattern="word-limit helper" supabase/tests/library/manualNotePersistence.postgres.test.mjs
node --test --test-name-pattern="same-name policy" supabase/tests/library/manualNotePersistence.postgres.test.mjs
~~~

All four write gates remain false. Local DDL/DML was confined to disposable loopback PostgreSQL clusters, removed by the harness. No shared database/Storage/provider mutation, staging, commit, push or deployment occurred. Existing mixed worktree edits remain preserved. Marketplace Phase9 Unit7C/M46, DOC-13 and ACTIVE remain unchanged.

Real PostgREST/response decoding, remote effective privileges and account-owned test round trips, response-loss reconciliation and native manual acceptance remain release gates. Current unit: library_sdd06_persistence_luna_review_corrected_live_gated. Exact next action is owner authorization for the exact-project application/readback unit; connected test writes and enablement stay separately scoped.
