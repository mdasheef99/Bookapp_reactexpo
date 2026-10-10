## 2026-10-10 - M71 forward correction application

M65-M70 below retain their original applied versions and source hashes. M71 was separately Owner-authorized, applied once as 20261010110835, and catalog-verified.
Read-only correction review APPROVED; application changed only the actual M70 private selection delegate. No historical migration file was rewritten or reapplied.
[M71 application ledger and detailed verification](02-implementation-and-verification.md) own this correction's exact evidence and recovery record.
Browser control now works; feature UI, compatible deployed runtime, provider permission and operational rollout remain pending.

# Owner Edition Picker M65-M70 Application Evidence

## 2026-10-09 - Independent approval and authorized application

**Status:** task8_independently_approved_m65_m70_applied_runtime_pending.
Owner authorization: "Ok proceed and complete 1 -3 please" covers recording
Task 8's independent LOCAL approval, live read-only preflight and application of
the six unchanged migrations. Backend deployment, provider calls/enablement,
browser/device testing and Git publication are outside this request.

Sources: [picker SDD §§6-11/13.2](../work-units/owner-edition-picker-sdd.md),
[SESSION-START §§5-8](../SESSION-START.md), [Task 8 evidence](33-owner-edition-picker-task8-local-verification.md).
Root: C:/Users/user/.codex/worktrees/edition-picker-research/Bookconnect.
Branch: codex/edition-picker. HEAD: ee3a8c79429ca401d468861f2861721082ba955e.
Starting status: 74 modified / 84 untracked / zero staged.

## Independent LOCAL approval recorded

The Owner supplied an independent APPROVED verdict with no actionable findings.
Reviewer reruns: native PostgreSQL 17/17 and 11 observed transactionid locks
between distinct connections; default U8B; Task 7 23 suites / 349 tests;
provider/worker/contracts 13 suites / 365 tests; SQL 187/187; worker build and
14/14 structural checks; whole/three strict types; continuity; syntax/whitespace.
Both test databases, clusters and temporary directories were removed.
All six migration hashes matched and the 158-file review snapshot was unchanged.
The reviewer did not reproduce the historical pre-Task-8 152-path preservation
audit because that baseline was unavailable. All nineteen active IDs have
bounded local evidence; EP-AC17 remains deferred. Earlier review provenance,
including Owner-accepted self-reviews, is preserved.
The reviewer disclosed one initial read-only Desktop-checkout access before the
restriction was visible; later work used the authorized worktree.

These are independently reported LOCAL results, not tests rerun in this
migration-application session. No deployment/operational approval is inferred.

## Fresh live preflight

Supabase MCP verified Bookconnect_reactexpo / ahntbtktjjmvfosgkmgn,
ACTIVE_HEALTHY, ap-southeast-2, PostgreSQL 17.6.1.063.
Live history before application: 169 entries. Latest Phase 9:
M62 / 20260913162154. Unrelated overall tail:
clubs_primary_venue_write_authorization / 20261008091939.

No picker history, state relation, helper/delegate or planned-name collision.
Catalog reads captured affected columns, constraints/indexes, RLS/policies/ACLs,
trigger bindings and existing function definitions. All fourteen audited public
relations have RLS enabled. Original candidate-wide attempt uniqueness exists;
both future partial-index duplicate checks return zero. Required function/type
and representative-cover dependencies are present; absent referenced names are
only planned new objects/renamed delegates, including M70's schema move.

Before counts: 173 candidates, 21 inventory, 1 canonical edition,
167 lookups, 123 attempts, 274 jobs. No active metadata/media/vision/publication
claim was observed. Nine staging_cleanup jobs are open; dispatcher remains
scheduled every minute and existing wake behavior must stay compatible.

Provider registry is enabled/matching/storage=true for existing automatic
behavior. Those flags do not grant retention permission for new alternatives
or the chosen snapshot. The new production retention verifier remains absent/
disabled. No registry/configuration/key was changed or provider call made.
Local configuration inspection emitted only the .env.example URL host field
(empty); no credentials were printed. Matching deployed app/worker configuration
remains a later runtime gate.

Security/performance advisors were captured as a baseline. Existing RPC-only
tables with RLS and no policy require grants-based interpretation. Unrelated
existing advisories are retained, not repaired as part of this application.

## Migration ledger

Each unchanged file contains its own BEGIN/COMMIT. Supabase apply_migration
was called sequentially and each catalog/history result was verified.
No bulk push, M63/M64 application, unrelated club migration or new SQL file.

| Local file | Checkpoint SHA-256 | Live version/status |
| --- | --- | --- |
| 20261007000065_marketplace_phase9_edition_picker_state.sql | 798A2B2D5722D40044FAD5FB4011FCED1D56F558FE05C3E44F0AA5EAB21EB9A3 | 20261009080319 / APPLIED_VERIFIED |
| 20261007000066_marketplace_phase9_edition_picker_commands.sql | 788662FA3BC60CD20F98BB350C13B5BA34F38DBC80F0C42AAE0678A71FA13BE7 | 20261009080812 / APPLIED_VERIFIED |
| 20261007000067_marketplace_phase9_edition_picker_operation_fences.sql | 66654B8C9E35586BFB8A3BA4395DC9F2660F6CD36AB1104247196847849025AC | 20261009080831 / APPLIED_VERIFIED |
| 20261007000068_marketplace_phase9_edition_picker_worker_completion.sql | C591686FA414B76635C55EADA59DC2172B0F885362606654C5886C5B11A85C5A | 20261009081039 / APPLIED_VERIFIED |
| 20261008000069_marketplace_phase9_edition_picker_commit_cleanup.sql | 008F9EBB8CDF3288053B10FFCF2A50DB36D96807A0B42787D89339EAE79E0CDE | 20261009081057 / APPLIED_VERIFIED |
| 20261008000070_marketplace_phase9_edition_picker_confirmation.sql | CBC63A03BF92A7609B4997B80C7CA3BB36C70D0568613D4D56CA76EDE230AF3C | 20261009081205 / APPLIED_VERIFIED |

## Compatibility and recovery

The automatic worker context retains its original response shape; explicit
purpose handling is isolated to new operation_version. Existing public Owner
read/Save/Add/worker signatures remain. New edition DTOs and M70 confirmation
need compatible Edge/client deployment before exposing the picker.
Live Owner Edge inventory: phase9-owner-ingestion v14, verify_jwt=true.
No Edge/worker/app is deployed in this scope.

M65-M70 expand state/contracts while preserving existing inventory/candidate
records. M67 replaces one uniqueness constraint with operation-scoped indexes.
M68/M69/M70 retain legacy implementations as private renamed delegates.
No catalogue cleanup or data deletion is authorized.

Preferred recovery: keep compatible SQL/readers/Add support and disable new
lookup/UI exposure; preserve held choices and inventory. After a failed
migration, read history/catalog before retry: CREATE/RENAME is not blindly
idempotent. If a later file fails, record the applied prefix and stop.
Captured original function definitions/grants support a separately reviewed
forward repair; no down migration or destructive contraction is executed.

## Session verification and actual mutations

Local migration hashes match the independently approved checkpoint.
Approval and current application authority are recorded in the handoff owners.
Completed: per-migration tool success, live versions, definitions/signatures,
table ACL/RLS/constraints, trigger/index readback, advisor delta and documentation
closeout. Live data fixtures, worker wake/provider calls and browser tests are
outside this bounded migration application stage.

Shared mutations: M65-M70 applied and verified; details below.
Exact next action: Owner authorization of compatible runtime and provider-gated browser verification.

Remaining gates: compatible deployed Edge/worker/client, configured-provider
retention rights/cache deadlines for alternatives AND selected metadata,
Codex browser/device accessibility, live Save/Add/recovery/cleanup/security,
operational lookup/UI disablement/rollback and controlled rollout.

## M65 applied and verified

Live version: 20261009080319. Supabase apply_migration succeeded. Stored migration
statement SHA-256 equals the local approved file. Nine function bodies match
exactly; helper execute grants deny anon/authenticated/service_role; private
state has RLS and no direct role access. Four new identity constraints are
validated. State rows remain zero and candidate/inventory/canonical/lookup/
attempt counts are unchanged.

## M66 applied and verified

Live version: 20261009080812. Tool application succeeded; stored statement
SHA-256 matches the approved file. 13 current function bodies match the
approved SQL; ownership/search_path and authenticated/service/private grants
pass. State remains empty with RLS/no direct role access; candidate/inventory/
canonical/lookup/attempt counts are unchanged. Three public commands grant authenticated-only execute.

## M67 applied and verified

Live version: 20261009080831. Stored statement SHA-256 matches the approved
file. All 20 current function bodies and grants match. Three edition indexes
are valid; original candidate-wide attempt constraint is removed. The identity
trigger is enabled. State remains empty and business row counts are unchanged.
The first readback assertion incorrectly expected direct service-role execution
on the private structural-candidate helper. Its original captured ACL and live
ACL both deny that role; the verification expectation was corrected. No grant
or migration was changed, and M67 was not reapplied.

## M68 applied and verified

Live version: 20261009081039. Tool application and exact stored statement
SHA-256 pass. 39 function bodies match approved SQL; postgres ownership,
empty search_path and Owner/worker/private grants pass. New/legacy helpers
remain denied to client/service roles. Failure receipt, three valid indexes,
all five edition triggers and existing representative-cover binding are present.
No invalid constraints; state remains empty and business row counts unchanged.


## M69 applied and verified

Live version: 20261009081057. Tool application and exact stored statement
SHA-256 pass. 52 function bodies match approved SQL; postgres ownership,
empty search_path and Owner/worker/private grants pass. New/legacy helpers
remain denied to client/service roles. Failure receipt, three valid indexes,
all five edition triggers and existing representative-cover binding are present.
No invalid constraints; state remains empty and business row counts unchanged.
The existing minute dispatcher points to the new cleanup wrapper while its original implementation is retained privately. No scheduler invocation or configuration change was made.

## M70 applied and final prefix verified

Live version: 20261009081205. All six stored migration statement SHA-256 values
match the unchanged approved local files. All 52 current function bodies
match; postgres ownership/empty search_path and Owner/worker/private grants pass.
All 38 private edition/automatic delegates deny direct client/service
execution. State remains empty; no invalid constraints; business counts unchanged.
The confirmation reader and selection reply wrappers match M70, including
current server-held confirmation on old replay receipts without rewriting them.

## Final application readback and advisor delta

All six live versions are verified in Supabase history, now 175 entries.
All stored migration SQL SHA-256 values equal the approved local files.
All 52 current migration-created/replaced function bodies match the approved
SQL (line-ending normalization only). Owner/worker grants, postgres ownership
and empty search_path pass. All 38 private edition/automatic delegates deny
anon/authenticated/service_role direct execution. State RLS/direct-role
restrictions, three valid indexes, validated constraints and five edition
trigger bindings pass. The representative-cover trigger and every-minute
dispatcher schedule/command are unchanged; no dispatcher was manually invoked.

A read-only projection over 173 existing cards returned 47 non-null suggestions;
all 47 expose a boolean confirmedByOwner. The normalized validator rejects an
empty malformed object. Legacy choices/select delegates remain present.
No new edition-state row was created. Business counts remain:
173 candidates, 21 inventory, 1 canonical edition, 167 lookups, 123 attempts.
Project remains ACTIVE_HEALTHY.

Advisor comparison:
- RLS-without-policy increased 70 to 71 for the new intentionally RPC-only
  state table. Direct table access is denied for all client/service roles.
  [Advisor explanation](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).
- Authenticated SECURITY DEFINER notices increased 151 to 154 for the three
  intended Owner commands. Their Owner scope checks and authenticated-only
  grants match approved SQL; anon/service access is denied.
  [Advisor explanation](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).
- Four new foreign-key indexing notices (153 to 157) and the empty table's
  unused-index notice (61 to 62) are nonblocking performance observations,
  recorded without unapproved index changes.
  [Foreign-key index guidance](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys),
  [unused-index guidance](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index).
- Existing mutable-search-path notices, public PostGIS/spatial_ref_sys and other
  baseline notices are unchanged. No new anon-executable definer notice appears.

## Preservation, deviations and closeout

Captured original definitions/grants/constraints/triggers and cron metadata:
ignored local .phase9-dist/edition-m65-m70-preflight-definitions.json
(132728 bytes; 17 private definitions plus original public Add definition).
This supports reviewed forward repair; no destructive rollback was executed.

A 1458-file nonignored snapshot was captured for non-document preservation.
Its collection overlapped the first approval-document batch, so it is not
represented as an untouched initial hash baseline for every document.
Only authorized documentation changed; historical document content was
preserved by bounded overlay insertion/replacement. Source/test/dependency/
migration hash comparison and final whitespace/continuity evidence are recorded
at session closeout. All non-document preservation claims use that snapshot.

Local document writing encountered a mapped-file restriction and a null-backup
argument error before replacement; atomic replacement with a named temporary
backup completed the updates and removed temporary files. A Windows glob read
was retried with rg's supported -g filter. M67's initial ACL assertion expected
a private helper to be service-executable; its captured and live ACLs both deny
that role. The assertion expectation was corrected without any grant change.
No migration failed or was reapplied.

Fresh verification in THIS session: live preflight/catalog/history, exact
migration/source/grant readbacks, read-only confirmation/validator probes,
advisor comparison, project status and documentation/preservation checks.
The independently approved Jest/SQL/native concurrency/type gates were not
rerun after application; no new product code or migration byte changed.
No live Owner Save/Add fixture, provider response, browser/device, deployed
worker restart or operational rollback is represented as tested.

Shared mutations: exactly six authorized schema migrations, M65-M70, on the
verified project. No application data/configuration/Storage mutation, Edge/
worker deployment, provider request, catalogue deletion or Git publication.
Preferred disablement retains compatible readers/Add/held selections/inventory.

Remaining gates: matching Edge/worker/client deployment, configured-provider
retention permission/cache deadlines for alternatives AND chosen metadata,
Codex browser/device accessibility and interactions, live Save/Add/recovery/
cleanup/security, operational lookup/UI disablement/rollback and rollout.

## Final documentation and preservation verification

Fresh final preservation checked all 1458 snapshotted nonignored paths.
All 1437 original paths outside the 21 authorized documentation files remain
byte-identical; no original file is missing. This preserves earlier product
source, tests, dependencies and all migration files. The only new nonignored
path is this application ledger. The snapshot's document-capture timing
limitation described above is preserved; no untouched-document baseline is
claimed for that initial overlapping batch.

The six local migration SHA-256 values again match the approved checkpoint.
Final Supabase project/history readback confirms ACTIVE_HEALTHY and all six
recorded picker versions in the 175-entry history.

Fresh Phase 9 continuity validator: exit 0 / PASS, 195 requirement definitions,
zero duplicates or missing traces, 92 Markdown files / 62 required phase files.
Fresh git diff --check: exit 0 / PASS. Scoped whitespace/conflict-marker checking
of all 22 changed/new documentation paths: zero findings. Existing line-ending
and document-size advisories remain nonblocking. Local ignored logs and
preservation evidence are under .phase9-dist/edition-m65-m70-*.

Final Git: codex/edition-picker at ee3a8c79429ca401d468861f2861721082ba955e;
74 modified / 85 untracked / zero staged, including all earlier implementation
work. This application session changed 21 existing documentation files and
added one documentation ledger; no production source/test/migration was edited.
Nothing was staged, committed, pushed or deployed. No Python tests ran.

Exact next action: Owner review/authorization for compatible development
Edge/worker/client rollout and provider-gated browser verification (step 4).
