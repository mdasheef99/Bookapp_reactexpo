# SDD-06 local correction preflight — 2026-10-11

## Authority and scope

The owner authorized targeted Library documentation corrections, fresh forward-migration files, focused database fixtures/tests, and isolated synthetic PostgreSQL verification. Shared-project application, connected test writes, Storage/account changes, app-write-gate changes, app/OCR work and Git publication remain outside scope. This preflight performed read-only Supabase queries, a small SDD wording correction and one local PostgreSQL regression addition.

Repository: `C:/Users/LEGION/Desktop/Bookconnect4_library`, branch `codex/library-cover-shelf`, HEAD `1b743a13328ec30280a524aaeea15e364fc3d6c5`. The tree already had extensive user changes and no staged changes. Nothing was staged or committed.

Marketplace continuity remains Phase 9, Unit 7C/M43–M46 complete; its next work unit still needs separate authorization. This Library work does not change DOC-13 or the marketplace handoff.

## Fresh live evidence

Before metadata queries, Supabase MCP `get_project` reverified ref `ahntbtktjjmvfosgkmgn`, project `Bookconnect_reactexpo`, `ACTIVE_HEALTHY`, region `ap-southeast-2`, PostgreSQL `17.6.1.063`. Both the Library and sibling Clubs trackers were read before migration preparation.

Fresh read-only `list_migrations` plus `SELECT` queries confirmed the last Library migration as `20261010221843 library_manual_note_persistence`; `supabase_migrations.schema_migrations` contains one stored SQL statement. MD5 of that stored statement is `d187c32b7b0846e735d6696adff6a7ed`, matching the prior live receipt. No migration was applied or repaired.

Current catalog summary:

- `reading_notes`: ten columns; `tag` nullable; values quote/reflect/distill/apply/question; `page_number` nullable; `version` non-null default 1; nullable `last_operation_id`; five indexes; nine validated constraints.
- Constraints retain nonempty and <=500-word content, nullable positive page, optional five-category tag, positive version, UUID key, Auth/user-book FKs and the composite `(user_book_id,user_id)` ownership FK. Parent `(id,user_id)` has a unique key.
- RLS is enabled (not forced) on both `reading_notes` and `user_books`. Four permissive note policies target `PUBLIC` and require `auth.uid() = user_id` plus a matching parent owned by `auth.uid()`; UPDATE has both `USING` and `WITH CHECK`.
- Effective note table privileges: `anon` none; `authenticated` SELECT/INSERT/UPDATE/DELETE; no authenticated TRUNCATE/REFERENCES/TRIGGER. INSERT/UPDATE remain table-wide.
- One enabled BEFORE INSERT/UPDATE revision trigger calls a PostgreSQL-owned PL/pgSQL SECURITY INVOKER function with empty `search_path`. Insert sets version 1, clears operation marker and assigns server times. Update increments version and sets `updated_at`, clears the marker when the submitted marker is unchanged, and rejects identity changes; it leaves `created_at` supplied by the updater. Function execution remains default PUBLIC/role-executable.
- The word-limit helper remains the expected immutable SQL function with `search_path=public`, and its writer execution grants remain effective.
- Metadata-only aggregate query: 2 notes; 0 missing parents; 0 owner mismatches; 0 null/invalid tags; 0 invalid pages; 0 null timestamps. No note body, row identifier or account identity was fetched. These counts do not establish timestamp authenticity.

The fresh catalog matches the earlier live snapshot and differs from the local reviewed candidate and target in the same material ways: creator timestamp is not pinned on update, authenticated writes have broad table grants, policies target PUBLIC, and the revision function keeps default execute grants. The local `20261010172118_library_manual_note_persistence.sql` remains an unapplied, unmigrated-baseline artifact and must not be replayed. Existing immutable applied-SQL evidence remains at [live-migration.json](./live-migration.json); the candidate hash and detailed correction target remain in the [forward plan](../../MANUAL-NOTE-FORWARD-CORRECTION-PLAN.md).

## Local runtime and CLI preflight

The previously identified isolated PostgreSQL runtime still exists at:

`C:/Users/LEGION/AppData/Local/Temp/bookconnect-primary-venue-tools-20261007/node_modules/@embedded-postgres/windows-x64/native/bin`

It contains `initdb.exe`, `postgres.exe` and `pg_ctl.exe`; `postgres.exe --version` returns PostgreSQL 17.6. Node is v22.11.0. Existing Node modules are at `C:/Users/LEGION/AppData/Local/Temp/bookconnect-primary-venue-tools-20261007/node_modules`; `pg` is 8.23.1 and `embedded-postgres` is 17.6.0-beta.15. The harness binds only `127.0.0.1`, uses synthetic records, rejects non-prefixed cleanup targets, and accepts no remote connection string. Its original suite applies the old candidate to an unmigrated projected baseline. A new isolated database test now applies the exact stored SQL snapshot for `20261010221843` and reproduces the live metadata defect.

No Supabase CLI executable was found on PATH, in common Windows install locations, in repository `node_modules/.bin`, as a local `@supabase/cli` package, or in the local npm CLI cache. Therefore no installed command help could be inspected and no filename was generated. This task forbids dependency installation; the official CLI contract requires `supabase migration new <name>` to create the timestamped file ([CLI reference](https://supabase.com/docs/reference/cli/global-flags), [environment/migration guide](https://supabase.com/docs/guides/deployment/managing-environments)). I did not invent a filename or write an executable migration by hand.

## Verification actually run

PostgreSQL:

```powershell
$env:LIBRARY_PG_BIN='C:\Users\LEGION\AppData\Local\Temp\bookconnect-primary-venue-tools-20261007\node_modules\@embedded-postgres\windows-x64\native\bin'
$env:LIBRARY_PG_TOOLS_NODE_MODULES='C:\Users\LEGION\AppData\Local\Temp\bookconnect-primary-venue-tools-20261007\node_modules'
node --test supabase/tests/library/manualNotePersistence.postgres.test.mjs
```

Result: **17/17 passed** against PostgreSQL 17.6. The suite includes sixteen existing tests of the old candidate on its projected baseline plus one new, separate database that applies the hash-checked live SQL snapshot. That live-variant test shows an authenticated synthetic owner can persist `created_at = 2000-01-01`; the same update increments version and still server-controls `updated_at`. This proves the pre-correction defect, not a fix. The initial sandboxed runner attempt failed with `spawn EPERM` before test setup; retrying the authorized loopback test with child-process launch permission passed. The harness stopped PostgreSQL and removed its exact prefix-checked temporary cluster.

Client regressions:

```text
node node_modules/jest/bin/jest.js --runInBand --no-cache --runTestsByPath "src/components/notes/__tests__/ManualNoteJourney.test.tsx" "src/features/books/notes/__tests__/noteNavigation.test.tsx" "src/components/notes/__tests__/ManualNoteFlow.test.tsx" "src/features/books/notes/__tests__/manualNotes.test.ts" "src/features/books/notes/__tests__/manualNotesGateway.test.ts" "src/features/books/services/__tests__/notesService.test.ts" "src/components/notes/__tests__/NoteEditor.ocr.test.tsx" "src/features/books/services/__tests__/userBookPagesService.test.ts" "src/features/books/notes/__tests__/composerBrowserHistory.test.ts" "src/features/books/notes/__tests__/manualNotePersistenceAdapter.test.ts" "src/features/books/notes/__tests__/manualNoteDeleteGate.test.ts"
```

Result: 11/11 suites, 142/142 tests passed; existing Node `punycode` and React Native Clipboard deprecation warnings only.

Additional checks:

- `node node_modules/typescript/bin/tsc -p tsconfig.library-notes.json --noEmit --pretty false` → exit 0.
- `powershell.exe -NoProfile -ExecutionPolicy Bypass -File 'docs/multi-tenant-bookstore-marketplace/implementation/phase-9-image-inventory/scripts/validate-phase9-continuity.ps1'` → PASS, 195 definitions, 0 duplicates/missing traceability, probes PASS, 76 Markdown files.
- Read-only local Markdown-link scanner across SDD-06, Library TRACKER, the correction plan and this receipt → 108 links, 0 unresolved.
- `git diff --check` → exit 0 with existing LF/CRLF notices only.

## Completed and outstanding

Completed: SDD-06 live-state wording was corrected to distinguish the historical pre-migration snapshot from the fresh current catalog. Optional categories, no-category behavior, positive optional pages, recovery decisions, existing Saved Pages and deferred OCR behavior were preserved. The forward correction plan remains accurate against the fresh baseline. A synthetic PostgreSQL pre-correction regression now reproduces the creator-timestamp defect using the exact applied SQL.

Not completed: No new migration was created because the mandatory Supabase CLI migration-creation command is unavailable and dependency installation is excluded. New executable migrations: **0**; per-migration line count/purpose and splitting decision are not applicable because no file was generated. The planned grant, policy and trigger changes share one notes authorization/integrity boundary, so the proposal treats them as one atomic migration; reassess cohesion at 400–500 lines, and split only if each intermediate authorization state can be proven safe. The harness has no corrected migration to apply; post-correction grants, trigger execution after revocation, data preservation through correction, rollback, lock timeout and full concurrency/compatibility guarantees remain unverified.

Exact next action: make an already-installed Supabase CLI executable available to this worktree. Then inspect its `migration new --help`, create one fresh migration, and complete the synthetic applied-variant, rollback, concurrency, lock-timeout and privilege/trigger acceptance suite. Do not apply it remotely or enable app gates.

Shared Supabase/Storage/account mutation: none. No note content was read. No dependency was installed. Only the PostgreSQL harness's temporary loopback cluster and synthetic rows were created; the harness removed the prefix-checked temp directory. No file was staged or committed.
