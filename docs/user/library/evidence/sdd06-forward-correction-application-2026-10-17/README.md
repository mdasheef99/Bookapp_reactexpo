# Library forward correction — application and readback

Date: 2026-10-17 (Asia/Calcutta).
Work unit: `library_sdd06_forward_correction_applied_readback_complete_owner_stop`.
Status: applied once and exact-artifact/catalog readback verified; stopped at owner boundary, four gates closed.

Owner explicitly instructed: “ok proceed please stop after thea pplication of db correction”. Scope: one application of the reviewed correction plus read-only verification, then stop. No connected note create/edit/delete test or cleanup, source gate enablement, browser/native test, deployment or Git publication.

Target ahntbtktjjmvfosgkmgn / Bookconnect_reactexpo / ACTIVE_HEALTHY / PG17.6.1.063, verified via MCP. Both worktree trackers read. Library checkout codex/library-cover-shelf at HEAD1b743a13328ec30280a524aaeea15e364fc3d6c5; existing mixed edits preserved. Marketplace Phase9/Unit7C M46 and routing unchanged.

Exact [reviewed local SQL](../../../../../supabase/migrations/20261016194722_library_manual_note_privilege_revision_correction.sql):
- SHA256 `fd6b6e074260888a5f636652fdd01785a99304c3065bd5ab46458a5e094d1305`.
- Payload MD5 `ec5e6bfb4e89e845c26ab0cd00c36fb6`.
- 17285 bytes, original line endings retained; payload decoded directly from verified bytes.
- [Fresh independent review, confirmed correction and 34/34 local SQL proof](../sdd06-forward-correction-independent-2026-10-17/README.md).

Core preflight matches the applied ledger/digest, all six catalog fingerprints, twelve enabled internal FK actions, owner/RLS/parent key, anonymous/authenticated role properties/membership, column inventory and twenty table ACL entries. Application's in-transaction guards check integrity and revalidate content; they stop rather than repair incompatible rows.

Automatic approval review rejected an optional preflight computing business-row digests as outside authorized migration/readback scope. It was not executed. The safer completed preflight is catalog-only; no note/page rows or content-derived digests were fetched. No workaround was attempted.

The baseline security-advisor request timed out. An optional extra metadata query also returned a connection timeout. A subsequent minimal SQL connection/ledger check succeeded, confirming PG170006, known baseline20261010221843 and zero correction migrations. These errors are not successful checks; no application had been dispatched during them.

## Applied result

MCP apply_migration was dispatched **once**, with the exact reviewed bytes, and returned success=true. Assigned live version: **20261017083830**, name library_manual_note_privilege_revision_correction. No replay, direct-SQL repair or SQL-file modification occurred. The applied local file is now immutable history; any later correction requires a newly authorized forward migration.

Stored migration readback matches all 17,285 payload bytes by SHA256 `fd6b6e074260888a5f636652fdd01785a99304c3065bd5ab46458a5e094d1305`, MD5 `ec5e6bfb4e89e845c26ab0cd00c36fb6` and byte length. The local filename's generated version differs from the assigned live version; both are recorded intentionally in the migration ledger.

## Read-only verification

- Authenticated created_at UPDATE denied; table-wide UPDATE denied; direct revision-function EXECUTE denied. Legal column grants remain installed.
- 24 effective table privileges, 120 column privileges and six function privileges match the target for anon/authenticated/service_role.
- Four authenticated policies match expected commands and actor/owned-parent predicates; UPDATE has USING and WITH CHECK.
- Both function bodies match the reviewed source, with postgres ownership, SECURITY INVOKER and empty search_path. Revision preserves OLD.created_at and server version/time/marker rules.
- Column fingerprint, existing revision-trigger fingerprint, table owner/RLS metadata, parent key and all twelve enabled internal RI actions remain equal to the verified baseline.
- Nine validated constraints read back. Both content CHECKs were re-added/validated by the migration, rather than changing only a helper. Full JS25 whitespace constant was explicitly confirmed through catalog UTF8 hex; raw Unicode rendering was not used to judge the four trailing whitespace characters.
- Generated read-only helper probes: 500 ordinary words accepted; 501 FEFF-separated words rejected. No note/page/account business row was inserted, updated, deleted or returned by verification.

Evidence: project-at-dispatch.json, apply-result.json, quick-readback.json, catalog-after.json, stored-sql-sha256.json and nonempty-utf8-readback.json. The first local readback parser encountered the explanatory untrusted-data marker; the same already-received result was reparsed without reapplying or changing the database. Optional advisor/metadata timeouts above do not establish lint success. The advisor was not rerun after its baseline timeout; no advisor PASS or broader project acceptance is claimed.

## Exact stop boundary and remaining limits

**Stop after application/readback, as instructed.** All four source gates are still false; gateway SHA256 unchanged at `B8744B2D73B83278EE125CFAB0F3789EA887EB2F57E98B8AFA07EBDDCAACC37E`. No connected create/edit/delete/cleanup, account switch, response-loss, browser or native test was run. The preceding 34/34 local SQL proof remains historical and was not rerun for this application-only unit. No business-row preservation fingerprint or real API/native acceptance is claimed.

External mutation: only the reviewed transactional schema/function/policy/grant correction and its migration-ledger record on the verified shared project. The SQL contains no business-row DML/backfill and adds no column/history/recovery system. Existing creation timestamps are not reconstructed. No Storage/provider/account mutation, application source edit, dependency installation, staging, commit, push or deployment. Existing mixed worktree changes preserved; index empty.

The SDD/plans, Library/phase/implementation trackers, current-vs-target audit, dictionary, DOC-13 overlay and migration ledger record the completed stage. Closeout PASS: Phase9 continuity (195 definitions, zero duplicate/missing traceability, regression probes PASS, 76 Markdown/55 required files), all 410 relative links across thirteen owning documents, tracked/scoped whitespace, unchanged SQL/harness/gateway hashes, exact stored/local SHA256, four false gates and empty index. Raw results: documentation-checks.txt and closeout-checks.txt. Existing size/line-ending notices remain advisory. No further work is authorized: connected API testing/cleanup, enabling saving and release verification require a new scoped owner instruction. Marketplace Phase9 Unit7C/M46 and ACTIVE routing remain unchanged.
