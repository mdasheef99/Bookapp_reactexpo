# Local forward-correction execution ledger

**Historical candidate checkpoint:** the later [fresh independent review and confirmed fix](../sdd06-forward-correction-independent-2026-10-17/README.md) supersedes this receipt's current-artifact hash/status. Results below remain evidence for the earlier 287-line candidate; current SQL is 313 lines with an additional FK-enforcement guard and 34/34 SQL verification. Original result logs are unchanged.

Date: 2026-10-17 (Asia/Calcutta)
Plan: [bounded correction plan](../../MANUAL-NOTE-FORWARD-CORRECTION-PLAN.md)
Work unit: `library_sdd06_forward_correction_local_verified_live_held`
Status: local correction and bounded review fix complete; shared application and gate enablement held.

## Scope and authority

Owner “ok proceed” explicitly followed the request to create one local forward-correction migration and bounded isolated tests. No shared application, connected test writes, gate enablement, installation, staging, commit, push or deploy is authorized in this unit. Marketplace Phase 9 / Unit7C M46 / DOC-13 / ACTIVE remain unchanged. Both worktree trackers were checked; sibling files are untouched.

Checkout: C:/Users/LEGION/Desktop/Bookconnect4_library, branch codex/library-cover-shelf, HEAD 1b743a13328ec30280a524aaeea15e364fc3d6c5. Existing mixed dirty files are preserved. Four production write gates remain false.

## Execution record

1. Fresh MCP project/catalog verification matched ahntbtktjjmvfosgkmgn / Bookconnect_reactexpo, ACTIVE_HEALTHY, PostgreSQL 17.6.1.063 and applied version 20261010221843 / SQL MD5 d187c32b7b0846e735d6696adff6a7ed. Metadata only; no note bodies or identities read.
2. Found an already-cached official Supabase CLI 2.116.0; inspected migration-new help and generated [the new file](../../../../../supabase/migrations/20261016194722_library_manual_note_privilege_revision_correction.sql). No dependency installed. Filename is the CLI-generated UTC timestamp, not a fabricated local-date timestamp.
3. Added an exact-applied-variant regression before implementing SQL. RED: authenticated created_at UPDATE privilege was true, expected false. Process exit 1. After implementation, the same selected regression passed 1/1, exit 0.
4. Correction: preserve creation time/server revisions; narrow column writes; authenticated owned-book policies; revoke direct trigger-function execution; exact JavaScript whitespace validation with existing-row revalidation. No business-row repair. Baseline fingerprints reject drift. Five-second lock timeout and transactional rollback remain required.
5. Final [PostgreSQL output](./postgres-tests.txt): **31/31 PASS**, exit zero, 62.882 seconds including checked stop/removal of the owned loopback cluster. Seventeen retained historical cases plus fourteen forward cases. Every forward case starts from the exact applied SQL in an independently seeded database, not the reviewed old candidate. Covers all 25 client whitespace 500/501 boundaries, NEL distinction, blank text, all categories/null/page validity, narrow grants, trusted trigger execution, exact row/index/marker preservation, concurrent CAS, stable UUID/legacy markers/overflow, catalog/ACL drift, stored-text rejection, injected failure and real five-second lock timeout.
6. [Client output](./client-tests.txt): **17 suites / 222 tests PASS**, exit zero, 24.169 seconds. Scope: notes domain, mounted manual/capture flows, crop/editor, notes/OCR/Saved Pages services and word cap. Existing punycode/Clipboard deprecation warnings; no client code changed. Scoped `npx --no-install tsc --noEmit -p tsconfig.library-notes.json` passed, exit zero, no diagnostics. Full repository compiler/Jest/browser/native were not run; no new UI behavior in this unit.
7. [Independent review](./REVIEW.md): no Critical finding, one Important explicit-ACL/grant-option guard gap confirmed through four RED cases, then fixed in one bounded pass. Final full SQL suite above is GREEN. One minor additional exact-target postcondition extension is deferred; current literal DDL, static review and role/preservation tests remain the target evidence, and exact live readback stays mandatory.

The first full run was 27/28 because `DEFAULT NULL` was not an actual default change in PostgreSQL; the effective baseline remained unchanged. Replaced that ineffective fixture mutation with `DEFAULT 'quote'`. [Initial output](./postgres-initial-run.txt) and [pre-review 30/30 output](./postgres-pre-review-green.txt) are preserved rather than presenting the final run as the first attempt. The independent-review [four-variant RED](./review-privileges-red.txt) is retained separately. No production guard was weakened to pass a test.

## Identity and closeout

| Artifact | SHA-256 |
|---|---|
| New correction SQL | `8DF3518384FCD7D38709FC472A47BCECF71D66C88468270F962BDBB06880CAB1` |
| Final PostgreSQL harness | `D74B6DE3A6C944ACA39BDD1AF1CBE479A389D489C00ADD7A2730B610477160FF` |
| Old reviewed candidate, unchanged | `EADD4D8A16D87801735EC59A101A95732A59E64E9902A576000B5CF0AAFB291D` |
| Immutable applied-SQL snapshot, unchanged | `43F02DBD5CA3CC38DF45EF4A5B028DC0EC3F3BB9E36626227871668EF146A5CB` |
| Production gateway/four gates, unchanged | `B8744B2D73B83278EE125CFAB0F3789EA887EB2F57E98B8AFA07EBDDCAACC37E` |

[Fresh catalog](./fresh-catalog.json), [catalog fingerprints](./baseline-fingerprints.json), [explicit privilege baseline](./privilege-baseline.json) and [CLI creation result](./cli-creation.json) record the read-only inputs. Both worktree trackers were checked; sibling feature untouched. Migration is one cohesive 287-line transaction, below advisory size levels; no applied migration was split or edited.

Closeout PASS: Phase9 continuity (195 definitions, zero duplicate/missing traceability, regression probes PASS, 76 Markdown/55 required phase files), local links, tracked/untracked whitespace checks and final hash/gate checks. Size notices remain advisory; larger existing trackers retain their current responsibilities and immutable history in this bounded unit. Changes remain local and uncommitted; index empty. Local synthetic DDL/DML only; **no shared database/Storage/provider/account mutation**, dependency installation, staging, commit, push or deploy. Four production write gates false; no app source edited.

Exact next action: owner reviews this candidate/evidence before separately authorizing exact-project MCP application/readback. Reverify project, both trackers, complete catalog/integrity/ledger and final file hash first. Connected test writes/cleanup, enablement and native release checks remain separately scoped; do not enable saving solely from SQL-role results.

## Scope decisions

Use one cohesive atomic migration because validation, metadata, policies and privileges jointly define the notes write boundary. Splitting would expose partial contracts. The generated file is below the advisory documentation size range; applied migration history is untouched.

Execution-workflow adaptation: use this durable evidence ledger with the existing repository plan rather than generating parallel spec/brief documents. Local uncommitted files, rather than a commit range, are the review package because Git publication is outside authorization.

## Limits

Local SQL-role fixtures cannot prove real Supabase Auth/PostgREST, response-loss transport reconciliation or native acceptance. Those release gates, separate shared-application authorization and explicit enablement remain outstanding. No promise of historical timestamp repair or durable draft/operation history is introduced.
