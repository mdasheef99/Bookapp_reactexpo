# Manual-note forward correction plan

Date: 2026-10-11 (Asia/Calcutta)
Last verification: 2026-10-18; [connected enablement receipt](./evidence/sdd06-note-save-enablement-2026-10-18/README.md); [immutable application/readback receipt](./evidence/sdd06-forward-correction-application-2026-10-17/README.md)
Status: applied once as 20261017083830; bounded connected acceptance complete and four source gates enabled 2026-10-18; full native/release acceptance pending
Work unit: library_sdd06_note_saving_enabled_connected_verified
Behavior: [SDD-06](./SDD-06-after-book-entry-ui.md), revision 0.4 baseline retained
Evidence: [actual applied SQL](./evidence/sdd06-live-session-review-2026-10-11/live-migration.json); [2026-10-17 baseline catalog](./evidence/sdd06-forward-correction-local-2026-10-17/fresh-catalog.json); [2026-10-17 FK enforcement readback](./evidence/sdd06-forward-correction-independent-2026-10-17/fk-trigger-readback.json). These are recorded verification receipts; documentation reconciliation does not claim a new database read.

## 1. Authorized work and next boundary

**Current 2026-10-18 handoff:** Owner requested enabling saving. [Connected receipt](./evidence/sdd06-note-save-enablement-2026-10-18/README.md) records actual signed-in PostgREST and normal UI persistence, CAS, bounded security/reconciliation checks and exact synthetic cleanup. Four default gates are true. No correction/replay/new migration or deployment occurred; full native/release acceptance remains open. The prior owner stop and preparation procedure below are historical and do not describe current capability availability. Completed task next action is use of the enabled local journey, with remaining acceptance tracked separately.

Current authority/completion: owner explicitly approved the DB correction and stopping afterward. The exact reviewed file was applied once via MCP as **20261017083830** and read back with matching SHA256 `fd6b6e074260888a5f636652fdd01785a99304c3065bd5ab46458a5e094d1305`. Application-only scope is complete. No connected business test/cleanup, source gate enablement, unrelated DDL or Git publication is authorized; stop. Earlier creation-only permissions below are historical. The applied file is now immutable; do not replay/edit/split it.

Owner “ok proceed please” follows the review's exact next action: bounded local delete-test corrections plus a forward-correction plan. The three regressions are restored with explicit simulated authorization, production delete/save gates stay false, and the plan below is reviewable.

On 2026-10-17, following the existing-harness 17/17 verification, the owner said “ok proceed” to the explicit request: “May I now create the local forward-correction migration and its bounded tests?” This resumes only local correction-file creation and isolated verification. Neither existing migration artifact is modified. Shared DDL, live test notes/cleanup, gate enablement and Git publication remain excluded under [AGENTS.md](../../../AGENTS.md). The [CLI-unavailable preflight](./evidence/sdd06-live-session-review-2026-10-11/LOCAL-CORRECTION-PREFLIGHT-2026-10-11.md) is historical: a fresh search found cached CLI 2.116.0, inspected its help and generated the new file without installation.

## 2. Exact baseline and preserved artifacts

Target: ahntbtktjjmvfosgkmgn / Bookconnect_reactexpo, ACTIVE_HEALTHY, ap-southeast-2, PostgreSQL 17.6.1.063. Reverified with Supabase MCP before preparing this plan. Both Library and sibling Clubs trackers were read; only this worktree was edited.

Live ledger: 20261010221843 library_manual_note_persistence, SQL MD5 d187c32b7b0846e735d6696adff6a7ed. The original [applied-SQL snapshot](./evidence/sdd06-live-session-review-2026-10-11/live-migration.json) remains immutable evidence.

The local [reviewed candidate](../../../supabase/migrations/20261010172118_library_manual_note_persistence.sql) remains SHA256 eadd4d8a16d87801735ec59a101a95732a59e64e9902a576000b5cf0aafb291d. Its unmigrated-baseline checks make it unsuitable for replay. Its earlier 16/16 result applies to that artifact, not the live variant or a future correction.

Fresh baseline: ten note columns, nine validated constraints, four permissive PUBLIC-targeted owned-book policies, enabled RLS, one enabled invoker revision trigger with empty search_path and postgres owner, parent UNIQUE(id,user_id), and effective table-wide authenticated INSERT/UPDATE. The revision function leaves created_at writable on UPDATE. Anonymous table privileges are denied; default revision-function EXECUTE remains available to anon/authenticated/service_role. Word-helper definition/config and writer EXECUTE match the retained 500-word contract.

Aggregate integrity: two notes, no missing/foreign-owned parents, no null timestamps or invalid versions. No note body/identity/account/credential was fetched. This does not prove historical creation timestamps were never altered.

The 2026-10-17 analysis freshly reverified this project/catalog/SQL digest and aggregate, without writes. Generated SELECT-only inputs additionally confirm that `btrim(content) <> ''` accepts tabs/newlines/nonbreaking/ideographic spaces without meaningful text. The word helper rejects 501 ordinary/newline/nonbreaking/thin-space-separated words but accepts 501 U+FEFF-separated words; JavaScript counts 501. Repair server validation to match the complete existing client whitespace definition while retaining meaningful text and the 500-word limit. These are integrity defects, not evidence of cross-account access. No note was inserted or changed by the probes.

## 3. Smallest forward change

Supabase CLI generated [20261016194722_library_manual_note_privilege_revision_correction.sql](../../../supabase/migrations/20261016194722_library_manual_note_privilege_revision_correction.sql) using migration new library_manual_note_privilege_revision_correction. The filename uses the generated UTC timestamp. The active migration ledger records the new local artifact and hash; both old artifacts remain unchanged. One cohesive transaction preserves the atomic notes contract, so a semantic split would expose partial security/validation states; no arbitrary line-count split is warranted.

One transaction changes only the note revision function, four note policies, note/function grants and existing content-validation helper/CHECKs:

1. Replace library_manage_note_revision with the reviewed server-metadata logic: SECURITY INVOKER, empty search_path, schema-qualified statement_timestamp, INSERT version 1/null marker/server times, UPDATE OLD.version+1 and OLD.created_at, server updated_at, immutable id/user_id/user_book_id, same-marker clearing for unmarked legacy edits, and overflow failure.
2. Preserve the existing trigger's enabled definition and binding; no second trigger. Revoke direct revision-function EXECUTE from PUBLIC/anon/authenticated/service_role, as in the reviewed contract. Prove invoker-trigger execution still works in actual PostgreSQL after these revocations; do not grant broader execution to make a test pass.
3. Replace exactly the four verified historical policies with library_note_select_owned_book, library_note_insert_owned_book, library_note_update_owned_book and library_note_delete_owned_book. Target authenticated; require user_id=(SELECT auth.uid()) and an accessible parent with matching id/user_id. UPDATE has both USING and WITH CHECK.
4. Remove PUBLIC/anon/authenticated table and column privilege layers on reading_notes, then grant only the matrix below. Preserve intentional service_role table access and required word-helper execution; align its body as below.
5. Fail final effective-privilege/catalog checks if inherited grants or any remaining drift defeat the target. Do not alter shared role memberships/default privileges to make the migration succeed.
6. Repair nonempty/word validation using one explicit contract matching client whitespace, including U+FEFF. Cover all-whitespace rejection and complete 500/501 boundaries without changing the limit. Revalidate existing records under repaired semantics within the transaction; changing a CHECK's helper alone does not recheck stored rows. Stop on incompatibility rather than trimming/deleting/backfilling. Keep the old helper-body precondition as an exact baseline guard, then verify the intentional corrected body/CHECK targets in postconditions.

| Role/command | Target |
|---|---|
| authenticated SELECT / DELETE | Table grant, constrained by owned-book RLS |
| authenticated INSERT | id, user_id, user_book_id, content, tag, page_number |
| authenticated UPDATE | content, tag, page_number, last_operation_id, updated_at |
| authenticated metadata/identity | No version/created_at INSERT or UPDATE; no identity UPDATE |
| anon / PUBLIC | No note table or column grants |
| service_role | Existing intentional table access retained; invoker trigger still enforces identity/version metadata |
| revision function | Browser/trusted application roles have no unnecessary direct EXECUTE |

updated_at stays insert-denied and update-allowed only for the retained legacy service payload; the trigger overwrites it. SELECT remains table-wide, so existing select('*') consumers are preserved. [Supabase column privileges](https://supabase.com/docs/guides/database/postgres/column-level-security) explains why revoking only column privileges cannot override table grants.

Keep category/page constraints, both ownership FKs, parent key, note IDs/content/tags/pages, existing version/marker values and indexes unchanged. Retain meaningful-text/500-word semantics while repairing their validation definitions above. No business-row UPDATE/backfill/delete, version reset, history table, recovery journal, numbering, OCR/cloud or unrelated parent/marketplace changes. This prevents future creation-metadata changes; it cannot reconstruct previously altered timestamps.

## 4. Preconditions and failure behavior

Use a bounded transaction with local five-second lock timeout and thirty-second statement timeout. Freeze the affected note/parent boundary while checking integrity and replacing its security contract; fail on lock timeout rather than extending it silently.

Before any replacement, match the fresh baseline:

- Exact ledger version/name/stored-SQL digest, with no second note-persistence version substituted.
- Full column inventory/types/nullability/defaults, all nine constraint definitions/validation, parent owner key and RLS.
- All twelve internal RI triggers for the retained three notes FKs: exact referencing/referenced relation, event, PostgreSQL enforcement function and enabled state. Constraint validation alone does not prove active enforcement. Reject disabled/replica-only actions without enabling or repairing them; generated names/OIDs are not portable baseline identifiers.
- Exactly four policies: complete name/command/role/permissiveness/USING/WITH CHECK. Reject added, stricter or modified same-name policies; never silently replace drift.
- Exactly one enabled noninternal trigger, expected function binding, and complete function definition/signature/language/invoker/search_path/owner/execution attributes. A matching ledger alone cannot prove the current function remains unchanged.
- Retained word-helper body/signature/execution attributes and effective writer EXECUTE.
- Actual grants/effective privileges and anonymous/authenticated role properties; reject unexpected inherited write or bypass authority.
- No missing parents, foreign owners, invalid versions or incompatible metadata. Stop for a separately scoped data-remediation decision; do not repair business rows here.

Dynamic postconditions verify target policy names/authenticated roles, constraint counts/validation, enabled trigger binding, invoker/search-path properties and the full effective allowed/denied privilege matrix. Literal target expressions/bodies and retained constraints are source-reviewed and exercised by isolated role/preservation tests; the dynamic guard does not repeat every target definition comparison. The independent review records that additional verification as a deferred minor, not proof of wrong DDL. Exact target live readback remains required before release. Any migration failure rolls the entire correction back to the previous variant; it is not broadly idempotent against an unexpected already-corrected state.

## 5. Disposable verification before shared application

Use the existing loopback PostgreSQL 17 runtime and synthetic roles/accounts/books/notes. No remote URL or credential, dependency install or sibling worktree edit. Install the projected historical baseline, apply the exact stored live variant, then apply the new correction. Do not begin from the already-correct reviewed candidate.

| Test | Required evidence |
|---|---|
| RED against live variant | Effective authenticated metadata privileges and owner-created_at mutation violate the target before correction |
| Exact upgrade / preservation | Synthetic record identities, bodies/tags/pages/version/marker/timestamps and existing constraints unchanged by correction |
| Narrow privileges | Real authenticated legal INSERT/UPDATE/DELETE work; forged metadata/identity and dangerous privileges denied; anon/foreign actor/foreign book denied |
| Trigger compatibility | SQL-role writes still work after function EXECUTE revocation; trusted UPDATE preserves created_at/identity, increments once, controls times/marker and rejects overflow |
| Category/validation | All five/null categories; invalid tags; optional positive page; ASCII/Unicode all-whitespace rejection; complete client-whitespace 500/501 boundaries including U+FEFF; existing rows revalidated without alteration |
| Concurrency | Two actual connections contend at the same version; exactly one wins; stale edit and compared-version replacement rejected |
| Reconciliation / legacy | Stable UUID duplicate cannot add a second row; exact marker evidence remains positive; unmarked legacy writes clear markers and invalidate stale versions |
| Parent / deletion | Existing owner binding, cascades and deletion cache tests remain; parent ownership changes cannot strand notes |
| Guard drift / rollback | Independent changed-function/policy/grant/column/constraint/word-helper scenarios reject and preserve the full original variant |
| Client regression | Current full focused scope and scoped TypeScript pass with four production gates false |

Record actual results and hash. A projected SQL fixture remains distinct from real Supabase Auth/PostgREST and native acceptance. Do not mark planned tests complete.

## 6. Shared application and subsequent release gates

The procedure below was completed for the exact reviewed artifact; it is retained as execution context, not an instruction to reapply. Actual version/evidence: [application/readback receipt](./evidence/sdd06-forward-correction-application-2026-10-17/README.md). Core catalog/grant/function/constraint/policy/FK checks and exact SQL hash PASS. Advisor baseline timed out and no lint PASS is claimed; no business-row digests or connected write tests were performed. The owner stop boundary is now reached.

After candidate review and separate application authorization, reverify the exact project, both trackers, current catalog/integrity and ledger. Apply only the reviewed forward file via MCP; no blanket db push, replay of the old candidate or direct-SQL repair. Capture the actual assigned live version and compare the submitted SQL with the local artifact, then read back schema/policies/effective privileges/function/trigger/advisors. If the result differs, keep gates closed.

Separately authorize account-owned synthetic connected test writes and cleanup. Verify real Auth/PostgREST five/null round trips, returned-row/zero-row CAS decoding, concurrent/stale edits, committed-response-loss reconciliation and honest missing/intervening/deleted outcomes, owner/foreign/anonymous denials, abort/account switching and retained consumer behavior. Native visual/navigation/keyboard/large-text/TalkBack acceptance remains required for the manual slice.

Four source gates stay false until matching receipts and explicit enablement authority exist. SQL-role fixtures and catalog readback alone do not establish these release checks. Existing capture/OCR implementation and its acceptance remain separately recorded; this DB application authorizes no additional capture work.

## 7. Risks and exact next action

DDL locks and grant changes affect the shared notes boundary, including retained legacy consumers; use the bounded timeouts and compatibility matrix. Parent and other-feature schema/grants remain unchanged. If inheritance, concurrent catalog changes or incompatible data defeat the preconditions, stop with the observed evidence rather than broaden this migration.

The existing ID-only exported legacy updater is not made CAS-safe by this correction; active manual routes must continue to use the versioned adapter. Current-row markers are not durable operation history, and no draft survives restart by virtue of this work.

Historical units completed preparation and independent RED/GREEN correction, with 34/34 local PostgreSQL cases. The separately authorized application is now complete as **20261017083830**, exact stored/local SHA256 verified. Source and gates are unchanged; prior client/SQL/runtime tests were not rerun for this application-only stage. Exact next action: **stop per owner instruction**. Connected tests/cleanup, enablement and release verification require a new scoped instruction. No remaining application authority is implied by this plan.

