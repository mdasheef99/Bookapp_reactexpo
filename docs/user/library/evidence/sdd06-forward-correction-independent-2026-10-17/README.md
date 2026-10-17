# Fresh independent persistence review and confirmed correction

**Later application checkpoint:** the exact reviewed/corrected artifact was subsequently authorized and [applied/read back](../sdd06-forward-correction-application-2026-10-17/README.md) once as **20261017083830**, with exact SQL SHA256 match. This receipt's pre-application results remain historical. The owner required stopping after application; four source gates remain false and no connected write tests/enablement were authorized.

Date: 2026-10-17 (Asia/Calcutta).
Work unit: `library_sdd06_forward_correction_independent_fix_verified_live_held`.
Status: independent review, parent confirmation and bounded correction verified; live application/gates held.

## Authority, scope and independence

Owner requested a spawned, independent, thorough review, then confirmation before corrections. This authorizes local investigation and bounded corrections, not shared Supabase application, connected business test writes/cleanup, write-gate enablement, installation or Git publication.

A fresh GPT-6 Astra/high reviewer was spawned with `fork_turns=none`: exact files, requirements and immutable applied SQL, without this conversation or prior review conclusions. It independently read source/fixtures/consumers and did not consult the previous REVIEW.md. It made no file or database changes and did not duplicate the parent's full suite. Parent independently ran the baseline suite **31/31 PASS**, exit zero, 78.871 seconds, then reproduced the finding before changing the migration. Agent conclusions and parent executable proof are separated below.

Checkout: C:/Users/LEGION/Desktop/Bookconnect4_library, branch codex/library-cover-shelf, HEAD 1b743a13328ec30280a524aaeea15e364fc3d6c5. Existing mixed dirty work preserved; sibling Clubs tracker read and sibling worktree untouched. Marketplace Phase9 / Unit7C M46 / DOC-13 / ACTIVE remain unchanged.

Reviewed artifacts:
- Forward SQL SHA256 `8df3518384fcd7d38709fc472a47bcecf71d66c88468270f962bdbb06880cab1`.
- Harness SHA256 `d74b6de3a6c944aca39bdd1af1cbe479a389d489c00add7a2730b610477160ff`.
- Baseline fixture SHA256 `39193b852d45ec5ee2db2f7f565e8a691e76cd9dbda484ee5a1ee3b4da972441`.
- Actual applied SQL snapshot: version 20261010221843, MD5 d187c32b7b0846e735d6696adff6a7ed. Old candidate 20261010172118 is not replayed or changed.

## Independent finding FKR-01 — P2, confirmed and corrected

Original lines 39–43, 56–58 and 75–80 checked FK definitions/validation and only noninternal note triggers. Disabling an internal referential-integrity trigger leaves the FK definition and convalidated flag unchanged. The migration therefore accepted that enforcement drift.

Reviewer provided a precise source-backed reproduction, explicitly unexecuted by the reviewer. Parent then ran it on the exact applied variant in a disposable database:
1. Disable only the composite FK's parent UPDATE action trigger.
2. Submit the unchanged forward correction: it incorrectly commits.
3. Change the synthetic parent owner: it succeeds and leaves **one ownership mismatch**.
4. Required rejection assertion fails, exit 1. [Raw RED](./fk-guard-red.txt).

This requires pre-existing privileged catalog drift. It is not evidence of an unprivileged escalation on the healthy baseline. Fresh MCP verifies the exact project and all **12** internal triggers on the three notes FKs are currently enabled in origin mode. No live trigger was disabled, and no live row was read or changed.

After reporting confirmation to the owner, parent added a bounded precondition:
- Locate each retained FK through its constraint and referencing/referenced relation.
- Require four matching internal actions by table, INSERT/UPDATE/DELETE event and PostgreSQL RI function.
- Require the verified enabled state `O`; do not depend on generated names/OIDs.
- Abort before replacements on missing/disabled/replica-mode enforcement. Never enable or repair triggers automatically.

## Associated coverage correction

Rollback snapshots now include internal FK trigger states, parent rows/security/policies and migration-ledger contents, in addition to existing note rows/ACLs/functions/policies/constraints/indexes. Upgrade preservation explicitly compares these new snapshots.

New regressions:
- Original disabled-parent ownership reproduction.
- Disable each of the twelve retained FK actions/checks independently, plus replica-mode drift; reject and preserve the exact drifted snapshot.
- Corrected-variant book/account deletion cascades still work; each local transaction is rolled back.
- Targeted run **3/3 PASS**, exit zero; [raw GREEN](./fk-guard-green.txt).

Expanded coverage needs 27 forward fixtures; the old single-letter suffix would produce `library_forward_{` at fixture 27. A direct diagnostic confirmed it violates the existing identifier assertion. The harness now uses an internal numeric counter with its fixed library prefix and a letters/digits/underscore-only identifier check. It still accepts no remote URL, untrusted identifier or credential.

## Other review checks and boundaries

The reviewer traced actual applied upgrade, metadata/identity/revision/marker/overflow logic, actual-write CAS predicates, legacy payload compatibility, table/column grants/options/default privileges/inheritance, helper EXECUTE retention, trigger execution, bounded locks/transactions, exact JS25 whitespace including FEFF/excluding NEL, rebuilt CHECK validation and helper consumers. No other product defect was identified.

The previously documented optional exact-target postcondition extension remains deferred: dynamic assertions do not duplicate every literal expression/body, while source review, role/preservation tests and required later live readback provide the present evidence. No new product behavior, field, recovery/history, OCR integration, cloud feature or UI work is introduced.

Fresh MCP metadata only: exact project ACTIVE_HEALTHY / PG17.6.1.063; applied ledger unchanged; revision/helper definition digests unchanged; helper's cataloged CHECK dependency is only reading_notes_500w_check; both tables retain RLS/postgres ownership. No business bodies/identities, aggregate recount or credentials fetched in this unit.

## Final verification and next boundary

Final [corrected SQL suite](./postgres-final.txt): **34/34 PASS**, exit zero, 95.544 seconds, including successful checked cluster cleanup. Seventeen historical cases and seventeen forward cases; three permanent cases were added in this unit. All twelve disabled enforcement variants plus replica-only drift are rejected with unchanged expanded snapshots. Concurrency/ACL/whitespace/data compatibility/lock timeout/injected-failure tests remain green.

| Final artifact | SHA-256 |
|---|---|
| New correction SQL, 313 cohesive lines | `FD6B6E074260888A5F636652FDD01785A99304C3065BD5AB46458A5E094D1305` |
| Expanded PostgreSQL harness | `53F1BC8BE2A53E22A027CB879E0C4C07F7AB7E72B166568A9CBBEC6C7E9477E2` |
| Unchanged old candidate | `EADD4D8A16D87801735EC59A101A95732A59E64E9902A576000B5CF0AAFB291D` |
| Unchanged applied-SQL snapshot | `43F02DBD5CA3CC38DF45EF4A5B028DC0EC3F3BB9E36626227871668EF146A5CB` |
| Unchanged production gateway/gates | `B8744B2D73B83278EE125CFAB0F3789EA887EB2F57E98B8AFA07EBDDCAACC37E` |

Historical client 222/222 and scoped TypeScript proof remains in the preceding receipt; neither was rerun here because app/TypeScript source is unchanged. No fresh web export, browser or native run. Real Auth/PostgREST, connected response-loss/account-switch verification and native acceptance remain unproved by local SQL-role fixtures.

Closeout verified: Phase9 continuity PASS (195 definitions, zero duplicate/missing traceability, regression probes PASS, 76 Markdown/55 required files), local links PASS across ten files/363 links, scoped/tracked whitespace PASS, final artifact hashes PASS, four write gates false and index empty. Raw results are in documentation-checks.txt and closeout-checks.txt beside this receipt. Existing size/line-ending notices are advisory. The 313-line correction remains one cohesive atomic write-boundary transaction; applied migration history was not split or edited. Larger existing trackers keep their existing audit responsibilities in this bounded unit.

All four production gates remain false. No app source, dependency, shared database/Storage/provider/account state, index, commit, branch, push or deployment changed. Local synthetic clusters only, stopped and removed by the harness's checked cleanup.

Exact next action after verified closeout: owner reviews the corrected artifact/evidence before separately authorizing exact-project MCP application/readback. Connected writes/cleanup, enablement and release acceptance remain separately scoped.

## Documentation reconciliation — 2026-10-17

Owner subsequently requested updated documentation. Reconciled the SDD-06 header/current unit, original persistence contract/release-security matrix, category rollout and forward-plan evidence pointers. Question/null schema support is already present in the recorded applied variant; four-gate closure reflects remaining safety/API/native acceptance. Old candidate-creation/question-only recipes and pre-correction results are explicitly historical. Library/Phase9/implementation trackers record this follow-up; current migration ledger/hash, product decisions, DOC-13 and ACTIVE remain unchanged.

Only Markdown and documentation-check output changed in this follow-up. No migration/test/application source, shared database/Storage/provider state, dependency or Git publication changed. No fresh database read or runtime suite is implied; the 34/34 result above remains the preceding executable verification. Documentation refresh closeout PASS: Phase9 continuity (195 definitions, zero missing/duplicate traceability, 76 Markdown/55 required files), all 378 relative links across twelve owning files, whitespace, unchanged SQL/harness/gateway hashes, four false gates and empty index. Raw results are documentation-refresh-checks.txt and documentation-refresh-links.txt; historical runtime/check logs remain unchanged. Current work unit and exact next authorization remain as stated above.
