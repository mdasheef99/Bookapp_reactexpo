# SDD-06 reported-session independent read-only review

Subsequent correction: [delete-test corrections and forward plan](./DELETE-CORRECTIONS.md) now pass 142/142 focused tests with all gates false. This original read-only review and its RED results remain history; the actual live SQL differences are still pending correction.

Date: 2026-10-11 (Asia/Calcutta)
Work unit: `library_sdd06_live_variant_review_blocked`
Scope: review the owner-pasted session account against repository source, the exact live project and focused regressions. No product correction, migration creation/application, live test write, gate enablement or Git publication was authorized or performed by this review.

## Verdict

Keep all four note-write gates false. The live database has the category/version/ownership foundation, but it is not the exact independently reviewed migration. The new delete gate is present and its negative tests pass; three previously passing mounted deletion regressions now fail. “Only flip the four gates” is not supported by the existing release contract or this evidence.

## Source and live identity

- Workspace: C:/Users/LEGION/Desktop/Bookconnect4_library.
- Branch: codex/library-cover-shelf; HEAD: 1b743a13328ec30280a524aaeea15e364fc3d6c5. Existing modified/untracked work was preserved.
- Fresh Supabase MCP get_project: ahntbtktjjmvfosgkmgn / Bookconnect_reactexpo; ACTIVE_HEALTHY; ap-southeast-2; PostgreSQL 17.6.1.063.
- Owner reports a different session applied the migration. This review independently verified the live ledger and catalog with READ ONLY transactions; it did not verify that session's original authorization or execution transcript.
- Live ledger: 20261010221843, name library_manual_note_persistence, one stored SQL statement, MD5 d187c32b7b0846e735d6696adff6a7ed as returned by PostgreSQL over array_to_string(statements, newline).
- Local reviewed file: [20261010172118_library_manual_note_persistence.sql](../../../../../supabase/migrations/20261010172118_library_manual_note_persistence.sql); SHA256 eadd4d8a16d87801735ec59a101a95732a59e64e9902a576000b5cf0aafb291d, unchanged.
- [Stored applied SQL](./live-migration.json) and [catalog readback](./live-readback.json) preserve the actual evidence. The SQL snapshot is documentation, not an executable migration proposal. The different live timestamp alone is normal MCP behavior; substantive SQL differences establish the mismatch.

## Confirmed foundation

reading_notes.tag is nullable and its CHECK allows quote/reflect/distill/apply/question. version is non-null integer default 1 with a positive CHECK; last_operation_id is nullable UUID. The validated composite book-owner FK and parent unique key exist. RLS is enabled, all four policies include actor and owned-parent checks, and the revision trigger is enabled and SECURITY INVOKER with an empty search_path.

Aggregate integrity: two notes, zero missing parents, zero note/book-owner mismatches. No note body, note identity, account identity or credential was read. This does not establish content preservation, a real application round trip, concurrency acceptance or user-visible release acceptance.

## Findings and ordered corrections

1. **P1 — Deployed SQL differs from the reviewed privilege/metadata contract.** The applied SQL grants authenticated table-wide INSERT and UPDATE. Fresh effective-privilege reads confirm UPDATE on created_at, version and identity columns. Its trigger overwrites version/updated_at and rejects identity changes, but does not restore OLD.created_at on UPDATE. Consequently the SQL contract permits an owner to change creation metadata; no live exploit or write was attempted. The reviewed candidate has narrow column grants and explicitly preserves created_at. Live policies target PUBLIC rather than authenticated and the trigger function retains effective EXECUTE for anon/authenticated, unlike the candidate. These last differences are contract drift, not proof of cross-account exposure; current ownership policies/FK and anonymous table denial remain present. Do not reuse the candidate's disposable 16/16 result as acceptance for this different applied artifact.
2. **P2 — The delete-gating change leaves the mounted regression suite red.** The new adapter checks ownedBookWrites before any dispatch and the reader disables Delete while false. Both new negative tests pass. Existing deletion tests still exercise that now-disabled production path without an explicit test authorization boundary: confirmation/cache/late-result scenarios cannot run. Preserve the new negative proof and restore a deliberately authorized simulated delete path in the fixtures; do not reopen production gates, remove assertions or skip the regressions. Add allowed-path coverage as appropriate.
3. **Release gate — Real Auth/PostgREST and manual acceptance remain unproved.** The [persistence matrix](../../MANUAL-NOTE-PERSISTENCE-PLAN.md#6-verification-before-any-write-gate-opens) still requires five/null round trips, versioned edits/stale replacements, stable-create reconciliation including ambiguous outcomes, ownership/privilege denials and native manual acceptance. Schema readback and local mocks alone cannot close those gates.
4. **Continuity — Previous “unapplied/authorize original application” pointers are stale.** This receipt and the owning trackers/audit/ledger now distinguish the exact local candidate from the different live variant. Preserve both artifacts. The old candidate expects an unmigrated baseline and must not be replayed onto this database. Any repair must be a separately authorized, reviewed forward correction against the actual live state.

Exact next action: owner reviews these findings and authorizes a bounded local delete-test correction plus a forward-correction plan; migration-file creation, shared application, connected synthetic test writes/cleanup and enablement remain separately scoped. No new broad design cycle or OCR work is needed to address these findings.

## Verification actually run

| Check | Result |
|---|---|
| New delete-gate tests | 2/2 PASS; supabase.from never called while gated |
| Initial mounted journey + new gate run | 19 passed, 3 failed / 22 |
| Full previously focused scope plus new suite | 133 passed, 3 failed / 136; 10 passing suites, one failing suite |
| Scoped Library TypeScript | PASS |
| Fresh MCP project/catalog/ledger/effective privileges | Read-only verified as described above |
| Security advisors | No reading_notes/user_books/library revision-specific finding returned; unrelated shared-project notices remain. Advisor silence is not security acceptance |

The three reproducible failures in [ManualNoteJourney.test.tsx](../../../../../src/components/notes/__tests__/ManualNoteJourney.test.tsx:125):
- refreshes the real collection cache after confirmed simulated reader deletion;
- clears deleted note data and controls in retained readers without replaying its old confirmation;
- keeps deleted data absent after a cancelled stale read and a late save confirmation.

No fresh web export, browser journey, emulator/native acceptance, real PostgREST save/denial/race test or disposable SQL suite was run in this review. Earlier 134/134 and 16/16 outputs retain their historical source/artifact scope.

## OpenCode account caveat

OpenCode executable version 1.18.21 was verified. Current OpenCode Go metadata lists Muse Spark 1.3 variants minimal/low/medium/high/xhigh; Space Bunny lists low/medium/high/xhigh/max. The reported Muse max and Space Bunny minimal runs do not establish those efforts merely by succeeding; provider request evidence would be needed. This review ran no model prompt and did not independently verify the benchmark research, skill patch, emulator session or previous browser-export claims.

## Closeout

Documentation-only evidence/handoff updates; all app code, four false gates and local migration bytes unchanged. No shared database/Storage mutation, staging, commit, push, deployment or new product implementation. Marketplace Unit7C/M46, DOC-13/ACTIVE and the global handoff remain unchanged.

Closeout verification: Phase9 continuity PASS (195 definitions, no duplicates/missing traceability, regression probes PASS, 76 Markdown files); repository git diff --check PASS; index empty; local candidate SHA256 unchanged. All 256 local links across eight reviewed handoff documents resolve; B01–B16 contracts remain 16/16; JSON evidence parses. SDD-06 remains cohesive at 491 lines; existing phase log/dictionary size notices are advisory and no required material was removed. Focused client tests remain 133 PASS / 3 FAIL, not a green acceptance claim. All review changes are local and uncommitted.

