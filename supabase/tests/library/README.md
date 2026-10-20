# Disposable manual-note persistence verification

This harness creates a fresh PostgreSQL 17 cluster on `127.0.0.1` at an ephemeral port, loads synthetic actors/books/notes, applies the candidate migration, then stops and removes that exact cluster. It accepts no remote database URL or credentials. It never connects to the shared Supabase project.

Use an existing PostgreSQL 17 installation with `initdb`, `postgres` and `pg_ctl`, plus an existing Node `pg` module. Set the paths to those installations; do not install dependencies or start a shared database as part of this test.

```powershell
$env:LIBRARY_PG_BIN = '<existing PostgreSQL 17 bin directory>'
$env:LIBRARY_PG_TOOLS_NODE_MODULES = '<existing tools node_modules directory containing pg>'
node --test supabase/tests/library/manualNotePersistence.postgres.test.mjs
```

The baseline combines the two existing reading_notes migrations with a minimal projection of the freshly verified parent tables, Auth roles/UID helper, broad grants and word-limit helper. It exercises actual PostgreSQL SQL/RLS/constraints/triggers and independent connections, rather than a SQL parser or mocked database. It is not a replay of the entire shared-project migration history or a real Auth/PostgREST service.

The second writer must actually wait on a PostgreSQL lock before the first commits. The tests also cover category/null round trips, constraints, privilege denial, foreign actors/books, metadata spoofing, legacy updates, stable create identity, cascades and atomic precondition failure. Independent isolated databases test word-helper body/volatility/search_path/security drift and same-name policy predicate/role/command/check drift, including rollback and preservation of the existing policies. The projected word helper matches the fresh receipt exactly; the owner-precondition test does not substitute a different helper. Candidate application here is disposable local DDL, not authority to apply it remotely or enable application saving.

Recorded evidence and limits: [local receipt](../../../docs/user/library/evidence/sdd06-persistence-local-2026-10-10/README.md).
