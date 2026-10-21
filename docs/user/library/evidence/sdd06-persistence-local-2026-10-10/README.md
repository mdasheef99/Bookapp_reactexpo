# Manual-note persistence candidate — local preparation and review

Date: 2026-10-10 (Asia/Calcutta)
Work unit: `library_sdd06_persistence_luna_review_corrected_live_gated` (review/correction closeout 2026-10-11)
Behavior authority: SDD-06 revision 0.4 baseline, with recorded local corrections; no new product choice.

## Authorization and scope

Owner: “sure please proceed,” responding to the concrete proposal to create one migration file, disposable backend tests and necessary adapter/legacy compatibility corrections. The subsequent instruction explicitly requested GPT-6 Luna/max review, confirmation of findings and necessary corrections. Creation, synthetic local verification, independent review and bounded local guard corrections are authorized. Shared-project application/test writes, write-gate enablement and Git publication are excluded.

Workspace: C:/Users/LEGION/Desktop/Bookconnect4_library; branch codex/library-cover-shelf; HEAD 1b743a13328ec30280a524aaeea15e364fc3d6c5. Existing mixed Library changes are preserved. The sibling Clubs tracker was inspected without editing that tree. Marketplace Phase9 Unit7C/M46, DOC-13 and ACTIVE remain unchanged.

Fresh Supabase MCP get_project verified ahntbtktjjmvfosgkmgn / Bookconnect_reactexpo, ACTIVE_HEALTHY, ap-southeast-2, PostgreSQL 17.6.1.063. Catalog/security SELECTs and migration listing reconfirmed the preflight baseline: four non-null categories, no version/marker or noninternal trigger, existing actor policies and broad grants. The 176-entry ledger ends at 20261010110835 marketplace_phase9_edition_picker_selection_eligibility. No live note bodies, identities or credentials were retained. [Fresh catalog](./CATALOG.json), [security readback](./SECURITY.json) and [prior exact query receipt](../sdd06-persistence-preflight-2026-10-10/QUERIES.md) are read-only evidence. Earlier aggregate counts are not represented as a new round-trip or denial test.

## Deliverables

- [Candidate migration](../../../../../supabase/migrations/20261010172118_library_manual_note_persistence.sql), created using cached Supabase CLI 2.116.0 `migration new`. The process-only telemetry opt-out prevented an unrelated configuration write; no dependency or global preference change occurred. Application status/filename/hash/effects are recorded in the active [migration ledger](../../../../multi-tenant-bookstore-marketplace/implementation/phase-9-image-inventory/trackers/02-implementation-and-verification.md#migration-ledger).
- [Real PostgreSQL harness](../../../../../supabase/tests/library/manualNotePersistence.postgres.test.mjs) and [baseline/usage](../../../../../supabase/tests/library/README.md): unique disposable PostgreSQL 17.6 loopback cluster, synthetic fixtures, verified cleanup. No remote URL input. Native execution required the sandbox escalation reviewer; it approved this already-authorized local test. No automatic approval rejection remained.
- [Manual adapter](../../../../../src/features/books/notes/manualNotesGateway.ts): exact returned identity/payload/server metadata validation, zero-row already-applied edit confirmation, actual compared-version predicate, read-only reconciliation and late account/abort rejection. Test gates are injectable through a factory; the production instance still receives the unchanged four false gates.
- Retained notesService/NoteEditor/TagSelector now preserve Question and null categories. No category remapping, data backfill, OCR integration or UI expansion.

The migration preserves legacy rows/content/page/500-word checks and Saved Pages. It adds nullable five-category storage, server revision/marker metadata, a composite book-owner FK, owned-book policies and restricted authenticated columns. Baseline constraint definitions, word-helper body/execution attributes/effective writer EXECUTE, trigger inventory, complete old policy semantics, RLS and owner integrity are preconditions; unexpected checked catalog/data state aborts rather than being repaired silently. Luna found that the original helper and policy checks were incomplete; [review/correction evidence](./LUNA-REVIEW.md) records confirmation, RED regressions and the bounded fix. Every update invalidates stale versions; unmarked/no-op legacy updates clear old operation markers. Identity changes are rejected even for privileged writers.

## Verification and evidence limits

| Check | Result and scope |
|---|---|
| Initial empty candidate | RED: tag remained NOT NULL; intentional upgrade assertion failed |
| Initial adapter regressions | RED: six of twelve original cases failed for already-applied/malformed/wrong-identity/late-account evidence |
| Retained editor regressions | RED: both Question/null cases crashed on missing tag configuration; the corrected test uses the existing Save control |
| Original disposable PostgreSQL checkpoint | PASS 14/14; [original output](./postgres-tests.txt). Real independent-connection lock race, authenticated/anonymous denials, five/null CRUD, constraints, metadata/marker/legacy behavior, create identity, cascades, owner/catalog precondition rollback |
| Independent review and guard corrections | Three P2 guard defects confirmed and fixed. Both original regression groups and the later ACL case were RED before correction. Final PostgreSQL PASS 16/16 including ten drift variants; Luna independently confirmed all fixes and reran both final groups. [Review](./LUNA-REVIEW.md), [initial RED](./review-regressions-red.txt), [ACL RED](./helper-acl-red.txt), [final GREEN](./final-review-postgres-tests.txt). Luna also reran 134/134 client tests and scoped TypeScript on unchanged app code |
| Bounded client rerun | PASS 57/57 across four affected suites; scoped Library TypeScript PASS |
| Full focused client regression | PASS 134/134 across ten suites; [complete output](./client-tests.txt). Services/transport/OS effects are simulated; mounted QueryClient/StackRouter tests exercise actual local state |
| Web export | PASS: single-worker Expo web export, 2,351 modules and 5.52 MB entry bundle; [build output](./web-export.txt). No deployment or fresh live-app/native acceptance |
| Continuity | PASS: 195 definitions, zero duplicates/missing traceability, regression probes PASS, 76 Markdown files; [output](./continuity.txt) |
| Links / page contracts / gates / whitespace | PASS: 272 local links across 12 documents, B01–B16 16/16, four false gates, ledger hash matches, 24 scoped whole-file whitespace checks and repository diff check; [output](./document-checks.txt). Four whitespace-bearing unrelated files from an over-broad whole-file scan were preserved |

The database baseline is a minimal catalog projection plus existing notes migrations, not the complete 176-migration shared environment. auth.uid uses synthetic JWT settings; SQL-role tests do not prove real Auth/PostgREST or production inherited-role behavior. The adapter uses mocked Supabase transport, including simulated committed-response loss; no real network-loss injection or shared account round trip is claimed.

Current-row operation markers are not durable receipts. Later edits/deletion may erase confirmation evidence. Unknown operations remain unresolved rather than being replayed or recreating deleted notes. In-memory recovery is not durable draft recovery.

Environment limitations were resolved without installing dependencies: cached CLI used after an offline npx cache miss; child-spawn restrictions required authorized native-test escalation, while the documentation check moved Git reads to the shell. Build warnings concern old Browserslist data and existing Tailwind rules; Jest reports existing Clipboard/punycode deprecations. No warning was treated as a native, accessibility or persistence PASS.

Documentation cohesion assessed: SDD-06 remains one connected behavior/acceptance contract. Long Phase9 trackers/audit/dictionary retain dated evidence and stable authority; size notices are advisory, and no required contract or evidence was pruned or split for a line target. Current Library/Phase9 pointers, SDD revision 0.12, bounded persistence/security matrix, dictionary/audit, category rollout and active migration ledger record the independent review and corrected candidate hash. DOC-13/ACTIVE global routing/status did not change. Original verification outputs above remain history; final review closeout checks are linked below.

The retained exported legacy updater remains ID-only. Server increments invalidate stale manual versions, but do not make that updater CAS-safe. The active after-book-entry editor uses the versioned manual boundary; consumer/integration verification remains a release gate. No generated reading_notes database type was found in this bounded source inventory; the shared ReadingNote/manual contract types now carry nullable categories and revision metadata.

Native visual/keyboard/Android Back/TalkBack/large-text acceptance, real PostgREST response decoding, response-loss reconciliation, effective live ACLs/ownership denial, production readback and gate enablement remain pending. Historical refreshed 8083 Chromium/browser evidence remains scoped to its original receipt and was not rerun here. SDD06-04/manual release is not accepted; OCR remains unstarted in this slice.

## Exact next action and state

Independent review: the owner requested GPT-6 Luna at maximum reasoning. The first attempt ended at a usage limit before findings; the same requested reviewer later completed the source/SQL/security/concurrency/transport/compatibility/evidence review. Three P2 catalog-guard findings were confirmed, corrected locally and independently confirmed fixed at the final hash. The [review receipt](./LUNA-REVIEW.md) records the full verdict, checkpoint history and tests. No correction was inferred from the initial failed attempt.

Exact next action: owner authorization for the exact-project application/readback unit using this reviewed candidate (SHA256 eadd4d8a16d87801735ec59a101a95732a59e64e9902a576000b5cf0aafb291d). Reverify project, catalog, integrity and shared ledger immediately before that application; never blanket-push this checkout's unrelated migrations. Connected test-record writes and gate enablement remain separately scoped.

All four production write gates remain false. Local disposable DDL/DML occurred only in automatically removed test clusters. Shared-project/database/Storage/provider mutations: none. No staging, commit, push or deployment; changes remain local and uncommitted.

## Review closeout verification — 2026-10-11

Final review-time continuity: PASS, 195 requirement definitions, zero duplicates/missing traceability, regression probes PASS and 76 Phase9 Markdown files checked; [output](./review-continuity.txt). Existing size notices are advisory. SDD-06 and the dated historical trackers remain cohesive; no required material was pruned or split for a line target.

Final scoped links, page contracts, gate/hash/whitespace/cleanup and publication-state checks are recorded in [review document checks](./review-document-checks.txt). App/compiler/browser/export results retain their original checkpoint and reviewer-run scope; no fresh native or transport acceptance is inferred.
