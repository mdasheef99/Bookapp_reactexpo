# Delete-test correction and forward-plan receipt

Date: 2026-10-11 (Asia/Calcutta)
Work unit: library_sdd06_delete_tests_corrected_forward_plan_ready
Authorization: owner “ok proceed please” accepted bounded local delete-test corrections plus a forward-correction plan. No migration-file creation, shared application, connected test writes, gate enablement or publication in this unit.

## Changes

[ManualNoteJourney.test.tsx](../../../../../src/components/notes/__tests__/ManualNoteJourney.test.tsx) now gives only the three simulated deletion scenarios an explicit adapter created with ownedBookWrites true. A per-test spy supplies the matching UI capability and routes the reader through that adapter; jest.restoreAllMocks restores the production path after each test. The production frozen gate object is never changed, and transport remains simulated.

The three original confirmation/cache/late-result assertions remain. Added a mounted production-gate regression: Delete is disabled, cannot open a confirmation or invoke the delete adapter, and does not dispatch to Supabase.

[manualNoteDeleteGate.test.ts](../../../../../src/features/books/notes/__tests__/manualNoteDeleteGate.test.ts) retains both original gate-closed no-dispatch cases and adds:
- an authorized factory traversing the actual book lookup and delete gateway, with exact actor/book/note filters and one mocked delete;
- zero and multiple returned rows rejected as unconfirmed;
- wrong current actor rejected before dispatch;
- unavailable owned book rejected before the delete request.

This is test-fixture/coverage correction, not a change to production deletion. No assertions were removed or skipped, timeouts increased, UI architecture changed, or gate enabled.

## Verification

| Check | Result |
|---|---|
| RED before correction | Original three deletion regressions failed; 17 unrelated tests intentionally omitted by the narrow name filter |
| Two affected suites after correction | 28/28 PASS |
| Full focused scope | 142/142 PASS, eleven suites, no skipped tests |
| Scoped Library TypeScript | PASS |
| Production gates | All four false |
| Original migration | Unchanged; SHA256 eadd4d8a16d87801735ec59a101a95732a59e64e9902a576000b5cf0aafb291d |

The full command used the same ten historical focused suites plus manualNoteDeleteGate.test.ts; all six added cases are included. Transport/native effects remain simulated. No SQL suite, web export, new browser/emulator acceptance or connected note write was run.

## Forward plan

[Concrete plan](../../MANUAL-NOTE-FORWARD-CORRECTION-PLAN.md) preserves both old artifacts and targets only revision metadata preservation, note policy roles/expressions and narrow note/function privileges. No schema/data reset or broader feature. It specifies exact-baseline guards, atomic rollback, preservation/security/concurrency tests using the applied variant first, and separate connected/native release gates.

Fresh Supabase MCP reverified ahntbtktjjmvfosgkmgn / Bookconnect_reactexpo, ACTIVE_HEALTHY, ap-southeast-2, PostgreSQL 17.6.1.063. [Fresh catalog](./forward-plan-baseline.json) still matches live 20261010221843 / SQL MD5 d187c32b7b0846e735d6696adff6a7ed. Two notes, no missing/foreign-owned parents/null timestamps/invalid versions. No note body, identity, account or credential was read.

Both Library and sibling Clubs trackers were read; sibling files unchanged. Official Supabase column-level-privilege documentation was consulted through MCP. Its table-grant precedence supports the narrow-grant target; no dependency/API upgrade is proposed.

## Limits and next action

The live variant remains uncorrected and does not inherit the original candidate's 16/16 acceptance. Real Auth/PostgREST security/round trips/reconciliation and native manual acceptance remain pending. Saving and deletion stay gated; OCR stays deferred.

Exact next action: owner authorizes one forward migration-file creation plus disposable PostgreSQL verification under the linked plan. Shared application, connected synthetic writes/cleanup, gate enablement and Git publication remain separate. The original unmigrated-baseline candidate must not be replayed.

Changes are local and uncommitted: two test files and documentation/evidence only. No live database/Storage mutation, staging, commit, push or deployment. Marketplace Unit7C/M46 and DOC-13/ACTIVE unchanged.

Closeout verification: Phase 9 continuity PASS (195 requirement definitions, no duplicate or missing traceability, validator regression probes PASS); 284 local links across eleven documents resolved; no trailing whitespace in those documents or the two changed test files; all sixteen B01–B16 contracts preserved; evidence JSON valid; git diff --check PASS; index empty. Documentation-size warnings were advisory and no required content was pruned. No new migration file exists; the original candidate hash remains unchanged.

