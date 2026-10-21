# Manual-note persistence preflight — 2026-10-10

Status: read-only audit and proposal complete; no migration created or applied.
Work unit: library_sdd06_persistence_preflight_complete_proposal_pending.

## Authority and workspace

Owner: “ok sure please proceed.” The turn's stated scope was read-only backend preflight, migration proposal and tracker reconciliation. Migration creation/application, application corrections, test-record writes, gate enablement and Git publication were excluded.

Repository: C:/Users/LEGION/Desktop/Bookconnect4_library.
Branch: codex/library-cover-shelf.
HEAD: 1b743a13328ec30280a524aaeea15e364fc3d6c5.
Existing modified/untracked Library work was preserved; index was empty at preflight.
Marketplace Phase 9 Unit7C/M46 and DOC-13/ACTIVE routing remain unchanged.

Read root AGENTS, ACTIVE, DOC-13, Phase9 session protocol/current tracker/master, current Library SDD/correction evidence and relevant source. Read the sibling Clubs tracker at C:/Users/LEGION/Desktop/Bookconnect4_expo/docs/user/clubs/TRACKER.md without editing that worktree. Its dated handoff is not fresh schema authority.

## Fresh evidence

Supabase MCP get_project verified ahntbtktjjmvfosgkmgn / Bookconnect_reactexpo, ACTIVE_HEALTHY, ap-southeast-2, PostgreSQL 17.6.1.063. Three SELECT-only queries collected notes/user_books metadata and aggregate integrity plus synthetic word-limit results. list_migrations and security/performance advisors were also read.

- [Catalog and relevant advisor snapshot](./CATALOG.json): no note content, record IDs, account IDs or credentials.
- [Exact SELECT queries](./QUERIES.md): catalog-only for first two; aggregate owner/FK/timestamp counts and synthetic text in the third.
- [Proposed target/data dictionary/security verification matrix](../../MANUAL-NOTE-PERSISTENCE-PLAN.md): proposed schema, grants, atomic save, reconciliation limitations and test requirements.
- [Current SDD](../../SDD-06-after-book-entry-ui.md): behavior authority.

Current notes table is still four-category/non-null, with no version/operation marker or noninternal maintenance trigger. Actor-only notes RLS and single-column book FK leave book-owner binding unproved. Effective anon/authenticated privileges include TRUNCATE/TRIGGER/REFERENCES/MAINTAIN. A missing explicit UPDATE WITH CHECK is not itself an ownership bypass: PostgreSQL uses the USING expression.

Aggregate: 2 notes; 0 missing referenced books; 0 note/book-owner mismatches; 0 null note timestamps. Existing content/page/500-word constraints are preserved in the proposal. SELECT probes returned true for 500 words, false for 501 and mixed-whitespace 501; the blank helper result is true, independently constrained by nonempty content.

Live ledger has 176 entries. Relevant last Library entries remain 20260820034004 reading_notes_fk_and_cleanup, 20260820064258 library_user_book_pages_vault and 20260820071215 library_word_limit_hardening. Latest shared entry is 20261010110835 marketplace_phase9_edition_picker_selection_eligibility. This evidence does not advance this checkout's marketplace tracker or authorize replay of unrelated migrations.

Advisor response was filtered to the two relevant tables before retaining it. No table-specific security lint was returned; this is not a security acceptance result. Performance recommendations: auth_rls_initplan on eight policies, unused idx_reading_notes_tag, unindexed user_books_book_id_fkey. Preserve indexes in this unit. Remediation links: [RLS initplan](https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan), [unused index](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index), [unindexed FK](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys).

## Source findings and limits

The four MANUAL_NOTE_WRITE_GATES remain false. New manual gateway has stable create IDs, a conditional versioned UPDATE scaffold and read-only reconciliation; its missing live columns prevent enabling edits. Zero-row edit currently always produces conflict after a successful latest read; future code must recognize an exact previously-applied operation without another write. Returned version/identity decoding and legacy Question/null consumers need verification.

The retained four-category notesService updater is ID-only, so a server increment alone would not make every legacy client conflict-safe. NoteCard handles Question/null through the current manual category helper. No active JSX NoteEditor call was found in the bounded app/books/notes search; its exported/internal compatibility remains a test requirement.

Locally installed supabase-js version is 2.89.0 (package metadata read only), below the documented 2.102.0 GET/HEAD retry feature. No dependency upgrade was made.

The browser checkpoint is promoted from the latest correction receipt: refreshed 8083 Chromium/Navigation API Back/Keep/Discard/Forward verified after stale Metro restart. Original stale-bundle failure is preserved. Historical 109/109 focused tests, Edge regressions, TypeScript/export and browser observations were not repeated by this preflight. Unsupported browsers, toolbar zoom, native visual/accessibility, real persistence and role/race tests remain NOT_RUN.

## Closeout and next action

Only documentation/evidence files changed in this turn. No SQL migration file, app edit, gate enablement, DDL, business-row or Storage write, dependency install, browser/Stitch action, staging, commit, push or deployment occurred.

Exact next proposed action: owner reviews the concrete plan and separately authorizes one Library migration file, disposable database verification harness and bounded adapter/compatibility corrections, with gates remaining false. Live application and shared-project test-record writes remain separate authority boundaries. Do not start OCR before manual acceptance.

Documentation validation results are recorded below after execution.

### Verification actually run

- Phase9 continuity validator PASS: 195 definitions, zero duplicates/missing traceability, validator regression probes PASS, 76 phase Markdown files checked.
- Scoped local-link check PASS: 250 references across the 12 changed Markdown documents; percent-encoded local routes decoded before filesystem checks.
- SDD page inventory PASS: 16 unique B01–B16 contracts; no contract removed.
- New proposal/evidence whitespace and catalog JSON parse/scope checks PASS.
- Repository git diff --check PASS; cached name listing empty. No staging/publication occurred.
- SDD is 484 lines and remains cohesive; long existing Phase9 logs/dictionaries retain their semantic history. Validator size warnings remain advisory.
- Initial ad hoc checker mishandled percent-encoded route links and Windows default text decoding; corrected checker passed without product/document changes for those false alarms.
- No app test suite, TypeScript build, export, new browser check, native acceptance, DB race/role-denial or persistence round trip run in this documentation-only unit. Historical test/browser receipts remain separate.

